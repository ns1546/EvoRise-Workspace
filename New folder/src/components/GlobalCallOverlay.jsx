import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Phone, Video, PhoneOff, X } from 'lucide-react';
import '../index.css';

const GlobalCallOverlay = () => {
  const { currentUser } = useAuth();
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsub = onSnapshot(collection(db, 'calls'), (snap) => {
      const now = Date.now();
      // Find an active call where:
      // 1. Status is ringing
      // 2. The caller is NOT me (I shouldn't see my own ring)
      // 3. The call has had a heartbeat ping in the last 12 seconds (proves caller is online)
      // 4. The call is targeted at all or at me
      const ringingCalls = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d =>
          d.status === 'ringing' &&
          d.callerId !== currentUser.uid &&
          (now - (d.lastPing || d.createdAt)) < 12000 &&
          (d.targetUid === 'all' || d.targetUid === currentUser.uid)
        )
        .sort((a, b) => b.createdAt - a.createdAt);
      
      const newestCall = ringingCalls[0];
      
      if (newestCall) {
        const dismissed = sessionStorage.getItem(`declined_call_${newestCall.id}`);
        if (!dismissed) {
          setActiveCall(newestCall);
        } else {
          setActiveCall(null);
        }
      } else {
        setActiveCall(null);
      }
    });

    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!activeCall) return;

    // Synthesize a ringing sound using Web Audio API
    let audioCtx;
    let osc1, osc2, lfo, gainNode;

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      osc1 = audioCtx.createOscillator();
      osc2 = audioCtx.createOscillator();
      lfo = audioCtx.createOscillator();
      gainNode = audioCtx.createGain();

      // UK/Europe style ringtone frequencies (400Hz + 450Hz)
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(400, audioCtx.currentTime);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(450, audioCtx.currentTime);

      // Ringing cadence (e.g. 0.4s on, 0.2s off, 0.4s on, 2s off)
      // We'll use a simpler LFO to modulate volume for ringing effect
      lfo.type = 'square';
      lfo.frequency.setValueAtTime(0.5, audioCtx.currentTime); // 0.5Hz = 2 seconds per cycle

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      
      // Modulate gain to create ringing cadence
      const cadenceGain = audioCtx.createGain();
      cadenceGain.gain.value = 0;
      lfo.connect(cadenceGain.gain);
      gainNode.connect(cadenceGain);
      cadenceGain.connect(audioCtx.destination);

      osc1.start();
      osc2.start();
      lfo.start();
    } catch (e) {
      console.warn("Web Audio API not supported or autoplay blocked");
    }

    return () => {
      try {
        if (osc1) osc1.stop();
        if (osc2) osc2.stop();
        if (lfo) lfo.stop();
        if (audioCtx) audioCtx.close();
      } catch (e) {}
    };
  }, [activeCall]);

  if (!activeCall) return null;

  // Extra safety: never show overlay if I am the caller
  if (activeCall.callerId === currentUser?.uid) return null;

  const handleAccept = () => {
    // Open the meeting link OR start native call
    if (activeCall.roomId) {
      window.dispatchEvent(new CustomEvent('START_NATIVE_CALL', { detail: { roomId: activeCall.roomId, type: activeCall.type } }));
    } else if (activeCall.link) {
      window.open(activeCall.link, '_blank');
    }
    // Locally dismiss the ringing overlay
    sessionStorage.setItem(`declined_call_${activeCall.id}`, 'true');
    setActiveCall(null);
  };

  const handleDecline = () => {
    // Locally dismiss the ringing overlay
    sessionStorage.setItem(`declined_call_${activeCall.id}`, 'true');
    setActiveCall(null);
  };

  const isVideo = activeCall.type === 'video' || activeCall.type === 'meeting';

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, background: '#070d1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.3s ease-out', padding: '60px 20px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      
      {/* Background Blur / Pulse Effect */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at center, rgba(30, 41, 59, 0.8) 0%, #070d1a 100%)', zIndex: -2 }}></div>
      <div style={{ position: 'absolute', top: '25%', width: '300px', height: '300px', borderRadius: '50%', background: isVideo ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', animation: 'timerPulse 2s infinite alternate', zIndex: -1, filter: 'blur(40px)' }}></div>

      {/* Top Section: Caller Info */}
      <div style={{ textAlign: 'center', color: 'white', marginTop: '40px', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 700,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)', marginBottom: '24px'
        }}>
          {(activeCall.callerName || '?').charAt(0).toUpperCase()}
        </div>

        <h1 style={{ fontSize: '36px', fontWeight: 700, margin: '0 0 8px 0', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
          {activeCall.callerName}
        </h1>
        <p style={{ fontSize: '16px', color: '#cbd5e1', margin: 0, fontWeight: 500 }}>
          {activeCall.type === 'meeting' ? 'Evorise Instant Meeting' : (isVideo ? 'Evorise Video Call' : 'Evorise Audio Call')}
        </p>
      </div>

      {/* Bottom Section: Actions */}
      <div style={{ display: 'flex', width: '100%', maxWidth: '400px', justifyContent: 'space-around', alignItems: 'flex-end', zIndex: 1, paddingBottom: '40px' }}>
        {/* Decline Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={handleDecline}
            style={{ width: '72px', height: '72px', borderRadius: '50%', border: 'none', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 25px rgba(239, 68, 68, 0.4)', transition: 'transform 0.2s ease' }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <PhoneOff size={32} />
          </button>
          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>Decline</span>
        </div>

        {/* Accept Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={handleAccept}
            style={{ width: '72px', height: '72px', borderRadius: '50%', border: 'none', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 25px rgba(16, 185, 129, 0.5)', transition: 'transform 0.2s ease', animation: 'bounce 2s infinite' }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isVideo ? <Video size={32} /> : <Phone size={32} />}
          </button>
          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>Accept</span>
        </div>
      </div>
      
      {/* CSS Keyframes */}
      <style>{`
        @keyframes timerPulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          100% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-12px); }
          60% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

export default GlobalCallOverlay;
