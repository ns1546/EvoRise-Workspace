import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

const MuteSettingsModal = ({ onClose, onSave }) => {
  const [selected, setSelected] = useState('8 hours');

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111b21', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 20px', background: '#202c33', display: 'flex', alignItems: 'center', gap: '24px', height: '59px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d1d7db', padding: 0 }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#e9edef' }}>Mute notifications</h2>
      </div>

      <div style={{ flex: 1, padding: '24px 30px', background: '#111b21' }}>
        <div style={{ color: '#e9edef', fontSize: '15px', marginBottom: '24px' }}>
          Other participants will not see that you muted this chat. You will still be notified if you are mentioned.
        </div>

        {['8 hours', '1 week', 'Always'].map(option => (
          <label key={option} style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="mute" 
              value={option} 
              checked={selected === option} 
              onChange={() => setSelected(option)} 
              style={{ width: '20px', height: '20px', marginRight: '16px', accentColor: '#00a884' }} 
            />
            <span style={{ color: '#e9edef', fontSize: '16px' }}>{option}</span>
          </label>
        ))}

        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #374045', color: '#00a884', padding: '10px 24px', borderRadius: '24px', cursor: 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
          <button onClick={() => { onSave(selected); onClose(); }} style={{ background: '#00a884', border: 'none', color: '#111b21', padding: '10px 24px', borderRadius: '24px', cursor: 'pointer', fontWeight: 500 }}>
            Mute
          </button>
        </div>
      </div>
    </div>
  );
};

export default MuteSettingsModal;
