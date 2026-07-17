import React, { useState } from 'react';
import { ArrowLeft, Bell, Lock, HelpCircle, User, Image, Monitor, FileText, Check } from 'lucide-react';

const SettingsModal = ({ onClose }) => {
  const [expandedSetting, setExpandedSetting] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [wallpaper, setWallpaper] = useState('default');

  const renderExpandedContent = (id) => {
    if (id === 'theme') {
      return (
        <div style={{ padding: '0 24px 16px 68px' }}>
          {['Light', 'Dark', 'System default'].map(t => {
            const val = t.toLowerCase().split(' ')[0];
            return (
              <label key={val} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', cursor: 'pointer' }}>
                <input type="radio" name="theme" value={val} checked={theme === val} onChange={() => setTheme(val)} style={{ accentColor: '#00a884', marginRight: '12px', width: '16px', height: '16px' }} />
                <span style={{ color: '#e9edef', fontSize: '15px' }}>{t}</span>
              </label>
            );
          })}
        </div>
      );
    }
    if (id === 'wallpaper') {
      return (
        <div style={{ padding: '0 24px 16px 68px', display: 'flex', gap: '8px' }}>
          {['#0b141a', '#1e2428', '#2a3942', '#3b4a54'].map(color => (
            <div key={color} onClick={() => setWallpaper(color)} style={{ width: '40px', height: '40px', borderRadius: '8px', background: color, cursor: 'pointer', border: wallpaper === color ? '2px solid #00a884' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {wallpaper === color && <Check size={16} color="#00a884" />}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111b21', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 20px', background: '#202c33', display: 'flex', alignItems: 'center', gap: '24px', height: '108px', flexShrink: 0, paddingTop: '49px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d1d7db', padding: 0 }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 500, color: '#e9edef' }}>Settings</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#111b21' }}>
        {[
          { id: 'account', icon: <User size={20} color="#8696a0"/>, title: 'Account', subtitle: 'Security notifications, change number' },
          { id: 'privacy', icon: <Lock size={20} color="#8696a0"/>, title: 'Privacy', subtitle: 'Block contacts, disappearing messages' },
          { id: 'notifications', icon: <Bell size={20} color="#8696a0"/>, title: 'Notifications', subtitle: 'Message, group & call tones' },
          { id: 'theme', icon: <Monitor size={20} color="#8696a0"/>, title: 'Theme', subtitle: 'Light, Dark, System Default' },
          { id: 'wallpaper', icon: <Image size={20} color="#8696a0"/>, title: 'Chat wallpaper', subtitle: 'Custom backgrounds' },
          { id: 'shortcuts', icon: <FileText size={20} color="#8696a0"/>, title: 'Keyboard shortcuts', subtitle: 'Navigation, sending' },
          { id: 'help', icon: <HelpCircle size={20} color="#8696a0"/>, title: 'Help', subtitle: 'Help center, contact us, privacy policy' },
        ].map(item => (
          <div key={item.id}>
            <div onClick={() => setExpandedSetting(expandedSetting === item.id ? null : item.id)} style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#202c33'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
              <div style={{ marginRight: '24px', display: 'flex', alignItems: 'center' }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', color: '#e9edef' }}>{item.title}</div>
                <div style={{ fontSize: '13px', color: '#8696a0', marginTop: '2px' }}>{item.subtitle}</div>
              </div>
            </div>
            {expandedSetting === item.id && renderExpandedContent(item.id)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsModal;
