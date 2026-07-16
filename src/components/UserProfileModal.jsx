import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword } from 'firebase/auth';
import { X, Camera, Save, AlertCircle } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';
import { useIsMobile } from '../hooks/useIsMobile';

const UserProfileModal = ({ userData, onClose }) => {
  const isMobile = useIsMobile();
  const { logActivity } = useActivity();
  const [formData, setFormData] = useState({
    name: userData?.name || '',
    email: userData?.email || '',
    password: ''
  });
  const [avatar, setAvatar] = useState(userData?.avatar || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const userId = userData?.id || auth.currentUser?.uid;
      const userRef = doc(db, 'users', userId);
      let updates = { name: formData.name };
      if (avatar) updates.avatar = avatar;

      await updateDoc(userRef, updates);
      
      const currentUser = auth.currentUser;
      if (currentUser) {
        if (formData.email && formData.email !== userData.email) {
          await updateEmail(currentUser, formData.email);
          updates.email = formData.email;
          await updateDoc(userRef, { email: formData.email });
        }
        if (formData.password) {
          await updatePassword(currentUser, formData.password);
        }
      }

      logActivity({ action: 'UPDATE_PROFILE', module: 'system', detail: `Updated personal profile settings.` });
      alert("Profile updated successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security reasons, changing email/password requires a recent login. Please log out and log back in, then try again.');
      } else {
        setError(err.message || 'Failed to update profile');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className={isMobile ? "mobile-bottom-sheet" : "matte-3d"} style={{ width: isMobile ? '100%' : '450px', padding: '30px', borderRadius: isMobile ? '24px 24px 0 0' : '24px', animation: 'float-in 0.3s ease-out', maxHeight: isMobile ? '100dvh' : '90vh', height: isMobile ? '100dvh' : 'auto', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Your Profile</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Update your personal details and avatar.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--text-secondary)"/></button>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '8px', padding: '12px', background: '#fef2f2', color: '#ef4444', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', border: '1px solid #fecdd3' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }}/>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Avatar Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--grad-teal)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '32px', fontWeight: 800, boxShadow: '0 4px 15px var(--teal-glow)' }}>
              {avatar ? (
                <img src={avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                userData?.name?.charAt(0) || 'U'
              )}
              <label style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '28px', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='rgba(0,0,0,0.8)'} onMouseOut={e=>e.currentTarget.style.background='rgba(0,0,0,0.6)'}>
                <Camera size={14} color="white"/>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              </label>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Click icon to upload</span>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Full Name</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '12px', outline: 'none' }} />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Email Address</label>
            <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '12px', outline: 'none' }} />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>New Password (Optional)</label>
            <input type="password" placeholder="Leave blank to keep current" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '12px', outline: 'none' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" disabled={isSubmitting} className="btn-teal" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
              <Save size={18}/> {isSubmitting ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfileModal;
