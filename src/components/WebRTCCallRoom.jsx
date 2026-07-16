/**
 * WebRTCCallRoom.jsx
 * 
 * Signaling model (clean, race-condition free):
 *  1. Both users join → register in participants subcollection.
 *  2. AFTER registering, each user does a one-shot getDocs for all OTHER participants.
 *  3. The user with the LOWER joinedAt (joined first) sends offers to those who joined later.
 *     The user who joined LATER sends offers to those already in the room.
 *  4. In practice: the JOINER always sends an OFFER to the CALLER already waiting.
 *  5. ICE candidates exchanged in realtime via signals subcollection onSnapshot.
 */

import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import {
  collection, doc, addDoc, onSnapshot, query, where,
  setDoc, deleteDoc, getDocs, updateDoc
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor } from 'lucide-react';

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ]
};

const WebRTCCallRoom = ({ roomId, callType, onLeave }) => {
  const { currentUser, userData } = useAuth();

  const [participants,  setParticipants]  = useState({});
  const [remoteStreams, setRemoteStreams]  = useState({});
  const [isMuted,       setIsMuted]       = useState(false);
  const [isVideoOff,    setIsVideoOff]    = useState(callType === 'audio');
  const [isScreenShare, setIsScreenShare] = useState(false);
  const [fullScreenId,  setFullScreenId]  = useState(null);
  const [callEnded,     setCallEnded]     = useState(false);
  const [amHost,        setAmHost]        = useState(false);
  const [status,        setStatus]        = useState('Connecting...');

  const localStreamRef  = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef   = useRef(null);
  const peersRef        = useRef({});       // uid → RTCPeerConnection
  const handledSigs     = useRef(new Set()); // prevent double-processing
  const cleanups        = useRef([]);
  const mountedRef      = useRef(true);

  // ─── Build / get peer connection ──────────────────────────────────────────
  function makePeer(uid) {
    if (peersRef.current[uid]) return peersRef.current[uid];

    const pc = new RTCPeerConnection(ICE);
    peersRef.current[uid] = pc;

    // attach local tracks
    const stream = localStreamRef.current;
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));

    // receive remote tracks
    pc.ontrack = e => {
      const [rs] = e.streams;
      if (rs && mountedRef.current) {
        setRemoteStreams(prev => ({ ...prev, [uid]: rs }));
        setStatus('Connected');
      }
    };

    // send ICE candidates
    pc.onicecandidate = async e => {
      if (!e.candidate) return;
      try {
        await addDoc(collection(db, `calls/${roomId}/signals`), {
          sender: currentUser.uid, target: uid,
          type: 'ice', data: JSON.stringify(e.candidate.toJSON()), ts: Date.now()
        });
      } catch (err) { console.warn('[ICE send]', err.code, err.message); }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] peer state with', uid, '→', pc.connectionState);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        delete peersRef.current[uid];
        if (mountedRef.current) {
          setRemoteStreams(prev => { const n={...prev}; delete n[uid]; return n; });
        }
      }
    };

    pc.onicegatheringstatechange = () =>
      console.log('[WebRTC] ICE gathering with', uid, '→', pc.iceGatheringState);

    pc.onsignalingstatechange = () =>
      console.log('[WebRTC] signaling state with', uid, '→', pc.signalingState);

    return pc;
  }

  // ─── Send offer to a remote uid ───────────────────────────────────────────
  async function sendOffer(uid) {
    console.log('[WebRTC] sending offer to', uid);
    const pc = makePeer(uid);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await addDoc(collection(db, `calls/${roomId}/signals`), {
        sender: currentUser.uid, target: uid,
        type: 'offer', data: JSON.stringify({ type: offer.type, sdp: offer.sdp }), ts: Date.now()
      });
      console.log('[WebRTC] offer sent to', uid);
    } catch (e) { console.error('[WebRTC] sendOffer error', e); }
  }

  // ─── Process one incoming signal ──────────────────────────────────────────
  async function processSignal(sigId, sig) {
    if (handledSigs.current.has(sigId)) return;
    handledSigs.current.add(sigId);

    const { sender, type, data } = sig;
    if (sender === currentUser.uid) return;

    console.log('[WebRTC] signal received:', type, 'from', sender);

    const pc = makePeer(sender);
    try {
      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await addDoc(collection(db, `calls/${roomId}/signals`), {
          sender: currentUser.uid, target: sender,
          type: 'answer', data: JSON.stringify({ type: answer.type, sdp: answer.sdp }), ts: Date.now()
        });
        console.log('[WebRTC] answer sent to', sender);
      } else if (type === 'answer') {
        if (pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)));
        }
      } else if (type === 'ice') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(data)));
        } else {
          // Queue it for later — remote description not set yet
          setTimeout(() => {
            pc.remoteDescription && pc.addIceCandidate(new RTCIceCandidate(JSON.parse(data))).catch(() => {});
          }, 2000);
        }
      }
    } catch (e) { console.error('[WebRTC] processSignal error', type, e.message); }
  }

  // ─── Main setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    const run = async () => {
      // ── Step 1: Get media ──────────────────────────────────────────────────
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: callType === 'video'
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
            : false,
        });
      } catch (e) {
        console.error('[WebRTC] getUserMedia failed:', e.name, e.message);
        alert(`Microphone/Camera error: ${e.message}\n\nPlease allow access in your browser and try again.`);
        onLeave();
        return;
      }

      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setStatus('Joining room...');

      // ── Step 2: Register in room ───────────────────────────────────────────
      const myName = userData?.name || currentUser.email?.split('@')[0] || 'User';
      const myJoinedAt = Date.now();
      await setDoc(doc(db, `calls/${roomId}/participants`, currentUser.uid), {
        name: myName, joinedAt: myJoinedAt
      });

      // ── Step 3: Identify if I'm the host ───────────────────────────────────
      const callSnap = await getDocs(query(collection(db, 'calls'), where('roomId', '==', roomId)));
      let callDocId = null, callDocData = null;
      callSnap.forEach(d => { callDocId = d.id; callDocData = d.data(); });
      const iAmHost = callDocData?.callerId === currentUser.uid;
      if (mountedRef.current) { setAmHost(iAmHost); }

      // ── Step 4: Heartbeat (host only) ──────────────────────────────────────
      if (iAmHost && callDocId) {
        const iv = setInterval(() =>
          updateDoc(doc(db, 'calls', callDocId), { lastPing: Date.now() }).catch(() => {}),
        4000);
        cleanups.current.push(() => clearInterval(iv));
      }

      // ── Step 5: Watch for host ending call ─────────────────────────────────
      const unsubCall = onSnapshot(
        query(collection(db, 'calls'), where('roomId', '==', roomId)),
        snap => {
          if (!mountedRef.current) return;
          snap.forEach(d => {
            if (d.data().status === 'ended' && d.data().callerId !== currentUser.uid) {
              setCallEnded(true);
              setTimeout(() => mountedRef.current && onLeave(), 2000);
            }
          });
        }
      );
      cleanups.current.push(unsubCall);

      // ── Step 6: Subscribe to signals addressed to ME ───────────────────────
      // This MUST be set up before we send offers, so we catch answers.
      const unsubSigs = onSnapshot(
        query(collection(db, `calls/${roomId}/signals`), where('target', '==', currentUser.uid)),
        snap => {
          if (!mountedRef.current) return;
          snap.docChanges().forEach(ch => {
            if (ch.type === 'added') processSignal(ch.doc.id, ch.doc.data());
          });
        },
        err => console.error('[WebRTC] signal listener error:', err.code, err.message)
      );
      cleanups.current.push(unsubSigs);

      // ── Step 7: One-shot: find who's already in room → send them offers ────
      // Wait a moment to ensure signal listener is active
      await new Promise(r => setTimeout(r, 800));

      const partsSnap = await getDocs(collection(db, `calls/${roomId}/participants`));
      const existingParts = [];
      partsSnap.forEach(d => {
        setParticipants(prev => ({ ...prev, [d.id]: d.data() }));
        if (d.id !== currentUser.uid) existingParts.push(d.id);
      });

      setStatus(existingParts.length > 0 ? 'Connecting to peers...' : 'Waiting for others...');

      // Send offer to EACH participant already in room
      for (const uid of existingParts) {
        await sendOffer(uid);
      }

      // ── Step 8: Watch for new participants joining AFTER me ─────────────────
      // When someone new joins, they will send ME an offer — I just need to answer (handled by signal listener).
      // But I still need to update the participants display and handle leaves.
      const unsubParts = onSnapshot(
        collection(db, `calls/${roomId}/participants`),
        snap => {
          if (!mountedRef.current) return;
          const map = {};
          snap.docs.forEach(d => { map[d.id] = d.data(); });
          setParticipants(map);

          snap.docChanges().forEach(ch => {
            if (ch.type === 'removed') {
              const uid = ch.doc.id;
              if (peersRef.current[uid]) { peersRef.current[uid].close(); delete peersRef.current[uid]; }
              setRemoteStreams(prev => { const n={...prev}; delete n[uid]; return n; });
            }
          });
        },
        err => console.error('[WebRTC] parts listener error:', err.code, err.message)
      );
      cleanups.current.push(unsubParts);
    };

    run();

    return () => {
      mountedRef.current = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach(pc => { try { pc.close(); } catch(e){} });
      peersRef.current = {};
      cleanups.current.forEach(fn => { try { fn(); } catch(e){} });
      cleanups.current = [];
      deleteDoc(doc(db, `calls/${roomId}/participants`, currentUser.uid)).catch(() => {});
    };
  }, [roomId, callType]); // eslint-disable-line

  // ─── Controls ─────────────────────────────────────────────────────────────
  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  }
  function toggleVideo() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsVideoOff(v => !v);
  }

  async function toggleScreenShare() {
    if (isScreenShare) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        Object.values(peersRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(camTrack);
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenShare(false);
    } else {
      try {
        const ds = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = ds;
        const track = ds.getVideoTracks()[0];
        track.onended = () => setIsScreenShare(false);
        Object.values(peersRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(track);
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = ds;
        setIsScreenShare(true);
      } catch (e) { console.error('Screen share:', e); }
    }
  }

  async function handleLeave() {
    try {
      const snap = await getDocs(query(collection(db, 'calls'), where('roomId', '==', roomId)));
      for (const d of snap.docs) {
        if (d.data().callerId === currentUser.uid) {
          await updateDoc(doc(db, 'calls', d.id), { status: 'ended' });
          await addDoc(collection(db, 'group_messages'), {
            text: `📞 Ended the ${d.data().type} call.`,
            senderId: currentUser.uid,
            senderName: userData?.name || 'User',
            timestamp: Date.now(), read: false, isCallLog: true,
          });
        }
      }
    } catch (e) { console.error('handleLeave:', e); }
    onLeave();
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const remoteEntries = Object.entries(remoteStreams);
  const partCount = Object.keys(participants).length;

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000000,
      background:'#070d1a', display:'flex', flexDirection:'column',
      fontFamily:"'Inter',system-ui,sans-serif",
    }}>
      {/* Call Ended overlay */}
      {callEnded && (
        <div style={{
          position:'absolute', inset:0, zIndex:20,
          background:'rgba(7,13,26,0.96)', display:'flex',
          flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16
        }}>
          <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(239,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <PhoneOff size={36} color="#ef4444"/>
          </div>
          <h2 style={{color:'white',margin:0}}>Call Ended</h2>
          <p style={{color:'#64748b',margin:0}}>The host ended this call</p>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center',
        background:'rgba(0,0,0,0.5)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{
            width:8,height:8,borderRadius:'50%',background:'#10b981',
            boxShadow:'0 0 0 3px rgba(16,185,129,0.25)',
            animation:'pulse 2s ease-in-out infinite'
          }}/>
          <span style={{color:'white',fontWeight:600,fontSize:17}}>
            Evorise {callType==='video'?'Video':'Audio'} Call
          </span>
          <span style={{
            background:'rgba(255,255,255,0.08)',padding:'2px 10px',
            borderRadius:20,color:'#94a3b8',fontSize:12,
          }}>
            {partCount} participant{partCount!==1?'s':''}
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{color:'#475569',fontSize:12}}>{status}</span>
          <span style={{color:'#10b981',fontSize:12,fontWeight:500}}>🔒 Encrypted</span>
        </div>
      </div>

      {/* Video Grid */}
      <div style={{
        flex:1, display:'flex', flexWrap:'wrap', gap:14, padding:20,
        overflowY:'auto', justifyContent:'center', alignItems:'center',
        position:'relative',
      }}>
        {/* Local tile */}
        {callType === 'video' ? (
          <div
            onClick={() => setFullScreenId(f => f==='local'?null:'local')}
            style={tileStyle(fullScreenId==='local', !!(fullScreenId&&fullScreenId!=='local'))}
          >
            <video ref={localVideoRef} autoPlay playsInline muted
              style={{width:'100%',height:'100%',objectFit:'cover',transform:isScreenShare?'none':'scaleX(-1)'}}
            />
            <Label>{userData?.name||'You'}{isMuted?' 🔇':''}{isScreenShare?' 📺':''}</Label>
          </div>
        ) : (
          <Avatar name={userData?.name||'You'} color="#0ea5e9" muted={isMuted}/>
        )}

        {/* Remote tiles */}
        {remoteEntries.map(([uid, stream]) =>
          callType === 'video' ? (
            <RemoteTile
              key={uid}
              stream={stream}
              label={participants[uid]?.name || 'Participant'}
              isFullScreen={fullScreenId===uid}
              hidden={!!(fullScreenId&&fullScreenId!==uid)}
              onClick={() => setFullScreenId(f => f===uid?null:uid)}
            />
          ) : (
            <Avatar key={uid} name={participants[uid]?.name||'Participant'} color="#8b5cf6" muted={false} stream={stream}/>
          )
        )}

        {remoteEntries.length === 0 && (
          <div style={{color:'#475569',fontSize:16,textAlign:'center',position:'absolute',bottom:100,left:'50%',transform:'translateX(-50%)'}}>
            <div style={{fontSize:36,marginBottom:8}}>⏳</div>
            Waiting for others to join...
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        padding:'18px 0 26px', display:'flex', justifyContent:'center',
        alignItems:'flex-end', gap:18, flexShrink:0,
        background:'linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 100%)'
      }}>
        <CtrlBtn onClick={toggleMute} active={isMuted} label={isMuted?'Unmute':'Mute'}>
          {isMuted?<MicOff size={20}/>:<Mic size={20}/>}
        </CtrlBtn>

        {callType==='video' && <>
          <CtrlBtn onClick={toggleVideo} active={isVideoOff} label={isVideoOff?'Start Cam':'Stop Cam'}>
            {isVideoOff?<VideoOff size={20}/>:<Video size={20}/>}
          </CtrlBtn>
          <CtrlBtn onClick={toggleScreenShare} active={isScreenShare} activeColor="#3b82f6" label={isScreenShare?'Stop Share':'Share Screen'}>
            <Monitor size={20}/>
          </CtrlBtn>
        </>}

        <button onClick={handleLeave} style={{
          display:'flex',alignItems:'center',gap:10,
          padding:'0 28px',height:56,borderRadius:30,border:'none',
          background:'linear-gradient(135deg,#ef4444,#b91c1c)',
          color:'white',fontWeight:700,fontSize:15,cursor:'pointer',
          boxShadow:'0 4px 20px rgba(239,68,68,0.4)',
        }}>
          <PhoneOff size={20}/> {amHost?'End Call':'Leave Call'}
        </button>
      </div>
    </div>
  );
};

