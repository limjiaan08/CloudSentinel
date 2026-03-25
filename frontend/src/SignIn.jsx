import React, { useState } from 'react';
/* 1. IMPORT YOUR IMAGE FROM ASSETS */
import logoImg from './assets/cloudsentinel_logo.png'; 

function SignIn({onNavigate}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', isError: false });

    try {
      // API Call to your Auth Blueprint (Matching the /api/auth prefix)
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // SUCCESS: Flask returns 200, user_id, user_name, and session_id
        setMessage({ text: `Welcome back, ${data.user_name}!`, isError: false });
        
        // FOR YOUR FYP: Save the session info so you stay logged in
        localStorage.setItem('session_id', data.session_id);
        localStorage.setItem('user_name', data.user_name);

        // Redirect to dashboard (or wherever your next page is)
        console.log("Login Successful! Session ID:", data.session_id);
        // setTimeout(() => onNavigate('dashboard'), 1500); 
      } else {
        // ERROR: Flask returns 401 (Invalid) or 400 (Missing fields)
        setMessage({ text: data.error || "Login failed", isError: true });
      }
    } catch (error) {
      setMessage({ text: "Connection failed. Is Flask running?", isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    /* BACKGROUND: #252F3E */
    <div className="min-h-screen w-full bg-[#252F3E] flex flex-col items-center pt-12 p-6 font-sans overflow-y-scroll">
      
      {/* THE WHITE CARD */}
      <div className="bg-white w-[500px] rounded-[3rem] shadow-2xl p-10 flex flex-col items-center">
        
        {/* 2. LOGO IMAGE CONTAINER */}
        <div className="w-full flex justify-center mb-0">
          <img 
            src={logoImg} 
            alt="CloudSentinel Logo" 
            className="w-full max-w-[250px] h-auto object-contain" 
          />
        </div>

        {/* TITLES */}
        <h1 className="text-[50px] font-bold tracking-tight mt-4 flex gap-1">
          <span className="text-black">Cloud</span>
          <span className="text-[#FF9900]">Sentinel</span>
        </h1>
        <p className="text-[20px] text-[#505050] text-sm mb-10 mt-0">Sign in to your account</p>

        {message.text && (
          <div className={`mb-4 p-3 rounded-xl w-full text-center text-sm font-bold ${message.isError ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
            {message.text}
          </div>
        )}

        {/* FORM */}
        <form className="w-full space-y-5" onSubmit={handleSignIn}>
          <div className="space-y-1">
            <label className="text-[18px] font-semibold text-slate-700 ml-1">Email address</label>
            <input 
              type="email" 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-[18px] text-slate-800 placeholder:text-slate-400"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[18px] font-semibold text-slate-700 ml-1">Password</label>
            <input 
              type="password" 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-[18px] text-slate-800"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF9900] hover:bg-[#D17D00] text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] mt-2">
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <p className="mt-8 text-[20px] text-slate-600 text-sm">
          Don't have an account?{' '}
          <span 
            onClick={onNavigate}
            className="text-[#FF9900] font-bold cursor-pointer transition-colors duration-200 hover:text-[#D17D00]">
            Sign Up
          </span>
        </p>
      </div>
      {/* FOOTER TEXT - Outside the card */}
      <div className="mt-6">
        <p className="text-white/60 text-xs font-medium tracking-[0.2em] uppercase">
          Secure AWS misconfiguration detection
        </p>
      </div>
    </div>
  );
}

export default SignIn;