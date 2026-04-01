import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, Filter as FilterIcon, ChevronDown, Clock, Search } from 'lucide-react';
import axios from 'axios';

const Findings = ({ scanId, user }) => { 
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');

  useEffect(() => {
    const fetchFindings = async () => {
      try {
        setLoading(true);
        const storedUser = JSON.parse(localStorage.getItem('user'));
        const currentUserId = user?.user_id || user?.id || storedUser?.user_id || storedUser?.id;
        const targetId = scanId || "latest";

        const response = await axios.get(`http://localhost:5000/api/scan-results/${targetId}`, {
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
  }, [scanId, user]);

  const filteredData = findings.filter(item => {
    const categoryMatch = filterCategory === 'All' || item.category === filterCategory;
    const severityMatch = filterSeverity === 'All' || item.severity === filterSeverity;
    return categoryMatch && severityMatch;
  });

  const getSeverityStyle = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical': return 'bg-red-50 text-red-600 border-red-100';
      case 'high': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'medium': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'low': return 'bg-blue-50 text-blue-600 border-blue-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  // --- 1. LOADING STATE ---
  if (loading) {
    return (
      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-280px)] p-20 flex flex-col items-center justify-center animate-in fade-in duration-300">
        <Loader2 className="animate-spin text-[#FF9900] mb-4" size={48} />
        <p className="text-slate-500 font-bold text-lg uppercase tracking-widest">Analyzing AWS Infrastructure...</p>
      </div>
    );
  }

  // --- 2. NO SCAN ENTRY ---
  if (!scanId && findings.length === 0) {
    return (
      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm min-h-[calc(100vh-220px)] p-20 flex flex-col items-center justify-center text-center">
        <div className="bg-slate-50 p-8 rounded-full mb-6 border border-slate-100">
          <Search className="text-slate-300" size={60} />
        </div>
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Scan Entry Found</h3>
        <p className="text-slate-500 mt-3 max-w-sm font-medium leading-relaxed">
          It looks like you haven't started a security audit yet. Please return to the dashboard to initiate a new scan.
        </p>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="mt-8 px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all active:scale-95 text-[13px] tracking-widest uppercase"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // --- 3. NO MISCONFIGURATIONS ---
  if (scanId && findings.length === 0) {
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

  // --- 4. RESULTS VIEW (With Unified White Wrapper) ---
  return (
    <div className="flex flex-col gap-8 pb-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* --- FILTER TOOLBAR --- */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4 border-r border-slate-100 pr-8">
          <div className="bg-orange-50 p-2.5 rounded-xl">
            <FilterIcon size={20} className="text-[#FF9900]" />
          </div>
          <div>
            <h4 className="text-[18px] font-black text-slate-900 uppercase leading-none">Filters</h4>
          </div>
        </div>

        <div className="flex items-center gap-7 flex-1 justify-end pl-8">
          <div className="relative group min-w-[220px]">
            <select 
              className="appearance-none w-full text-[14px] font-bold text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl pl-5 pr-12 py-3 outline-none hover:bg-white hover:border-[#FF9900]/30 transition-all cursor-pointer"
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
              className="appearance-none w-full text-[14px] font-bold text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl pl-5 pr-12 py-3 outline-none hover:bg-white hover:border-[#FF9900]/30 transition-all cursor-pointer"
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
        <div className="px-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-7 bg-[#FF9900] rounded-full"></div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Audit Analysis Results</h3>
          </div>
          
          <div className="flex items-center justify-between ml-4">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-[14px] font-bold text-slate-600 uppercase tracking-widest">Results Detected:</span>
              <span className="text-[14px] font-extrabold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                {findings.length > 0 ? findings[0].scan_time : "Processing..."}
              </span>
            </div>
            
            <div className="bg-red-500 text-white text-[14px] font-black px-4 py-1 rounded-lg shadow-lg shadow-red-500/10 uppercase tracking-widest">
              {filteredData.length} Total Risks
            </div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse table-fixed"> 
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-slate-500">
                <th className="px-8 py-5 w-[15%] text-center text-[15px] font-black uppercase tracking-widest">Category</th>
                <th className="px-8 py-5 w-[15%] text-center text-[15px] font-black uppercase tracking-widest">Severity</th>
                <th className="px-8 py-5 w-[38%] text-left text-[15px] font-black uppercase tracking-widest">Finding Detail</th>
                <th className="px-8 py-5 w-[15%] text-center text-[15px] font-black uppercase tracking-widest">Service</th>
                <th className="px-8 py-5 w-[17%] text-center text-[15px] font-black uppercase tracking-widest">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length > 0 ? filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-all duration-200 group">
                  <td className="px-8 py-7 text-[16px] font-extrabold text-slate-900 text-center">{item.category}</td>
                  <td className="px-8 py-7 text-center">
                    <span className={`${getSeverityStyle(item.severity)} border text-[14px] font-extrabold px-4 py-1.5 rounded-lg uppercase tracking-tighter inline-block`}>
                      {item.severity}
                    </span>
                  </td>
                  <td className="px-8 py-7 text-left">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-extrabold text-slate-900 text-[17px] leading-none group-hover:text-[#FF9900] transition-colors">
                        {item.finding}
                      </span>
                      <span className="text-[14px] text-slate-400 font-bold leading-relaxed italic">
                        {item.description}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-7 font-black text-slate-600 text-[16px] text-center">{item.service}</td>
                  <td className="px-8 py-7 text-slate-400 text-[14px] font-bold text-center tracking-tight uppercase">
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