// ─── Shared style helpers ──────────────────────────────────────────────────
function tileStyle(isFullScreen, hidden) {
  return {
    position: isFullScreen ? 'absolute' : 'relative',
    inset: isFullScreen ? 0 : 'auto',
    width:  isFullScreen ? '100%' : 360,
    height: isFullScreen ? '100%' : 270,
    background: '#1e293b', borderRadius: isFullScreen ? 0 : 16,
    overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    zIndex: isFullScreen ? 8 : 1, cursor: 'pointer',
    display: hidden ? 'none' : 'block',
    border: '1px solid rgba(255,255,255,0.07)',
  };
}

function Label({ children }) {
  return (
    <div style={{
      position:'absolute',bottom:10,left:10,
      background:'rgba(0,0,0,0.7)',padding:'3px 12px',
      borderRadius:20,color:'white',fontSize:13,fontWeight:500,
    }}>
      {children}
    </div>
  );
}

function Avatar({ name, color, muted, stream }) {
  const audioRef = useRef(null);
  
  useEffect(() => {
    if (audioRef.current && stream && audioRef.current.srcObject !== stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
      {stream && <audio ref={audioRef} autoPlay playsInline />}
      <div style={{
        width:110,height:110,borderRadius:'50%',
        background:`linear-gradient(135deg,${color},${color}99)`,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:44,fontWeight:700,color:'white',
        boxShadow:`0 0 0 5px ${color}30, 0 8px 32px rgba(0,0,0,0.4)`,
        animation: muted ? 'none' : 'pulse 2s ease-in-out infinite',
      }}>
        {(name||'?').charAt(0).toUpperCase()}
      </div>
      <span style={{color:'white',fontWeight:600,fontSize:14}}>
        {name}{muted?' 🔇':''}
      </span>
    </div>
  );
}

function RemoteTile({ stream, label, isFullScreen, hidden, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div onClick={onClick} style={tileStyle(isFullScreen, hidden)}>
      <video ref={ref} autoPlay playsInline
        style={{width:'100%',height:'100%',objectFit:'cover'}}
      />
      <Label>{label}</Label>
    </div>
  );
}

function CtrlBtn({ children, label, active, activeColor='#ef4444', onClick }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
      <button onClick={onClick} style={{
        width:52,height:52,borderRadius:'50%',border:'none',
        background: active ? activeColor : 'rgba(255,255,255,0.1)',
        backdropFilter:'blur(8px)',color:'white',cursor:'pointer',
        display:'flex',alignItems:'center',justifyContent:'center',
        boxShadow: active ? `0 4px 16px ${activeColor}55` : 'none',
        transition:'all 0.2s',
      }}>
        {children}
      </button>
      <span style={{color:'#64748b',fontSize:11}}>{label}</span>
    </div>
  );
}

export default WebRTCCallRoom;
