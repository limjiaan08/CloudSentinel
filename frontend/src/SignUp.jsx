import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from './assets/cloudsentinel_logo.png'; 
/* Make sure lucide-react is installed: npm install lucide-react */
import { Eye, EyeOff } from 'lucide-react';

function SignUp() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({text: '', isError: false});
  
  /* Independent visibility states for both fields */
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({text: '', isError: false});

    if(password !== confirmPassword){
        setMessage({text: "Passwords do not match!", isError:true});
        setLoading(false);
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/auth/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: fullName,
                email: email,
                password: password
            }),
        });

        const data = await response.json();

        if (response.ok) {
            setMessage({text: data.message + " Redirecting to sign in...", isError: false});
            setFullName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setTimeout(() => navigate('/signin'), 2000);
        } else {
            setMessage({text: data.error || "Something went wrong", isError: true });
        }
    } catch (error) {
        setMessage({text: "Connection failed. Is the Flask server running?", isError: true});
    } finally {
        setLoading(false);
    }
  };

  return (
    /* Main Layout: flex-col + overflow-y-auto handles zooming perfectly */
    <div className="min-h-screen w-full bg-[#252F3E] flex flex-col items-center font-sans overflow-y-auto relative pt-8">
      
      {/* Center Container: This pushes the footer to the bottom while keeping card centered */}
      <div className="flex-grow flex items-center justify-center w-full p-6">
        <div className="bg-white w-full max-w-[500px] rounded-[3rem] shadow-2xl p-8 flex flex-col items-center my-4">
          
          <div className="w-full flex justify-center mb-0">
            <img src={logoImg} alt="CloudSentinel Logo" className="w-full max-w-[250px] h-auto object-contain" />
          </div>

          <h1 className="text-[50px] font-bold tracking-tight mt-4 flex gap-1 leading-tight text-center">
            <span className="text-black">Cloud</span>
            <span className="text-[#FF9900]">Sentinel</span>
          </h1>
          <p className="text-[20px] text-[#505050] mb-8 mt-0 text-center">Create your account</p>
          
          {/* Status Message */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-2xl w-full text-center text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300 ${
              message.isError ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'
            }`}>
              {message.text}
            </div>
          )}

          <form className="w-full space-y-5" onSubmit={handleSignUp}>
            {/* Name Field */}
            <div className="space-y-1">
              <label className="text-[18px] font-semibold text-slate-700 ml-1">Full Name</label>
              <input 
                type="text" required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-[18px] text-slate-800 placeholder:text-slate-400"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            {/* Email Field */}
            <div className="space-y-1">
              <label className="text-[18px] font-semibold text-slate-700 ml-1">Email</label>
              <input 
                type="email" required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-[18px] text-slate-800 placeholder:text-slate-400"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label className="text-[18px] font-semibold text-slate-700 ml-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-5 pr-12 outline-none focus:ring-2 focus:ring-[#FF9900] transition-all text-[18px] text-slate-800"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FF9900] transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
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
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FF9900] transition-colors p-1"
                >
                  {showConfirmPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full bg-[#FF9900] hover:bg-[#D17D00] text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          <p className="mt-6 text-[16px] text-slate-600">
            Already have an account?{' '}
            <span 
              onClick={() => navigate('/signin')} 
              className="text-[#FF9900] font-bold cursor-pointer transition-colors duration-200 hover:text-[#D17D00]">
              Sign In
            </span>
          </p>
        </div>
      </div>

      {/* Footer Branding - Sticky bottom */}
      <div className="mt-auto pb-8 w-full text-center">
        <p className="text-white/60 text-xs font-medium tracking-[0.2em] uppercase">
          Secure AWS misconfiguration detection
        </p>
      </div>
    </div>
  );
}

export default SignUp;