import React from 'react';
import { ArrowLeft, Lock } from 'lucide-react';

const EncryptionModal = ({ onClose, contactName }) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111b21', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 20px', background: '#202c33', display: 'flex', alignItems: 'center', gap: '24px', height: '59px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d1d7db', padding: 0 }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#e9edef' }}>Verify security code</h2>
      </div>

      <div style={{ flex: 1, padding: '32px 30px', background: '#111b21', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <Lock size={48} color="#111b21" />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', width: '100%', marginBottom: '32px' }}>
          {[
             '14323', '59483', '10394', '49302',
             '49320', '59403', '49324', '19430',
             '59432', '10493', '49302', '59432',
             '40392', '59430', '19403', '40329'
          ].map((code, idx) => (
            <div key={idx} style={{ fontSize: '16px', color: '#e9edef', fontFamily: 'monospace', textAlign: 'center' }}>{code}</div>
          ))}
        </div>

        <div style={{ color: '#8696a0', fontSize: '14px', textAlign: 'center', lineHeight: 1.6 }}>
          Messages and calls to this group are end-to-end encrypted. 
          To verify that the chat is secure, you can compare the numbers above with the group members' screens.
        </div>
        
        <button onClick={onClose} style={{ marginTop: 'auto', background: '#00a884', color: '#111b21', border: 'none', padding: '12px 32px', borderRadius: '24px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', width: '100%' }}>
          OK
        </button>
      </div>
    </div>
  );
};

export default EncryptionModal;
