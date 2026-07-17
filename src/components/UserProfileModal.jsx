import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword } from 'firebase/auth';
import { X, Camera, Save, AlertCircle, ZoomIn } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';
import { useIsMobile } from '../hooks/useIsMobile';

/* ── Image compression helper ──────────────────────────────── */
const compressImage = (file, maxSizeBytes = 900 * 1024, maxDim = 1200) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Try quality from 0.9 down until under maxSizeBytes
      let quality = 0.9;
      const tryEncode = () => {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const bytes = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
        if (bytes <= maxSizeBytes || quality <= 0.2) {
          resolve(dataUrl);
        } else {
          quality = Math.max(0.2, quality - 0.1);
          tryEncode();
        }
      };
      tryEncode();
    };
    img.onerror = reject;
    img.src = url;
  });

/* ── Lightbox ────────────────────────────────────────────────── */
const Lightbox = ({ src, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.18s ease',
    }}
  >
    {/* Close button */}
    <button
      onClick={onClose}
      style={{
        position: 'fixed', top: 18, right: 18,
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)',
        border: '1.5px solid rgba(255,255,255,0.3)',
        color: 'white', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        transition: 'background 0.2s',
        zIndex: 100000,
      }}
      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
      onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
      title="Close"
    >
      <X size={20} />
    </button>

    {/* Image */}
    <img
      src={src}
      alt="Profile preview"
      onClick={e => e.stopPropagation()}
      style={{
        maxWidth: '90vw',
        maxHeight: '88vh',
        borderRadius: '20px',
        objectFit: 'contain',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        border: '2px solid rgba(255,255,255,0.12)',
        animation: 'scaleIn 0.22s cubic-bezier(.34,1.56,.64,1)',
      }}
    />

    {/* Tap-to-close hint */}
    <span style={{
      position: 'fixed', bottom: 24, left: 0, right: 0,
      textAlign: 'center', color: 'rgba(255,255,255,0.45)',
      fontSize: 13, pointerEvents: 'none', userSelect: 'none',
    }}>
      Tap outside to close
    </span>

    <style>{`
      @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
      @keyframes scaleIn { from { transform:scale(0.82); opacity:0 } to { transform:scale(1); opacity:1 } }
    `}</style>
  </div>
);

