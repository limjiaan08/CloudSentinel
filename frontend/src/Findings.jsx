import React from 'react';
import { ShieldAlert, ExternalLink } from 'lucide-react';

const Findings = () => {
  const findingsData = [
    { id: 1, service: 'S3', title: 'Public Read Access Enabled', severity: 'Critical' },
    { id: 2, service: 'IAM', title: 'MFA not enabled for Root', severity: 'High' }
  ];

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-xl font-bold text-slate-800 px-2">Security Findings</h3>
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
              <th className="px-8 py-4">Service</th>
              <th className="px-8 py-4">Finding</th>
              <th className="px-8 py-4">Severity</th>
            </tr>
          </thead>
          <tbody>
            {findingsData.map((item) => (
              <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                <td className="px-8 py-5 font-bold text-slate-600">{item.service}</td>
                <td className="px-8 py-5 font-bold text-slate-900">{item.title}</td>
                <td className="px-8 py-5">
                  <span className="bg-red-100 text-red-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                    {item.severity}
                  </span>
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

