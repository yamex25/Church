import { motion } from 'motion/react';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Settings,
  Camera,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '../../components/AuthContext';

export default function PortalProfile() {
  const { user, logout } = useAuth();
  
  const member = {
    name: user?.displayName || 'Faith Member',
    email: user?.email || 'N/A',
    phone: '', // These would normally come from a 'users' or 'members' doc
    address: '',
    memberSince: 'Member',
    gender: 'N/A',
    dob: 'N/A',
    categories: ['Member']
  };

  const handleSignOut = () => {
    if (window.confirm("Confirm secure sign out?")) {
      logout();
    }
  };

  return (
    <div className="space-y-10 text-church-black">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-church-black">Ministry Identity</h2>
          <p className="text-xs font-black text-church-gray uppercase tracking-widest mt-1">Personal Stewardship</p>
        </div>
        <button 
          onClick={() => alert("Settings are managed by the church office. Contact them to update sensitive data.")}
          className="p-3 bg-white border-2 border-church-blue/10 rounded-2xl text-church-blue shadow-sm hover:bg-church-soft transition-all"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Avatar Section */}
      <section className="bg-white p-12 rounded-[48px] border border-church-blue/5 shadow-2xl shadow-church-blue/5 flex flex-col items-center relative overflow-hidden">
        <div className="relative mb-8 pt-4">
          <div className="w-40 h-40 rounded-[32px] bg-church-soft flex items-center justify-center text-7xl font-display font-black text-church-blue border-4 border-white shadow-2xl shadow-church-blue/10 transform -rotate-3">
             {member.name.charAt(0)}
          </div>
          <button 
            onClick={() => alert("Photo upload is coming soon.")}
            className="absolute -bottom-2 -right-2 bg-church-yellow text-church-black p-4 rounded-2xl border-4 border-white shadow-xl hover:scale-110 active:scale-95 transition-all"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>
        <h3 className="text-3xl font-display font-black text-church-black">{member.name}</h3>
        <p className="text-church-gray text-[10px] font-black uppercase tracking-[0.25em] mt-2 mb-8 bg-church-soft px-4 py-1.5 rounded-full border border-church-blue/5">Faith Member since {member.memberSince}</p>
        
        <div className="flex flex-wrap justify-center gap-3">
          {member.categories.map(cat => (
            <span key={cat} className="px-6 py-2 bg-church-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-church-blue/10">
              {cat}
            </span>
          ))}
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-church-yellow/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
      </section>

      {/* Details List */}
      <section className="bg-white rounded-[40px] border border-church-blue/5 shadow-2xl shadow-church-blue/5 overflow-hidden divide-y divide-church-soft">
        {[
          { icon: Mail, label: 'Email Address', val: member.email },
          { icon: Phone, label: 'Contact Number', val: member.phone },
          { icon: MapPin, label: 'Resident Address', val: member.address },
          { icon: Calendar, label: 'Birth Anniversary', val: member.dob },
        ].map((item, i) => (
          <div 
            key={i} 
            onClick={() => alert(`Updating ${item.label} requires office verification.`)}
            className="p-8 flex items-center gap-6 group cursor-pointer hover:bg-church-soft transition-colors"
          >
            <div className="p-4 rounded-2xl bg-church-soft text-church-blue group-hover:bg-church-blue group-hover:text-white transition-all shadow-sm">
              <item.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-church-gray uppercase tracking-[0.2em] leading-none mb-2">{item.label}</p>
              <p className="text-lg font-bold text-church-black tracking-tight">{item.val}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-church-blue/20 group-hover:text-church-blue transition-all group-hover:translate-x-1" />
          </div>
        ))}
      </section>

      {/* Privacy / Account Options */}
      <section className="space-y-4 pt-6">
        <h3 className="text-xs font-black text-church-gray uppercase tracking-[0.2em] px-4">Sanctity & Privacy</h3>
        <div className="flex items-center justify-between p-8 bg-white rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5 group hover:border-church-blue/20 transition-all">
           <div className="flex items-center gap-5">
             <div className="p-3 bg-green-50 rounded-xl text-green-600">
               <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
               <span className="text-base font-bold text-church-black">Two-Factor Authentication</span>
               <p className="text-xs text-church-gray font-medium">Extra layer of protection for your record</p>
             </div>
           </div>
           <div className="w-14 h-7 bg-church-soft rounded-full relative p-1 cursor-pointer transition-colors hover:bg-church-blue/10">
              <div className="w-5 h-5 bg-church-blue rounded-full shadow-md" />
           </div>
        </div>
        <div className="flex items-center justify-between p-8 bg-white rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5 group hover:border-church-blue/20 transition-all">
           <div className="flex items-center gap-5">
             <div className="p-3 bg-church-blue/5 rounded-xl text-church-blue">
               <Smartphone className="w-6 h-6" />
             </div>
             <div>
               <span className="text-base font-bold text-church-black">Manage Verified Devices</span>
               <p className="text-xs text-church-gray font-medium">Authorized login portals</p>
             </div>
           </div>
           <ChevronRight className="w-5 h-5 text-church-blue/20 group-hover:text-church-blue transition-all group-hover:translate-x-1" />
        </div>
      </section>

      <button 
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-4 py-8 text-white font-black text-xs uppercase tracking-[0.25em] bg-red-600 rounded-[32px] hover:bg-red-700 transition-all shadow-2xl shadow-red-600/20 active:scale-95 mb-12"
      >
        <LogOut className="w-5 h-5" />
        Secure Sign Out
      </button>
    </div>
  );
}
