import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { CheckCircle, AlertTriangle, Info, XCircle, Clock, X } from 'lucide-react';

const TYPE_CFG = {
  info:     { color: '#0b57d0', bg: '#e8f0fe', border: '#aecbfa', icon: <Info size={16}/> },
  success:  { color: '#137333', bg: '#e6f4ea', border: '#a8d5b5', icon: <CheckCircle size={16}/> },
  warning:  { color: '#e37400', bg: '#fef7e0', border: '#fad07a', icon: <AlertTriangle size={16}/> },
  error:    { color: '#c5221f', bg: '#fce8e6', border: '#f4b8b5', icon: <XCircle size={16}/> },
  reminder: { color: '#7b1fa2', bg: '#f3e5f5', border: '#ce93d8', icon: <Clock size={16}/> },
};

const GlobalToastOverlay = () => {
  const { toasts, dismissToast, markAsRead } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: '16px', left: '0', right: '0', zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', pointerEvents: 'none', padding: '0 16px' }}>
      {toasts.map(toast => {
        const cfg = TYPE_CFG[toast.type] || TYPE_CFG.info;
        return (
          <div
            key={toast.id}
            onClick={() => {
              markAsRead(toast.id);
              if (toast.module) {
                window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: toast.module } }));
              }
              if (toast.actionUrl) {
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId: toast.actionUrl } }));
                }, 100);
              }
              dismissToast(toast.id);
            }}
            style={{
              pointerEvents: 'all',
              cursor: 'pointer',
              display: 'flex', alignItems: 'flex-start', gap: '16px',
              background: 'rgba(25, 25, 28, 0.85)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px', padding: '16px 20px',
              width: '100%', maxWidth: '420px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1)',
              animation: 'slideDownToast 0.4s cubic-bezier(0.2, 0.8, 0.2, 1.1) forwards',
            }}
          >
            <div style={{ 
              background: cfg.bg, 
              color: cfg.color, 
              padding: '10px', 
              borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              {cfg.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0, marginTop: '2px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '4px', letterSpacing: '-0.01em' }}>{toast.title}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>{toast.body}</div>
              {toast.module && (
                <div style={{ fontSize: '11px', fontWeight: 600, color: cfg.color, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{toast.module}</div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '4px', flexShrink: 0, marginTop: '-2px' }}>
              <X size={16}/>
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideDownToast {
          from { transform: translateY(-120%) scale(0.95); opacity: 0; }
          to   { transform: translateY(0) scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default GlobalToastOverlay;
