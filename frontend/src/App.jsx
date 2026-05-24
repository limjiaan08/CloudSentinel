import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './SignIn'; 
import SignUp from './SignUp';
import Dashboard from './Dashboard';
import ResetPassword from './ResetPassword';
import TokenExpirationModal from './TokenExpirationModal';

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user_name');
    const savedSession = localStorage.getItem('session_id');
    const savedId = localStorage.getItem('user_id'); // NEW: Get user_id
    
    return (savedUser && savedSession && savedId) 
      ? { user_name: savedUser, session_id: savedSession, user_id: savedId } 
      : null;
  });
  
  useEffect(() => {
    const savedUser = localStorage.getItem('user_name');
    const savedSession = localStorage.getItem('session_id');
    const savedId = localStorage.getItem('user_id'); // NEW: Get user_id
    const token = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');

    if (savedUser && savedSession && savedId) {
      setUser({ user_name: savedUser, session_id: savedSession, user_id: savedId });
    }

    // Setup auto-logout timer for token expiration
    if (token && tokenExpiry) {
      const checkTokenExpiry = () => {
        const now = new Date();
        const expiry = new Date(tokenExpiry);
        
        // If token has expired, logout
        if (now >= expiry) {
          console.warn('Token has expired, logging out...');
          localStorage.clear();
          setUser(null);
        }
      };

      // Check every 1 second (instead of 30 seconds) so popup appears sooner
      const timerId = setInterval(checkTokenExpiry, 1000);
      
      // Initial check
      checkTokenExpiry();
      
      return () => clearInterval(timerId);
    }
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem('authToken');
    const sessionId = localStorage.getItem('session_id');
    
    if (token || sessionId) {
      try {
        await fetch('http://localhost:5000/auth/logout', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({ token, session_id: sessionId }),
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    localStorage.clear();
    setUser(null);
  };

  return (
    <Router>
      <TokenExpirationModal />
      <Routes>
        {/* 1. INITIAL REDIRECT: Send users from "/" to "/signin" */}
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/signin"} replace />} />

        {/* 2. SIGN IN: Pass setUser so SignIn can update the user data */}
        <Route 
          path="/signin" 
          element={<SignIn onLoginSuccess={(data) => setUser(data)} />} 
        />

        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* 3. SIGN UP */}
        <Route path="/signup" element={<SignUp />} />

        {/* 4. INDEPENDENT DEDICATED LINKS (Similar Design) */}
        <Route 
          path="/dashboard" 
          element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/signin" />} 
        />
        
        <Route 
          path="/findings" 
          element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/signin" />} 
        />

        <Route 
          path="/history" 
          element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/signin" />} 
        />

        <Route 
          path="/profile" 
          element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/signin" />} 
        />

        {/* 5. CATCH-ALL: Redirect any broken links back to signin */}
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </Router>
  );
}

export default App;