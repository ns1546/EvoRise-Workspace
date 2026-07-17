import React, { useEffect } from 'react';
import { X } from 'lucide-react';

import { useIsMobile } from '../hooks/useIsMobile';

const SideDrawer = ({ isOpen, onClose, title, children, width = '500px' }) => {
  const isMobile = useIsMobile();
  
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', alignItems: isMobile ? 'flex-end' : 'stretch' }}>
      
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', animation: 'fade-in 0.3s ease-out' }}
      />

      {/* Drawer / Sheet */}
      <div 
        className={isMobile ? "mobile-bottom-sheet" : "glass-panel"}
        style={isMobile ? {} : { 
          width: width, 
          maxWidth: '90vw', 
          height: '100%', 
          position: 'relative', 
          display: 'flex', 
          flexDirection: 'column', 
          animation: 'slide-in-right 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          borderLeft: '1px solid var(--glass-border)',
          borderTopLeftRadius: '24px',
          borderBottomLeftRadius: '24px',
          background: 'rgba(255, 255, 255, 0.75)' 
        }}
      >
        {/* Header */}
        <div className={isMobile ? "mobile-bottom-sheet__header" : ""} style={isMobile ? {} : { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid var(--border-light)' }}>
          <h2 className={isMobile ? "mobile-bottom-sheet__title" : ""} style={isMobile ? { margin: 0 } : { margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h2>
          <button 
            className={isMobile ? "mobile-bottom-sheet__close" : ""}
            onClick={onClose}
            style={isMobile ? {} : { background: 'rgba(0,0,0,0.04)', border: 'none', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseOver={(e) => !isMobile && (e.currentTarget.style.background = 'rgba(0,0,0,0.08)')}
            onMouseOut={(e) => !isMobile && (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
          >
            <X size={18} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Content Body */}
        <div className={isMobile ? "mobile-bottom-sheet__body" : ""} style={isMobile ? {} : { flex: 1, overflowY: 'auto', padding: '24px' }}>
          {children}
        </div>
      </div>
      
      {/* Slide Animation Keyframes */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SideDrawer;
