import React, { useState } from 'react';
import { ArrowLeft, Camera, Edit2, Check } from 'lucide-react';
import { db } from '../../../firebase';
import { doc, updateDoc } from 'firebase/firestore';

const ProfileModal = ({ onClose, userData }) => {
  const [editingField, setEditingField] = useState(null); // 'name' or 'about'
  const [nameValue, setNameValue] = useState(userData?.name || '');
  const [aboutValue, setAboutValue] = useState(userData?.role || 'Evorise Team Member');

  const handleSave = async (field) => {
    if (!userData?.id) return;
    try {
      if (field === 'name') {
        await updateDoc(doc(db, 'users', userData.id), { name: nameValue });
      } else {
        await updateDoc(doc(db, 'users', userData.id), { role: aboutValue });
      }
      setEditingField(null);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111b21', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 20px', background: '#202c33', display: 'flex', alignItems: 'center', gap: '24px', height: '108px', flexShrink: 0, paddingTop: '49px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d1d7db', padding: 0 }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 500, color: '#e9edef' }}>Profile</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0' }}>
        <div style={{ position: 'relative', cursor: 'pointer', marginBottom: '32px' }}>
          <div style={{ width: '200px', height: '200px', borderRadius: '50%', background: '#6b7c85', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '80px', fontWeight: 'bold' }}>
            {(userData?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, left: 0, top: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0}>
            <Camera size={24} color="white" />
            <span style={{ color: 'white', fontSize: '13px', marginTop: '8px', textAlign: 'center', width: '100px' }}>CHANGE PROFILE PHOTO</span>
          </div>
        </div>

        <div style={{ width: '100%', padding: '14px 30px', background: '#111b21' }}>
          <div style={{ color: '#008069', fontSize: '14px', marginBottom: '16px' }}>Your name</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #202c33', paddingBottom: '10px' }}>
            {editingField === 'name' ? (
              <input 
                type="text" 
                value={nameValue} 
                onChange={e => setNameValue(e.target.value)} 
                autoFocus
                style={{ background: 'transparent', border: 'none', color: '#e9edef', fontSize: '17px', outline: 'none', width: '100%' }}
              />
            ) : (
              <span style={{ color: '#e9edef', fontSize: '17px' }}>{userData?.name || 'User'}</span>
            )}
            
            {editingField === 'name' ? (
              <Check size={20} color="#00a884" style={{ cursor: 'pointer' }} onClick={() => handleSave('name')} />
            ) : (
              <Edit2 size={18} color="#8696a0" style={{ cursor: 'pointer' }} onClick={() => setEditingField('name')} />
            )}
          </div>
          <div style={{ color: '#8696a0', fontSize: '13px', marginTop: '14px' }}>
            This is not your username or pin. This name will be visible to your WhatsApp contacts.
          </div>
        </div>

        <div style={{ width: '100%', padding: '14px 30px', background: '#111b21', marginTop: '10px' }}>
          <div style={{ color: '#008069', fontSize: '14px', marginBottom: '16px' }}>About</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #202c33', paddingBottom: '10px' }}>
            {editingField === 'about' ? (
              <input 
                type="text" 
                value={aboutValue} 
                onChange={e => setAboutValue(e.target.value)} 
                autoFocus
                style={{ background: 'transparent', border: 'none', color: '#e9edef', fontSize: '17px', outline: 'none', width: '100%' }}
              />
            ) : (
              <span style={{ color: '#e9edef', fontSize: '17px' }}>{userData?.role || 'Evorise Team Member'}</span>
            )}

            {editingField === 'about' ? (
              <Check size={20} color="#00a884" style={{ cursor: 'pointer' }} onClick={() => handleSave('about')} />
            ) : (
              <Edit2 size={18} color="#8696a0" style={{ cursor: 'pointer' }} onClick={() => setEditingField('about')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
