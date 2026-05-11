import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Church, 
  ArrowRight, 
  ShieldCheck, 
  Heart, 
  Calendar, 
  Users,
  BarChart,
  Smartphone
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-church-white font-sans text-church-black">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-10 py-6 max-w-7xl mx-auto border-b border-church-soft">
        <div className="flex items-center gap-3">
          <div className="bg-church-blue p-2.5 rounded-xl rotate-3 shadow-lg shadow-church-blue/20">
            <Church className="text-white w-6 h-6" />
          </div>
          <span className="font-display font-black text-2xl tracking-tight text-church-black">GraceFlow</span>
        </div>
        <div className="flex items-center gap-8">
          <Link to="/admin" className="text-xs font-black uppercase tracking-widest text-church-gray hover:text-church-blue transition-colors">Staff Login</Link>
          <Link 
            to="/portal" 
            className="bg-church-yellow text-church-black px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-church-yellow/20"
          >
            Member Portal
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-10 py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
             <div className="inline-block bg-church-yellow/20 text-church-black px-4 py-2 rounded-full text-[10px] uppercase font-black tracking-[0.25em] mb-8">
               Digital Ministry Excellence
             </div>
            <h1 className="text-6xl md:text-8xl font-display font-black text-church-black leading-[0.9] mb-10 tracking-tight italic">
              Empowering <span className="text-church-blue">Faith</span> through <span className="underline decoration-church-yellow decoration-8 underline-offset-8">Technology</span>.
            </h1>
            <p className="text-xl text-church-gray mb-12 max-w-xl leading-relaxed font-medium">
              The all-in-one sanctuary for church administration, member engagement, and financial transparency.
            </p>
            <div className="flex flex-wrap gap-6">
              <Link to="/admin" className="flex items-center gap-4 bg-church-blue text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-church-blue/30 group">
                Establish Leadership
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </Link>
              <Link to="/portal" className="flex items-center gap-4 bg-white border-2 border-church-blue/10 text-church-black px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-soft transition-all shadow-sm">
                Join the Fellowship
              </Link>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-church-blue p-10 rounded-[64px] shadow-[0_50px_100px_-20px_rgba(30,64,175,0.3)] border border-white/10 -rotate-2 hover:rotate-0 transition-transform duration-700 aspect-square flex items-center justify-center">
               <div className="grid grid-cols-2 gap-6 w-full">
                  {[
                    { icon: Users, label: "Community", color: "bg-church-yellow", iconColor: "text-church-black" },
                    { icon: BarChart, label: "Analytics", color: "bg-white/10", iconColor: "text-white" },
                    { icon: Calendar, label: "Events", color: "bg-white/10", iconColor: "text-white" },
                    { icon: Smartphone, label: "Engagement", color: "bg-church-yellow", iconColor: "text-church-black" }
                  ].map((item, idx) => (
                    <div key={idx} className={cn(item.color, "p-8 rounded-[32px] flex flex-col gap-4 shadow-xl border border-white/5 transition-transform hover:scale-105")}>
                      <item.icon className={cn(item.iconColor, "w-10 h-10")} />
                      <span className={cn(item.iconColor, "text-xs font-black uppercase tracking-widest")}>{item.label}</span>
                    </div>
                  ))}
               </div>
            </div>
            <div className="absolute -z-10 -bottom-20 -right-20 w-96 h-96 bg-church-yellow/30 rounded-full blur-[100px]"></div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-10 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-4xl font-display font-black text-church-black mb-6 tracking-tight">Standard of Excellence</h2>
          <p className="text-church-gray max-w-2xl mx-auto font-medium">GraceFlow provides the infrastructure required to scale your ministry while maintaining intimate community connections.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-12">
          {[
            { icon: ShieldCheck, title: "Secure Treasury", desc: "Military-grade encryption for all tithes, offerings, and ministry donations." },
            { icon: Heart, title: "Pastoral Care", desc: "Integrated prayer request management and member follow-up workflows." },
            { icon: Smartphone, title: "Digital ID", desc: "Instant member identification and attendance tracking via secure QR protocols." }
          ].map((feature, i) => (
            <motion.div 
              key={ feature.title }
              whileHover={{ y: -10 }}
              className="p-10 rounded-[48px] bg-white border border-church-blue/5 shadow-xl shadow-church-blue/5 hover:shadow-2xl hover:shadow-church-blue/10 transition-all text-center"
            >
              <div className="w-20 h-20 bg-church-soft rounded-[24px] flex items-center justify-center mx-auto mb-10 shadow-inner">
                <feature.icon className="text-church-blue w-10 h-10" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-4">{feature.title}</h3>
              <p className="text-church-gray leading-relaxed font-medium">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-church-blue text-white py-24 px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-20">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-church-yellow p-2.5 rounded-xl">
                <Church className="text-church-black w-6 h-6" />
              </div>
              <span className="font-display font-black text-3xl">GraceFlow</span>
            </div>
            <p className="max-w-xs text-blue-200 font-medium leading-relaxed">Modern solutions for spiritual communities. Managing the temporal so you can focus on the eternal.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-20">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-church-yellow">Platform</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li><Link to="/admin" className="hover:text-church-yellow transition-colors">Admin Dashboard</Link></li>
                <li><Link to="/portal" className="hover:text-church-yellow transition-colors">Member Portal</Link></li>
                <li><a href="#" className="hover:text-church-yellow transition-colors">Security</a></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-church-yellow">Community</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li><a href="#" className="hover:text-church-yellow transition-colors">Resources</a></li>
                <li><a href="#" className="hover:text-church-yellow transition-colors">Support</a></li>
                <li><a href="#" className="hover:text-church-yellow transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-24 pt-10 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300">© {new Date().getFullYear()} GraceFlow Systems. Built for faith-led organizations.</p>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-church-yellow transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-church-yellow transition-colors">Service Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
