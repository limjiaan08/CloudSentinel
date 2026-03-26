import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './SignIn'; 
import SignUp from './SignUp';
import Dashboard from './Dashboard';

function App() {
  // Store user info in state so we can pass it to Dashboard
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // Check if user info exists in browser memory
    const savedUser = localStorage.getItem('user_name');
    const savedSession = localStorage.getItem('session_id');

    if (savedUser && savedSession) {
      // Put it back into the state so the Dashboard doesn't kick you out
      setUser({ user_name: savedUser, session_id: savedSession });
    }
  }, []);

  const handleLogout = async () => {
    const sessionId = localStorage.getItem('session_id');

    if (sessionId) {
      try {
        // API Call to your Flask /auth/logout
        await fetch('http://localhost:5000/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }

    // Clear local storage and reset state
    localStorage.clear();
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        {/* 1. INITIAL REDIRECT: Send users from "/" to "/signin" */}
        <Route path="/" element={<Navigate to="/signin" replace />} />

        {/* 2. SIGN IN: Pass setUser so SignIn can update the user data */}
        <Route 
          path="/signin" 
          element={<SignIn onLoginSuccess={(data) => setUser(data)} />} 
        />

        {/* 3. SIGN UP */}
        <Route path="/signup" element={<SignUp />} />

        {/* 4. DASHBOARD: Pass user and a clearUser function for logout */}
        <Route 
          path="/dashboard" 
          element={
            <Dashboard 
              user={user} 
              onLogout={handleLogout} 
            />
          } 
        />

        {/* 5. CATCH-ALL: Redirect any broken links back to signin */}
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </Router>
  );
}

export default App;