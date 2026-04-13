import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import logoImg from './assets/cloudsentinel_logo.png';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', isError: false });

    const handleReset = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setMessage({ text: "Passwords do not match.", isError: true });
        }

        setLoading(true);
        setMessage({ text: '', isError: false });

        try {
            const response = await fetch(`http://localhost:5000/auth/reset-password/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();

            if (response.ok) {
                setMessage({ text: "Password updated! Redirecting...", isError: false });
                setTimeout(() => navigate('/signin'), 2000);
            } else {
                setMessage({ text: data.error || "Reset failed", isError: true });
            }
        } catch (error) {
            setMessage({ text: "Connection failed. Is Flask running?", isError: true });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#252F3E] flex flex-col items-center justify-center pt-12 p-6 font-sans overflow-y-auto">
            <div className="bg-white w-full max-w-[450px] rounded-[3rem] shadow-2xl p-8 flex flex-col items-center">
                
                {/* Logo Section - Exact same as SignIn */}
                <div className="w-full flex justify-center mb-0">
                    <img src={logoImg} alt="CloudSentinel Logo" className="w-full max-w-[250px] h-auto object-contain" />
                </div>

                {/* Header Section - Exact same as SignIn */}
                <h1 className="text-[50px] font-bold tracking-tight mt-4 flex gap-1">
                    <span className="text-black">Cloud</span>
                    <span className="text-[#FF9900]">Sentinel</span>
                </h1>
                <p className="text-[20px] text-[#505050] mb-10 mt-0">Set new password</p>

                {/* Message Box - Exact same as SignIn */}
                {message.text && (
                    <div className={`mb-4 p-3 rounded-xl w-full text-center text-sm font-bold ${message.isError ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {message.text}
                    </div>
                )}

                {/* Reset Form */}
                <form className="w-full space-y-5" onSubmit={handleReset}>
                    <div className="space-y-1">
                        <label className="text-[18px] font-semibold text-slate-700 ml-1">New Password</label>
                        <input 
                            type="password" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-5 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-[18px] text-slate-800 placeholder:text-slate-400"
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[18px] font-semibold text-slate-700 ml-1">Confirm Password</label>
                        <input 
                            type="password" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-5 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-[18px] text-slate-800 placeholder:text-slate-400"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#FF9900] hover:bg-[#D17D00] text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] mt-2 mb-4">
                        {loading ? "Updating..." : "Update Password"}
                    </button>
                </form>
            </div>
            
            {/* Footer Branding - Exact same as SignIn */}
            <div className="mt-6">
                <p className="text-white/60 text-xs font-medium tracking-[0.2em] uppercase">
                    Secure AWS misconfiguration detection
                </p>
            </div>
        </div>
    );
}

export default ResetPassword;