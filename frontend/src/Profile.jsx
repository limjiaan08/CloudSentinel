import React, { useState, useEffect } from 'react';
import { Mail, Calendar, Clock, Lock, Shield, Edit2, Check, X, AlertCircle, CheckCircle2, Loader2, LogOut, RefreshCw } from 'lucide-react';

const Profile = ({ user }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const [message, setMessage] = useState({ type: '', msg: '' });
    const [tokenStatus, setTokenStatus] = useState(null);
    const [verifyingToken, setVerifyingToken] = useState(false);
    const [reAuthLoading, setReAuthLoading] = useState(false);

    useEffect(() => {
        fetchProfile();
        verifyTokenStatus();
        // Set interval to check token status every 5 minutes
        const interval = setInterval(verifyTokenStatus, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    const getAuthHeader = () => {
        const token = localStorage.getItem('authToken');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    };

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const userId = user?.user_id || user?.id;
            const response = await fetch(`http://localhost:5000/auth/user/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                }
            });

            if (response.ok) {
                const data = await response.json();
                setProfile(data);
                setNewName(data.user_name);
            } else if (response.status === 401) {
                setMessage({ type: 'error', msg: 'Session expired. Please log in again.' });
            }
        } catch (err) {
            console.error("Failed to fetch profile:", err);
            setMessage({ type: 'error', msg: 'Failed to load profile information.' });
        } finally {
            setLoading(false);
        }
    };

    const verifyTokenStatus = async () => {
        try {
            setVerifyingToken(true);
            const response = await fetch('http://localhost:5000/auth/verify-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                }
            });

            if (response.ok) {
                const data = await response.json();
                setTokenStatus({
                    valid: data.valid,
                    message: data.message,
                    expiry: data.token_expiry
                });
            } else {
                setTokenStatus({
                    valid: false,
                    message: 'Token verification failed'
                });
            }
        } catch (err) {
            console.error("Failed to verify token:", err);
            setTokenStatus({
                valid: false,
                message: 'Could not verify token status'
            });
        } finally {
            setVerifyingToken(false);
        }
    };

    const handleUpdateName = async () => {
        if (!newName.trim()) {
            setMessage({ type: 'error', msg: 'Name cannot be empty' });
            return;
        }

        if (newName === profile.user_name) {
            setEditingName(false);
            return;
        }

        try {
            const userId = user?.user_id || user?.id;
            const response = await fetch(`http://localhost:5000/auth/user/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ user_name: newName })
            });

            if (response.ok) {
                const data = await response.json();
                setProfile({ ...profile, user_name: data.user_name });
                setEditingName(false);
                setMessage({ type: 'success', msg: 'Profile name updated successfully!' });
                // Update localStorage
                localStorage.setItem('user_name', data.user_name);
                setTimeout(() => setMessage({ type: '', msg: '' }), 3000);
            } else {
                setMessage({ type: 'error', msg: 'Failed to update profile name.' });
            }
        } catch (err) {
            console.error("Failed to update profile:", err);
            setMessage({ type: 'error', msg: 'Connection error. Please try again.' });
        }
    };

    const handleReAuthenticate = async () => {
        try {
            setReAuthLoading(true);
            const userId = user?.user_id || user?.id;
            const response = await fetch(`http://localhost:5000/auth/user/${userId}/re-authenticate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Update localStorage with new token
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('tokenExpiry', data.token_expiry);
                localStorage.setItem('session_id', data.session_id);
                
                setMessage({ type: 'success', msg: 'Session re-authenticated successfully! New token issued.' });
                await fetchProfile();
                await verifyTokenStatus();
                setTimeout(() => setMessage({ type: '', msg: '' }), 3000);
            } else {
                setMessage({ type: 'error', msg: 'Failed to re-authenticate. Please try again.' });
            }
        } catch (err) {
            console.error("Re-authentication failed:", err);
            setMessage({ type: 'error', msg: 'Connection error during re-authentication.' });
        } finally {
            setReAuthLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-MY', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatTime = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-MY', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    const getTimeUntilExpiry = (expiryString) => {
        if (!expiryString) return 'N/A';
        const expiry = new Date(expiryString);
        const now = new Date();
        const diff = expiry - now;
        
        if (diff <= 0) return 'Expired';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-240px)] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-[#FF9900] mb-4" size={48} />
                <p className="text-slate-500 font-bold text-lg uppercase tracking-widest">Loading Profile...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-10">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-700">Unable to Load Profile</h3>
                <p className="text-slate-400 mt-2 font-medium">Please try refreshing the page or log in again.</p>
            </div>
        );
    }

    return (
        <div>
            {/* STATUS MESSAGE */}
            {message.msg && (
                <div className={`mb-8 p-4 rounded-2xl flex items-start gap-3 border ${
                    message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
                    <p className="text-[14px] font-semibold leading-tight">{message.msg}</p>
                </div>
            )}

            {/* PROFILE SECTIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* --- SECTION 1: BASIC INFORMATION --- */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-[16px] font-bold text-slate-900 mb-5 flex items-center gap-3 uppercase tracking-wider">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Mail size={18} className="text-blue-600" />
                        </div>
                        Basic Information
                    </h3>

                    <div className="space-y-5">
                        {/* FULL NAME */}
                        <div>
                            <label className="text-[13px] font-bold uppercase tracking-wider text-slate-600 block mb-2">Full Name</label>
                            {editingName ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="flex-1 bg-white border border-slate-300 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-[#FF9900] text-[15px]"
                                        placeholder="Enter your full name"
                                    />
                                    <button
                                        onClick={handleUpdateName}
                                        className="bg-green-500 hover:bg-green-600 text-white p-2.5 rounded-xl transition-colors"
                                        title="Save"
                                    >
                                        <Check size={18} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingName(false);
                                            setNewName(profile.user_name);
                                        }}
                                        className="bg-slate-300 hover:bg-slate-400 text-white p-2.5 rounded-xl transition-colors"
                                        title="Cancel"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4">
                                    <span className="text-[15px] font-medium text-slate-700">{profile.user_name}</span>
                                    <button
                                        onClick={() => setEditingName(true)}
                                        className="text-[#FF9900] hover:text-[#D17D00] transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* EMAIL */}
                        <div>
                            <label className="text-[13px] font-bold uppercase tracking-wider text-slate-600 block mb-2">Email Address</label>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-500">
                                <span className="text-[15px] font-medium text-slate-700">{profile.user_email}</span>
                            </div>
                        </div>

                        {/* ACCOUNT CREATED DATE */}
                        <div>
                            <label className="text-[13px] font-bold uppercase tracking-wider text-slate-600 block mb-2">Account Created</label>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 flex items-center gap-4">
                                <Calendar size={16} className="text-slate-400" />
                                <span className="text-[15px] font-medium text-slate-700">{formatDate(profile.created_at)}</span>
                            </div>
                        </div>

                        {/* USER ID */}
                        <div>
                            <label className="text-[13px] font-bold uppercase tracking-wider text-slate-600 block mb-2">User ID</label>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4">
                                <p className="text-[15px] text-slate-400 font-mono break-all">{profile.user_id}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- SECTION 2: SESSION & LOGIN INFO --- */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-[16px] font-bold text-slate-900 mb-5 flex items-center gap-3 uppercase tracking-wider">
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <Clock size={18} className="text-purple-600" />
                        </div>
                        Session Information
                    </h3>

                    <div className="space-y-5">
                        {/* LAST LOGIN */}
                        <div>
                            <label className="text-[13px] font-bold uppercase tracking-wider text-slate-600 block mb-2">Last Login</label>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4">
                                <span className="text-[15px] font-medium text-slate-700">
                                    {profile.last_login ? formatDate(profile.last_login) : 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* LAST SESSION DURATION */}
                        <div>
                            <label className="text-[13px] font-bold uppercase tracking-wider text-slate-600 block mb-2">Last Session Duration</label>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4">
                                {profile.last_session_duration !== null && profile.last_session_duration !== undefined ? (
                                    <span className="text-[15px] font-medium text-slate-700">
                                        {Math.floor(profile.last_session_duration / 3600) > 0 &&
                                            `${Math.floor(profile.last_session_duration / 3600)}h `}
                                        
                                        {Math.floor((profile.last_session_duration % 3600) / 60) > 0 &&
                                            `${Math.floor((profile.last_session_duration % 3600) / 60)}m `}
                                        
                                        {`${profile.last_session_duration % 60}s`}
                                    </span>
                                ) : (
                                    <span className="text-[15px] font-medium text-slate-500">
                                        N/A
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* TOKEN EXPIRY */}
                        <div>
                            <label className="text-[13px] font-bold uppercase tracking-wider text-slate-600 block mb-2">Token Expiry Time</label>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4">
                                <span className="text-[15px] font-medium text-slate-700">
                                    {profile.token_expiry ? formatDate(profile.token_expiry) : 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* TIME UNTIL EXPIRY */}
                        <div>
                            <label className="text-[13px] font-bold uppercase tracking-wider text-slate-600 block mb-2">Time Until Expiry</label>
                            <div className={`border rounded-xl py-2.5 px-4 ${
                                getTimeUntilExpiry(profile.token_expiry).includes('Expired') 
                                    ? 'bg-red-50 border-red-200' 
                                    : 'bg-slate-50 border-slate-200'
                            }`}>
                                <span className={`text-[15px] font-bold ${
                                    getTimeUntilExpiry(profile.token_expiry).includes('Expired')
                                        ? 'text-red-600'
                                        : 'text-slate-800'
                                }`}>
                                    {getTimeUntilExpiry(profile.token_expiry)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- SECTION 3: TOKEN & SECURITY STATUS --- */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:col-span-2 mb-6">
                    <h3 className="text-[16px] font-bold text-slate-900 mb-5 flex items-center gap-3 uppercase tracking-wider">
                        <div className="bg-green-100 p-2 rounded-lg">
                            <Shield size={18} className="text-green-600" />
                        </div>
                        Token & Security Status
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* TOKEN VALIDITY */}
                        <div className={`border rounded-2xl p-5 ${
                            tokenStatus?.valid 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-red-50 border-red-200'
                        }`}>
                            <div className="flex items-center gap-3 mb-3">
                                {tokenStatus?.valid ? (
                                    <div className="bg-green-200 p-2 rounded-lg">
                                        <CheckCircle2 size={20} className="text-green-700" />
                                    </div>
                                ) : (
                                    <div className="bg-red-200 p-2 rounded-lg">
                                        <AlertCircle size={20} className="text-red-700" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-[12px] font-bold uppercase tracking-wider text-slate-600">Token Status</p>
                                    <p className={`text-[16px] font-bold uppercase tracking-wide ${tokenStatus?.valid ? 'text-green-700' : 'text-red-700'}`}>
                                        {tokenStatus?.valid ? 'Valid' : 'Invalid/Expired'}
                                    </p>
                                </div>
                            </div>
                            <p className="text-[13px] text-slate-600 font-medium tracking-wide">
                                {tokenStatus?.message || 'Checking token status...'}
                            </p>
                            <button
                                onClick={verifyTokenStatus}
                                disabled={verifyingToken}
                                className="mt-3 w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 tracking-wide"
                            >
                                {verifyingToken ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={16} />
                                        Verify Token
                                    </>
                                )}
                            </button>
                        </div>

                        {/* RE-AUTHENTICATE */}
                        <div className="border border-orange-200 rounded-2xl p-5 bg-orange-50">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="bg-orange-200 p-2 rounded-lg">
                                    <Lock size={20} className="text-orange-700" />
                                </div>
                                <div>
                                    <p className="text-[12px] font-bold uppercase tracking-wider text-slate-600">Re-Authentication</p>
                                    <p className="text-[16px] font-bold uppercase tracking-wide text-orange-700">Refresh Session</p>
                                </div>
                            </div>
                            <p className="text-[13px] text-slate-600 font-medium mb-3 tracking-wide">
                                Generate a new token and refresh your session to extend your access time.
                            </p>
                            <button
                                onClick={handleReAuthenticate}
                                disabled={reAuthLoading}
                                className="w-full bg-[#FF9900] hover:bg-[#D17D00] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 tracking-wide"
                            >
                                {reAuthLoading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Re-Authenticating...
                                    </>
                                ) : (
                                    <>
                                        <LogOut size={16} />
                                        Re-Authenticate
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
