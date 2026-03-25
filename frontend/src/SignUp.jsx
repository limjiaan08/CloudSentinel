import React, { useState } from 'react';
/* 1. IMPORT YOUR IMAGE FROM ASSETS */
import logoImg from './assets/cloudsentinel_logo.png'; 

function SignUp({onNavigate}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({text: '', isError: false});

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({text: '', isError: false});

    //password validation
    if(password !== confirmPassword){
        setMessage({text: "Passwords do not match!", isError:true});
        setLoading(false);
        return;
    }

    try{
        //API Call to Auth blueprint
        const response = await fetch('http://127.0.0.1:5000/api/auth/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: fullName,
                email: email,
                password: password
            }),
        });

        const data = await response.json();

        if(response.ok){
            setMessage({text: data.message, isError: false});
            setFullName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setTimeout(() => onNavigate(), 2000);
        }else{
            setMessage({text: data.error || "Something went wrong", isError: true });
        }
    }catch(error){
        setMessage({text: "Connection failed. Is the Flask server running?", isError: true});
    }finally{
        setLoading(false);
    }
  }

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
        <p className="text-[20px] text-[#505050] text-sm mb-10 mt-0">Create your account</p>
        
        {message.text && (
            <div className={`mb-4 p-3 rounded-xl w-full text-center text-sm font-bold ${message.isError ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
            {message.text}
          </div>
        )}
        {/* FORM */}
        <form className="w-full space-y-5" onSubmit={handleSignUp}>
          <div className="space-y-1">
            <label className="text-[18px] font-semibold text-slate-700 ml-1">Full Name</label>
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-[18px] text-slate-800 placeholder:text-slate-400"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[18px] font-semibold text-slate-700 ml-1">Email</label>
            <input 
              type="email" 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-[18px] text-slate-800"
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

          <div className="space-y-1">
            <label className="text-[18px] font-semibold text-slate-700 ml-1">Confirm Password</label>
            <input 
              type="password" 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-[18px] text-slate-800"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-[#FF9900] hover:bg-[#D17D00] text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] mt-2">
            Sign Up
          </button>
        </form>

        <p className="mt-8 text-[20px] text-slate-600 text-sm">
          Already have an account?{' '}
          <span 
            onClick={onNavigate}
            className="text-[#FF9900] font-bold cursor-pointer transition-colors duration-200 hover:text-[#D17D00]">
            Sign In
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

export default SignUp;