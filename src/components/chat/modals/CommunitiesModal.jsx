import React, { useState } from 'react';
import { ArrowLeft, Users, Camera, Check } from 'lucide-react';

const CommunitiesModal = ({ onClose }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = () => {
    if (!name) return;
    alert(`Community "${name}" created successfully!`);
    onClose();
  };
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111b21', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 20px', background: '#202c33', display: 'flex', alignItems: 'center', gap: '24px', height: '108px', flexShrink: 0, paddingTop: '49px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d1d7db', padding: 0 }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 500, color: '#e9edef' }}>Communities</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#111b21', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: isCreating ? '20px' : '40px' }}>
        {!isCreating ? (
          <>
            <img src="https://whatsapp.com/static/images/communities/illustration.png" alt="Communities" style={{ width: '200px', height: '150px', objectFit: 'contain', marginBottom: '32px' }} onError={e => e.currentTarget.style.display='none'} />
            <h3 style={{ color: '#e9edef', fontSize: '24px', fontWeight: 400, margin: '0 0 16px 0', textAlign: 'center' }}>Introducing communities</h3>
            <p style={{ color: '#8696a0', fontSize: '15px', textAlign: 'center', maxWidth: '300px', margin: '0 0 32px 0', lineHeight: 1.5 }}>
              Easily organize your related groups and send announcements. Now, your communities, like neighborhoods or schools, can have their own space.
            </p>
            <button style={{ background: '#00a884', color: '#111b21', border: 'none', borderRadius: '24px', padding: '10px 24px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }} onClick={() => setIsCreating(true)}>
              Start your community
            </button>
          </>
        ) : (
          <div style={{ width: '100%', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '150px', height: '150px', borderRadius: '32px', background: '#202c33', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '32px' }}>
              <Camera size={32} color="#8696a0" style={{ marginBottom: '8px' }} />
              <span style={{ color: '#8696a0', fontSize: '13px' }}>ADD ICON</span>
            </div>
            
            <div style={{ width: '100%', borderBottom: '2px solid #00a884', paddingBottom: '8px', marginBottom: '24px' }}>
              <input type="text" placeholder="Community name" value={name} onChange={e => setName(e.target.value)} autoFocus style={{ width: '100%', background: 'transparent', border: 'none', color: '#e9edef', fontSize: '16px', outline: 'none' }} />
            </div>

            <div style={{ width: '100%', borderBottom: '1px solid #8696a0', paddingBottom: '8px' }}>
              <input type="text" placeholder="Community description" value={desc} onChange={e => setDesc(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: '#e9edef', fontSize: '15px', outline: 'none' }} />
            </div>

            <button onClick={handleCreate} disabled={!name} style={{ position: 'absolute', bottom: '40px', right: '40px', background: name ? '#00a884' : '#202c33', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: name ? 'pointer' : 'default', transition: 'background 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>
              <Check size={24} color={name ? '#111b21' : '#8696a0'} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunitiesModal;
