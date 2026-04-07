import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
// Added RefreshCw for the scanning animation
import { LayoutDashboard, Search, History as HistoryIcon, User, LogOut, Play, AlertCircle, RefreshCw } from 'lucide-react'; 
import logoImg from './assets/cloudsentinel_logo.png';
import Findings from './Findings'; 
import History from './History';

const Dashboard = ({ onLogout, user }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;
    const isCancelledRef = useRef(false);

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
    const [currentService, setCurrentService] = useState(''); // Tracking S3, IAM, etc.
    const [completedServices, setCompletedServices] = useState([]);
    const [currentScanId, setCurrentScanId] = useState(null);

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
        isCancelledRef.current = false; // Reset the kill switch

        if (!scanData.accessKey.trim() || !scanData.secretKey.trim() || !scanData.region) {
            setScanError('All fields are required.');
            return;
        }

        const services = [
            { name: 'S3 Storage', max: 20 },
            { name: 'EBS Volumes', max: 40 },
            { name: 'IAM Identities', max: 60 },
            { name: 'VPC Networking', max: 80 },
            { name: 'Security Groups', max: 95 }
        ];

        setLoading(true);
        let progressInterval;

        try {
            const verifyResponse = await fetch('http://localhost:5000/api/verify-aws', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...scanData, userId: user?.user_id || user?.id }),
            });

            const verifyData = await verifyResponse.json();

            // Guard 1: User cancelled during AWS credential verification
            if (isCancelledRef.current) return;

            if (verifyResponse.ok) {
                const scanId = verifyData.scan_id;
                setCurrentScanId(scanId);
                setLoading(false);
                setScanProgress(0);
                setCurrentService(services[0].name);
                setIsScanning(true); 
                
                let serviceIdx = 0;
                progressInterval = setInterval(() => {
                    setScanProgress((prev) => {
                        const currentMilestone = services[serviceIdx].max;
                        if (prev < currentMilestone) return prev + 1;
                        if (serviceIdx < services.length - 1) {
                            serviceIdx++;
                            setCurrentService(services[serviceIdx].name);
                        }
                        return prev;
                    });
                }, 150);

                const fetchResponse = await fetch('http://localhost:5000/api/fetch-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...scanData, scan_id: scanId }),
                });

                clearInterval(progressInterval); 

                // Guard 2: User cancelled while backend was scanning
                if (isCancelledRef.current) {
                    console.log("Scan cancelled, aborting frontend navigation.");
                    return;
                }

                if (fetchResponse.ok) {
                    const smoothFinish = setInterval(() => {
                        setScanProgress((prev) => {
                            if (prev >= 100) {
                                clearInterval(smoothFinish);
                                setCurrentService('Scan Complete!'); 
                                return 100;
                            }
                            return prev + 1; 
                        });
                    }, 20); 

                    setTimeout(() => {
                        // Guard 3: Final check before moving to results
                        if (!isCancelledRef.current) {
                            setShowScanModal(false);
                            resetForm();
                            navigate('/findings');
                        }
                    }, 2500); 
                } else {
                    const resultData = await fetchResponse.json();
                    setScanError(resultData.error || "Failed during scanning.");
                    setIsScanning(false);
                }
            } else {
                setScanError(verifyData.error || "Verification failed.");
            }
        } catch (err) {
            if (!isCancelledRef.current) {
                setScanError("Connection failed.");
            }
            if (progressInterval) clearInterval(progressInterval);
        } finally {
            if (!isCancelledRef.current) setLoading(false);
        }
    };

    const handleCancelScan = async () => {
        // 1. Trigger kill switch immediately to stop StartScan logic
        isCancelledRef.current = true;
        const idToStop = currentScanId;

        // 2. Hide modal and reset local view state
        setIsScanning(false);
        setShowScanModal(false);

        // 3. Backend Sync: Tell Flask to update status to CANCELLED and DELETE data
        try {
            if (idToStop) {
                await fetch(`http://localhost:5000/api/cancel-scan/${idToStop}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log("✅ Scan record cancelled and findings purged.");
            }
        } catch (err) {
            console.error("Backend cancellation failed:", err);
        } finally {
            // 4. Move to history where they see the "CANCELLED" row with 0 findings
            resetForm();
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
                    <NavItem icon={<HistoryIcon size={22} />} label="History" isActive={currentPath === '/history'} onClick={() => navigate('/history')} />
                    <NavItem icon={<User size={22} />} label="Profile" isActive={currentPath === '/profile'} onClick={() => navigate('/profile')} />
                </nav>
            </aside>

            {/* MAIN CONTENT */}
            <main className="w-full flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-[30px] font-black text-slate-800 tracking-tight uppercase">AWS Security Monitoring</h2>
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
                
                <section className="w-full flex-1 overflow-y-auto pt-2 px-6 bg-slate-50/50">
                    <div className="w-full mx-auto flex flex-col h-full">
                        {/* Title Section */}
                        <div className="mb-4">
                            {/* Parent flex container to align the bar with the entire text block */}
                            <div className="flex items-stretch gap-4 mt-2 mb-1">
                                {/* The Orange Bar: h-auto with items-stretch ensures it fills the vertical space */}
                                <div className="w-1.5 bg-[#FF9900] rounded-full shrink-0"></div>
                                
                                {/* Container for Title and Subtitle */}
                                <div className="flex flex-col justify-center">
                                    <h1 className="text-[25px] font-black text-slate-900 tracking-tight uppercase leading-tight">
                                        {activePage.title}
                                    </h1>
                                    
                                    <p className="text-[16px] text-slate-500 font-medium leading-normal">
                                        {activePage.subtitle}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* --- DYNAMIC CONTAINER --- */}
                        <div className="flex-1 w-full h-full">
                            {/* DASHBOARD OVERVIEW */}
                            {currentPath === '/dashboard' && (
                                <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-208px)] p-10 flex flex-col items-center justify-center text-center">
                                    <h3 className="text-xl font-bold text-slate-700">Security Overview</h3>
                                    <p className="text-slate-500 mt-2">Ready to audit? Click "Scan Now" to detect misconfigurations.</p>
                                </div>
                            )}

                            {/* FINDINGS PAGE (Now handles its own white box internally) */}
                            {currentPath === '/findings' && <Findings scanId={currentScanId} user={user} />}

                            {/* HISTORY PAGE */}
                            {currentPath === '/history' && <History user={user} />}

                            {/* PROFILE PAGE */}
                            {currentPath === '/profile' && (
                                <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-220px)] p-10 flex flex-col items-center justify-center text-center">
                                    <User size={48} className="text-slate-300 mb-4" />
                                    <h3 className="text-xl font-bold text-slate-700">Account Settings</h3>
                                    <p className="text-slate-400 mt-2 font-medium">Manage your security profile and preferences here.</p>
                                </div>
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
                                            className="flex-1 bg-slate-100 text-slate-600 font-extrabold py-4 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 hover:bg-slate-200"
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
                            // --- VIEW 2: REFINED AUDITOR UI ---
                            <div className="flex flex-col py-2 animate-in zoom-in-95 duration-300">
                                {/* Header with Pulse */}
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-[#FF9900] rounded-full animate-ping opacity-20"></div>
                                        <div className="relative bg-[#FF9900]/10 p-4 rounded-2xl">
                                            <RefreshCw size={28} className="text-[#FF9900] animate-spin" />
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">Scanning in Progress</h2>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                            <p className="text-[15px] text-slate-500 font-bold uppercase tracking-wider">
                                                {scanProgress < 100 ? `Analyzing ${currentService}...` : 'Finishing...'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Service List Checklist */}
                                <div className="space-y-4 mb-8">
                                    {['S3', 'EBS', 'IAM', 'VPC', 'EC2'].map((svc, idx) => {
                                        const milestones = [20, 40, 60, 80, 95];
                                        
                                        // FIX: Only mark as completed if progress has passed the milestone 
                                        // OR the currentService explicitly says 'Scan Complete!'
                                        const isCompleted = scanProgress >= milestones[idx] || currentService === 'Scan Complete!';
                                        
                                        const isCurrent = currentService.includes(svc) && currentService !== 'Scan Complete!';

                                        return (
                                            <div key={svc} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-500 ${
                                                isCompleted ? 'bg-green-50 border-green-100' : 
                                                isCurrent ? 'bg-slate-50 border-[#FF9900]/30 shadow-sm' : 'bg-white border-slate-100 opacity-40'
                                            }`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-500 ${
                                                        isCompleted ? 'bg-green-500 text-white' : 'border-2 border-slate-300'
                                                    }`}>
                                                        {isCompleted && (
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <span className={`text-[13px] font-bold ${isCompleted ? 'text-green-700' : 'text-slate-700'}`}>
                                                        {svc} Configurations
                                                    </span>
                                                </div>
                                                {/* Fixed pulse visibility logic */}
                                                {isCurrent && <span className="text-[10px] font-bold text-[#FF9900] animate-pulse">SCANNING...</span>}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Progress Bar Container */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[12px] font-extrabold text-slate-600 uppercase tracking-widest">Global Progress</span>
                                        <span className="text-[15px] font-extrabold text-[#FF9900]">{scanProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-green-500 h-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                                            style={{ width: `${scanProgress}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <button 
                                    onClick= {handleCancelScan}
                                    className="mt-5 px-10 py-4 bg-slate-50 text-slate-500 font-extrabold text-[13px] uppercase tracking-[0.2em] rounded-2xl border border-slate-200/60 shadow-sm transition-all duration-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 hover:shadow-md hover:shadow-red-500/10 active:scale-95 disabled:opacity-50"
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