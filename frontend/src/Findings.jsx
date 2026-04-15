import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Added for navigation state
import { AlertCircle, ShieldCheck, Loader2, Filter as FilterIcon, ChevronDown, Clock, Search, ArrowLeft, HistoryIcon } from 'lucide-react';
import axios from 'axios';

const Findings = ({ scanId: propScanId, user }) => { 
  const location = useLocation();
  const navigate = useNavigate();
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');

  // --- NEW: Priority Logic for Scan ID ---
  // Checks if a scanId was passed via navigate state (from History page)
  // Otherwise uses the prop scanId or "latest"
  const passedScanId = location.state?.selectedScanId;
  const targetScanId = passedScanId || propScanId || "latest";

  useEffect(() => {
    const fetchFindings = async () => {
      try {
        setLoading(true);
        const storedUser = JSON.parse(localStorage.getItem('user'));
        const currentUserId = user?.user_id || user?.id || storedUser?.user_id || storedUser?.id;

        const response = await axios.get(`http://localhost:5000/api/scan-results/${targetScanId}`, {
            params: { user_id: currentUserId } 
        });
        setFindings(response.data);
      } catch (err) {
        console.error("❌ Fetch error:", err);
        setFindings([]);
      } finally {
        setLoading(false);
      }
    };
    if (user || localStorage.getItem('user')) fetchFindings();
  }, [targetScanId, user]); // Refetch if targetScanId changes

const filteredData = findings.filter(item => {
  const categoryMatch = filterCategory === 'All' || item.category === filterCategory;
  const severityMatch = filterSeverity === 'All' || item.severity === filterSeverity;
  return categoryMatch && severityMatch;
});

const getSeverityStyle = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'HIGH': 
        return {
          container: 'bg-red-50 border-red-200 text-red-700 shadow-sm shadow-red-100',
          dot: 'bg-red-500 animate-pulse'
        };
      case 'MEDIUM': 
        return {
          container: 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm shadow-amber-100',
          dot: 'bg-amber-500'
        };
      case 'LOW': 
        return {
          container: 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100',
          dot: 'bg-emerald-500'
        };
      default: 
        return {
          container: 'bg-slate-50 border-slate-200 text-slate-600',
          dot: 'bg-slate-400'
        };
    }
};

const getServiceStyle = (service) => {
    const s = service?.toUpperCase();
    if (s?.includes('S3')) return 'bg-[#FF9900]/10 border border-[#FF9900]/20 px-3 py-1 rounded-[1.5rem] text-[#FF9900]';
    if (s?.includes('IAM')) return 'bg-[#FF9900]/10 border border-[#FF9900]/20 px-3 py-1 rounded-[1.5rem] text-[#FF9900]';
    if (s?.includes('VPC')) return 'bg-[#FF9900]/10 border border-[#FF9900]/20 px-3 py-1 rounded-[1.5rem] text-[#FF9900]';
    if (s?.includes('EC2')) return 'bg-[#FF9900]/10 border border-[#FF9900]/20 px-3 py-1 rounded-[1.5rem] text-[#FF9900]';
    if (s?.includes('EBS')) return 'bg-[#FF9900]/10 border border-[#FF9900]/20 px-3 py-1 rounded-[1.5rem] text-[#FF9900]';
    return 'bg-slate-50 border-slate-100 text-slate-700';
};

  // --- 1. LOADING STATE ---
if (loading) {
  return (
    <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-208px)] p-20 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <Loader2 className="animate-spin text-[#FF9900] mb-4" size={48} />
      <p className="text-slate-500 font-bold text-lg uppercase tracking-widest">Analyzing AWS Infrastructure...</p>      </div>
  );
}

