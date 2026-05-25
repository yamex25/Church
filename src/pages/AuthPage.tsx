import { useState } from 'react';
import { motion } from 'motion/react';
import { Church, ShieldCheck, Heart } from 'lucide-react';
import { useAuth } from '@/src/components/AuthContext';
import { cn } from '@/src/lib/utils';
import { Navigate, useLocation } from 'react-router-dom';
import { UserRole } from '@/src/types';

export default function AuthPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const location = useLocation();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-church-soft flex flex-col items-center justify-center gap-6">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="bg-church-blue p-6 rounded-[32px] shadow-2xl shadow-church-blue/20"
        >
          <Church className="text-white w-12 h-12" />
        </motion.div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-church-blue animate-pulse">GraceFlow is Preparing...</p>
      </div>
    );
  }

  if (user) {
    const from = (location.state as any)?.from?.pathname;
    if (from && from !== '/') {
      return <Navigate to={from} replace />;
    }
    const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER, UserRole.SECRETARY, UserRole.DPT_LEADER];
    const defaultRoute = ADMIN_ROLES.includes(user.role) ? '/admin' : '/portal';
    return <Navigate to={defaultRoute} replace />;
  }

  const handleLogin = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {

      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError("Login window closed. Please try again.");
      } else {
        setAuthError(err.message || "Failed to sign in. Please try again.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-church-white flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-church-yellow/5 via-white to-church-blue/5">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[48px] p-12 shadow-2xl shadow-church-blue/10 border border-church-blue/5 text-center"
      >
        <div className="bg-church-blue w-24 h-24 rounded-[32px] mx-auto mb-10 flex items-center justify-center shadow-2xl shadow-church-blue/30 -rotate-2 group-hover:rotate-0 transition-transform duration-500">
          <Church className="text-white w-12 h-12" />
        </div>
        
        <h1 className="text-5xl font-display font-black text-church-black mb-4 tracking-tight leading-tight italic">GraceFlow</h1>
        <p className="text-church-gray mb-12 font-medium leading-relaxed max-w-[280px] mx-auto">Digitizing the Sanctuary. Access your ministry sanctuary below.</p>

        {authError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl">
            {authError}
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={isSigningIn}
          className={cn(
            "w-full flex items-center justify-center gap-4 bg-white border-2 border-church-blue/10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest text-church-black transition-all active:scale-95 shadow-sm mb-10 group",
            isSigningIn ? "opacity-50 cursor-not-allowed" : "hover:bg-church-soft hover:border-church-blue"
          )}
        >
          {isSigningIn ? (
             <div className="animate-spin rounded-full h-5 w-5 border-2 border-church-blue border-t-transparent" />
          ) : (
            <>
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
              Continue with Google
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-church-soft rounded-2xl text-center">
            <ShieldCheck className="w-6 h-6 text-church-blue mx-auto mb-2" />
            <span className="text-[10px] font-black uppercase tracking-widest text-church-blue">Secure Data</span>
          </div>
          <div className="p-4 bg-church-soft rounded-2xl text-center">
            <Heart className="w-6 h-6 text-church-blue mx-auto mb-2" />
            <span className="text-[10px] font-black uppercase tracking-widest text-church-blue">Faith Based</span>
          </div>
        </div>
      </motion.div>

      <p className="mt-12 text-[10px] font-black uppercase tracking-[0.2em] text-church-gray">
        Powered by GraceFlow Systems &bull; Version 2.0
      </p>
    </div>
  );
}
