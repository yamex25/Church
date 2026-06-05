import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Church,
  ArrowRight,
  Users,
  Calendar,
  DollarSign,
  ClipboardCheck,
  Heart,
  Home,
  MessageSquare,
  Briefcase,
  Package,
  Receipt,
  TrendingUp,
  FileText,
  UserPlus,
  LayoutDashboard,
  Check,
  Phone,
  Mail,
  Star,
  Gem
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const modules = [
  {
    icon: LayoutDashboard,
    name: "Dashboard",
    desc: "One screen that shows you what's happening across the church  attendance numbers, recent contributions, upcoming events, and tasks that need attention."
  },
  {
    icon: Users,
    name: "Member Management",
    desc: "Maintain a well-organized record of all church members including contact details, family connections, and membership status."
  },
  {
    icon: ClipboardCheck,
    name: "Attendance Tracking",
    desc: "Record attendance for Sunday services, midweek meetings, and any other gathering. Pull reports by date, service, or group."
  },
  {
    icon: DollarSign,
    name: "Finance Module",
    desc: "Track tithes, offerings, and special contributions against set targets. Generate clear financial summaries and giving records per member."
  },
  {
    icon: Calendar,
    name: "Events Management",
    desc: "Create and manage church events with dates, venues, coordinators, and attendance tracking from planning through to the day."
  },
  {
    icon: Heart,
    name: "Prayer Requests",
    desc: "Members submit requests that pastoral staff can view, follow up on, and update  so nothing slips through the cracks."
  },
  {
    icon: Home,
    name: "Home Cell Groups",
    desc: "Organize small groups, assign leaders, record cell meeting attendance, and keep the home fellowship structure running smoothly."
  },
  {
    icon: MessageSquare,
    name: "Communications",
    desc: "Send announcements and notices to all members or specific groups using in-app messaging and SMS notifications."
  },
  {
    icon: Briefcase,
    name: "HR Management",
    desc: "Store records for paid staff and volunteers — their roles, contact details, service history, and relevant documentation."
  },
  {
    icon: Package,
    name: "Asset Inventory",
    desc: "List and track church property sound equipment, vehicles, furniture  with condition notes and the person responsible."
  },
  {
    icon: Receipt,
    name: "Daily Expenses",
    desc: "Log day-to-day operational spending with categories and approvals, so expenditure is always accounted for and auditable."
  },
  {
    icon: TrendingUp,
    name: "Pledge Tracker",
    desc: "Record member giving pledges and monitor how much has been fulfilled over time. Useful for building projects and special fundraising."
  },
  {
    icon: FileText,
    name: "Requisitions",
    desc: "Staff raise purchase requests that go through an approval chain before any money moves  keeping spending orderly and authorized."
  },
  {
    icon: UserPlus,
    name: "Visitor Management",
    desc: "Log new and returning visitors, capture their contact information, and schedule follow-up visits or calls from the care team."
  }
];

