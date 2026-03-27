import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './SignIn'; 
import SignUp from './SignUp';
import Dashboard from './Dashboard';

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

    if (savedUser && savedSession && savedId) {
      setUser({ user_name: savedUser, session_id: savedSession, user_id: savedId });
    }
  }, []);

  const handleLogout = async () => {
    const sessionId = localStorage.getItem('session_id');
    if (sessionId) {
      try {
        await fetch('http://localhost:5000/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
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
      <Routes>
        {/* 1. INITIAL REDIRECT: Send users from "/" to "/signin" */}
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/signin"} replace />} />

        {/* 2. SIGN IN: Pass setUser so SignIn can update the user data */}
        <Route 
          path="/signin" 
          element={<SignIn onLoginSuccess={(data) => setUser(data)} />} 
        />

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