/* ── Main Component ──────────────────────────────────────────── */
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
  const [compressing, setCompressing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploadInfo, setUploadInfo] = useState('');

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCompressing(true);
    setUploadInfo('');
    try {
      const compressed = await compressImage(file);
      const bytes = Math.round((compressed.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
      const kb = Math.round(bytes / 1024);
      setUploadInfo(`✓ Compressed to ${kb < 1024 ? kb + ' KB' : (kb / 1024).toFixed(1) + ' MB'}`);
      setAvatar(compressed);
    } catch {
      setError('Failed to process image. Please try a different file.');
    }
    setCompressing(false);
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
      logActivity({ action: 'UPDATE_PROFILE', module: 'system', detail: 'Updated personal profile settings.' });
      alert('Profile updated successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security, changing email/password requires a recent login. Please log out and back in, then try again.');
      } else {
        setError(err.message || 'Failed to update profile');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Lightbox */}
      {lightboxOpen && avatar && (
        <Lightbox src={avatar} onClose={() => setLightboxOpen(false)} />
      )}

      {/* Modal backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          zIndex: 9998,
        }}
        onClick={onClose}
      >
        {/* Modal card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: isMobile ? '100%' : '460px',
            background: 'white',
            borderRadius: isMobile ? '28px 28px 0 0' : '28px',
            padding: isMobile ? '24px 20px calc(28px + env(safe-area-inset-bottom))' : '32px',
            maxHeight: isMobile ? '95dvh' : '90vh',
            overflowY: 'auto',
            boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
            animation: isMobile ? 'slideUp 0.28s cubic-bezier(.34,1.56,.64,1)' : 'float-in 0.28s ease-out',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-0.3px' }}>Your Profile</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Update your details and profile photo.
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color="var(--text-secondary)" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', gap: 8, padding: '12px 14px', background: '#fef2f2', color: '#ef4444', borderRadius: 12, fontSize: 13, marginBottom: 20, border: '1px solid #fecdd3' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Avatar Section ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>

              {/* Avatar circle with zoom + upload overlay */}
              <div style={{ position: 'relative', width: 100, height: 100 }}>
                <div style={{
                  width: 100, height: 100, borderRadius: 28,
                  background: 'linear-gradient(135deg, #0b57d0, #1a73e8)',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 38, fontWeight: 800,
                  boxShadow: '0 6px 20px rgba(11,87,208,0.35)',
                  position: 'relative',
                }}>
                  {avatar ? (
                    <img src={avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    userData?.name?.charAt(0)?.toUpperCase() || 'U'
                  )}

                  {/* Hover overlay: zoom preview */}
                  {avatar && (
                    <div
                      onClick={() => setLightboxOpen(true)}
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s',
                        borderRadius: 28,
                      }}
                      onMouseOver={e => e.currentTarget.style.opacity = 1}
                      onMouseOut={e => e.currentTarget.style.opacity = 0}
                    >
                      <ZoomIn size={22} color="white" />
                      <span style={{ color: 'white', fontSize: 10, marginTop: 4, fontWeight: 600 }}>PREVIEW</span>
                    </div>
                  )}
                </div>

                {/* Camera upload button (bottom-right badge) */}
                <label
                  title="Upload photo"
                  style={{
                    position: 'absolute', bottom: -6, right: -6,
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0b57d0, #1a73e8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: '2.5px solid white',
                    boxShadow: '0 2px 8px rgba(11,87,208,0.4)',
                    transition: 'transform 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Camera size={15} color="white" />
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                </label>
              </div>

              {/* Status text */}
              {compressing ? (
                <span style={{ fontSize: 12, color: '#007AFF', fontWeight: 600 }}>⏳ Compressing image…</span>
              ) : uploadInfo ? (
                <span style={{ fontSize: 12, color: '#34C759', fontWeight: 600 }}>{uploadInfo}</span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {avatar ? 'Tap 🔍 to preview · 📷 to change' : 'Click 📷 to upload (auto-compressed to &lt;1 MB)'}
                </span>
              )}

              {/* Mobile preview button (always visible on touch) */}
              {avatar && isMobile && (
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  style={{
                    background: 'rgba(0,122,255,0.1)', border: 'none',
                    color: '#007AFF', fontSize: 13, fontWeight: 600,
                    padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <ZoomIn size={14} /> View Full Photo
                </button>
              )}
            </div>

            {/* ── Form fields ── */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Full Name</label>
              <input
                type="text" required value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="matte-3d-inset"
                style={{ width: '100%', padding: '13px 14px', border: 'none', borderRadius: 14, outline: 'none', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email Address</label>
              <input
                type="email" required value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="matte-3d-inset"
                style={{ width: '100%', padding: '13px 14px', border: 'none', borderRadius: 14, outline: 'none', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>New Password <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input
                type="password" placeholder="Leave blank to keep current"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="matte-3d-inset"
                style={{ width: '100%', padding: '13px 14px', border: 'none', borderRadius: 14, outline: 'none', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>

            {/* Save button */}
            <button
              type="submit"
              disabled={isSubmitting || compressing}
              style={{
                width: '100%', padding: '15px',
                background: isSubmitting || compressing ? '#94a3b8' : 'linear-gradient(135deg, #0b57d0, #1a73e8)',
                color: 'white', border: 'none', borderRadius: 16,
                fontWeight: 700, fontSize: 16, cursor: isSubmitting || compressing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: isSubmitting || compressing ? 'none' : '0 6px 20px rgba(11,87,208,0.35)',
                transition: 'all 0.2s',
              }}
            >
              <Save size={18} />
              {compressing ? 'Processing image…' : isSubmitting ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes slideUp  { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes float-in { from { transform: translateY(16px); opacity:0 } to { transform: translateY(0); opacity:1 } }
      `}</style>
    </>
  );
};

export default UserProfileModal;
