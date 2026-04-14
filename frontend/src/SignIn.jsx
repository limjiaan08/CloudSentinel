import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from './assets/cloudsentinel_logo.png'; 
import { Mail, AlertCircle, CheckCircle2, X, Eye, EyeOff } from 'lucide-react'; // Added Eye icons

/* --- FORGOT PASSWORD MODAL COMPONENT --- */
const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const response = await fetch('http://localhost:5000/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', msg: data.message });
        setEmail('');
      } else {
        setStatus({ type: 'error', msg: data.error || "Email not found." });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: "Connection failed. Try again later." });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStatus({ type: '', msg: '' });
    setEmail('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#252F3E]/80 backdrop-blur-sm p-6">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 relative">
        <button onClick={handleClose} className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <div className="bg-orange-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-100">
            <Mail className="text-[#FF9900]" size={40} />
          </div>
          <h2 className="text-[30px] font-bold text-slate-900">Forgot Password?</h2>
          <p className="text-[18px] font-normal text-slate-500 mt-2 leading-relaxed px-4">
            Enter your registered email address and we'll send a secure reset link.
          </p>
        </div>

        {status.msg && (
          <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 border ${
            status.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {status.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
            <p className="text-[14px] font-semibold leading-tight">{status.msg}</p>
          </div>
        )}

        {status.type !== 'success' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1 pb-4">
              <label className="text-[16px] font-semibold text-slate-700 ml-1">Email address</label>
              <input 
                type="email" 
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-slate-800"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF9900] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-[#D17D00] transition-all disabled:opacity-50 mt-2"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        ) : (
          <button 
            onClick={handleClose}
            className="w-full bg-[#FF9900] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-[#D17D00] transition-all mt-2"
          >
            Got it, thanks!
          </button>
        )}
      </div>
    </div>
  );
};

/* --- MAIN SIGN IN COMPONENT --- */
function SignIn({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New state for eye toggle
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const navigate = useNavigate();

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', isError: false });

    try {
      const response = await fetch('http://localhost:5000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ text: `Welcome back, ${data.user_name}!`, isError: false });
        localStorage.setItem('session_id', data.session_id);
        localStorage.setItem('user_name', data.user_name);
        localStorage.setItem('user_id', data.user_id);

        setTimeout(() => {
          onLoginSuccess(data);
          navigate('/dashboard');
        }, 1000);
      } else {
        setMessage({ text: data.error || "Login failed", isError: true });
      }
    } catch (error) {
      setMessage({ text: "Connection failed. Is Flask running?", isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#252F3E] flex flex-col items-center font-sans overflow-y-auto relative pt-8">
      
      {/* Container that centers the card but allows footer to be pushed down */}
      <div className="flex-grow flex items-center justify-center w-full p-6">
        <div className="bg-white w-full max-w-[450px] rounded-[3rem] shadow-2xl p-8 flex flex-col items-center">
          <div className="w-full flex justify-center mb-0">
            <img src={logoImg} alt="CloudSentinel Logo" className="w-full max-w-[250px] h-auto object-contain" />
          </div>

          <h1 className="text-[50px] font-bold tracking-tight mt-4 flex gap-1 leading-tight text-center">
            <span className="text-black">Cloud</span>
            <span className="text-[#FF9900]">Sentinel</span>
          </h1>
          <p className="text-[20px] text-[#505050] mb-10 mt-0 text-center">Sign in to your account</p>

          {message.text && (
            <div className={`mb-4 p-3 rounded-xl w-full text-center text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300 ${
              message.isError ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'
            }`}>
              {message.text}
            </div>
          )}

          <form className="w-full space-y-5" onSubmit={handleSignIn}>
            <div className="space-y-1">
              <label className="text-[18px] font-semibold text-slate-700 ml-1">Email address</label>
              <input 
                type="email" 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-5 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-[18px] text-slate-800 placeholder:text-slate-400"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[18px] font-semibold text-slate-700">Password</label>
                <button 
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[#FF9900] text-[15px] font-bold cursor-pointer hover:text-[#D17D00]"
                >
                  Forgot Password?
                </button>
              </div>
              
              {/* PASSWORD INPUT WRAPPER */}
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-5 pr-12 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-[18px] text-slate-800"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FF9900] transition-colors focus:outline-none p-1"
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF9900] hover:bg-[#D17D00] text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50">
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <p className="mt-4 text-[16px] text-slate-600">
            Don't have an account?{' '}
            <span 
              onClick={() => navigate('/signup')} 
              className="text-[#FF9900] font-bold cursor-pointer transition-colors duration-200 hover:text-[#D17D00]">
              Sign Up
            </span>
          </p>
        </div>
      </div>
      
      {/* FOOTER: This now matches the SignUp page exactly */}
      <div className="mt-auto pb-8 pt-4 w-full text-center">
        <p className="text-white/60 text-xs font-medium tracking-[0.2em] uppercase">
          Secure AWS misconfiguration detection
        </p>
      </div>

      <ForgotPasswordModal 
        isOpen={isForgotModalOpen} 
        onClose={() => setIsForgotModalOpen(false)} 
      />
    </div>
  );
}

export default SignIn;