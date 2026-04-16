import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Activity, Clock, ExternalLink, ChevronDown, Filter as FilterIcon, Search, Loader2 
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

    const sortedScans = [...scans].sort((a, b) => {
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    const handleViewDetails = (scanId, status) => {
        if (status === 'COMPLETED') {
            navigate('/findings', { state: { selectedScanId: scanId } });
        }
    };

    const formatTime = (dateString) => {
        if (!dateString) return "--:--:--";
        return new Date(dateString).toLocaleTimeString('en-MY', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString('en-MY', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        });
    };

    if (loading) return (
        <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-208px)] p-20 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <Loader2 className="animate-spin text-[#FF9900] mb-4" size={48} />
            <p className="text-slate-500 font-bold text-lg uppercase tracking-widest">Syncing Audit Logs...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-5 pb-6">
            
            {scans.length > 0 ? (
                <>
                    <div className="bg-white border border-slate-200 rounded-2xl pl-6 px-4 py-4 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4 border-r border-slate-100 pr-8">
                            <div className="bg-orange-50 p-2.5 rounded-xl">
                                <FilterIcon size={20} className="text-[#FF9900]" />
                            </div>
                            <div>
                                <h4 className="text-[16px] font-extrabold text-slate-700 tracking-wide uppercase leading-none">History Filters</h4>
                            </div>
                        </div>

                        <div className="flex items-center gap-7 flex-1 justify-end pl-8">
                            <div className="relative group min-w-[200px]">
                                <select 
                                    className="appearance-none w-full text-[14px] font-semibold text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl pl-5 pr-12 py-3 outline-none hover:bg-white hover:border-[#FF9900]/30 transition-all cursor-pointer"
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                >
                                    <option value="desc">Newest Scans</option>
                                    <option value="asc">Oldest Scans</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-[#FF9900]" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="mb-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl shadow-sm">
                                    <Activity size={20} className="text-slate-700" />
                                    <div className="flex items-center gap-3">
                                        <span className="text-[13px] font-extrabold text-slate-700 uppercase tracking-[0.15em] leading-none">
                                            Audit Sessions
                                        </span>
                                        <div className="w-[1px] h-5 bg-[#252F3E]/10"></div>
                                        <div className="flex items-center pl-1">
                                            <div className="bg-[#252F3E]/95 text-white px-4 h-[34px] flex items-center justify-center rounded-xl font-bold text-[13px] shadow-md shadow-slate-200">
                                                Total of {scans.length} Scans
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                            <table className="w-full border-collapse table-fixed"> 
                                <thead className="bg-slate-100 border-b border-slate-100">
                                    <tr className="bg-slate-50/80 border-b border-slate-200">
                                        <th className="px-6 py-4 w-[16%] text-center">
                                            <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">Audit Date</span>
                                        </th>
                                        <th className="px-6 py-4 w-[14%] text-center">
                                            <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">Start</span>
                                        </th>
                                        <th className="px-6 py-4 w-[14%] text-center">
                                            <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">End</span>
                                        </th>
                                        <th className="px-6 py-4 w-[13%] text-center">
                                            <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">Duration</span>
                                        </th>
                                        <th className="px-6 py-4 w-[13%] text-center">
                                            <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">Status</span>
                                        </th>
                                        <th className="px-6 py-4 w-[20%] text-center">
                                            <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">Severities</span>
                                        </th>
                                        <th className="px-6 py-4 w-[10%] text-center">
                                            <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">Action</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {sortedScans.map((scan) => (
                                        <tr key={scan.scan_id} className="hover:bg-slate-50/50 transition-all duration-200 group">
                                            <td className="px-4 py-7 text-center text-[16px] font-bold text-slate-900 uppercase">
                                                {formatDate(scan.start_time)}
                                            </td>
                                            <td className="px-4 py-7 text-center text-[15px] font-bold text-slate-700">
                                                {formatTime(scan.start_time)}
                                            </td>
                                            <td className="px-4 py-7 text-center text-[15px] font-bold text-slate-700">
                                                {scan.end_time ? formatTime(scan.end_time) : "--:--:--"}
                                            </td>
                                            <td className="px-4 py-7 text-center font-bold text-slate-900 text-[16px]">
                                                {scan.duration && scan.duration > 0 ? `${Number(scan.duration).toFixed(2)}s` : "---"}
                                            </td>
                                            <td className="px-4 py-7 text-center">
                                                <div className="flex justify-center">
                                                    {scan.scan_status === 'COMPLETED' ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm transition-all duration-300">
                                                            <div className="relative flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                            </div>
                                                            <span className="text-[11px] font-black uppercase tracking-widest">Completed</span>
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 shadow-sm transition-all duration-300">
                                                            <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                                                            <span className="text-[11px] font-black uppercase tracking-widest">{scan.scan_status}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-7">
                                                <div className="flex justify-center items-center gap-3">
                                                    {scan.scan_status === 'COMPLETED' ? (
                                                        <>
                                                            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-full shadow-sm shadow-red-100 min-w-[50px] justify-center">
                                                                <span className="text-[14px] font-black">{scan.high_count || 0}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full shadow-sm shadow-amber-100 min-w-[50px] justify-center">
                                                                <span className="text-[14px] font-black">{scan.med_count || 0}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full shadow-sm shadow-emerald-100 min-w-[50px] justify-center">
                                                                <span className="text-[14px] font-black">{scan.low_count || 0}</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="bg-slate-50 border border-slate-200 text-slate-500 px-6 py-1 rounded-full text-[12px] font-black tracking-widest shadow-inner">
                                                            N/A
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-7 text-center">
                                                <button 
                                                    disabled={scan.scan_status !== 'COMPLETED'}
                                                    onClick={() => handleViewDetails(scan.scan_id, scan.scan_status)} 
                                                    className={`p-2.5 rounded-xl transition-all shadow-md inline-flex items-center justify-center ${
                                                        scan.scan_status === 'COMPLETED' 
                                                        ? 'bg-[#FF9900] text-white hover:bg-[#D17D00] active:scale-95' 
                                                        : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                                                    }`}
                                                >
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
                <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-208px)] p-10 flex flex-col items-center justify-center text-center">
                    <div className="bg-slate-50 p-8 rounded-full mb-6 border border-slate-100">
                        <Search size={60} className="text-slate-300" />
                    </div>
                    <h3 className="text-[20px] font-black text-slate-800 uppercase tracking-tight">No History Recorded</h3>
                    <p className="text-slate-500 max-w-[340px] text-[15px] mt-3 font-medium leading-relaxed">
                        Your security audit logs are empty. Start a scan to monitor your AWS environment.
                    </p>
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="mt-8 px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all active:scale-95 text-[13px] tracking-widest uppercase"
                    >
                        Initiate Audit
                    </button>
                </div>
            )}
        </div>
    );
};

export default History;