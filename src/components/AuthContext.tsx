import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, UserRole } from '@/src/types';
import { auth, db } from '@/src/lib/firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { verifyTOTP } from '@/src/lib/totp';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isMember: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
  verifyTwoFactor: (code: string) => Promise<boolean>;
  enableTwoFactor: (secret: string) => Promise<void>;
  disableTwoFactor: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorVerified, setTwoFactorVerified] = useState(false);

  const BOOTSTRAP_ADMIN = 'yamexgilbs@gmail.com';

  useEffect(() => {
    // Safety timeout for loading state
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth loading timed out, forcing false");
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log("Auth State: User logged in", firebaseUser.uid);
          // Sync with Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            console.log("Auth State: User document found");
            const userData = userDoc.data() as AppUser;
            const docData = userDoc.data();
            if (firebaseUser.email === BOOTSTRAP_ADMIN && userData.role !== UserRole.ADMIN) {
              console.log("Auth State: Boosting to Admin", BOOTSTRAP_ADMIN);
              const updatedUser = { ...userData, role: UserRole.ADMIN };
              await setDoc(doc(db, 'users', firebaseUser.uid), updatedUser);
              setUser(updatedUser);
            } else {
              setUser(userData);
            }
            const has2FA = !!(docData?.twoFactorEnabled && docData?.twoFactorSecret);
            setTwoFactorEnabled(has2FA);
            setTwoFactorVerified(false);
          } else {
            console.log("Auth State: Creating new user document");
            const role = firebaseUser.email === BOOTSTRAP_ADMIN ? UserRole.ADMIN : UserRole.MEMBER;
            const newUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'New Member',
              role: role,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
            setTwoFactorEnabled(false);
            setTwoFactorVerified(false);
          }
        } else {
          console.log("Auth State: No user");
          setUser(null);
          setTwoFactorEnabled(false);
          setTwoFactorVerified(false);
        }
      } catch (error) {
        console.error("Auth sync error:", error);
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

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // Re-throw so UI can catch it
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setTwoFactorEnabled(false);
      setTwoFactorVerified(false);
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  };

  const verifyTwoFactor = async (code: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const secret = userDoc.data()?.twoFactorSecret as string | undefined;
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
    await setDoc(doc(db, 'users', user.uid), { twoFactorEnabled: true, twoFactorSecret: secret }, { merge: true });
    setTwoFactorEnabled(true);
    setTwoFactorVerified(true);
  };

  const disableTwoFactor = async (code: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const secret = userDoc.data()?.twoFactorSecret as string | undefined;
      if (!secret) return false;
      const valid = await verifyTOTP(secret, code);
      if (valid) {
        await setDoc(doc(db, 'users', user.uid), { twoFactorEnabled: false, twoFactorSecret: null }, { merge: true });
        setTwoFactorEnabled(false);
        setTwoFactorVerified(false);
      }
      return valid;
    } catch (err) {
      console.error('2FA disable error:', err);
      return false;
    }
  };

  // TEMPORARY: Grant all users access for vetting purposes
  const isAdmin = !!user;
  const isMember = !!user;

  console.log("Auth State:", { uid: user?.uid, role: user?.role, isAdmin, isMember });

  return (
    <AuthContext.Provider value={{
      user, loading, isAdmin, isMember, signInWithGoogle, logout,
      twoFactorEnabled, twoFactorVerified, verifyTwoFactor, enableTwoFactor, disableTwoFactor
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
