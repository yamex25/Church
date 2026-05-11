import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, UserRole } from '@/src/types';
import { auth, db } from '@/src/lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isMember: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap Admin Email
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
            // Force Admin for bootstrap email if not already
            if (firebaseUser.email === BOOTSTRAP_ADMIN && userData.role !== UserRole.ADMIN) {
              console.log("Auth State: Boosting to Admin", BOOTSTRAP_ADMIN);
              const updatedUser = { ...userData, role: UserRole.ADMIN };
              await setDoc(doc(db, 'users', firebaseUser.uid), updatedUser);
              setUser(updatedUser);
            } else {
              setUser(userData);
            }
          } else {
            console.log("Auth State: Creating new user document");
            // New user defaults to Member, unless bootstrap admin
            const role = firebaseUser.email === BOOTSTRAP_ADMIN ? UserRole.ADMIN : UserRole.MEMBER;
            const newUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'New Member',
              role: role,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
        } else {
          console.log("Auth State: No user");
          setUser(null);
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
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  };

  // Roles access checks
  // TEMPORARY: Grant all users access for vetting purposes
  const isAdmin = !!user; 
  const isMember = !!user;

  console.log("Auth State:", { uid: user?.uid, role: user?.role, isAdmin, isMember });

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isMember, signInWithGoogle, logout }}>
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