const plans = [
  {
    name: "Free",
    price: "0",
    label: "UGX 0",
    period: "",
    tagline: "Good for small churches just getting started",
    features: [
      "Up to 50 members",
      "Basic attendance tracking",
      "Event management",
      "Prayer request module",
      "Member portal access",
      "Dashboard overview"
    ],
    cta: "Get Started Free",
    highlight: false,
    icon: null
  },
  {
    name: "Standard",
    price: "75,000",
    label: "UGX 75,000",
    period: "/ month",
    tagline: "For congregations that are growing steadily",
    features: [
      "Up to 300 members",
      "Everything in Free",
      "Finance module",
      "Home cell groups",
      "Visitor management",
      "Communications & SMS"
    ],
    cta: "Choose Standard",
    highlight: false,
    icon: Star
  },
  {
    name: "Professional",
    price: "150,000",
    label: "UGX 150,000",
    period: "/ month",
    tagline: "For churches that need the full picture",
    features: [
      "Up to 1,000 members",
      "Everything in Standard",
      "HR management",
      "Asset inventory",
      "Daily expense logging",
      "Pledge tracker",
      "Requisitions & approvals",
      "Full financial reports"
    ],
    cta: "Choose Professional",
    highlight: true,
    icon: null
  },
  {
    name: "Diamond",
    price: "300,000",
    label: "UGX 300,000",
    period: "/ month",
    tagline: "For large ministries and multi-branch churches",
    features: [
      "Unlimited members",
      "Everything in Professional",
      "Multi-branch support",
      "Custom church branding",
      "Dedicated support line",
      "Data export and backups",
      "Priority feature access"
    ],
    cta: "Choose Diamond",
    highlight: false,
    icon: Gem
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-church-white font-sans text-church-black">

      {/* Navigation */}
      <nav className="flex items-center justify-between px-10 py-6 max-w-7xl mx-auto border-b border-church-soft">
        <div className="flex items-center gap-3">
          <div className="bg-church-blue p-2.5 rounded-xl rotate-3 shadow-lg shadow-church-blue/20">
            <Church className="text-white w-6 h-6" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-church-blue">GraceFlow</span>
        </div>
        <div className="flex items-center gap-8">
                    <h1 className="text-lg font-bold uppercase tracking-widest   text-church-blue  px-8 py-3 rounded-2xl hover:text-church-yello transition-colors">+256773496430</h1>

          
          <Link to="/admin" className="text-xs font-bold uppercase tracking-widest  bg-church-blue text-church-yellow  px-8 py-3 rounded-2xl hover:text-church-white transition-colors">Staff Login</Link>
          
          <Link
            to="/portal"
            className="bg-church-blue text-church-yellow px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest hover:scale-105 hover:text-church-white  active:scale-95 transition-all shadow-xl shadow-church-yellow/20"
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
            <div className="inline-block bg-church-blue text-church-white px-4 py-2 rounded-full text-[10px] uppercase font-black tracking-[0.25em] mb-8">
              Church Administration Software
            </div>
            <h1 className="text-6xl md:text-8xl font-display font-black text-church-black leading-[0.9] mb-10 tracking-tight italic">
              Run your church with <span className="text-church-blue">clarity</span> and <span className="underline decoration-church-blue decoration-8 underline-offset-8">confidence</span>.
            </h1>
            <p className="text-xl text-church-blue mb-12 max-w-xl leading-relaxed font-medium">
              GraceFlow brings members, finances, attendance, events, and communication into one place ; so your team spends less time on paperwork and more time on ministry.
            </p>
            <div className="flex flex-wrap gap-6">
              <Link to="/admin" className="flex items-center gap-4 bg-church-blue text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-church-blue/30 group">
                Admin Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </Link>
              <Link to="/portal" className="flex items-center gap-4 bg-white border-2 border-church-blue/10 text-church-black px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-soft transition-all shadow-sm">
                Member Portal
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="relative flex items-center justify-center"
          >
            <svg viewBox="0 0 500 420" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-lg mx-auto" aria-hidden="true">
              <circle cx="420" cy="75" r="95" fill="#DBEAFE" />
              <circle cx="85" cy="365" r="65" fill="#FFFBEB" />
              <rect x="88" y="288" width="16" height="68" rx="5" fill="#CBD5E1" />
              <rect x="396" y="288" width="16" height="68" rx="5" fill="#CBD5E1" />
              <rect x="58" y="270" width="384" height="20" rx="10" fill="#E2E8F0" />
              <rect x="290" y="320" width="120" height="14" rx="7" fill="#CBD5E1" />
              <rect x="332" y="334" width="36" height="45" rx="5" fill="#E2E8F0" />
              <rect x="322" y="370" width="18" height="22" rx="4" fill="#CBD5E1" />
              <rect x="360" y="370" width="18" height="22" rx="4" fill="#CBD5E1" />
              <rect x="150" y="225" width="200" height="48" rx="8" fill="#64748B" />
              <rect x="160" y="232" width="180" height="32" rx="5" fill="#94A3B8" />
              <rect x="165" y="236" width="170" height="7" rx="3" fill="#CBD5E1" opacity="0.6" />
              <rect x="165" y="247" width="170" height="7" rx="3" fill="#CBD5E1" opacity="0.5" />
              <rect x="212" y="248" width="76" height="15" rx="5" fill="#7C8CA0" opacity="0.5" />
              <rect x="157" y="222" width="186" height="6" rx="3" fill="#475569" />
              <rect x="150" y="82" width="200" height="144" rx="14" fill="#1E3A8A" />
              <rect x="160" y="92" width="180" height="124" rx="8" fill="#1E40AF" />
              <rect x="160" y="92" width="180" height="22" rx="8" fill="#1E3A8A" />
              <circle cx="174" cy="103" r="5" fill="#FCD34D" />
              <rect x="186" y="99" width="52" height="8" rx="3" fill="white" opacity="0.2" />
              <rect x="160" y="114" width="40" height="102" fill="#1E3A8A" opacity="0.7" />
              <circle cx="180" cy="130" r="7" fill="white" opacity="0.2" />
              <circle cx="180" cy="150" r="7" fill="white" opacity="0.2" />
              <circle cx="180" cy="170" r="7" fill="white" opacity="0.2" />
              <circle cx="180" cy="190" r="7" fill="white" opacity="0.2" />
              <rect x="206" y="116" width="58" height="44" rx="7" fill="white" opacity="0.1" />
              <rect x="212" y="121" width="20" height="7" rx="2" fill="#FCD34D" opacity="0.9" />
              <rect x="212" y="132" width="44" height="5" rx="2" fill="white" opacity="0.35" />
              <rect x="212" y="140" width="30" height="5" rx="2" fill="white" opacity="0.25" />
              <rect x="212" y="148" width="24" height="7" rx="3" fill="#FCD34D" opacity="0.6" />
              <rect x="272" y="116" width="60" height="44" rx="7" fill="white" opacity="0.1" />
              <rect x="278" y="121" width="20" height="7" rx="2" fill="#FCD34D" opacity="0.9" />
              <rect x="278" y="132" width="44" height="5" rx="2" fill="white" opacity="0.35" />
              <rect x="278" y="140" width="30" height="5" rx="2" fill="white" opacity="0.25" />
              <rect x="278" y="148" width="24" height="7" rx="3" fill="#FCD34D" opacity="0.6" />
              <rect x="206" y="166" width="126" height="8" rx="3" fill="white" opacity="0.15" />
              <rect x="206" y="178" width="126" height="8" rx="3" fill="white" opacity="0.1" />
              <rect x="206" y="190" width="96" height="8" rx="3" fill="white" opacity="0.08" />
              <rect x="206" y="202" width="110" height="8" rx="3" fill="white" opacity="0.08" />
              <ellipse cx="355" cy="248" rx="42" ry="46" fill="#1E3A8A" />
              <path d="M338 206 L355 226 L372 206" fill="white" opacity="0.15" />
              <rect x="345" y="196" width="20" height="18" rx="7" fill="#F59E0B" />
              <circle cx="355" cy="172" r="38" fill="#F59E0B" />
              <ellipse cx="317" cy="176" rx="8" ry="10" fill="#F59E0B" />
              <ellipse cx="393" cy="176" rx="8" ry="10" fill="#F59E0B" />
              <path d="M319 162 Q319 127 355 122 Q391 127 391 162 Q382 138 355 136 Q328 138 319 162Z" fill="#1E3A8A" />
              <ellipse cx="342" cy="172" rx="6" ry="6.5" fill="white" />
              <ellipse cx="368" cy="172" rx="6" ry="6.5" fill="white" />
              <circle cx="343" cy="173" r="3.5" fill="#1E3A8A" />
              <circle cx="369" cy="173" r="3.5" fill="#1E3A8A" />
              <circle cx="344" cy="171.5" r="1.2" fill="white" />
              <circle cx="370" cy="171.5" r="1.2" fill="white" />
              <path d="M333 162 Q342 158 350 162" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M360 162 Q368 158 377 162" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M341 185 Q355 196 369 185" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <circle cx="328" cy="182" r="7" fill="#FB923C" opacity="0.35" />
              <circle cx="382" cy="182" r="7" fill="#FB923C" opacity="0.35" />
              <path d="M316 256 Q285 268 248 268" stroke="#F59E0B" strokeWidth="24" strokeLinecap="round" fill="none" />
              <path d="M394 256 Q410 262 385 268" stroke="#F59E0B" strokeWidth="24" strokeLinecap="round" fill="none" />
              <ellipse cx="234" cy="265" rx="16" ry="11" fill="#F59E0B" />
              <ellipse cx="387" cy="265" rx="16" ry="11" fill="#F59E0B" />
              <rect x="404" y="95" width="88" height="65" rx="14" fill="white" />
              <rect x="404" y="95" width="88" height="65" rx="14" stroke="#E2E8F0" strokeWidth="1.5" />
              <circle cx="422" cy="115" r="9" fill="#DBEAFE" />
              <rect x="418" y="109" width="8" height="12" rx="2" fill="#1E3A8A" opacity="0.4" />
              <rect x="436" y="108" width="46" height="7" rx="3" fill="#1E3A8A" opacity="0.4" />
              <rect x="436" y="119" width="34" height="5" rx="2" fill="#94A3B8" opacity="0.5" />
              <rect x="412" y="131" width="72" height="18" rx="7" fill="#FCD34D" />
              <rect x="424" y="137" width="46" height="5" rx="2" fill="#92400E" opacity="0.4" />
              <rect x="18" y="118" width="80" height="58" rx="12" fill="white" />
              <rect x="18" y="118" width="80" height="58" rx="12" stroke="#E2E8F0" strokeWidth="1.5" />
              <circle cx="35" cy="135" r="9" fill="#DBEAFE" />
              <rect x="31" y="129" width="8" height="12" rx="2" fill="#1E3A8A" opacity="0.35" />
              <rect x="50" y="129" width="38" height="7" rx="3" fill="#1E3A8A" opacity="0.4" />
              <rect x="50" y="140" width="28" height="5" rx="2" fill="#94A3B8" opacity="0.4" />
              <rect x="26" y="150" width="62" height="16" rx="6" fill="#F1F5F9" />
              <rect x="30" y="155" width="44" height="5" rx="2" fill="#1E3A8A" opacity="0.25" />
            </svg>
          </motion.div>
        </div>
      </section>

      {/* Modules Section */}
      <section className="py-32 px-10 bg-church-blue">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-block bg-yellow text-church-yellow px-2 py-1 rounded-full text-[15px] uppercase font-black tracking-[0.25em] mb-6">
              What's included
            </div>
            <h2 className="text-4xl font-display font-black text-white mb-6 tracking-tight">Everything your church needs to stay organised</h2>
            <p className="text-blue-200 max-w-2xl mx-auto font-medium text-lg">
              GraceFlow covers the day-to-day work of running a church ; from tracking Sunday attendance to managing staff requisitions and following up on first-time visitors.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.1 }}
            className="bg-yellow rounded-[20px] p-4 border border-white/10"
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-10 gap-y-10">
              {modules.map((mod) => (
                <div key={mod.name} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <mod.icon className="text-church-yellow w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-white text-base">{mod.name}</h3>
                  </div>
                  <p className="text-blue-200 text-sm leading-relaxed">{mod.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32 px-10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-block bg-church-blue text-church-yellow px-4 py-2 rounded-full text-[10px] uppercase font-black tracking-[0.25em] mb-6">
              Pricing
            </div>
            <h2 className="text-4xl font-display font-black text-church-black mb-6 tracking-tight">Plans for every size of congregation</h2>
            <p className="text-church-gray max-w-xl mx-auto font-medium text-lg">
              Start free and grow into a higher plan as your church grows. No hidden charges . what you see is what you pay.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={cn(
                  "rounded-[40px] p-8 flex flex-col border transition-all hover:shadow-2xl",
                  plan.highlight
                    ? "bg-church-blue text-white border-church-blue shadow-2xl shadow-church-blue/30 scale-105"
                    : "bg-white text-church-black border-church-blue/10 shadow-lg shadow-church-blue/5 hover:border-church-blue/20"
                )}
              >
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    {plan.icon && <plan.icon className={cn("w-5 h-5", plan.highlight ? "text-church-yellow" : "text-church-blue")} />}
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-[0.25em]",
                      plan.highlight ? "text-blue-200" : "text-church-gray"
                    )}>{plan.name}</span>
                  </div>
                  <div className="mb-3">
                    <span className={cn("text-4xl font-display font-black", plan.highlight ? "text-white" : "text-church-black")}>
                      {plan.price === "0" ? "Free" : `${plan.price}`}
                    </span>
                    {plan.price !== "0" && (
                      <span className={cn("text-sm font-bold ml-1", plan.highlight ? "text-blue-200" : "text-church-gray")}>
                        UGX{plan.period}
                      </span>
                    )}
                  </div>
                  <p className={cn("text-sm font-medium", plan.highlight ? "text-blue-200" : "text-church-gray")}>
                    {plan.tagline}
                  </p>
                </div>

                <ul className="space-y-3 mb-10 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        plan.highlight ? "bg-church-yellow" : "bg-church-soft"
                      )}>
                        <Check className={cn("w-3 h-3", plan.highlight ? "text-church-black" : "text-church-blue")} strokeWidth={3} />
                      </div>
                      <span className={cn("text-sm font-medium", plan.highlight ? "text-blue-100" : "text-church-gray")}>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/admin"
                  className={cn(
                    "block text-center py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95",
                    plan.highlight
                      ? "bg-church-yellow text-church-black shadow-xl shadow-church-yellow/30"
                      : "bg-church-soft text-church-black hover:bg-church-blue/10"
                  )}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-church-gray text-sm font-medium mt-12">
            All prices are in Ugandan Shillings (UGX). Contact us if your congregation has specific needs not covered by these plans.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-church-blue text-white pt-24 px-10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-16 pb-16">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-church-yellow p-2.5 rounded-xl">
                <Church className="text-church-black w-6 h-6" />
              </div>
              <span className="font-display  bg-church-white font-white text-3xl">GraceFlow</span>
            </div>
            <p className="text-blue-200 font-medium leading-relaxed max-w-xs">
              Church management software built to help congregations stay organised, transparent, and focused on what matters.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-church-yellow">Platform</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li><Link to="/admin" className="hover:text-church-yellow transition-colors">Admin Dashboard</Link></li>
                <li><Link to="/portal" className="hover:text-church-yellow transition-colors">Member Portal</Link></li>
                <li><a href="#" className="hover:text-church-yellow transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-church-yellow">Support</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li><a href="#" className="hover:text-church-yellow transition-colors">Help Centre</a></li>
                <li><a href="#" className="hover:text-church-yellow transition-colors">Training</a></li>
                <li><a href="#" className="hover:text-church-yellow transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-church-yellow">Developer</h4>
            <p className="text-blue-100 font-bold text-lg">Iyama Gilbert</p>
            <div className="space-y-3">
              <a
                href="tel:0773496430"
                className="flex items-center gap-3 text-sm font-medium text-blue-200 hover:text-church-yellow transition-colors"
              >
                <Phone className="w-4 h-4 flex-shrink-0" />
                0773 496 430
              </a>
              <a
                href="mailto:yamexgilbs@gmail.com"
                className="flex items-center gap-3 text-sm font-medium text-blue-200 hover:text-church-yellow transition-colors"
              >
                <Mail className="w-4 h-4 flex-shrink-0" />
                yamexgilbs@gmail.com
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto py-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs font-bold text-blue-300 uppercase tracking-widest">
            © {new Date().getFullYear()} GraceFlow  Developed by Iyama Gilbert
          </p>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-church-yellow transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-church-yellow transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
