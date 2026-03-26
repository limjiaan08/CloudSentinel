import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom'; // Added Outlet
import { LayoutDashboard, Search, History, User, LogOut, Play } from 'lucide-react';
import logoImg from './assets/cloudsentinel_logo.png';

const Dashboard = ({ onLogout, user }) => {
    const navigate = useNavigate();
    const location = useLocation(); 
    const currentPath = location.pathname;

    const handleLogoutAction = () => {
        onLogout(); 
        navigate('/signin'); 
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

            {/* LEFT SIDEBAR */}
            <aside className="w-72 bg-[#252F3E] text-white flex flex-col p-6 shadow-xl z-20">
                <div className="shrink-0 flex items-center gap-3 mb-10 px-1">
                    <img src={logoImg} alt="Logo" className="pt-1 w-11 h-11 object-contain" />
                    <div className="flex flex-col justify-center border-l border-white/10 pl-4">
                        <h1 className="text-[25px] font-bold tracking-tight leading-none text-white">
                            Cloud<span className="text-[#FF9900]">Sentinel</span>
                        </h1>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white mt-1.5 leading-none">
                            AWS Security Monitor
                        </p>
                    </div>
                </div>

                {/* DETECTION SCOPE CARD */}
                <div className="mt-0 mb-10 p-5 rounded-[1.5rem] bg-white/5 border border-white/10 backdrop-blur-md shadow-inner">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-2.5 w-1 rounded-full bg-[#FF9900] animate-pulse shadow-[0_0_8px_#FF9900]"></div>
                        <span className="text-[12px] font-bold uppercase tracking-[0.25em] text-white">Detection Scope</span>
                    </div>
                    <div className="mb-4 text-[11px] text-white/70 uppercase tracking-widest font-semibold">OWASP CNAS Categories</div>
                    <div className="flex gap-2 mb-4">
                        {['CNAS-1', 'CNAS-3', 'CNAS-6'].map(tag => (
                            <span key={tag} className="text-[10px] bg-[#FF9900]/10 border border-[#FF9900]/20 px-3 py-1 rounded-[1.5rem] text-[#FF9900] font-mono font-bold">{tag}</span>
                        ))}
                    </div>
                    <div className="mb-2 text-[11px] text-white/70 uppercase tracking-widest font-semibold">Target Services</div>
                    <div className="flex flex-wrap gap-2">
                        {['S3', 'IAM', 'VPC', 'EC2', 'EBS'].map((svc) => (
                            <span key={svc} className="text-[10px] bg-[#FF9900]/10 border border-[#FF9900]/20 px-3 py-1 rounded-[1.5rem] text-[#FF9900] font-mono font-bold">{svc}</span>
                        ))}
                    </div>
                </div>

                {/* NAVIGATION */}
                <nav className="flex-1 space-y-3 px-1">
                    <NavItem icon={<LayoutDashboard size={22} />} label="Dashboard" isActive={currentPath === '/dashboard'} onClick={() => navigate('/dashboard')} />
                    <NavItem icon={<Search size={22} />} label="Findings" isActive={currentPath === '/findings'} onClick={() => navigate('/findings')} />
                    <NavItem icon={<History size={22} />} label="History" isActive={currentPath === '/history'} onClick={() => navigate('/history')} />
                    <NavItem icon={<User size={22} />} label="Profile" isActive={currentPath === '/profile'} onClick={() => navigate('/profile')} />
                </nav>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-[30px] font-black text-slate-800 tracking-tight capitalize">
                            AWS Security Monitoring
                        </h2>
                        <p className="text-[15px] text-slate-500 font-bold uppercase tracking-widest">OWASP CNAS Compliance Scanner</p>
                    </div>

                    <div className="flex items-center gap-6">
                        {currentPath === '/dashboard' && (
                            <button className="flex items-center gap-3 bg-[#FF9900] hover:bg-[#E68A00] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#FF9900]/20 transition-all active:scale-95 animate-in fade-in zoom-in">
                                <Play size={16} fill="currentColor" />
                                <span className="tracking-wide">Scan Now</span>
                            </button>
                        )}
                        <div className="h-10 w-[2px] bg-slate-200 mx-2 ml-5"></div>
                        <button onClick={handleLogoutAction} className="p-3 text-[#FF9900] hover:text-red-500 hover:bg-red-50 rounded-xl transition-all group">
                            <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </header>
                
                <section className="flex-1 overflow-y-auto pt-2 px-7 pb-7 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto flex flex-col h-full">
                        
                        <div className="mb-4 animate-in fade-in slide-in-from-left-4 duration-500">
                            <h1 className="text-[30px] font-black text-slate-900 tracking-tight capitalize">
                                {currentPath === '/dashboard' ? 'Security Overview' : currentPath.split('/')[1]}
                            </h1>
                            <p className="text-[16px] text-slate-500 font-medium mt-1">
                                {currentPath === '/dashboard' && `Welcome back, ${user?.user_name || 'Admin'}. Monitor your AWS security status.`}
                                {currentPath === '/findings' && "Detailed analysis of vulnerabilities."}
                                {currentPath === '/history' && "Review previous scan records."}
                                {currentPath === '/profile' && "Update your account details."}
                            </p>
                        </div>

                        {/* THE LARGE WHITE CARD */}
                        <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[500px] p-10 flex-1 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            
                            {/* CRITICAL CHANGE: The Outlet renders the child routes defined in App.jsx */}
                            <Outlet /> 

                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

const NavItem = ({ icon, label, isActive, onClick }) => (
    <div 
        onClick={onClick} 
        className={`flex items-center gap-4 p-4 rounded-[1.5rem] cursor-pointer transition-all duration-300 ${
            isActive 
                ? 'bg-[#FF9900] text-white shadow-lg shadow-[#FF9900]/20 scale-[1.01]' 
                : 'text-white/40 hover:bg-white/5 hover:text-white'
        }`}
    >
        {/* Subtle icon weight change */}
        <div className={`transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
            {React.cloneElement(icon, { strokeWidth: isActive ? 2.5 : 2 })}
        </div> 

        {/* Using Semibold for Active and Medium for Inactive */}
        <span className={`tracking-wide text-[15px] ${isActive ? 'font-bold' : 'font-bold'}`}>
            {label}
        </span>
    </div>
);

export default Dashboard;