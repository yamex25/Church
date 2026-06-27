import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, Church, UserRole } from '@/src/types';
import { resolveModules, resolveSubscriptionModules, DEFAULT_PLAN_MODULES } from '@/src/lib/permissions';
import { auth, db } from '@/src/lib/firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { verifyTOTP } from '@/src/lib/totp';
import { churchRef, userDoc } from '@/src/lib/db';

interface AuthContextType {
  user: AppUser | null;
  church: Church | null;
  churchId: string | null;
  loading: boolean;
  needsChurchSetup: boolean;

  // Role helpers (true if user holds that role OR a higher one)
  isSuperAdmin: boolean;
  isAdmin: boolean;        // SUPER_ADMIN | ADMIN
  isDeptHead: boolean;     // SUPER_ADMIN | ADMIN | DEPARTMENT_HEAD
  isMember: boolean;       // any authenticated user with a church

  // Employee-derived flags
  isAccountant: boolean;
  employeeDepartment: string | null;

  // Module-level permissions (Odoo-style)
  allowedModules: Set<string>;
  hasModule: (moduleId: string) => boolean;

  // Action-level permissions (e.g. 'members:create', 'members:disable')
  hasAction: (action: string) => boolean;

  // Platform Owner — sees all churches, above all church roles
  isPlatformOwner: boolean;

  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  signUpWithEmail: (displayName: string, username: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;

  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
  verifyTwoFactor: (code: string) => Promise<boolean>;
  enableTwoFactor: (secret: string) => Promise<void>;
  disableTwoFactor: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsChurchSetup, setNeedsChurchSetup] = useState(false);
  const [isAccountant, setIsAccountant] = useState(false);
  const [employeeDepartment, setEmployeeDepartment] = useState<string | null>(null);
  const [allowedModules, setAllowedModules] = useState<Set<string>>(new Set());
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorVerified, setTwoFactorVerified] = useState(false);

  // Hardcoded Platform Owner email — this is the SaaS system owner.
  // This person NEVER goes through church setup and always lands on /platform.
  // Case-insensitive comparison is used everywhere.
  const PLATFORM_OWNER_EMAIL = 'yamexgilbs@gmail.com';

  /** Returns true if the given email belongs to the Platform Owner. */
  const isOwnerEmail = (email: string | null | undefined): boolean =>
    (email ?? '').toLowerCase().trim() === PLATFORM_OWNER_EMAIL.toLowerCase();

  /**
   * Single-query employee detection. Returns updated role, accountant flag,
   * and employee department. One Firestore read covers all three concerns.
   * - HOD → auto-promotes/demotes MEMBER ↔ DEPARTMENT_HEAD
   * - isAccountant → true for Finance employees flagged as accountant
   * - employeeDepartment → used to show department-specific portal modules
   * - Never touches ADMIN or SUPER_ADMIN roles.
   */
  const detectEmployeeInfo = async (
    churchId: string,
    email: string,
    uid: string,
    currentRole: UserRole,
  ): Promise<{ role: UserRole; isAccountant: boolean; dept: string | null }> => {
    try {
      const snap = await getDocs(query(
        collection(db, 'churches', churchId, 'employees'),
        where('email', '==', email),
      ));

      if (snap.empty) {
        // Not an employee — downgrade if they were previously a HOD
        let newRole = currentRole;
        if (currentRole === UserRole.DEPARTMENT_HEAD) {
          newRole = UserRole.MEMBER;
          await setDoc(userDoc(uid), { role: UserRole.MEMBER }, { merge: true });
        }
        return { role: newRole, isAccountant: false, dept: null };
      }

      const emp = snap.docs[0].data();
      const active = emp.status !== 'Terminated';
      const isDH = active && !!emp.isDepartmentHead;
      const acct = active && !!emp.isAccountant;
      const dept = active ? (emp.department as string | null) ?? null : null;

      let newRole = currentRole;
      if (currentRole !== UserRole.SUPER_ADMIN && currentRole !== UserRole.ADMIN) {
        if (isDH && currentRole !== UserRole.DEPARTMENT_HEAD) {
          newRole = UserRole.DEPARTMENT_HEAD;
          await setDoc(userDoc(uid), { role: newRole }, { merge: true });
        } else if (!isDH && currentRole === UserRole.DEPARTMENT_HEAD) {
          newRole = UserRole.MEMBER;
          await setDoc(userDoc(uid), { role: newRole }, { merge: true });
        }
      }

      return { role: newRole, isAccountant: acct, dept };
    } catch (e) {
      console.warn('Employee info detection failed:', e);
      return { role: currentRole, isAccountant: false, dept: null };
    }
  };

  /**
   * Load the effective module set for a user.
   *
   * Priority:
   *   1. Church-level overrides (add/remove on top of plan)
   *   2. Subscription plan modules (from `subscriptionPlanModules/{planId}` or defaults)
   *   3. User's personal grants (from their user doc + groups) — used as ceiling for non-Super-Admins
   *
   * Platform Owner bypasses everything — always gets all modules.
   */
  const loadModulePermissions = async (
    churchId: string,
    userDoc_: AppUser,
    superAdmin: boolean,
    church?: Church | null,
  ): Promise<Set<string>> => {
    try {
      // ── 1. Load subscription plan modules ──────────────────────────────────
      const planId = church?.subscriptionPlan ?? null;
      let planModules: string[] = planId
        ? (DEFAULT_PLAN_MODULES[planId] ?? [])
        : []; // No plan → no subscription-based access

      if (planId) {
        try {
          const planSnap = await getDoc(doc(db, 'subscriptionPlanModules', planId));
          if (planSnap.exists()) {
            planModules = planSnap.data().modules as string[];
          }
          // If Firestore doc doesn't exist yet, we already set planModules from defaults above
        } catch {
          // Use defaults if read fails
        }
      }

      // If no plan is set (e.g. manually created church without activation), fall back to all
      const effectivePlanModules = planId ? planModules : null;

      // ── 2. Cumulate user's personal grants (direct + groups) ───────────────
      const groupIds = userDoc_.groupIds ?? [];
      let groupModules: string[] = [];
      for (const gid of groupIds) {
        const gsnap = await getDoc(doc(db, 'churches', churchId, 'groups', gid));
        if (gsnap.exists()) groupModules = groupModules.concat(gsnap.data().modules ?? []);
      }
      const direct = userDoc_.allowedModules ?? null;
      const personalModules = direct != null ? [...new Set([...direct, ...groupModules])] : null;

      // ── 3. No plan → fall back to simple personal-grant logic ─────────────
      if (!effectivePlanModules) {
        return resolveModules(superAdmin, personalModules);
      }

      // ── 4. Resolve with subscription + overrides + personal ceiling ────────
      return resolveSubscriptionModules({
        planModules: effectivePlanModules,
        overrides: church?.moduleOverrides ?? null,
        isSuperAdmin: superAdmin,
        userModules: personalModules,
      });
    } catch (e) {
      console.warn('Permission load failed:', e);
      return resolveModules(superAdmin, null);
    }
  };

  const loadChurch = async (churchId: string): Promise<Church | null> => {
    try {
      const snap = await getDoc(churchRef(churchId));
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Church;
      }
    } catch (e) {
      console.error('Failed to load church:', e);
    }
    return null;
  };

  const syncUser = async (firebaseUser: import('firebase/auth').User) => {

    // ══════════════════════════════════════════════════════════════════════
    // STEP 0 — PLATFORM OWNER CHECK (runs before EVERYTHING else)
    // If this is the system owner's email, they go directly to /platform.
    // They NEVER see the church setup, NEVER need an activation code.
    // ══════════════════════════════════════════════════════════════════════
    if (isOwnerEmail(firebaseUser.email)) {
      const snap = await getDoc(userDoc(firebaseUser.uid));
      const existing = snap.exists() ? (snap.data() as Partial<AppUser>) : {};
      const ownerUser: AppUser = {
        uid: firebaseUser.uid,
        email: PLATFORM_OWNER_EMAIL,
        displayName: firebaseUser.displayName || existing.displayName || 'Platform Owner',
        photoURL: firebaseUser.photoURL ?? existing.photoURL,
        role: UserRole.PLATFORM_OWNER,  // always forced — never overridable
        churchId: '',                   // platform owner belongs to no church
        accountStatus: 'active',
        lastLogin: new Date().toISOString(),
        authProvider: 'google',
      };
      // Write back to Firestore (ensures role is always correct even if tampered)
      await setDoc(userDoc(firebaseUser.uid), ownerUser, { merge: false });
      setUser(ownerUser);
      setChurch(null);
      setNeedsChurchSetup(false);          // ← CRITICAL: never needs church setup
      setAllowedModules(resolveModules(true, null)); // ← all modules
      setIsAccountant(false);
      setEmployeeDepartment(null);
      setTwoFactorEnabled(false);
      setTwoFactorVerified(false);
      return; // ← Done. Platform Owner is fully handled. Nothing else runs.
    }

    // ══════════════════════════════════════════════════════════════════════
    // Regular user flow (everyone who is NOT the Platform Owner)
    // ══════════════════════════════════════════════════════════════════════

    const snap = await getDoc(userDoc(firebaseUser.uid));

    if (snap.exists()) {
      let userData = snap.data() as AppUser;

      setUser(userData);

      const has2FA = !!(snap.data()?.twoFactorEnabled && snap.data()?.twoFactorSecret);
      setTwoFactorEnabled(has2FA);
      setTwoFactorVerified(false);

      // Update last login (non-blocking)
      setDoc(userDoc(firebaseUser.uid), { lastLogin: new Date().toISOString() }, { merge: true })
        .catch(() => {});

      if (userData.churchId) {
        // Detect HOD role, accountant flag, and department in one query
        const { role: resolvedRole, isAccountant: acct, dept } = await detectEmployeeInfo(
          userData.churchId,
          userData.email,
          firebaseUser.uid,
          userData.role,
        );
        if (resolvedRole !== userData.role) {
          userData = { ...userData, role: resolvedRole };
          setUser(userData);
        }
        setIsAccountant(acct);
        setEmployeeDepartment(dept);

        const superAdmin = resolvedRole === UserRole.SUPER_ADMIN;
        const ch = await loadChurch(userData.churchId);
        setChurch(ch);
        // Load with subscription plan awareness
        const modules = await loadModulePermissions(userData.churchId, userData, superAdmin, ch);
        setAllowedModules(modules);
        setNeedsChurchSetup(false);
      } else {
        // User authenticated but has no church → send to church setup
        setChurch(null);
        setNeedsChurchSetup(true);
      }
    } else {
      // ── Brand new user — check for a pending admin invite first ──────────
      const emailLower = (firebaseUser.email ?? '').toLowerCase();
      let inviteApplied = false;

      try {
        const inviteSnap = await getDocs(query(
          collection(db, 'pendingInvites'),
          where('emailLower', '==', emailLower),
          where('status', '==', 'pending'),
        ));

        if (!inviteSnap.empty) {
          const invite = inviteSnap.docs[0].data();
          const invitedUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || invite.invitedByName || 'Admin User',
            photoURL: firebaseUser.photoURL || undefined,
            role: invite.role as UserRole,
            churchId: invite.churchId,
            allowedModules: invite.allowedModules ?? null,
            allowedActions: invite.allowedActions ?? [],
            accountStatus: 'active',
            lastLogin: new Date().toISOString(),
          };
          await setDoc(userDoc(firebaseUser.uid), invitedUser);
          await updateDoc(inviteSnap.docs[0].ref, {
            status: 'accepted',
            acceptedAt: new Date().toISOString(),
            acceptedUid: firebaseUser.uid,
          });
          setUser(invitedUser);
          const superAdmin = invite.role === UserRole.SUPER_ADMIN;
          const ch = await loadChurch(invite.churchId);
          const modules = await loadModulePermissions(invite.churchId, invitedUser, superAdmin, ch);
          setAllowedModules(modules);
          setChurch(ch);
          setNeedsChurchSetup(false);
          setTwoFactorEnabled(false);
          setTwoFactorVerified(false);
          inviteApplied = true;
        }
      } catch (e) {
        console.warn('Pending invite check failed:', e);
      }

      if (!inviteApplied) {
        // New users (non-Platform-Owner, no pending invite).
        // Use merge:true so we never overwrite a doc already written by
        // createUsernameAccount or a signUpWithEmail race.
        const newUser: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'New User',
          photoURL: firebaseUser.photoURL || undefined,
          role: UserRole.MEMBER,
          churchId: '',
          authProvider: 'google',
          lastLogin: new Date().toISOString(),
          accountStatus: 'active',
        };
        await setDoc(userDoc(firebaseUser.uid), newUser, { merge: true });

        // Re-read what was actually written (merge may have kept existing churchId/role)
        const afterSnap = await getDoc(userDoc(firebaseUser.uid));
        const finalUser = afterSnap.exists()
          ? (afterSnap.data() as AppUser)
          : newUser;

        setUser(finalUser);
        setTwoFactorEnabled(false);
        setTwoFactorVerified(false);

        if (finalUser.churchId) {
          // The doc already had a churchId (e.g., created by createUsernameAccount)
          const superAdmin = finalUser.role === UserRole.SUPER_ADMIN;
          const ch = await loadChurch(finalUser.churchId);
          const modules = await loadModulePermissions(finalUser.churchId, finalUser, superAdmin, ch);
          setAllowedModules(modules);
          setChurch(ch);
          setNeedsChurchSetup(false);
        } else {
          setChurch(null);
          setNeedsChurchSetup(true); // genuinely new user — send to church setup
        }
      }
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timed out, forcing false');
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          await syncUser(firebaseUser);
        } else {
          setUser(null);
          setChurch(null);
          setNeedsChurchSetup(false);
          setIsAccountant(false);
          setEmployeeDepartment(null);
          setAllowedModules(new Set());
          setTwoFactorEnabled(false);
          setTwoFactorVerified(false);
        }
      } catch (error) {
        console.error('Auth sync error:', error);
      } finally {
        setLoading(false);
        clearTimeout(timeout);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const refreshUser = async () => {
    if (auth.currentUser) {
      await syncUser(auth.currentUser);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  /** Sign in with email + password (Firebase Email/Password auth). */
  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Email sign-in failed:', error);
      throw error;
    }
  };

  /**
   * Look up email by username, then sign in with email + password.
   * Username records live in `usernames/{username_lower}` → { uid, email }.
   */
  const signInWithUsername = async (username: string, password: string) => {
    try {
      const usernameSnap = await getDoc(doc(db, 'usernames', username.trim().toLowerCase()));
      if (!usernameSnap.exists()) {
        throw Object.assign(new Error('Username not found.'), { code: 'auth/user-not-found' });
      }
      const { email } = usernameSnap.data() as { email: string };
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Username sign-in failed:', error);
      throw error;
    }
  };

  /**
   * Register a new user with email + password.
   * Also creates a username record for future username-based login.
   */
  const signUpWithEmail = async (
    displayName: string,
    username: string,
    email: string,
    password: string,
  ) => {
    const usernameLower = username.trim().toLowerCase();
    const emailLower = email.trim().toLowerCase();

    // 1. Check username availability before creating any accounts
    const uSnap = await getDoc(doc(db, 'usernames', usernameLower));
    if (uSnap.exists()) {
      throw Object.assign(new Error('Username is already taken.'), { code: 'username/taken' });
    }

    // 2. Create Firebase Auth account
    const cred = await createUserWithEmailAndPassword(auth, emailLower, password);
    const uid = cred.user.uid;

    // 3. Write the Firestore user doc IMMEDIATELY — this must happen before
    //    syncUser runs (triggered by onAuthStateChanged) so the doc exists
    //    with the correct churchId and role.
    const newUserDoc = {
      uid,
      email: emailLower,
      displayName: displayName.trim(),
      role: UserRole.MEMBER,
      churchId: '',
      username: usernameLower,
      authProvider: 'email' as const,
      accountStatus: 'active' as const,
      lastLogin: new Date().toISOString(),
    };
    await setDoc(userDoc(uid), newUserDoc);

    // 4. Username lookup doc (allows login by username)
    await setDoc(doc(db, 'usernames', usernameLower), {
      uid,
      email: emailLower,
      createdAt: new Date().toISOString(),
    });

    // 5. Update Firebase Auth display name (cosmetic only)
    await updateProfile(cred.user, { displayName: displayName.trim() });

    // 6. Explicitly re-sync so React state is consistent with what we just wrote
    //    (overrides any stale state set by the onAuthStateChanged race)
    await syncUser(cred.user);
  };

  /** Send a password reset email via Firebase. */
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setTwoFactorEnabled(false);
      setTwoFactorVerified(false);
      setNeedsChurchSetup(false);
      setChurch(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const verifyTwoFactor = async (code: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const snap = await getDoc(userDoc(user.uid));
      const secret = snap.data()?.twoFactorSecret as string | undefined;
      if (!secret) return false;
      const valid = await verifyTOTP(secret, code);
      if (valid) setTwoFactorVerified(true);
      return valid;
    } catch (err) {
      console.error('2FA verification error:', err);
      return false;
    }
  };

  const enableTwoFactor = async (secret: string): Promise<void> => {
    if (!user) return;
    await setDoc(userDoc(user.uid), { twoFactorEnabled: true, twoFactorSecret: secret }, { merge: true });
    setTwoFactorEnabled(true);
    setTwoFactorVerified(true);
  };

  const disableTwoFactor = async (code: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const snap = await getDoc(userDoc(user.uid));
      const secret = snap.data()?.twoFactorSecret as string | undefined;
      if (!secret) return false;
      const valid = await verifyTOTP(secret, code);
      if (valid) {
        await setDoc(userDoc(user.uid), { twoFactorEnabled: false, twoFactorSecret: null }, { merge: true });
        setTwoFactorEnabled(false);
        setTwoFactorVerified(false);
      }
      return valid;
    } catch (err) {
      console.error('2FA disable error:', err);
      return false;
    }
  };

  const role = user?.role;
  // isPlatformOwner checks BOTH the stored role AND the email directly —
  // two independent guards so neither can be bypassed alone.
  const isPlatformOwner = role === UserRole.PLATFORM_OWNER
    || isOwnerEmail(user?.email);
  const isSuperAdmin = isPlatformOwner || role === UserRole.SUPER_ADMIN;
  const isAdmin = isSuperAdmin || role === UserRole.ADMIN;
  const isDeptHead = isAdmin || role === UserRole.DEPARTMENT_HEAD;
  const isMember = !!user && !!user.churchId;

  const churchId = user?.churchId || null;
  const hasModule = (moduleId: string): boolean =>
    isPlatformOwner || isSuperAdmin || allowedModules.has(moduleId);
  const hasAction = (action: string): boolean => {
    if (isPlatformOwner || isSuperAdmin) return true;
    return (user?.allowedActions ?? []).includes(action);
  };

  return (
    <AuthContext.Provider value={{
      user,
      church,
      churchId,
      loading,
      needsChurchSetup,
      isSuperAdmin,
      isAdmin,
      isDeptHead,
      isMember,
      isAccountant,
      employeeDepartment,
      allowedModules,
      hasModule,
      hasAction,
      isPlatformOwner,
      signInWithGoogle,
      signInWithEmail,
      signInWithUsername,
      signUpWithEmail,
      sendPasswordReset,
      logout,
      refreshUser,
      twoFactorEnabled,
      twoFactorVerified,
      verifyTwoFactor,
      enableTwoFactor,
      disableTwoFactor,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
