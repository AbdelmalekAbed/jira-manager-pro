// src/AppWrapper.jsx
import React from 'react';
import JiraManagerPro from './project';
import AnalyticsDashboard from './AnalyticsDashboard';

function AppWrapper() {
  const currentPath = window.location.pathname;
  const isAnalyticsPage = currentPath === '/analytics';
  
  console.log('AppWrapper - Current path:', currentPath);
  console.log('AppWrapper - Is analytics page:', isAnalyticsPage);
  
  // Handle client-side routing
  React.useEffect(() => {
    const handlePopState = () => {
      // Force re-render on browser back/forward
      window.location.reload();
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
  
  if (isAnalyticsPage) {
    return <AnalyticsDashboard />;
  }
  
  return <JiraManagerPro />;
}

export default AppWrapper;