// --- 2. NO SCAN ENTRY ---
  if (targetScanId === "latest" && findings.length === 0) {
    return (
      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-208px)] p-10 flex flex-col items-center justify-center text-center">
        <div className="bg-slate-50 p-8 rounded-full mb-6 border border-slate-100">
          <Search className="text-slate-300" size={60} />
        </div>
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Scan Entry Found</h3>
        <p className="text-slate-500 mt-3 max-w-sm font-medium leading-relaxed">
          It looks like you haven't started a security audit yet. Please return to the dashboard to initiate a new scan.
        </p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="mt-8 px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all active:scale-95 text-[13px] tracking-widest uppercase"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // --- 3. NO MISCONFIGURATIONS ---
  if (findings.length === 0) {
    return (
      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-220px)] p-20 flex flex-col items-center justify-center text-center">
        <div className="bg-green-50 p-8 rounded-full mb-6 border border-green-100">
          <ShieldCheck className="text-green-500" size={60} />
        </div>
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Misconfigurations Detected</h3>
        <p className="text-slate-500 mt-3 max-w-sm font-medium leading-relaxed">
          Scan complete! Your AWS environment is currently secure and follows all OWASP CNAS best practices.
        </p>
        <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-200 animate-pulse">
           <div className="w-2 h-2 rounded-full bg-green-500"></div>
           <span className="text-[11px] font-black text-green-700 uppercase tracking-widest">Environment Verified</span>
        </div>
      </div>
    );
  }

  // --- 4. RESULTS VIEW ---
  return (
    <div className="flex flex-col gap-5 pb-6">
      
      {/* --- NEW: HISTORICAL VIEW BANNER --- */}
      {passedScanId && (
        <div className="bg-[#252F3E] rounded-2xl p-4 px-6 flex items-center justify-between shadow-lg animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4 text-white">
            <div className="bg-[#FF9900] p-2 rounded-lg text-white">
                <HistoryIcon size={20} />
            </div>
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#FF9900]">Archive Report</p>
              <h4 className="text-[14px] font-bold text-white">Reviewing scan: <span className="font-mono text-white/70">{passedScanId}</span></h4>
            </div>
          </div>
          <button 
            onClick={() => navigate('/findings', { replace: true, state: {} })}
            className="flex items-center gap-2 bg-[#FF9900] hover:bg-[#D17D00] px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all text-white border border-white/20"
          >
            <ArrowLeft size={14} /> Back to Latest
          </button>
        </div>
      )}

      {/* --- FILTER TOOLBAR --- */}
      <div className="bg-white border border-slate-200 rounded-2xl pl-6 px-4 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4 border-r border-slate-100 pr-8">
          <div className="bg-orange-50 p-2.5 rounded-xl">
            <FilterIcon size={20} className="text-[#FF9900]" />
          </div>
          <div>
            <h4 className="text-[16px] font-extrabold text-slate-700 tracking-wide uppercase leading-none">Findings Filters</h4>
          </div>
        </div>

        <div className="flex items-center gap-7 flex-1 justify-end pl-8">
          <div className="relative group min-w-[220px]">
            <select 
              className="appearance-none w-full text-[14px] font-semibold text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl pl-5 pr-12 py-3 outline-none hover:bg-white hover:border-[#FF9900]/30 transition-all cursor-pointer"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All OWASP Categories</option>
              <option value="CNAS-1">CNAS-1</option>
              <option value="CNAS-3">CNAS-3</option>
              <option value="CNAS-6">CNAS-6</option>
            </select>
            <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-[#FF9900]" />
          </div>

          <div className="relative group min-w-[180px]">
            <select 
              className="appearance-none w-full text-[14px] font-semibold text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl pl-5 pr-12 py-3 outline-none hover:bg-white hover:border-[#FF9900]/30 transition-all cursor-pointer"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="All">All Severities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-[#FF9900]" />
          </div>
        </div>
      </div>

      {/* --- AUDIT ANALYSIS HEADER --- */}
      <div className="flex flex-col gap-4">
        <div className="mb-2">
          <div className="flex items-center justify-between">
            {/* Left Side: Audit Metadata */}
            <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl shadow-sm">
              <Clock size={20} className="text-slate-700" />
              
              {/* Changed to flex-row and items-center to put them side-by-side */}
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-extrabold text-slate-700 uppercase tracking-[0.15em] leading-none">
                  Analysis Completed
                </span>

                {/* Subtle Vertical Divider to match the date styling */}
                <div className="w-[1px] h-5 bg-[#252F3E]/10"></div>

                <div className="flex items-center pl-1">
                  <div className="bg-[#252F3E]/95 text-white px-4 h-[34px] flex items-center justify-center rounded-xl font-bold text-[13px] shadow-md shadow-slate-200 whitespace-nowrap">
                    {findings.length > 0 && findings[0]?.scan_time 
                      ? findings[0].scan_time 
                      : "Initializing..."}
                  </div>
                </div>
              </div>
            </div>
          </div>
            
            {/* Right Side: Risk Counter */}
            <div className="flex items-center gap-3 bg-white border border-red-100 pl-4 pr-1.5 py-1.5 rounded-2xl shadow-sm">
              {/* Added AlertCircle Icon */}
     
              <AlertCircle size={20} className="text-red-500" />
      
              <span className="text-[12px] font-black text-red-500 uppercase tracking-[0.1em]">
                Threats Detected
              </span>

              {/* Subtle Vertical Divider to match the date styling */}
              <div className="w-[1px] h-5 bg-red-100"></div>

              <div className="bg-red-500 text-white min-w-[44px] h-[34px] ml-1 px-3 flex items-center justify-center rounded-xl font-black text-[16px] shadow-md shadow-red-200">
                {filteredData.length}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse table-fixed"> 
            <thead className="bg-slate-100 border-b border-slate-100">
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-6 py-4 w-[15%] text-center">
                  <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">
                    Category
                  </span>
                </th>
                <th className="px-6 py-4 w-[15%] text-center">
                  <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">
                    Severity
                  </span>
                </th>
                <th className="px-6 py-4 w-[38%] text-left">
                  <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">
                    Finding Detail
                  </span>
                </th>
                <th className="px-6 py-4 w-[15%] text-center">
                  <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">
                    Service
                  </span>
                </th>
                <th className="px-6 py-4 w-[17%] text-center">
                  <span className="text-[12px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/50 px-2 py-1 rounded-md">
                    Timestamp
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredData.length > 0 ? filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-all duration-200 group">
                  <td className="px-8 py-7 text-[17px] font-bold text-slate-900 text-center">{item.category}</td>
                  <td className="px-8 py-8 text-center">
                    {(() => {
                      const style = getSeverityStyle(item.severity);
                      return (
                        <div className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border ${style.container} transition-all duration-300`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {/* The Text Label */}
                          <span className="text-[13px] font-black uppercase tracking-[0.15em]">
                            {item.severity}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-8 py-7 text-left">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-bold text-slate-900 text-[17px] leading-none group-hover:text-[#FF9900] transition-colors">
                        {item.finding}
                      </span>
                      <span className="text-[15px] text-slate-500 font-semibold leading-relaxed italic">
                        {item.description}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-7 text-center">
                    <span className={`inline-block px-3 py-1 rounded-md border text-[13px] font-black uppercase tracking-wider ${getServiceStyle(item.service)} shadow-sm transition-transform duration-200 group-hover:scale-105`}>
                      {item.service}
                    </span>
                  </td>
                  <td className="px-8 py-7 text-slate-700 text-[14px] font-bold text-center tracking-tight uppercase">
                    {item.scan_time}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-8 py-32 text-center text-slate-400 font-bold italic">
                    No results match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Findings;