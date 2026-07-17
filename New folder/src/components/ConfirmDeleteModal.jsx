import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

const ConfirmDeleteModal = ({ title, message, onConfirm, onCancel, isDeleting }) => {
  const isMobile = useIsMobile();
  return (
    <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className={isMobile ? "mobile-bottom-sheet" : "matte-3d"} style={{ width: isMobile ? '100%' : '400px', height: isMobile ? 'auto' : 'auto', padding: '30px', borderRadius: isMobile ? '24px 24px 0 0' : '24px', animation: 'float-in 0.3s ease-out' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{title || 'Confirm Deletion'}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {message || 'Are you sure you want to delete this item? This action cannot be undone.'}
              </p>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', alignSelf: 'flex-start' }}>
            <X size={20} color="var(--text-secondary)" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '30px' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, cursor: isDeleting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
            <Trash2 size={16}/> {isDeleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
