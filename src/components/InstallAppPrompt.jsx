import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

const InstallAppPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      return;
    }

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIOS(isIOSDevice);

    if (isMobile) {
      // Check if we already dismissed
      const dismissed = localStorage.getItem('install_prompt_dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000); // Show after 3 seconds
      }
    }

    // Listen for Android install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('install_prompt_dismissed')) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isMobile]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      // Just let them read the iOS instructions
    } else {
      alert("Your browser is still preparing the app install. Please wait a moment, or tap the three dots in your browser menu and select 'Add to Home screen'.");
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('install_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '16px',
      right: '16px',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border-strong)',
      borderRadius: '20px',
      padding: '20px',
      zIndex: 999999,
      boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
      animation: 'fade-in-up 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
    }}>
      <button onClick={handleDismiss} style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: '#8E8E93' }}>
        <X size={20} />
      </button>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg, #007AFF, #0056b3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
          <Download size={24} />
        </div>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: 'black' }}>Install Evorise App</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#555', lineHeight: '1.4' }}>
            Install the app to your Home Screen to receive native push notifications.
          </p>
        </div>
      </div>

      {isIOS && !deferredPrompt ? (
        <div style={{ background: '#F2F2F7', padding: '12px', borderRadius: '12px', fontSize: '14px', color: '#333' }}>
          Tap the <Share size={16} style={{ verticalAlign: 'middle', margin: '0 2px', color: '#007AFF' }} /> <b>Share</b> button at the bottom of Safari, then tap <b>Add to Home Screen</b>.
        </div>
      ) : (
        <button onClick={handleInstallClick} style={{ width: '100%', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700 }}>
          Install Now
        </button>
      )}
    </div>
  );
};

export default InstallAppPrompt;
