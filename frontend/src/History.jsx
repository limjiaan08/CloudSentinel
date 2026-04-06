import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Clock, Calendar, ArrowUpDown, ExternalLink, 
    ChevronDown, Filter as FilterIcon, Activity, Search, PlayCircle 
} from 'lucide-react';

const History = ({ user }) => {
    const navigate = useNavigate();
    const [scans, setScans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        if (user) fetchHistory();
    }, [user]);

    const fetchHistory = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/scan-history/${user?.user_id || user?.id}`);
            const data = await response.json();
            if (response.ok) {
                setScans(data.scans);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        } finally {
            setLoading(false);
        }
    };

    // --- SORTING LOGIC ---
    const sortedScans = [...scans].sort((a, b) => {
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    const handleViewDetails = (scanId) => {
        navigate('/findings', { state: { selectedScanId: scanId } });
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-8 h-8 border-4 border-[#FF9900]/20 border-t-[#FF9900] rounded-full animate-spin mb-4"></div>
            <p className="font-bold uppercase tracking-widest text-[11px]">Syncing Audit Logs...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            
            {scans.length > 0 ? (
                <>
                    {/* --- 1. SEPARATE FILTER/SORT TOOLBAR (Floating White Box) --- */}
                    <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4 border-r border-slate-100 pr-8">
                            <div className="bg-orange-50 p-2.5 rounded-xl">
                                <FilterIcon size={20} className="text-[#FF9900]" />
                            </div>
                            <div>
                                <h4 className="text-[18px] font-black text-slate-900 uppercase leading-none">History Sort</h4>
                            </div>
                        </div>

                        <div className="flex items-center gap-7 flex-1 justify-end pl-8">
                            <div className="flex items-center gap-3">
                                <div className="relative group min-w-[200px]">
                                    <select 
                                        className="appearance-none w-full text-[14px] font-bold text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl pl-5 pr-12 py-3 outline-none hover:bg-white hover:border-[#FF9900]/30 transition-all cursor-pointer"
                                        value={sortOrder}
                                        onChange={(e) => setSortOrder(e.target.value)}
                                    >
                                        <option value="desc">Newest First</option>
                                        <option value="asc">Oldest First</option>
                                    </select>
                                    <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-[#FF9900]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- 2. MAIN DATA TABLE (Separate White Box) --- */}
                    <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-280px)]">
                        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
                            <Activity size={18} className="text-slate-400" />
                            <h3 className="font-black text-slate-800 uppercase tracking-tight text-[14px]">
                                Scan Session Logs ({scans.length})
                            </h3>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-slate-400 uppercase text-[10px] tracking-[0.25em] font-black bg-slate-50/50">
                                        <th className="px-8 py-5 border-b border-slate-100">Audit Date</th>
                                        <th className="px-6 py-5 border-b border-slate-100">Duration</th>
                                        <th className="px-6 py-5 border-b border-slate-100">Status</th>
                                        <th className="px-6 py-5 border-b border-slate-100 text-center">Severities (H/M/L)</th>
                                        <th className="px-8 py-5 border-b border-slate-100 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {sortedScans.map((scan) => (
                                        <tr key={scan.scan_id} className="hover:bg-slate-50/80 transition-all group">
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[14px] font-black text-slate-800 uppercase">
                                                        {new Date(scan.start_time).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                        {new Date(scan.start_time).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 font-mono text-[13px] text-slate-500 font-bold">
                                                {scan.duration ? `${Number(scan.duration).toFixed(2)}s` : '0.00s'}
                                            </td>
                                            <td className="px-6 py-6">
                                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                                    scan.scan_status === 'COMPLETED' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                    {scan.scan_status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="flex justify-center gap-2">
                                                    <div className="bg-red-50 text-red-600 px-2 py-1 rounded-md text-[12px] font-black border border-red-100">{scan.high_count || 0}</div>
                                                    <div className="bg-amber-50 text-amber-600 px-2 py-1 rounded-md text-[12px] font-black border border-amber-100">{scan.med_count || 0}</div>
                                                    <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[12px] font-black border border-blue-100">{scan.low_count || 0}</div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button onClick={() => handleViewDetails(scan.scan_id)} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-[#FF9900] transition-all active:scale-95 shadow-md group-hover:shadow-[#FF9900]/20">
                                                    <ExternalLink size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                /* --- VIEW 3: EMPTY STATE (Big White Box) --- */
                <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-208px)] p-10 flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200 border border-slate-100">
                        <Search size={48} />
                    </div>
                    <h3 className="text-[24px] font-black text-slate-800 uppercase tracking-tight mb-2">No History Recorded</h3>
                    <p className="text-slate-500 max-w-[340px] text-[15px] mb-10 font-medium leading-relaxed">
                        Your security audit logs are empty. Start a scan to monitor your AWS environment.
                    </p>
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-3 bg-[#FF9900] text-white px-10 py-4 rounded-2xl font-bold text-[13px] uppercase tracking-[0.2em] shadow-xl shadow-[#FF9900]/20 hover:scale-105 transition-all active:scale-95"
                    >
                        <PlayCircle size={20} />
                        Go to Scanner
                    </button>
                </div>
            )}
        </div>
    );
};

export default History;