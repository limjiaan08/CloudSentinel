/**
 * Token Manager - Handles JWT token expiration and automatic logout
 * This utility manages token storage, expiration checks, and automatic logout
 */

const TOKEN_KEY = 'authToken';
const TOKEN_EXPIRY_KEY = 'tokenExpiry';
const USER_ID_KEY = 'userId';
const SESSION_ID_KEY = 'sessionId';

/**
 * Store authentication token and expiry time
 */
export const storeToken = (token, tokenExpiry, userId, sessionId) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, tokenExpiry);
  localStorage.setItem(USER_ID_KEY, userId);
  localStorage.setItem(SESSION_ID_KEY, sessionId);
};

/**
 * Retrieve stored token
 */
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Get token expiry time
 */
export const getTokenExpiry = () => {
  return localStorage.getItem(TOKEN_EXPIRY_KEY);
};

/**
 * Clear all auth data (logout)
 */
export const clearAuthData = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
};

/**
 * Check if token is expired
 */
export const isTokenExpired = () => {
  const expiryTime = getTokenExpiry();
  if (!expiryTime) return true;

  const now = new Date();
  const expiry = new Date(expiryTime);

  return now >= expiry;
};

/**
 * Get time remaining until token expires (in milliseconds)
 */
export const getTimeUntilExpiry = () => {
  const expiryTime = getTokenExpiry();
  if (!expiryTime) return 0;

  const now = new Date();
  const expiry = new Date(expiryTime);
  const diff = expiry - now;

  return diff > 0 ? diff : 0;
};

/**
 * Format remaining time for display
 */
export const formatTimeRemaining = () => {
  const ms = getTimeUntilExpiry();
  if (ms <= 0) return 'Expired';

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  const hours = Math.floor((ms / 1000 / 60 / 60) % 24);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

/**
 * Verify token validity with backend
 */
export const verifyTokenWithBackend = async () => {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch('http://localhost:5000/auth/verify-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
};

/**
 * Trigger automatic logout on token expiry
 */
export const triggerAutoLogout = async () => {
  const token = getToken();
  const sessionId = localStorage.getItem(SESSION_ID_KEY);

  try {
    // Notify backend of auto-logout
    if (token) {
      await fetch('http://localhost:5000/auth/auto-logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Auto-logout notification failed:', error);
  }

  // Clear local auth data
  clearAuthData();

  // Redirect to login (if using React Router)
  window.location.href = '/signin';
};

/**
 * Set up automatic logout timer
 * Logs out user 1 minute before token expires
 */
export const setupAutoLogoutTimer = (callback) => {
  const checkTokenExpiry = () => {
    const timeRemaining = getTimeUntilExpiry();
    const oneMinuteInMs = 60 * 1000;

    // If less than 1 minute remaining, logout
    if (timeRemaining < oneMinuteInMs && timeRemaining > 0) {
      console.warn('Token expiring in less than 1 minute, preparing logout...');
      if (callback) callback('expiring');
    }

    // If already expired, logout
    if (isTokenExpired()) {
      console.warn('Token has expired, logging out...');
      triggerAutoLogout();
      return;
    }
  };

  // Check every 30 seconds
  const timerId = setInterval(checkTokenExpiry, 30000);

  return timerId;
};

/**
 * Hook-compatible token manager
 */
export const useTokenExpiration = () => {
  return {
    getToken,
    getTokenExpiry,
    isTokenExpired,
    getTimeUntilExpiry,
    formatTimeRemaining,
    clearAuthData,
    verifyTokenWithBackend,
    triggerAutoLogout,
    setupAutoLogoutTimer
  };
};
