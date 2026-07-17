import React, { useState, useEffect, useRef } from 'react';
import { Wifi, Cast, Monitor, Volume2, Play, SkipForward, SkipBack, BellOff, Focus, Power, AlignJustify, Lock } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

const ControlCenter = ({ isOpen, onClose, logout }) => {
  const { settings } = useSettings();
  
  // Real System States
  const [wifi, setWifi] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [cozyView, setCozyView] = useState(document.body.classList.contains('compact-view'));
  const [dnd, setDnd] = useState(localStorage.getItem('evorise-dnd') === 'true');
  const [focusMode, setFocusMode] = useState(false);
  
  // Sliders
  const [volume, setVolume] = useState(80);
  const [brightness, setBrightness] = useState(100);
  
  // Media Player (Ambient Lofi)
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(() => {
    const a = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3');
    a.loop = true;
    return a;
  });

  const ref = useRef(null);

  // Network listener
  useEffect(() => {
    const handleOnline = () => setWifi(true);
    const handleOffline = () => setWifi(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Brightness effect
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.style.filter = brightness < 100 ? `brightness(${brightness}%)` : '';
    }
  }, [brightness]);

  // Audio effect
  useEffect(() => {
    audio.volume = volume / 100;
    if (isPlaying) {
      audio.play().catch(e => {
        console.error('Playback failed', e);
        setIsPlaying(false);
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Interact with the page first to play audio', type: 'error' } }));
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, volume, audio]);

  // Cleanup audio
  useEffect(() => {
    return () => audio.pause();
  }, [audio]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const toggleCozyView = () => {
    document.body.classList.toggle('compact-view');
    setCozyView(document.body.classList.contains('compact-view'));
  };

  const toggleDnd = () => {
    const newDnd = !dnd;
    setDnd(newDnd);
    localStorage.setItem('evorise-dnd', newDnd ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('toast', { detail: { message: newDnd ? 'Do Not Disturb Enabled' : 'Do Not Disturb Disabled', type: 'info' } }));
  };

  const triggerFocus = () => {
    setFocusMode(true);
    window.dispatchEvent(new CustomEvent('TRIGGER_DYNAMIC_ISLAND', { detail: { type: 'stopwatch' } }));
    setTimeout(() => setFocusMode(false), 2000);
    onClose();
  };

  const handleLogout = () => {
    if (logout) {
      logout();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '60px',
        right: '20px',
        width: '320px',
        background: 'rgba(25, 25, 30, 0.75)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderRadius: '24px',
        padding: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(255,255,255,0.1) inset',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 9999,
        animation: 'cc-slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        color: 'white',
        cursor: 'default'
      }}
    >
      <style>{`
        @keyframes cc-slide-down {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cc-block {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          backdrop-filter: blur(20px);
          overflow: hidden;
          transition: background 0.2s;
        }
        .cc-block:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .cc-slider-wrap {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          height: 48px;
          padding: 0 12px;
          gap: 12px;
        }
        .cc-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.2);
          outline: none;
        }
        .cc-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        .cc-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          transition: all 0.2s;
          cursor: pointer;
        }
        .cc-toggle.active {
          background: var(--blue, #007aff);
        }
        .cc-toggle.active-orange {
          background: var(--orange, #ff9500);
        }
        .cc-toggle.active-indigo {
          background: #5856d6;
        }
        .cc-toggle.active-red {
          background: #ff3b30;
        }
      `}</style>

      {/* Connectivity & Quick Toggles Row */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* Connectivity */}
        <div className="cc-block" style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Network status is automatic', type: 'info' } }))}>
            <div className={`cc-toggle ${wifi ? 'active' : ''}`}><Wifi size={18} color="white" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Cloud Sync</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{wifi ? 'Connected' : 'Offline'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={toggleFullscreen}>
            <div className={`cc-toggle ${isFullscreen ? 'active' : ''}`}><Cast size={18} color="white" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Present Mode</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{isFullscreen ? 'Active' : 'Windowed'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={toggleCozyView}>
            <div className={`cc-toggle ${cozyView ? 'active' : ''}`}><AlignJustify size={18} color="white" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Cozy Workspace</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{cozyView ? 'On' : 'Off'}</div>
            </div>
          </div>
        </div>

        {/* Small Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '90px' }}>
          <div className={`cc-block ${dnd ? 'active-indigo' : ''}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: dnd ? '#5856d6' : '' }} onClick={toggleDnd}>
            <div style={{ textAlign: 'center' }}>
              <BellOff size={22} color="white" style={{ marginBottom: 4 }} />
              <div style={{ fontSize: '11px', fontWeight: 600 }}>DND</div>
            </div>
          </div>
          <div className={`cc-block ${focusMode ? 'active-orange' : ''}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: focusMode ? '#ff9500' : '' }} onClick={triggerFocus}>
            <div style={{ textAlign: 'center' }}>
              <Focus size={22} color="white" style={{ marginBottom: 4 }} />
              <div style={{ fontSize: '11px', fontWeight: 600 }}>Focus</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="cc-block" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="cc-slider-wrap">
          <Monitor size={18} color="rgba(255,255,255,0.8)" />
          <input 
            type="range" 
            className="cc-slider" 
            min="30" max="100" 
            value={brightness} 
            onChange={e => setBrightness(e.target.value)}
          />
        </div>
        <div className="cc-slider-wrap">
          <Volume2 size={18} color="rgba(255,255,255,0.8)" />
          <input 
            type="range" 
            className="cc-slider" 
            min="0" max="100" 
            value={volume} 
            onChange={e => setVolume(e.target.value)}
          />
        </div>
      </div>

      {/* Media Player and Lock */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div className="cc-block" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--grad-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              <span style={{ fontSize: '16px' }}>🎵</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>Ambient Lofi</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Deep Focus Audio</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '4px' }}>
            <SkipBack size={20} color="white" style={{ cursor: 'pointer', opacity: 0.5 }} />
            <div onClick={() => setIsPlaying(!isPlaying)} style={{ cursor: 'pointer' }}>
              {isPlaying ? <Power size={24} color="white" /> : <Play size={24} color="white" fill="white" />}
            </div>
            <SkipForward size={20} color="white" style={{ cursor: 'pointer', opacity: 0.5 }} />
          </div>
        </div>
        
        {/* Lock System / Exit */}
        <div className="cc-block" style={{ width: '90px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleLogout}>
          <div className="cc-toggle active-red" style={{ background: '#ff3b30' }}>
            <Lock size={20} color="white" />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600 }}>Lock & Exit</div>
        </div>
      </div>

    </div>
  );
};

export default ControlCenter;
