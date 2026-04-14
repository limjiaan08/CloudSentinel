import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import logoImg from './assets/cloudsentinel_logo.png';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', isError: false });

    const [isVerifying, setIsVerifying] = useState(true);
    const [isTokenValid, setIsTokenValid] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        const checkToken = async () => {
            try {
                const response = await fetch(`http://localhost:5000/auth/verify-reset-token/${token}`);
                const data = await response.json();
                
                if (response.ok && data.valid) {
                    setIsTokenValid(true);
                } else {
                    setIsTokenValid(false);
                    // We don't set the message state here because we use the "Error View" below
                }
            } catch (err) {
                setIsTokenValid(false);
            } finally {
                setIsVerifying(false);
            }
        };
        checkToken();
    }, [token]);

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
                setMessage({ text: "Password updated successfully!", isError: false });
                setTimeout(() => navigate('/signin'), 2000);
            } else {
                setMessage({ text: data.error || "Reset failed", isError: true });
            }
        } catch (error) {
            setMessage({ text: "Connection failed.", isError: true });
        } finally {
            setLoading(false);
        }
    };

    if (isVerifying) {
        return (
            <div className="min-h-screen bg-[#252F3E] flex items-center justify-center">
                <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF9900] mx-auto mb-4"></div>
                    <p className="text-lg font-medium">Verifying secure link...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-[#252F3E] flex flex-col items-center font-sans overflow-y-auto relative pt-8">
            <div className="flex-grow flex items-center justify-center w-full p-6">
                <div className="bg-white w-full max-w-[450px] rounded-[3rem] shadow-2xl p-8 flex flex-col items-center my-4">
                    
                    <div className="w-full flex justify-center mb-0">
                        <img src={logoImg} alt="CloudSentinel Logo" className="w-full max-w-[250px] h-auto object-contain" />
                    </div>

                    <h1 className="text-[50px] font-bold tracking-tight mt-4 flex gap-1 leading-tight text-center">
                        <span className="text-black">Cloud</span>
                        <span className="text-[#FF9900]">Sentinel</span>
                    </h1>
                    <p className="text-[20px] text-[#505050] mb-10 mt-0 text-center">Reset your password</p>

                    {/* CONDITIONAL CONTENT */}
                    {isTokenValid ? (
                        <>
                            {/* Only show messages (like "Passwords match") if the token is valid */}
                            {message.text && (
                                <div className={`mb-6 p-4 rounded-2xl w-full text-center text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300 ${
                                    message.isError ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'
                                }`}>
                                    {message.text}
                                </div>
                            )}

                            <form className="w-full space-y-5" onSubmit={handleReset}>
                                <div className="space-y-1">
                                    <label className="text-[18px] font-semibold text-slate-700 ml-1">New Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            required
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-5 pr-12 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-[18px] text-slate-800"
                                            placeholder="Enter new password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FF9900] p-1">
                                            {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[18px] font-semibold text-slate-700 ml-1">Confirm Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showConfirmPassword ? "text" : "password"} 
                                            required
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-5 pr-12 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-[18px] text-slate-800"
                                            placeholder="Confirm your password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FF9900] p-1">
                                            {showConfirmPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                                        </button>
                                    </div>
                                </div>

                                <button type="submit" disabled={loading} className="w-full bg-[#FF9900] hover:bg-[#D17D00] text-white font-bold py-4 rounded-2xl shadow-lg mt-2 mb-4 disabled:opacity-50">
                                    {loading ? "Updating..." : "Update Password"}
                                </button>
                            </form>
                        </>
                    ) : (
                        /* ERROR VIEW - Only thing that shows when link is dead */
                        <div className="text-center w-full">
                            <div className="flex items-center justify-center gap-3 bg-red-50 border border-red-100 p-4 rounded-2xl mb-8">
                                <AlertCircle className="text-red-500 shrink-0" size={24} />
                                <p className="text-red-600 font-bold text-[16px]">
                                    The reset link has expired.
                                </p>
                            </div>
                            
                            <p className="text-slate-600 mb-8 px-3 text-[16px]">
                                For security reasons, reset links are only valid for a limited time. Please request a new link to continue.
                            </p>
                            
                            <button 
                                onClick={() => navigate('/signin')}
                                className="w-full bg-[#252F3E] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-black transition-all active:scale-[0.98]"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-auto pb-8 pt-4 w-full text-center">
                <p className="text-white/60 text-xs font-medium tracking-[0.2em] uppercase">
                    Secure AWS misconfiguration detection
                </p>
            </div>
        </div>
    );
}

export default ResetPassword;