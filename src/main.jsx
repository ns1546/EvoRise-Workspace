import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Login from './Login.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GlobalStateProvider } from './contexts/GlobalStateContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { SettingsProvider } from './contexts/SettingsContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0a0f1e' }}>
        <div style={{ width: '50px', height: '50px', border: '4px solid rgba(26,115,232,0.2)', borderTop: '4px solid #1a73e8', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        <p style={{ marginTop: '20px', color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>Authenticating...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const Root = () => {
  return (
    <SettingsProvider>
      <AuthProvider>
        <GlobalStateProvider>
          <NotificationProvider>
            <ActivityProvider>
              <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/*" 
              element={
                <ProtectedRoute>
                  <App />
                </ProtectedRoute>
              } 
            />
          </Routes>
              </BrowserRouter>
            </ActivityProvider>
          </NotificationProvider>
        </GlobalStateProvider>
      </AuthProvider>
    </SettingsProvider>
  );
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
