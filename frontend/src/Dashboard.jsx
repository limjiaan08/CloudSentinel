import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
// Added RefreshCw for the scanning animation
import { LayoutDashboard, Search, History, User, LogOut, Play, AlertCircle, RefreshCw } from 'lucide-react'; 
import logoImg from './assets/cloudsentinel_logo.png';
import Findings from './Findings'; 

const Dashboard = ({ onLogout, user }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    // --- STATES ---
    const [showScanModal, setShowScanModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false); // ADDED
    const [scanProgress, setScanProgress] = useState(0); // ADDED
    const [scanError, setScanError] = useState('');
    const [scanData, setScanData] = useState({
        accessKey: '',
        secretKey: '',
        region: ''
    });

    // --- DYNAMIC TITLES ---
    const pageContent = {
        '/dashboard': {
            title: 'Security Overview',
            subtitle: `Welcome back, ${user?.user_name || 'Admin'}. Monitor your AWS security status.`
        },
        '/findings': {
            title: 'Security Findings',
            subtitle: 'Detailed analysis of detected AWS misconfigurations and risks.'
        },
        '/history': {
            title: 'Scan History',
            subtitle: 'Review and compare previous security audit results.'
        },
        '/profile': {
            title: 'Account Settings',
            subtitle: 'Manage your profile information and security preferences.'
        }
    };

    const activePage = pageContent[currentPath] || { 
        title: 'CloudSentinel', 
        subtitle: 'AWS Security Monitoring System' 
    };

    // --- FORM RESET HELPER ---
    const resetForm = () => {
        setScanData({ accessKey: '', secretKey: '', region: '' });
        setScanError('');
        setIsScanning(false); // NEW: Ensure scan state is reset
        setScanProgress(0);   // NEW: Ensure progress is reset
    };

    const handleLogoutAction = () => {
        onLogout();
        navigate('/signin');
    };

    // --- FORM VALIDATION & SUBMISSION ---
    const handleStartScan = async (e) => {
        e.preventDefault();
        setScanError('');

        if (!scanData.accessKey.trim() || !scanData.secretKey.trim() || !scanData.region) {
            setScanError('All fields are required to begin the security scan.');
            return;
        }

        setLoading(true);

        try {
            // STEP 1: Verify Credentials and Create Scan Entry
            const verifyResponse = await fetch('http://localhost:5000/api/verify-aws', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...scanData,
                    userId: user?.user_id || user?.id // Ensure you pass the logged-in user's ID
                }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok) {
                // STEP 2: Credentials are valid, now start the "Scanning" UI
                const currentScanId = verifyData.scan_id;
                setLoading(false);
                setIsScanning(true); // Switch to the scanning progress view
                
                // STEP 3: Trigger the Configuration Fetching
                const fetchResponse = await fetch('http://localhost:5000/api/fetch-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        ...scanData, 
                        scan_id: currentScanId 
                    }),
                });

                if (fetchResponse.ok) {
                    setScanProgress(100);
                    setTimeout(() => {
                        resetForm();
                        setShowScanModal(false);
                        navigate('/findings');
                    }, 800);
                } else {
                    const fetchError = await fetchResponse.json();
                    setScanError(fetchError.error || "Failed during configuration fetching.");
                    setIsScanning(false);
                }
            } else {
                setScanError(verifyData.error || "Failed to verify AWS credentials.");
            }
        } catch (err) {
            setScanError("Connection failed. Is the Flask server running?");
        } finally {
            setLoading(false);
        }
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
                        <p className="text-[9px] uppercase tracking-[0.2em] font-semibold text-white mt-1.5 leading-none">
                            AWS Security Monitor
                        </p>
                    </div>
                </div>

                <div className="mt-0 mb-10 p-5 mr-1 rounded-[1.5rem] bg-white/5 border border-white/10 backdrop-blur-md shadow-inner">
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

                <nav className="flex-1 space-y-3 ">
                    <NavItem icon={<LayoutDashboard size={22} />} label="Dashboard" isActive={currentPath === '/dashboard'} onClick={() => navigate('/dashboard')} />
                    <NavItem icon={<Search size={22} />} label="Findings" isActive={currentPath === '/findings'} onClick={() => navigate('/findings')} />
                    <NavItem icon={<History size={22} />} label="History" isActive={currentPath === '/history'} onClick={() => navigate('/history')} />
                    <NavItem icon={<User size={22} />} label="Profile" isActive={currentPath === '/profile'} onClick={() => navigate('/profile')} />
                </nav>
            </aside>

            {/* MAIN CONTENT */}
            <main className="w-full flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-[30px] font-black text-slate-800 tracking-tight capitalize">AWS Security Monitoring</h2>
                        <p className="text-[15px] text-slate-500 font-bold uppercase tracking-widest">OWASP CNAS Compliance Scanner</p>
                    </div>

                    <div className="flex items-center gap-6">
                        {currentPath === '/dashboard' && (
                            <button 
                                onClick={() => setShowScanModal(true)}
                                className="flex items-center gap-3 bg-[#FF9900] hover:bg-[#E68A00] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#FF9900]/20 transition-all active:scale-95">
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
                
                <section className="w-full flex-1 overflow-y-auto pt-2 px-6 pb-6 bg-slate-50/50">
                    <div className="w-full mx-auto flex flex-col h-full">
                        <div className="mb-4">
                            <h1 className="text-[30px] font-black text-slate-900 tracking-tight capitalize">
                                {activePage.title}
                            </h1>
                            <p className="text-[16px] text-slate-500 font-medium mt-1">
                                {activePage.subtitle}
                            </p>
                        </div>

                        <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[500px] p-10 flex-1 overflow-y-auto">
                            {currentPath === '/dashboard' && (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <h3 className="text-xl font-bold text-slate-700">Security Overview</h3>
                                    <p className="text-slate-500 mt-2">Ready to audit? Click "Scan Now" to detect misconfigurations.</p>
                                </div>
                            )}

                            {currentPath === '/findings' && <Findings />}

                            {currentPath === '/history' && (
                                <div className="text-center text-slate-400 font-bold p-10">Scan History coming soon...</div>
                            )}

                            {currentPath === '/profile' && (
                                <div className="text-center text-slate-400 font-bold p-10">User Profile settings coming soon...</div>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* --- MODAL OVERLAY --- */}
            {showScanModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#252F3E]/40 backdrop-blur-sm animate-in fade-in duration-300">
                    {/* NEW: Container width transitions from max-w-2xl to max-w-md when scanning */}
                    <div className={`bg-white w-full ${isScanning ? 'max-w-md' : 'max-w-2xl'} rounded-[1.5rem] shadow-2xl pt-4 pb-8 px-8 flex flex-col relative animate-in zoom-in-95 duration-300 transition-all`}>
                        
                        {!isScanning ? (
                            // --- VIEW 1: ORIGINAL FORM DESIGN ---
                            <>
                                <div className="flex items-center gap-4 mb-3 px-1">
                                    <img src={logoImg} alt="Logo" className="w-16 h-16 object-contain shrink-0" />
                                    <div className="flex flex-col justify-center">
                                        <h2 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">AWS Credentials Required</h2>
                                        <p className="text-[15px] text-slate-500 font-medium mt-2 leading-none">Provide credentials to scan your AWS account</p>
                                    </div>
                                </div>

                                <hr className="border-slate-300 mb-6 w-full border-t-1"/>

                                {scanError && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
                                        <AlertCircle className="text-red-500" size={18} />
                                        <p className="text-red-600 text-[13px] font-bold">{scanError}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    <div className="bg-blue-50 border border-blue-200 p-5 rounded-3xl">
                                        <span className="text-[12px] font-bold uppercase tracking-widest text-blue-700 block mb-2">Permissions:</span>
                                        <div className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-2"></div>
                                            <p className="text-[13px] text-blue-600 leading-relaxed font-medium">Read-only access to S3, IAM, VPC, EC2 and EBS.</p>
                                        </div>
                                    </div>
                                    <div className="bg-green-50 border border-green-200 p-5 rounded-3xl">
                                        <span className="text-[12px] font-bold uppercase tracking-widest text-green-700 block mb-2">Scope:</span>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0 mt-2"></div>
                                                <p className="text-[13px] text-green-600 font-medium">Read-only operations only.</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0 mt-2"></div>
                                                <p className="text-[13px] text-green-600 font-medium">Credentials are not stored.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <form className="space-y-5" onSubmit={handleStartScan}>
                                    <div className="space-y-1">
                                        <label className="text-[15px] font-bold text-slate-700 ml-2">AWS Access Key ID</label>
                                        <input 
                                            type="text" 
                                            value={scanData.accessKey}
                                            onChange={(e) => setScanData({...scanData, accessKey: e.target.value})}
                                            placeholder="Enter your AWS Access Key ID" 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-5 outline-none focus:ring-2 focus:ring-[#FF9900] text-[15px]"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[15px] font-bold text-slate-700 ml-2">AWS Secret Access Key</label>
                                        <input 
                                            type="password" 
                                            value={scanData.secretKey}
                                            onChange={(e) => setScanData({...scanData, secretKey: e.target.value})}
                                            placeholder="Enter your AWS Secret Access Key" 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-5 outline-none focus:ring-2 focus:ring-[#FF9900] text-[15px]"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[14px] font-bold text-slate-700 ml-2">Region</label>
                                        <div className="relative group">
                                            <select 
                                                value={scanData.region}
                                                onChange={(e) => setScanData({...scanData, region: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-5 outline-none focus:ring-2 focus:ring-[#FF9900] appearance-none cursor-pointer text-[15px] text-slate-400 valid:text-slate-700"
                                                required
                                            >
                                                <option value="" disabled hidden>Select AWS Region</option>
                                                <option value="ap-southeast-5" className="text-slate-700">ap-southeast-5 (Malaysia)</option>
                                                <option value="ap-northeast-1" className="text-slate-700">ap-northeast-1 (Tokyo)</option>
                                                <option value="ap-northeast-2" className="text-slate-700">ap-northeast-2 (Seoul)</option>
                                                <option value="ap-northeast-3" className="text-slate-700">ap-northeast-3 (Osaka)</option>
                                                <option value="ap-southeast-1" className="text-slate-700">ap-southeast-1 (Singapore)</option>
                                                <option value="ap-southeast-2" className="text-slate-700">ap-southeast-2 (Sydney)</option>
                                                <option value="ca-central-1" className="text-slate-700">ca-central-1 (Central)</option>
                                                <option value="eu-central-1" className="text-slate-700">eu-central-1 (Frankfurt)</option>
                                                <option value="eu-north-1" className="text-slate-700">eu-north-1 (Stockholm)</option>
                                                <option value="eu-west-1" className="text-slate-700">eu-west-1 (Ireland)</option>
                                                <option value="eu-west-2" className="text-slate-700">eu-west-2 (London)</option>
                                                <option value="eu-west-3" className="text-slate-700">eu-west-3 (Paris)</option>
                                                <option value="sa-east-1" className="text-slate-700">sa-east-1 (São Paulo)</option>
                                                <option value="us-east-1" className="text-slate-700">us-east-1 (N.Virginia)</option>
                                                <option value="us-east-2" className="text-slate-700">us-east-2 (Ohio)</option>
                                                <option value="us-west-1" className="text-slate-700">us-west-1 (N.California)</option>
                                                <option value="us-west-1" className="text-slate-700">us-west-2 (Oregon)</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-400">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-3">
                                        <button 
                                            type="button" 
                                            onClick={() => { resetForm(); setShowScanModal(false); }}
                                            className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 hover:bg-slate-200"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 bg-[#FF9900] hover:bg-[#D17D00] text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {loading ? "Verifying..." : "Start Scan"}
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            // --- VIEW 2: NEW SCANNING PROGRESS STATE ---
                            <div className="flex flex-col items-center text-center py-6 animate-in zoom-in-95 duration-300">
                                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6">
                                    <RefreshCw size={40} className="text-[#FF9900] animate-spin" />
                                </div>
                                <h2 className="text-[26px] font-black text-slate-900 tracking-tight leading-none mb-3">Scanning in Progress</h2>
                                <p className="text-[15px] text-slate-500 font-medium px-4 mb-8">
                                    CloudSentinel is retrieving configurations and checking for OWASP CNAS misconfigurations...
                                </p>
                                
                                {/* Progress Bar */}
                                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-8">
                                    <div 
                                        className="bg-[#FF9900] h-full transition-all duration-500 ease-out"
                                        style={{ width: `${scanProgress}%` }}
                                    ></div>
                                </div>

                                <button 
                                    onClick={() => { setIsScanning(false); setShowScanModal(false); resetForm(); }}
                                    className="bg-slate-100 text-slate-600 font-bold px-8 py-3 rounded-2xl transition-all hover:bg-red-50 hover:text-red-500 active:scale-95"
                                >
                                    Cancel Scan
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const NavItem = ({ icon, label, isActive, onClick }) => (
    <div onClick={onClick} className={`flex items-center gap-4 mr-1 p-4 rounded-[1.5rem] cursor-pointer transition-all duration-300 ${isActive ? 'bg-[#FF9900] text-white shadow-lg' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}>
        <div className={`transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
            {React.cloneElement(icon, { strokeWidth: isActive ? 2.5 : 2 })}
        </div> 
        <span className="tracking-wide text-[15px] font-bold">{label}</span>
    </div>
);

export default Dashboard;