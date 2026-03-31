import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import axios from 'axios';

// 1. FIX: Added 'user' to the props destructuring
const Findings = ({ scanId, user }) => { 
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFindings = async () => {
      try {
        setLoading(true);
        
        // 2. SAFETY: Check for user ID from prop, or fallback to localStorage 
        // in case the prop is slow to load
        const storedUser = JSON.parse(localStorage.getItem('user'));
        const currentUserId = user?.user_id || user?.id || storedUser?.user_id || storedUser?.id;

        const targetId = scanId || "latest";

        console.log(`📡 Fetching [${targetId}] for User ID: ${currentUserId}`);

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

    // Only fetch if we have a user identity (prevents blank calls)
    const userIdExists = user?.user_id || user?.id || localStorage.getItem('user');
    if (userIdExists) {
        fetchFindings();
    }
  }, [scanId, user]); 

  // ... (rest of your loading and empty states)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-slate-100">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
        <p className="text-slate-500 font-medium">Retrieving scan results...</p>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
          <ShieldCheck className="text-slate-300" size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-600">No Findings Available</h3>
        <p className="text-slate-400 text-sm max-w-xs text-center">
          Please initiate a scan from the Dashboard to analyze your AWS infrastructure.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700">
      <h3 className="text-xl font-bold text-slate-800 px-2">
        Latest Scan Results ({findings.length})
      </h3>
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
              <th className="px-8 py-4">Category</th>
              <th className="px-8 py-4">Severity</th>
              <th className="px-8 py-4">Finding</th>
              <th className="px-8 py-4">Service</th>
              <th className="px-8 py-4">Scan Time</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((item) => (
              <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                <td className="px-8 py-5 text-xs font-black text-indigo-600">{item.category}</td>
                <td className="px-8 py-5">
                   <span className="bg-red-100 text-red-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                    {item.severity}
                  </span>
                </td>
                <td className="px-8 py-5 font-bold text-slate-900">{item.finding}</td>
                <td className="px-8 py-5 font-bold text-slate-600">{item.service}</td>
                <td className="px-8 py-5 text-slate-800 text-[11px] font-medium">
                  {item.scan_time}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Findings;