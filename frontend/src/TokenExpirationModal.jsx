import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, ShieldAlert, LogOut } from 'lucide-react';
import { renewToken, isTokenExpired, getTimeUntilExpiry, clearAuthData, getTokenExpiry } from './utils/tokenManager';

/**
 * TokenExpirationModal - Displays an enterprise-styled popup when the token is about to expire
 * Integrates directly with tokenManager utility hooks and local dashboard themes.
 */
export default function TokenExpirationModal({ user }) {
  const [showModal, setShowModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isRenewing, setIsRenewing] = useState(false);

  useEffect(() => {
    // Check token expiration every 1 second for real-time updates
    const checkInterval = setInterval(() => {
      const timeMs = getTimeUntilExpiry();
      
      // Debug logging matching backend scan patterns
      console.log('⏱️ Token expiry check:', {
        timeMs,
        timeRemainingSecs: Math.floor(timeMs / 1000),
        tokenExpiry: getTokenExpiry(),
        isExpired: isTokenExpired()
      });

      // Show modal when less than 3 minutes remain
      const threeMinutesInMs = 3 * 60 * 1000;
      if (timeMs < threeMinutesInMs && timeMs > 0) {
        setShowModal(true);
        
        // Update remaining time display
        const seconds = Math.floor(timeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        
        if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${secs}s`);
        } else {
          setTimeRemaining(`${secs}s`);
        }
      }
      
      // Auto logout if token is already expired
      if (isTokenExpired() && showModal) {
        console.log('🛑 Token already expired, logging out...');
        handleLogout();
      }
    }, 1000); // Check every 1 second

    return () => clearInterval(checkInterval);
  }, [showModal]);

  /**
   * Handle token renewal
   */
  const handleRenew = async () => {
    setIsRenewing(true);
    console.log('🔄 Attempting to renew token...');
    const result = await renewToken();
    
    if (result) {
      setShowModal(false);
      console.log('✅ Token renewed, session extended!');
    } else {
      console.error('❌ Token renewal failed. Please log in again.');
      handleLogout();
    }
    
    setIsRenewing(false);
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    console.log('🚪 Logging out user...');
    clearAuthData();
    window.location.href = '/signin';
  };

  // Render check ensuring background cycle runs without visual DOM blocking leaks
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#252F3E]/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[1.5rem] shadow-2xl pt-5 pb-8 px-8 flex flex-col relative animate-in zoom-in-95 duration-300 border border-slate-200">
        
        

        {/* Tactical Header Layout matching AWS credential box patterns */}
        <div className="flex items-center gap-4 mb-4 mt-2 px-1">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-red-500/10 rounded-2xl animate-pulse scale-125" />
            <div className="bg-red-50 border border-red-100 p-3.5 rounded-2xl relative z-10">
              <ShieldAlert size={26} className="text-red-500" />
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-[22px] font-bold text-slate-800 tracking-widest leading-none uppercase">
              Token Expiration
            </h2>
            <p className="text-[12px] text-slate-500 font-semibold uppercase tracking-widest mt-2 leading-none">
              Session Security Warning
            </p>
          </div>
        </div>

        <hr className="border-slate-200 mb-5 w-full border-t" />

        {/* Warning Banner block mirroring dashboard alert widgets */}
        <div className="mb-5 p-4 bg-amber-50/70 border border-amber-200/60 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
          <p className="text-slate-700 text-[13px] font-normal leading-relaxed tracking-wide">
            Your authenticated management session is approaching its inactivity threshold. Unresponsiveness will automatically revoke active access path tokens.
          </p>
        </div>

        {/* Central Live Counter Monitor */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-[1.25rem] py-5 mb-6 flex flex-col items-center justify-center shadow-inner">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-[0.2em] mb-1.5 leading-none">
            Revocation Countdown
          </span>
          <p className="text-4xl font-mono font-black text-slate-800 tracking-tight select-none">
            {timeRemaining}
          </p>
        </div>

        {/* Action button container row */}
        <div className="flex gap-4 pt-1">
          {/* Terminate / Logout Action Node */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl transition-all shadow-md active:scale-95 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-transparent text-[14px] uppercase tracking-[0.1em] flex items-center justify-center gap-2"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>

          {/* Extend Session Action Node */}
          <button
            type="button"
            onClick={handleRenew}
            disabled={isRenewing}
            className="flex-1 bg-[#FF9900] hover:bg-[#D17D00] disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/10 transition-all active:scale-95 text-[14px] uppercase tracking-[0.1em] flex items-center justify-center gap-2"
          >
            {isRenewing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Renewing...</span>
              </>
            ) : (
              <>
                <Clock size={15} />
                <span>Extend Token</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}