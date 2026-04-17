import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
// Added RefreshCw for the scanning animation
import { AlertTriangle, Clock, LayoutDashboard, Search, History as HistoryIcon, User, LogOut, Play, AlertCircle, RefreshCw, Rocket, 
    Database, Zap, ShieldCheck, Activity, ChevronRight, PieChart as PieIcon, Globe
 } from 'lucide-react'; 
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
    const [scans, setScans] = useState([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [currentService, setCurrentService] = useState(''); // Tracking S3, IAM, etc.
    const [currentScanId, setCurrentScanId] = useState(null);
    const [findings, setFindings] = useState([]); // 1. Add this state at the top

    useEffect(() => {
        const fetchData = async () => {
            setIsInitialLoading(true);
            try {
                const uid = user?.user_id || user?.id;
                
                // 1. Fetch History
                const historyRes = await fetch(`http://localhost:5000/api/scan-history/${uid}`);
                const historyData = await historyRes.json();
                
                if (historyRes.ok && historyData.scans?.length > 0) {
                    setScans(historyData.scans);

                    // --- FIX STARTS HERE ---
                    // Instead of historyData.scans[0], find the first one that is 'COMPLETED'
                    const lastCompleted = historyData.scans.find(s => s.scan_status === 'COMPLETED');

                    if (lastCompleted) {
                        const latestId = lastCompleted.scan_id;

                        // 2. Fetch the actual Result Items for this COMPLETED scan
                        const resultsRes = await fetch(`http://localhost:5000/api/scan-results/${latestId}`);
                        const resultsData = await resultsRes.json();
                        
                        // Map the results to findings state
                        setFindings(resultsData.results || resultsData || []);
                    } else {
                        // Reset findings if no successful scans exist
                        setFindings([]);
                    }
                }
            } catch (err) {
                console.error("Dashboard Sync Error:", err);
            } finally {
                setIsInitialLoading(false);
            }
        };
        if (user) fetchData();
    }, [user, isScanning]);

    console.log("Current Findings Data:", findings);

    const serviceCounts = {
        // We check if the string includes the service name, handling the "VPC, EC2" cases
        S3: findings.filter(f => (f.aws_service || f.service)?.toUpperCase().includes('S3')).length,
        IAM: findings.filter(f => (f.aws_service || f.service)?.toUpperCase().includes('IAM')).length,
        VPC: findings.filter(f => (f.aws_service || f.service)?.toUpperCase().includes('VPC')).length,
        EC2: findings.filter(f => (f.aws_service || f.service)?.toUpperCase().includes('EC2')).length,
        EBS: findings.filter(f => (f.aws_service || f.service)?.toUpperCase().includes('EBS')).length,
    };

    const latestScan = scans.find(s => s.scan_status === 'COMPLETED') || null;
    const hasHistory = latestScan !== null;

    // Chart Colors & Data
    const COLORS = ['#EF4444', '#F59E0B', '#10B981']; // Red, Amber, Emerald
    const severityData = latestScan ? [
        { name: 'High', value: latestScan.high_count || 0 },
        { name: 'Medium', value: latestScan.med_count || 0 },
        { name: 'Low', value: latestScan.low_count || 0 },
    ].filter(d => d.value > 0) : [];

    // Update this number as you add more detection logic to your backend
    const TOTAL_RULES = 8; 

    const calculateComplianceScore = () => {
        if (!latestScan) return 100;
        
        // Total findings (count each unique misconfiguration once)
        const totalFindings = (latestScan.high_count || 0) + 
                            (latestScan.med_count || 0) + 
                            (latestScan.low_count || 0);
        
        // Formula: ((Total Rules - Total Findings) / Total Rules) * 100
        const score = ((TOTAL_RULES - totalFindings) / TOTAL_RULES) * 100;
        
        // Math.max ensures we never show a negative percentage if findings > rules
        return Math.max(0, Math.round(score));
    };

    const currentScore = calculateComplianceScore();

    const SEVERITY_ORDER = { 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };

    const sortedSeverityData = [...severityData].sort((a, b) => 
        (SEVERITY_ORDER[a.name] || 99) - (SEVERITY_ORDER[b.name] || 99)
    );

    const [chartView, setChartView] = useState('severity'); // 'severity' or 'cnas'

    const cnasData = latestScan ? [
        { name: 'CNAS-1', value: findings.filter(f => f.category === 'CNAS-1').length },
        { name: 'CNAS-3', value: findings.filter(f => f.category === 'CNAS-3').length },
        { name: 'CNAS-6', value: findings.filter(f => f.category === 'CNAS-6').length },
    ].filter(d => d.value > 0) : [];

    const totalRisks = (latestScan?.high_count || 0) + (latestScan?.med_count || 0) + (latestScan?.low_count || 0);

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
                    <NavItem icon={<LayoutDashboard size={22} />} label="DASHBOARD" isActive={currentPath === '/dashboard'} onClick={() => navigate('/dashboard')} />
                    <NavItem icon={<Search size={22} />} label="FINDINGS" isActive={currentPath === '/findings'} onClick={() => navigate('/findings')} />
                    <NavItem icon={<HistoryIcon size={22} />} label="HISTORY" isActive={currentPath === '/history'} onClick={() => navigate('/history')} />
                    <NavItem icon={<User size={22} />} label="PROFILE" isActive={currentPath === '/profile'} onClick={() => navigate('/profile')} />
                </nav>
            </aside>

            {/* MAIN CONTENT */}
            <main className="w-full flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-[26px] font-extrabold text-slate-800 uppercase">AWS Security Monitoring</h2>
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
                                    <h1 className="uppercase text-[22px] font-bold text-slate-900 leading-none tracking-wide">
                                        {activePage.title}
                                    </h1>
                                    
                                    <p className="text-[17px] text-slate-500 font-medium leading-normal">
                                        {activePage.subtitle}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* --- DYNAMIC CONTAINER --- */}
                        <div className="flex-1 w-full h-full">
                            {/* DASHBOARD OVERVIEW */}
                            {currentPath === '/dashboard' && (
                                !hasHistory ? (
                                    /* --- VIEW A: ONBOARDING (For New Users) --- */
                                    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        {/* Hero Welcome Card */}
                                        <div className="bg-[#252F3E] rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl border border-white/5">
                                            <div className="relative z-10 max-w-2xl text-left">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF9900]/20 border border-[#FF9900]/30 text-[#FF9900] text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF9900] animate-pulse" />
                                                    System Ready
                                                </div>
                                                <h2 className="text-[42px] font-black leading-tight mb-4 tracking-tight">
                                                    Securing your Cloud <br/> starts with an <span className="text-[#FF9900]">Audit.</span>
                                                </h2>
                                                <p className="text-white/50 text-lg font-medium mb-10 leading-relaxed">
                                                    CloudSentinel cross-references your AWS infrastructure against OWASP CNAS categories to identify critical misconfigurations.
                                                </p>
                                                <button 
                                                    onClick={() => setShowScanModal(true)} 
                                                    className="bg-[#FF9900] hover:bg-white hover:text-[#252F3E] text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-[13px] transition-all shadow-xl shadow-[#FF9900]/20 flex items-center gap-3 active:scale-95"
                                                >
                                                    <Play size={20} fill="currentColor" /> Initialize Security Scan
                                                </button>
                                            </div>
                                            <Globe className="absolute -right-20 -bottom-20 text-white/5 w-[600px] h-[600px] pointer-events-none opacity-20" />
                                        </div>

                                        {/* 3-Step Implementation Guide */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            {[
                                                { title: "Configuration", desc: "Input secure Boto3 credentials for read-only metadata access.", icon: <Database /> },
                                                { title: "Automated Audit", desc: "Our engine triggers checks across S3, IAM, and VPC Networking.", icon: <Zap /> },
                                                { title: "Risk Mitigation", desc: "Receive formatted reports with remediation steps for your findings.", icon: <ShieldCheck /> }
                                            ].map((item, idx) => (
                                                <div key={idx} className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm relative group transition-all hover:shadow-xl hover:-translate-y-1 text-left">
                                                    <div className="absolute top-8 right-8 text-[40px] font-black text-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">0{idx + 1}</div>
                                                    <div className="bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center text-[#FF9900] mb-6 border border-slate-100 group-hover:bg-[#FF9900] group-hover:text-white transition-colors">
                                                        {item.icon}
                                                    </div>
                                                    <h4 className="text-[18px] font-black text-slate-800 mb-2 uppercase tracking-tight">{item.title}</h4>
                                                    <p className="text-slate-500 font-medium text-[14px] leading-relaxed">{item.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* --- VIEW B: ANALYTICS (For Returning Users) --- */
                                    <div className="flex flex-col gap-6 pb-6">
                                        {/* --- COMPACT TACTICAL EXECUTIVE HEADER --- */}
                                        <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden">
                                            <div className="flex flex-col md:flex-row items-center min-h-[120px] w-full">
                                                
                                                {/* 1. SCORE ZONE (Left Column) */}
                                                <div className="flex-1 flex items-center justify-center gap-4 px-10 py-6 w-full">
                                                    <div className="relative flex items-center justify-center shrink-0">
                                                        <svg className="w-16 h-16 transform -rotate-90">
                                                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-slate-50" />
                                                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" 
                                                                strokeDasharray={175.8}
                                                                /* Updated to use currentScore */
                                                                strokeDashoffset={175.8 - (175.8 * currentScore) / 100}
                                                                className={`${currentScore < 70 ? 'text-red-500' : currentScore < 90 ? 'text-amber-500' : 'text-emerald-500'} transition-all duration-1000`} 
                                                            />
                                                        </svg>
                                                        <span className="absolute text-[15px] font-black text-slate-800">
                                                            {currentScore}%
                                                        </span>
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-[14px] font-black text-slate-700 uppercase tracking-[0.2em] mb-2 leading-none">Security Score</p>
                                                        <h4 className={`text-[18px] font-black tracking-tight leading-none uppercase ${currentScore < 70 ? 'text-red-600' : currentScore < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                            {currentScore < 70 ? 'Critical' : currentScore < 90 ? 'Warning' : 'Healthy'}
                                                        </h4>
                                                    </div>
                                                </div>

                                                {/* SEPARATION LINE 1 */}
                                                <div className="hidden md:block w-[1px] h-[120px] bg-slate-200"></div>

                                                {/* 2. DYNAMIC SERVICE RISK ZONE (Middle Column - Spaced for Frames) */}
                                                <div className="flex-[2.5] flex flex-col justify-center py-6 w-full bg-slate-50/30">
                                                    <div className="mb-4">
                                                        <p className="text-center text-[14px] font-black text-slate-700 uppercase tracking-[0.2em] leading-none">Service Security Distribution</p>
                                                        <p className="text-center text-[13px] text-slate-700 font-normal my-2 tracking-normal leading-none">Counts per impacted domain (Single risks may affect multiple services)</p>
                                                    </div>
                                                    <div className="flex items-center justify-between w-full max-w-lg mx-auto">
                                                        {[
                                                            { label: 'S3', count: serviceCounts.S3 },
                                                            { label: 'IAM', count: serviceCounts.IAM },
                                                            { label: 'VPC', count: serviceCounts.VPC },
                                                            { label: 'EC2', count: serviceCounts.EC2 },
                                                            { label: 'EBS', count: serviceCounts.EBS }
                                                        ].map((svc) => (
                                                            <div key={svc.label} className="flex flex-col items-center">
                                                                <div className={`min-w-[30px] h-[30px] flex items-center justify-center rounded-lg font-bold text-[18px] border transition-all duration-500 ${
                                                                    svc.count > 0 
                                                                    ? 'bg-red-50 border-red-200 text-red-600 shadow-sm shadow-red-100' 
                                                                    : 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm shadow-emerald-100'
                                                                }`}>
                                                                    {svc.count}
                                                                </div>
                                                                <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wider mt-2">{svc.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* SEPARATION LINE 2 */}
                                                <div className="hidden md:block w-[1px] h-[120px] bg-slate-200"></div>

                                                {/* 3. AUDIT CONTEXT (Right Column) */}
                                                <div className="flex-1 flex items-center justify-center gap-5 pl-2 pr-8 py-6 w-full text-left">
                                                    <div className="bg-blue-50 p-3 rounded-2xl shrink-0 border border-blue-100/50">
                                                        <Clock size={24} className="text-blue-600" />
                                                    </div>
                                                    <div className="flex flex-col justify-center">
                                                        <p className="text-[14px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2.5 leading-none">Last Scan</p>
                                                        <h4 className="text-[14px] font-bold text-slate-800 leading-tight my-1">
                                                            {latestScan?.start_time ? new Date(latestScan.start_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                            <p className="text-[14px] text-slate-600 font-medium uppercase tracking-normal">
                                                                {latestScan?.duration ? `${latestScan.duration.toFixed(2)}s` : '0.00s'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. ANALYTICS CORE */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">
                                            {/* Risk Profile Visualizer */}
                                            <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm flex flex-col min-h-[450px] relative overflow-hidden" tabIndex="-1">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-start gap-4 pt-6 pl-6">
                                                        {/* 1. BIGGER ICON WITH PULSE ANIMATION */}
                                                        <div className="relative mt-1">
                                                            {/* The Pulsing Glow Effect */}
                                                            <div className="absolute inset-0 bg-[#FF9900]/20 rounded-full blur-md animate-pulse scale-150" />
                                                            
                                                            {/* The Actual Icon */}
                                                            <PieIcon 
                                                                size={28} 
                                                                className="text-[#FF9900] relative z-10" 
                                                                strokeWidth={2.5}
                                                            />
                                                        </div>

                                                        {/* 2. TEXT CONTAINER */}
                                                        <div className="flex flex-col justify-center">
                                                            <h4 className="text-[14px] font-black uppercase tracking-[0.15em] text-slate-700 leading-tight">
                                                                Risk Distribution
                                                            </h4>
                                                            <p className="text-slate-500 text-[11px] font-semibold uppercase mt-1 tracking-[0.1em] leading-tight">
                                                                {chartView === 'severity' ? 'By Severity Level' : 'By OWASP CNAS Category'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* --- PROFESSIONAL TOGGLE SWITCH --- */}
                                                    <div className="flex bg-slate-100 p-1 rounded-xl mt-6 mr-6 border border-slate-200">
                                                        <button 
                                                            onClick={() => setChartView('severity')}
                                                            className={`tracking-wider px-5 py-1.5 rounded-lg text-[12px] font-bold uppercase transition-all ${chartView === 'severity' ? 'bg-white text-[#FF9900] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Severity
                                                        </button>
                                                        <button 
                                                            onClick={() => setChartView('cnas')}
                                                            className={`tracking-wider px-5 py-1.5 rounded-lg text-[12px] font-bold uppercase transition-all ${chartView === 'cnas' ? 'bg-white text-[#FF9900] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            CNAS
                                                        </button>
                                                    </div>
                                                </div>

                                                {totalRisks > 0 ? (
                                                    <div className="relative h-[320px] w-full [&_*:focus]:outline-none">
                                                        {/* CENTRAL METRIC (Center of Donut) */}
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                            <span className="text-[40px] font-semibold text-slate-800 leading-none">{totalRisks}</span>
                                                            <span className="text-[12px] font-semibold text-slate-600 uppercase tracking-widest mt-1">Total Risks</span>
                                                        </div>

                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart className="focus:outline-none">
                                                                <Pie 
                                                                    // 1. Point to your sorted data
                                                                    data={chartView === 'severity' ? sortedSeverityData : cnasData} 
                                                                    
                                                                    // 2. INCREASE THESE (Original was 80/110)
                                                                    innerRadius={110} 
                                                                    outerRadius={140} 
                                                                    
                                                                    // 3. Move the center up slightly (default is 50%)
                                                                    cy="55%" 
                                                                    
                                                                    paddingAngle={12} 
                                                                    dataKey="value" 
                                                                    stroke="none"
                                                                    style={{ outline: 'none' }}
                                                                    animationBegin={0}
                                                                    animationDuration={1000}
                                                                    // --- ADDED PERCENTAGE LABELS ---
                                                                    labelLine={false} // Hides the connector lines for a cleaner look
                                                                    label={({ cx, cy, midAngle, outerRadius, percent }) => {
                                                                        const RADIAN = Math.PI / 180;
                                                                        // Adjust the '1.2' to move the label further in or out
                                                                        const radius = outerRadius + 15;
                                                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                                                        return (
                                                                            <text 
                                                                                x={x} 
                                                                                y={y} 
                                                                                fill="#64748b" // slate-500
                                                                                textAnchor={x > cx ? 'start' : 'end'} 
                                                                                dominantBaseline="central"
                                                                                className="text-[14px] font-semibold"
                                                                            >
                                                                                {`${(percent * 100).toFixed(0)}%`}
                                                                            </text>
                                                                        );
                                                                    }}
                                                                >
                                                                    {/* Map over the sorted data to keep HIGH, MEDIUM, LOW order */}
                                                                    {(chartView === 'severity' ? sortedSeverityData : cnasData).map((entry, index) => {
                                                                        let color = '#CBD5E1';
                                                                        if (chartView === 'severity') {
                                                                            if (entry.name === 'High') color = '#EF4444';
                                                                            if (entry.name === 'Medium') color = '#F59E0B';
                                                                            if (entry.name === 'Low') color = '#10B981';
                                                                        } else {
                                                                            const cnasColors = ['#1E293B', '#FF9900', '#64748B'];
                                                                            color = cnasColors[index % cnasColors.length];
                                                                        }
                                                                        return <Cell key={`cell-${index}`} fill={color} />;
                                                                    })}
                                                                </Pie>

                                                                <Tooltip 
                                                                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '10px 15px' }}
                                                                />

                                                                <Legend 
                                                                    verticalAlign="bottom" 
                                                                    align="center"
                                                                    iconType="circle"
                                                                    // Keep bottom negative to stay low, but remove paddingBottom which can cause overlap
                                                                    wrapperStyle={{ bottom: -45, left: 35 }} 
                                                                    formatter={(value) => (
                                                                        <span 
                                                                            className="text-[14px] font-medium text-slate-600 uppercase tracking-widest ml-3 mr-12"
                                                                            style={{ display: 'inline-block' }} // Ensures margins are respected perfectly
                                                                        >
                                                                            {value}
                                                                        </span>
                                                                    )}
                                                                />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                                                        <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center mb-6 border border-emerald-100 shadow-xl">
                                                            <ShieldCheck size={48} className="text-emerald-500" />
                                                        </div>
                                                        <h5 className="text-[22px] font-black text-slate-800 uppercase tracking-tight">Environment Secure</h5>
                                                        <p className="text-slate-400 font-medium max-w-[240px] mt-2 text-center">No misconfigurations found in the latest scan cycle.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Tactical Response Card */}
                                            <div className="bg-[#252F3E] rounded-[1.5rem] p-8 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group min-h-[450px]">
    {/* Background Tech Decal */}
    <Activity className="absolute -right-20 -bottom-20 text-white/[0.03] w-[450px] h-[450px] pointer-events-none rotate-12 transition-transform duration-1000 group-hover:rotate-0" />
    
    <div className="relative z-10">
        {/* Audit Pulse Badge */}
        <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl mb-5 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-[#FF9900] animate-pulse shadow-[0_0_10px_#FF9900]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF9900]">Critical Audit Pulse</span>
        </div>
        
        {/* Headline */}
        <h4 className="text-[25px] font-bold uppercase leading-tight mb-2 mx-1 tracking-wider text-white">
            {(latestScan.high_count + latestScan.med_count + latestScan.low_count) === 0 
                ? <>Zero Threats Detected</> 
                : <>Security Findings Requiring Action</>
            }
        </h4>
        
        {/* Intelligence Paragraph */}
        <p className="text-white/60 text-[17px] font-normal leading-relaxed tracking-wide mx-1 mb-8">
            {(latestScan.high_count + latestScan.med_count + latestScan.low_count) === 0 
                ? "Infrastructure matches the Golden Image baseline. No drift detected."
                : `The scanner identified ${latestScan.high_count + latestScan.med_count + latestScan.low_count} environmental deltas that violate the established SSDLC security protocols.`}
        </p>

        {/* --- NEW REMEDIATION ALERT SECTION --- */}
        {(latestScan.high_count + latestScan.med_count + latestScan.low_count) > 0 && (
            <div className="bg-[#FF9900]/10 border border-[#FF9900]/30 rounded-2xl p-5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle size={18} className="text-[#FF9900]" />
                    <span className="text-[12px] font-bold uppercase tracking-widest text-[#FF9900]">Remediation Required</span>
                </div>
                <p className="text-[13px] text-white/80 leading-relaxed font-normal tracking-wide">
                    Manual intervention is necessary to synchronize the infrastructure back to the <span className="text-white font-bold">Secure Baseline</span>.
                </p>
            </div>
        )}
    </div>

    {/* Primary Action Button */}
    <button 
        onClick={() => navigate('/findings')} 
        className="w-full bg-[#FF9900] hover:bg-[#E68A00] text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[13px] transition-all duration-300 flex items-center justify-center gap-4 active:scale-95 mt-8 mb-2 shadow-xl shadow-orange-950/20"
    >
        Analyze Logs for Remediation <ChevronRight size={20} strokeWidth={3} />
    </button>
</div>
                                        </div>

                                        {/* 3. SERVICE MAPPING GRID */}
                                        <div className="bg-white border border-slate-200 p-10 rounded-[3rem] shadow-sm relative overflow-hidden">
                                            <div className="flex items-center justify-between mb-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-slate-900 p-3 rounded-2xl">
                                                        <Database size={20} className="text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[16px] font-black uppercase tracking-[0.1em] text-slate-800">Infrastructure Scope</h4>
                                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Verified Monitoring Connectors</p>
                                                    </div>
                                                </div>
                                                <div className="hidden md:flex gap-2">
                                                    {['CNAS-1', 'CNAS-3', 'CNAS-6'].map(tag => (
                                                        <span key={tag} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-slate-400">{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                                {['S3 Storage', 'IAM Identity', 'VPC Network', 'EC2 Compute', 'EBS Volumes'].map((svc) => (
                                                    <div key={svc} className="group bg-slate-50/50 border border-slate-100 p-5 rounded-[2rem] hover:bg-white hover:border-[#FF9900]/30 hover:shadow-lg transition-all duration-300">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="relative flex h-3 w-3">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                                            </div>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter italic">Encrypted</span>
                                                        </div>
                                                        <span className="text-[14px] font-black text-slate-800 block mb-1">{svc}</span>
                                                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Status: 200 OK</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
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