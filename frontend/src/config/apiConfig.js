// Frontend API Configuration
// Dynamically loads API URL from environment variables or defaults to localhost

export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

export const apiUrl = getApiUrl();
