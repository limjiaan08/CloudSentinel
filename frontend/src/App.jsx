import React, { useState } from 'react';
import SignIn from './SignIn'; 
import SignUp from './SignUp'; // You can uncomment this later

function App() {
  const [currentPage, setCurrentPage] = useState('signin');

  return (
    <>
      {currentPage === 'signin' && (
        <SignIn onNavigate={() => setCurrentPage('signup')} />
      )}

      {currentPage === 'signup' && (
        <SignUp onNavigate={() => setCurrentPage('signin')} />
      )}
    </>
  );
}

export default App;