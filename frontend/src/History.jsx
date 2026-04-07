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

    const sortedScans = [...scans].sort((a, b) => {
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    const handleViewDetails = (scanId) => {
        navigate('/findings', { state: { selectedScanId: scanId } });
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
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-8 h-8 border-4 border-[#FF9900]/20 border-t-[#FF9900] rounded-full animate-spin mb-4"></div>
            <p className="font-bold uppercase tracking-widest text-[11px]">Syncing Audit Logs...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 pb-6 animate-in fade-in duration-500">
            
            {scans.length > 0 ? (
                <>
                    {/* --- 1. FILTER TOOLBAR --- */}
                    <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4 border-r border-slate-100 pr-8">
                            <div className="bg-orange-50 p-2.5 rounded-xl">
                                <FilterIcon size={20} className="text-[#FF9900]" />
                            </div>
                            <div>
                                <h4 className="text-[18px] font-black text-slate-900 uppercase leading-none">History Filters</h4>
                            </div>
                        </div>

                        <div className="flex items-center gap-7 flex-1 justify-end pl-8">
                            <div className="relative group min-w-[200px]">
                                <select 
                                    className="appearance-none w-full text-[14px] font-bold text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl pl-5 pr-12 py-3 outline-none hover:bg-white hover:border-[#FF9900]/30 transition-all cursor-pointer"
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

                    {/* --- 2. AUDIT ANALYSIS HEADER (Matching Findings) --- */}
                    <div className="flex flex-col gap-4">
                        <div className="px-2">
                            <div className="flex items-center justify-between ml-4">
                                <div className="flex items-center gap-2">
                                    <Clock size={18} className="text-slate-400" />
                                    <span className="text-[14px] font-extrabold text-slate-700 uppercase tracking-widest">Audit Sessions:</span>
                                    <span className="text-[14px] font-extrabold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                        Total of {scans.length} Scans
                                    </span>
                                </div>
                                
                                <div className="bg-slate-900 text-white text-[14px] font-black px-4 py-1.5 rounded-lg shadow-lg uppercase tracking-widest">
                                    Full Audit Trail
                                </div>
                            </div>
                        </div>
                        {/* --- 3. MAIN DATA TABLE --- */}
                        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                            <table className="w-full border-collapse table-fixed"> 
                                <thead className="bg-slate-100 border-b border-slate-100">
                                    <tr className="text-slate-700">
                                        <th className="py-5 w-[16%] text-center text-[15px] font-black uppercase tracking-widest">Audit Date</th>
                                        <th className="py-5 w-[14%] text-center text-[15px] font-black uppercase tracking-widest">Start Time</th>
                                        <th className="py-5 w-[14%] text-center text-[15px] font-black uppercase tracking-widest">End Time</th>
                                        <th className="py-5 w-[13%] text-center text-[15px] font-black uppercase tracking-widest">Duration</th>
                                        <th className="py-5 w-[13%] text-center text-[15px] font-black uppercase tracking-widest">Status</th>
                                        <th className="py-5 w-[20%] text-center text-[15px] font-black uppercase tracking-widest">Severities <br></br>(HIGH, MEDIUM, LOW)</th>
                                        <th className="py-5 w-[10%] text-center text-[15px] font-black uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300">
                                    {sortedScans.map((scan) => (
                                        <tr key={scan.scan_id} className="hover:bg-slate-50/50 transition-all duration-200 group">
                                            <td className="py-7 text-center text-[17px] font-extrabold text-slate-800 uppercase">
                                                {formatDate(scan.start_time)}
                                            </td>
                                            
                                            <td className="py-7 text-center text-[17px] font-extrabold text-slate-800 uppercase">
                                                {formatTime(scan.start_time)}
                                            </td>
                                            
                                            <td className="py-7 text-center text-[17px] font-extrabold text-slate-800 uppercase">
                                                {/* If end_time is null (cancelled), show dashes */}
                                                {scan.end_time ? formatTime(scan.end_time) : "--:--:--"}
                                            </td>
                                            
                                            <td className="py-7 text-center font-extrabold text-slate-800 text-[17px]">
                                                {/* If duration is null or 0 (cancelled), show dashes */}
                                                {scan.duration && scan.duration > 0 ? `${Number(scan.duration).toFixed(2)}s` : "---"}
                                            </td>
                                            
                                            <td className="py-7 text-center">
                                                <span className={`text-[14px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider inline-block border ${
                                                    scan.scan_status === 'COMPLETED' 
                                                    ? 'bg-green-500 text-white border-green-100' 
                                                    : 'bg-yellow-500 text-white border-yellow-100'
                                                }`}>
                                                    {scan.scan_status}
                                                </span>
                                            </td>
                                            
                                            <td className="py-7 text-center">
                                                {/* flex justify-center ensures the badge group is centered under the title */}
                                                <div className="flex justify-center items-center gap-2">
                                                    <div className="bg-red-500 text-white px-2.5 py-1 rounded-md text-[17px] font-black min-w-[32px]">
                                                        {scan.high_count || 0}
                                                    </div>
                                                    <div className="bg-yellow-500 text-white px-2.5 py-1 rounded-md text-[17px] font-black min-w-[32px]">
                                                        {scan.med_count || 0}
                                                    </div>
                                                    <div className="bg-blue-500 text-white px-2.5 py-1 rounded-md text-[17px] font-black min-w-[32px]">
                                                        {scan.low_count || 0}
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            <td className="py-7 text-center">
                                                <button 
                                                    onClick={() => handleViewDetails(scan.scan_id)} 
                                                    className="p-3 bg-[#252F3E] text-white rounded-xl hover:bg-[#FF9900] transition-all active:scale-95 shadow-md inline-flex items-center justify-center"
                                                >
                                                    <ExternalLink size={18} />
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
                /* --- VIEW 3: EMPTY STATE --- */
                <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-208px)] p-10 flex flex-col items-center justify-center text-center">
                    <div className="bg-slate-50 p-8 rounded-full mb-6 border border-slate-100">
                        <Search size={60} className="text-slate-300" />
                    </div>
                    <h3 className="text-[24px] font-black text-slate-800 uppercase tracking-tight">No History Recorded</h3>
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