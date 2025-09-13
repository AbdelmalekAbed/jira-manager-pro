// src/apiService.js

export const apiService = {
  getAnalytics: async () => {
    try {
      // Point to your actual backend server
      const response = await fetch('http://localhost:5000/api/analytics');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      
      if (!text.trim()) {
        throw new Error('Empty response from server');
      }
      
      const data = JSON.parse(text);
      return data;
    } catch (error) {
      console.error('API Service Error:', error);
      throw error;
    }
  },
};