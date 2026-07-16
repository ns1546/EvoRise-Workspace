import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, arrayUnion, arrayRemove, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useActivity } from '../contexts/ActivityContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { Users, Search, MoreVertical, Video, Phone, Lock, ArrowDown, Pin, X as XIcon, Plus, MessageSquare } from 'lucide-react';
import MessageBubble, { getSenderColor } from './chat/MessageBubble';
import GroupInfoPanel from './chat/GroupInfoPanel';
import MessageInput from './chat/MessageInput';
import ChatMenu from './chat/modals/ChatMenu';
import MainMenu from './chat/modals/MainMenu';
import ProfileModal from './chat/modals/ProfileModal';
import SettingsModal from './chat/modals/SettingsModal';
import CommunitiesModal from './chat/modals/CommunitiesModal';
import NewGroupModal from './chat/modals/NewGroupModal';
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("WhatsApp ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', background: 'white', padding: '20px', height: '100vh', overflow: 'auto', zIndex: 99999 }}>
          <h1>WhatsApp Component Crashed!</h1>
          <p>Please take a screenshot of this error and show it to the AI.</p>
          <pre>{this.state.error && this.state.error.toString()}</pre>
          <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const ContextMenu = ({ menu, onClose, onReply, onStar, onDelete, onPin, onForward, currentUserId, onReactOpen }) => {
  if (!menu) return null;
  const { msg, rect, isMe } = menu;

  const items = [
    { label: 'Reply', action: () => { onReply(msg); onClose(); } },
    { label: 'React to message', action: () => { onReactOpen(msg); onClose(); } },
    { label: 'Forward message', action: () => { onForward(msg); onClose(); } },
    { label: 'Copy text', action: () => { navigator.clipboard?.writeText(msg.text); onClose(); } },
    { label: msg.starredBy?.includes(currentUserId) ? 'Unstar message' : 'Star message', action: () => { onStar(msg.id); onClose(); } },
    { label: msg.isPinned ? 'Unpin message' : 'Pin message', action: () => { onPin(msg); onClose(); } },
    ...(isMe ? [{ label: 'Delete for everyone', action: () => { onDelete(msg.id); onClose(); }, danger: true }] : []),
    { label: 'Delete for me', action: () => { onClose(); /* Optional local delete */ }, danger: true },
  ];

  // Anchor menu to the message bubble element, not cursor
  const menuWidth = 210;
  const menuHeight = items.length * 46 + 16;

  // Position: relative to whatsapp-root container
  let left = isMe ? (rect.right - menuWidth) : rect.left;
  let top = rect.top + 30;

  // Clamp within the whatsapp-root container bounds
  if (rect.containerWidth) {
    if (left < 8) left = 8;
    if (left + menuWidth > rect.containerWidth - 8) left = rect.containerWidth - menuWidth - 8;
  }
  
  if (rect.containerHeight) {
    if (top + menuHeight > rect.containerHeight - 8) top = rect.top - menuHeight;
    if (top < 8) top = 8;
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ position: 'absolute', top, left, background: '#233138', border: '1px solid #2a3942', borderRadius: '6px', boxShadow: '0 5px 20px rgba(0,0,0,0.4)', padding: '6px 0', minWidth: `${menuWidth}px`, zIndex: 9999 }}
    >
      {items.map(item => (
        <div
          key={item.label}
          onClick={item.action}
          style={{ padding: '11px 24px', fontSize: '14.5px', color: item.danger ? '#ea4335' : '#e9edef', cursor: 'pointer', userSelect: 'none', transition: 'background 0.1s' }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
};


const ReactionPicker = ({ menu, onClose, onReact, currentReaction }) => {
  if (!menu) return null;
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const { rect, isMe } = menu;

  // Anchor to message bubble
  const pickerWidth = 270;
  const pickerHeight = 50;
  let left = isMe ? rect.right - pickerWidth : rect.left;
  let top = rect.top - 54;

  if (rect.containerWidth) {
    if (left < 8) left = 8;
    if (left + pickerWidth > rect.containerWidth - 8) left = rect.containerWidth - pickerWidth - 8;
  }

  if (rect.containerHeight) {
    if (top < 8) top = rect.top + 30; // flip below if no room above
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ position: 'absolute', top, left, background: '#233138', borderRadius: '30px', boxShadow: '0 2px 5px rgba(0,0,0,.26), 0 8px 20px rgba(0,0,0,.30)', padding: '10px 16px', display: 'flex', gap: '8px', zIndex: 9999, border: '1px solid #2a3942' }}
    >
      {emojis.map(e => (
        <span
          key={e}
          onClick={() => { onReact(menu.msg.id, e); onClose(); }}
          style={{ fontSize: '24px', cursor: 'pointer', transition: 'transform 0.15s ease', display: 'inline-block', outline: currentReaction === e ? '2px solid #00a884' : 'none', borderRadius: '50%', padding: '2px' }}
          onMouseOver={e2 => e2.currentTarget.style.transform = 'scale(1.35)'}
          onMouseOut={e2 => e2.currentTarget.style.transform = 'scale(1)'}
        >{e}</span>
      ))}
    </div>
  );
};

const WhatsApp = () => {
  const { currentUser, userData, logout } = useAuth();
  const { sendNotification } = useNotifications();
  const { logActivity } = useActivity();
  const isMobile = useIsMobile();
  const [team, setTeam] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pinnedMsg, setPinnedMsg] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [reactionMenu, setReactionMenu] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState([]);
  const [activeCall, setActiveCall] = useState(null); // { type: 'audio' | 'video' }
  const [forwardMsg, setForwardMsg] = useState(null);
  const [mentionUser, setMentionUser] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  
  // Modal States
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [activeSidebarModal, setActiveSidebarModal] = useState(null);
  const [isSelectingMessages, setIsSelectingMessages] = useState(false);
  const [ongoingCall, setOngoingCall] = useState(null);
  const [dismissedCalls, setDismissedCalls] = useState(new Set());

  const chatBodyRef = useRef(null);
  const chatEndRef = useRef(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const unsubTeam = onSnapshot(collection(db, 'users'), snap => {
      setTeam(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubMsgs = onSnapshot(collection(db, 'group_messages'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.timestamp - b.timestamp);
      setMessages(prev => {
        const newCount = data.length - prev.length;
        if (newCount > 0 && !isAtBottomRef.current && prev.length > 0) {
          setUnreadCount(c => c + newCount);
        }
        return data;
      });
    });

    const unsubCalls = onSnapshot(collection(db, 'calls'), snap => {
      const now = Date.now();
      const calls = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Only show banner for calls that have a live heartbeat ping (caller is still online)
        .filter(d =>
          d.status === 'ringing' &&
          d.callerId !== currentUser?.uid &&
          (now - (d.lastPing || d.createdAt)) < 12000
        )
        .sort((a, b) => b.createdAt - a.createdAt);
      if (calls.length > 0) {
        setOngoingCall(calls[0]);
      } else {
        setOngoingCall(null);
      }
    });

    // Listen for pinned message
    const unsubPin = onSnapshot(doc(db, 'group_settings', 'pinned'), snap => {
      if (snap.exists()) setPinnedMsg(snap.data());
      else setPinnedMsg(null);
    });

    // Listen for typing status
    const unsubTyping = onSnapshot(collection(db, 'typing_status'), snap => {
      const now = Date.now();
      const active = [];
      snap.docs.forEach(d => {
        const data = d.data();
        if (d.id !== currentUser?.uid && data.isTyping && (now - data.updatedAt) < 5000) {
          active.push({ id: d.id, name: data.name });
        }
      });
      setTypingUsers(active);
    });

    const handleClick = () => { setContextMenu(null); setReactionMenu(null); setShowMainMenu(false); setShowChatMenu(false); };
    window.addEventListener('click', handleClick);
    return () => { unsubTeam(); unsubMsgs(); unsubCalls(); unsubPin(); unsubTyping(); window.removeEventListener('click', handleClick); };
  }, [currentUser?.uid]);

  // Auto scroll on new messages if at bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      chatEndRef.current?.scrollIntoView();
    }
  }, [messages]);

  const handleScroll = () => {
    const el = chatBodyRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom);
    if (atBottom) setUnreadCount(0);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
  };

  const handleSend = async (text, fileAttachment = null) => {
    if (!currentUser?.uid) return;
    const replyData = replyingTo
      ? { id: replyingTo.id, senderId: replyingTo.senderId, senderName: replyingTo.senderName || team.find(t => t.id === replyingTo.senderId)?.name, text: replyingTo.text }
      : null;
    setReplyingTo(null);

    let mediaUrl = null;
    let mediaType = null;
    let mediaName = null;

    if (fileAttachment) {
      const { file, isImage, isVideo, isAudio, type, name } = fileAttachment;
      mediaName = name;
      mediaType = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document';

      // Read file as base64 for all files (< 900KB) so all users can see/download
      if (file.size < 900 * 1024) {
        mediaUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      }
      // For large files, store name only
    }

    await addDoc(collection(db, 'group_messages'), {
      senderId: currentUser.uid,
      senderName: userData?.name || 'User',
      text: text || (mediaName ? '' : ''),
      mediaUrl,
      mediaType,
      mediaName,
      timestamp: Date.now(),
      isDeleted: false,
      replyTo: replyData,
      reactions: {},
      starredBy: [],
      read: false,
    });
    
    // Notify all other users in group chat
    sendNotification({
      title: `New msg in General from ${userData?.name || 'User'}`,
      body: text || (mediaName ? `Sent a ${mediaType}` : 'Sent a message'),
      module: 'whatsapp',
      targetUid: 'all',
      type: 'info'
    });
  };

  const handleTyping = async (isTyping) => {
    if (!currentUser?.uid) return;
    await setDoc(doc(db, 'typing_status', currentUser.uid), {
      isTyping,
      name: userData?.name || currentUser.email.split('@')[0],
      updatedAt: Date.now()
    }, { merge: true });
  };

  const handleDelete = async (id) => {
    await updateDoc(doc(db, 'group_messages', id), { isDeleted: true, text: 'This message was deleted', reactions: {}, replyTo: null });
  };

  const handleStar = async (id) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    const isStarred = (msg.starredBy || []).includes(currentUser.uid);
    await updateDoc(doc(db, 'group_messages', id), {
      starredBy: isStarred ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
  };

  const handleInitiateCall = async (type) => {
    const roomId = `WhatsApp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    await addDoc(collection(db, 'calls'), {
      type: type, // 'audio' or 'video'
      status: 'ringing',
      callerId: currentUser?.uid,
      callerName: userData?.name || 'User',
      targetUid: 'all',
      roomId: roomId,
      createdAt: Date.now()
    });
    
    window.dispatchEvent(new CustomEvent('START_NATIVE_CALL', { detail: { roomId, type } }));
  };

  const handleReact = async (id, emoji) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    const reactions = { ...(msg.reactions || {}) };
    if (reactions[currentUser.uid] === emoji) delete reactions[currentUser.uid];
    else reactions[currentUser.uid] = emoji;
    await updateDoc(doc(db, 'group_messages', id), { reactions });
  };

  const handleForward = (msg) => setForwardMsg(msg);

  const handlePin = async (msg) => {
    const pinRef = doc(db, 'group_settings', 'pinned');
    if (pinnedMsg && pinnedMsg.id === msg.id) {
      await deleteDoc(pinRef);
      logActivity({ action: 'UNPIN_MESSAGE', module: 'whatsapp', detail: `Unpinned message` });
    } else {
      await setDoc(pinRef, {
        id: msg.id,
        text: msg.text,
        senderName: msg.senderName || team.find(t => t.id === msg.senderId)?.name || 'Unknown',
        pinnedBy: currentUser?.uid,
        pinnedAt: Date.now(),
      });
      logActivity({ action: 'PIN_MESSAGE', module: 'whatsapp', detail: `Pinned message` });
    }
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-container-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.background = 'rgba(255,255,255,0.6)';
      setTimeout(() => { if (el) el.style.background = 'transparent'; }, 1200);
    }
  };

  const openContextMenu = (e, msg) => {
    e.stopPropagation();
    setReactionMenu(null);
    const el = document.getElementById(`msg-bubble-${msg.id}`);
    const containerEl = document.getElementById('whatsapp-root');
    const bubbleRect = el?.getBoundingClientRect();
    const containerRect = containerEl?.getBoundingClientRect();
    if (!bubbleRect || !containerRect) return;
    
    // Calculate coords relative to the whatsapp-root container
    const rect = {
      left: bubbleRect.left - containerRect.left,
      top: bubbleRect.top - containerRect.top,
      right: bubbleRect.right - containerRect.left,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
    };
    
    const isMe = msg.senderId === currentUser?.uid;
    setContextMenu({ msg, rect, isMe });
  };

  const openReactionMenu = (e, msg) => {
    setContextMenu(null);
    const el = document.getElementById(`msg-bubble-${msg.id}`);
    const containerEl = document.getElementById('whatsapp-root');
    const bubbleRect = el?.getBoundingClientRect();
    const containerRect = containerEl?.getBoundingClientRect();
    if (!bubbleRect || !containerRect) return;
    
    const rect = {
      left: bubbleRect.left - containerRect.left,
      top: bubbleRect.top - containerRect.top,
      right: bubbleRect.right - containerRect.left,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
    };
    
    const isMe = msg.senderId === currentUser?.uid;
    setReactionMenu({ msg, rect, isMe });
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const displayedMessages = msgSearchQuery
    ? messages.filter(m => m.text?.toLowerCase().includes(msgSearchQuery.toLowerCase()))
    : messages;

  const handleMainMenuAction = (action) => {
    if (action === 'new_group') setActiveSidebarModal('new_group');
    else if (action === 'communities') setActiveSidebarModal('communities');
    else if (action === 'starred') setShowStarred(true);
    else if (action === 'settings') setActiveSidebarModal('settings');
    else if (action === 'logout') logout();
  };

  const handleChatMenuAction = (action) => {
    if (action === 'contact_info') setShowInfo(true);
    else if (action === 'select_messages') setIsSelectingMessages(!isSelectingMessages);
    else if (action === 'mute_notifications') setShowInfo(true); // Open info panel where mute is available
    else if (action === 'clear_messages') {
      if (window.confirm('Are you sure you want to clear ALL messages globally? This cannot be undone.')) {
        messages.forEach(async (m) => {
          try {
            await deleteDoc(doc(db, 'group_messages', m.id));
          } catch(e) {
            console.error(e);
          }
        });
        showToast('All messages cleared');
      }
    }
    else if (action === 'export_chat') {
      const chatData = JSON.stringify(messages, null, 2);
      const blob = new Blob([chatData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WhatsApp_Backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Chat exported successfully');
    }
    else if (action === 'restore_chat') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const restoredMessages = JSON.parse(event.target.result);
            if (!Array.isArray(restoredMessages)) throw new Error('Invalid backup file');
            for (const m of restoredMessages) {
              const { id, ...data } = m;
              await addDoc(collection(db, 'group_messages'), data);
            }
            showToast('Chat restored successfully');
          } catch (err) {
            alert('Failed to restore chat: Invalid backup file.');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
    else if (action === 'exit_group') showToast('Admin cannot exit main group');
  };

  // ── MOBILE RENDER ─────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div id="whatsapp-root"
        style={{ display:'flex', flexDirection:'column', flex: 1, height: '100%', minHeight: '100%', width: '100%', background:'#000', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', position:'relative', overflow:'hidden' }}
        onClick={() => { setContextMenu(null); setReactionMenu(null); }}>

        {/* ── Native Chat Header ─────────────────── */}
        <div style={{ background:'#1C1C1E', borderBottom:'0.5px solid #38383A', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:19, background:'#34C759', display:'flex', alignItems:'center', justifyContent:'center', color:'white', flexShrink:0 }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:600, color:'white', lineHeight:1.2 }}>Evorise Global Team</div>
              <div style={{ fontSize:12, color:'#8E8E93', marginTop:1 }}>
                {typingUsers.length > 0
                  ? <span style={{ color:'#34C759' }}>{typingUsers.map(u => u.name).join(', ')} typing…</span>
                  : `${team.length} members`}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:18, color:'#0A84FF' }}>
            <Video size={22} style={{ cursor:'pointer' }} onClick={() => handleInitiateCall('video')} />
            <Phone size={20} style={{ cursor:'pointer' }} onClick={() => handleInitiateCall('audio')} />
          </div>
        </div>

        {/* ── Pinned Message Banner ──────────────── */}
        {pinnedMsg && (
          <div onClick={() => scrollToMessage(pinnedMsg.id)}
            style={{ background:'#1C1C1E', borderBottom:'0.5px solid #38383A', display:'flex', alignItems:'center', gap:10, padding:'8px 16px', cursor:'pointer', flexShrink:0 }}>
            <Pin size={13} color="#34C759" />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:'#34C759', fontWeight:500 }}>Pinned Message</div>
              <div style={{ fontSize:13, color:'#E5E5EA', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {pinnedMsg.text}
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); handlePin(pinnedMsg); }}
              style={{ background:'none', border:'none', color:'#636366', cursor:'pointer', padding:2, display:'flex' }}>
              <XIcon size={16} />
            </button>
          </div>
        )}

        {/* ── Ongoing Call Banner ────────────────── */}
        {ongoingCall && !dismissedCalls.has(ongoingCall.id) && (
          <div style={{ background:'#1DB954', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', color:'white', cursor:'pointer', flexShrink:0 }}
            onClick={() => ongoingCall.roomId && window.dispatchEvent(new CustomEvent('START_NATIVE_CALL', { detail:{ roomId:ongoingCall.roomId, type:ongoingCall.type } }))}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {ongoingCall.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>Ongoing {ongoingCall.type==='video'?'Video':'Audio'} Call</div>
                <div style={{ fontSize:12, opacity:0.9 }}>Started by {ongoingCall.callerName}</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ background:'white', color:'#1DB954', borderRadius:14, padding:'5px 12px', fontWeight:600, fontSize:13 }}>Join</span>
              <button onClick={e => { e.stopPropagation(); setDismissedCalls(p => new Set(p).add(ongoingCall.id)); }}
                style={{ background:'none', border:'none', color:'white', cursor:'pointer', display:'flex' }}>
                <XIcon size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── Message Body ───────────────────────── */}
        <div ref={chatBodyRef} onScroll={handleScroll}
          style={{ flex:1, overflowY:'auto', background:'#000', display:'flex', flexDirection:'column', padding:'0 0 8px' }}>

          {/* Encryption notice */}
          <div style={{ display:'flex', justifyContent:'center', padding:'16px 12px 8px' }}>
            <div style={{ background:'#1C1C1E', padding:'7px 14px', borderRadius:8, fontSize:12, color:'#636366', display:'flex', alignItems:'center', gap:6, maxWidth:320, textAlign:'center', lineHeight:'16px' }}>
              <Lock size={11} color="#636366" style={{ flexShrink:0 }} />
              Messages are end-to-end encrypted.
            </div>
          </div>

          {/* Messages */}
          {displayedMessages.map((msg, idx) => {
            const parseDate = (ts) => {
              if (!ts) return new Date();
              if (typeof ts === 'number') return new Date(ts);
              if (ts.toDate) return ts.toDate();
              if (ts.seconds) return new Date(ts.seconds * 1000);
              const d = new Date(ts); return isNaN(d.getTime()) ? new Date() : d;
            };
            const dateStr = parseDate(msg.timestamp).toLocaleDateString();
            const prevDateStr = idx > 0 ? parseDate(displayedMessages[idx-1].timestamp).toLocaleDateString() : null;
            const showDateSep = dateStr !== prevDateStr;
            return (
              <React.Fragment key={msg.id}>
                {showDateSep && (
                  <div style={{ display:'flex', justifyContent:'center', margin:'10px 0' }}>
                    <div style={{ background:'#1C1C1E', padding:'4px 12px', borderRadius:8, fontSize:12, color:'#636366' }}>
                      {dateStr === new Date().toLocaleDateString() ? 'Today' : dateStr}
                    </div>
                  </div>
                )}
                <MessageBubble
                  msg={msg} isMe={msg.senderId === currentUser?.uid}
                  prevMsg={idx > 0 ? displayedMessages[idx-1] : null}
                  nextMsg={idx < displayedMessages.length-1 ? displayedMessages[idx+1] : null}
                  currentUserId={currentUser?.uid} team={team}
                  onReply={setReplyingTo} onStar={handleStar}
                  onDelete={openContextMenu} onReact={openReactionMenu}
                  onScrollTo={scrollToMessage} onImageClick={setLightboxImage}
                  dateStr={dateStr} isSelectingMessages={false}
                />
              </React.Fragment>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* ── Typing Indicator ───────────────────── */}
        {typingUsers.length > 0 && (
          <div style={{ background:'#1C1C1E', padding:'6px 16px', display:'flex', alignItems:'center', gap:8, borderTop:'0.5px solid #38383A', flexShrink:0 }}>
            <div style={{ display:'flex', gap:3, alignItems:'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#34C759', animation:`bounce 1.2s ${i*0.2}s infinite` }} />
              ))}
            </div>
            <span style={{ fontSize:13, color:'#8E8E93' }}>
              {typingUsers.length===1 ? `${typingUsers[0].name} is typing…` : `${typingUsers.map(u=>u.name).join(', ')} are typing…`}
            </span>
          </div>
        )}

        {/* ── Scroll to Bottom Button ────────────── */}
        {showScrollBtn && (
          <button onClick={scrollToBottom}
            style={{ position:'absolute', bottom:80, right:16, width:40, height:40, borderRadius:20, background:'#1C1C1E', border:'0.5px solid #38383A', boxShadow:'0 2px 10px rgba(0,0,0,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#8E8E93', zIndex:10 }}>
            {unreadCount > 0 && (
              <div style={{ position:'absolute', top:-6, left:'50%', transform:'translateX(-50%)', background:'#34C759', color:'white', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:8, minWidth:16, textAlign:'center' }}>
                {unreadCount}
              </div>
            )}
            <ArrowDown size={20} />
          </button>
        )}

        {/* ── Message Input ──────────────────────── */}
        <div style={{ paddingBottom:'calc(83px + env(safe-area-inset-bottom))', backgroundColor:'#1C1C1E', borderTop:'0.5px solid #38383A', flexShrink:0 }}>
          <MessageInput
            onSend={handleSend} replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            team={team} onTyping={handleTyping}
          />
        </div>

        {/* Context menus share same component (desktop + mobile) */}
        <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onReply={setReplyingTo}
          onStar={handleStar} onDelete={handleDelete} onPin={handlePin} onForward={handleForward}
          currentUserId={currentUser?.uid} onReactOpen={(msg) => openReactionMenu(null, msg)} />
        <ReactionPicker menu={reactionMenu} onClose={() => setReactionMenu(null)} onReact={handleReact}
          currentReaction={reactionMenu ? messages.find(m=>m.id===reactionMenu.msg?.id)?.reactions?.[currentUser?.uid] : null} />
      </div>
    );
  }

  return (
    <div
      id="whatsapp-root"
      style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, width: '100%', background: isMobile ? '#000000' : '#111b21', overflow: 'hidden', fontFamily: isMobile ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : '"Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif', position: 'relative' }}
      onClick={() => { setContextMenu(null); setReactionMenu(null); setShowMainMenu(false); setShowChatMenu(false); }}
    >
      {/* LEFT SIDEBAR */}
      {!isMobile && (
        <div style={{ width: '30%', minWidth: '340px', maxWidth: '420px', background: '#111b21', display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a3942', position: 'relative' }}>
          {/* Header */}
        <div style={{ padding: '0 16px', background: '#202c33', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '59px', flexShrink: 0 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#6b7c85', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }} onClick={() => setActiveSidebarModal('profile')}>
            {(userData?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: '20px', color: '#aebac1' }}>
            <Users size={22} style={{ cursor: 'pointer' }} title="Communities" onClick={() => setActiveSidebarModal('communities')} />
            <div style={{ position: 'relative' }}>
              <MoreVertical size={22} style={{ cursor: 'pointer' }} title="Menu" onClick={(e) => { e.stopPropagation(); setShowMainMenu(!showMainMenu); setShowChatMenu(false); }} />
              {showMainMenu && <MainMenu onClose={() => setShowMainMenu(false)} onSelect={handleMainMenuAction} />}
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px', background: '#111b21' }}>
          <div style={{ background: '#202c33', padding: '0 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', height: '35px' }}>
            <Search size={16} color="#aebac1"/>
            <input 
              type="text" 
              placeholder="Search or start new chat" 
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px', color: '#e9edef', '::placeholder': { color: '#8696a0' } }} 
            />
          </div>
        </div>

        {/* Chats List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Group Chat Item */}
          {(!sidebarSearch || 'evorise global team'.includes(sidebarSearch.toLowerCase())) && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 0 16px', cursor: 'pointer', background: '#2a3942', height: '72px' }}>
            <div style={{ width: '49px', height: '49px', borderRadius: '50%', background: '#00a884', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', flexShrink: 0 }}>
              <Users size={28}/>
            </div>
            <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderBottom: '1px solid #2a3942', paddingRight: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', color: '#e9edef' }}>Evorise Global Team</span>
                <span style={{ fontSize: '12px', color: unreadCount > 0 ? '#00a884' : '#8696a0' }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ fontSize: '13px', color: '#8696a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {typingUsers.length > 0 ? <span style={{ color: '#00a884' }}>typing...</span> : messages[messages.length - 1]?.text || 'No messages yet'}
                </span>
                {unreadCount > 0 && (
                  <div style={{ background: '#00a884', color: '#111b21', borderRadius: '10px', minWidth: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', padding: '0 6px' }}>
                    {unreadCount}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Sidebar Modals overlay */}
        {activeSidebarModal === 'profile' && <ProfileModal onClose={() => setActiveSidebarModal(null)} userData={userData} />}
        {activeSidebarModal === 'settings' && <SettingsModal onClose={() => setActiveSidebarModal(null)} />}
        {activeSidebarModal === 'communities' && <CommunitiesModal onClose={() => setActiveSidebarModal(null)} />}
        {activeSidebarModal === 'new_group' && <NewGroupModal onClose={() => setActiveSidebarModal(null)} team={team} />}
      </div>
      )}

      {/* RIGHT CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {/* Chat Header */}
        <div
          onClick={() => !isMobile && setShowInfo(true)}
          style={{ height: isMobile ? '60px' : '59px', background: isMobile ? '#1c1c1e' : '#202c33', display: 'flex', alignItems: 'center', padding: isMobile ? '0 16px' : '0 16px', justifyContent: 'space-between', cursor: isMobile ? 'default' : 'pointer', flexShrink: 0, zIndex: 10, borderBottom: isMobile ? '0.5px solid #38383a' : 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isMobile ? '#34c759' : '#00a884', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '18px', fontWeight: 'bold' }}>
              <Users size={24}/>
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, fontWeight: isMobile ? 600 : 500, color: isMobile ? 'white' : '#e9edef' }}>Evorise Global Team</h2>
              <p style={{ fontSize: '13px', margin: '2px 0 0 0', color: isMobile ? '#8e8e93' : '#8696a0' }}>
                {typingUsers.length > 0
                  ? `${typingUsers.map(u => u.name).join(', ')} typing...`
                  : `Admin, You, and ${team.length - 2} others`}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px', color: isMobile ? '#0a84ff' : '#aebac1' }} onClick={e => e.stopPropagation()}>
            <Video size={22} style={{ cursor: 'pointer' }} title="Video call" onClick={() => handleInitiateCall('video')}/>
            <Phone size={20} style={{ cursor: 'pointer' }} title="Call" onClick={() => handleInitiateCall('audio')}/>
            <Search size={24} style={{ cursor: 'pointer', display: isMobile ? 'none' : 'block' }} onClick={() => setShowSearchPanel(!showSearchPanel)} title="Search"/>
            <div style={{ position: 'relative', display: isMobile ? 'none' : 'block' }}>
              <MoreVertical size={24} style={{ cursor: 'pointer' }} title="Menu" onClick={(e) => { e.stopPropagation(); setShowChatMenu(!showChatMenu); setShowMainMenu(false); }}/>
              {showChatMenu && <ChatMenu onClose={() => setShowChatMenu(false)} onSelect={handleChatMenuAction} />}
            </div>
          </div>
        </div>

        {/* PINNED MESSAGE BANNER */}
        {pinnedMsg && (
          <div
            onClick={() => scrollToMessage(pinnedMsg.id)}
            style={{ background: isMobile ? '#1c1c1e' : '#202c33', borderBottom: isMobile ? '0.5px solid #38383a' : '1px solid #2a3942', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0 16px', minHeight: '50px', gap: '12px' }}
            title="Click to go to pinned message"
          >
            {/* Vertical accent bar */}
            <div style={{ width: '3px', height: '38px', background: isMobile ? '#34c759' : '#00a884', borderRadius: '2px', flexShrink: 0 }}></div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', color: isMobile ? '#34c759' : '#00a884', fontWeight: 500, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Pin size={13}/> Pinned Message
              </div>
              <div style={{ fontSize: '13.5px', color: '#e9edef', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '500px' }}>
                {pinnedMsg.text}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); handlePin(pinnedMsg); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', padding: '4px', display: 'flex', alignItems: 'center' }}
              title="Unpin message"
            >
              <XIcon size={18}/>
            </button>
          </div>
        )}

        {/* In-chat search bar */}
        {showSearchPanel && (
          <div style={{ padding: '8px 16px', background: '#202c33', borderBottom: '1px solid #2a3942', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Search size={18} color="#aebac1"/>
            <input
              autoFocus
              type="text"
              placeholder="Search messages..."
              value={msgSearchQuery}
              onChange={e => setMsgSearchQuery(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: '#e9edef', fontSize: '15px' }}
            />
            {msgSearchQuery && <div onClick={() => setMsgSearchQuery('')} style={{ cursor: 'pointer', color: '#aebac1', fontSize: '13px' }}>Clear</div>}
          </div>
        )}

        {/* Ongoing Call Banner */}
        {ongoingCall && !dismissedCalls.has(ongoingCall.id) && (
          <div style={{ background: '#10b981', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', cursor: 'pointer', animation: 'fadeIn 0.3s ease' }}
               onClick={() => {
                 if (ongoingCall.roomId) {
                   window.dispatchEvent(new CustomEvent('START_NATIVE_CALL', { detail: { roomId: ongoingCall.roomId, type: ongoingCall.type } }));
                 }
               }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ animation: 'pulse 1.5s infinite' }}>
                {ongoingCall.type === 'video' ? <Video size={20} /> : <Phone size={20} />}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>Ongoing {ongoingCall.type === 'video' ? 'Video' : 'Audio'} Call</div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>Started by {ongoingCall.callerName}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button style={{ background: 'white', color: '#10b981', border: 'none', padding: '6px 16px', borderRadius: '20px', fontWeight: 600, cursor: 'pointer' }}>
                Join Call
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissedCalls(prev => new Set(prev).add(ongoingCall.id));
                }}
                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Dismiss Banner"
              >
                <XIcon size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Chat Body */}
        <div
          ref={chatBodyRef}
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', background: isMobile ? '#000000' : '#0b141a', backgroundImage: isMobile ? 'none' : 'url("https://web.whatsapp.com/img/bg-chat-tile-light_a4be512e7195b6b733d9110b408f075d.png")', backgroundSize: '412.5px', backgroundRepeat: 'repeat', position: 'relative', display: 'flex', flexDirection: 'column' }}
        >
          {/* Encryption notice */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 12px 8px 12px' }}>
            <div style={{ background: isMobile ? '#1c1c1e' : '#1d2f38', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', color: isMobile ? '#8e8e93' : '#8696a0', display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '380px', textAlign: 'center', lineHeight: '18px' }}>
              <Lock size={12} color={isMobile ? '#8e8e93' : '#8696a0'} style={{ flexShrink: 0 }}/>
              Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, paddingBottom: '8px' }}>
            {displayedMessages.map((msg, idx) => {
              const parseDate = (ts) => {
                if (!ts) return new Date();
                if (typeof ts === 'number') return new Date(ts);
                if (ts.toDate) return ts.toDate();
                if (ts.seconds) return new Date(ts.seconds * 1000);
                const d = new Date(ts);
                return isNaN(d.getTime()) ? new Date() : d;
              };
              const dateStr = parseDate(msg.timestamp).toLocaleDateString();
              const prevDateStr = idx > 0 ? parseDate(displayedMessages[idx-1].timestamp).toLocaleDateString() : null;
              const showDateSep = dateStr !== prevDateStr;

              return (
                <React.Fragment key={msg.id}>
                  {showDateSep && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
                      <div style={{ background: isMobile ? '#1c1c1e' : '#1d2f38', padding: '5px 12px', borderRadius: '8px', fontSize: '12.5px', color: isMobile ? '#8e8e93' : '#8696a0', boxShadow: isMobile ? 'none' : '0 1px 0.5px rgba(11,20,26,.13)' }}>
                        {dateStr === new Date().toLocaleDateString() ? 'Today' : dateStr}
                      </div>
                    </div>
                  )}
                  <MessageBubble
                    msg={msg}
                    isMe={msg.senderId === currentUser?.uid}
                    prevMsg={idx > 0 ? displayedMessages[idx - 1] : null}
                    nextMsg={idx < displayedMessages.length - 1 ? displayedMessages[idx + 1] : null}
                    currentUserId={currentUser?.uid}
                    team={team}
                    onReply={setReplyingTo}
                    onStar={handleStar}
                    onDelete={openContextMenu}
                    onReact={openReactionMenu}
                    onScrollTo={scrollToMessage}
                    onImageClick={setLightboxImage}
                    dateStr={dateStr}
                    isSelectingMessages={isSelectingMessages}
                  />
                </React.Fragment>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            style={{ position: 'absolute', bottom: '80px', right: '24px', width: '42px', height: '42px', borderRadius: '50%', background: '#202c33', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aebac1', zIndex: 10 }}
          >
            {unreadCount > 0 && (
              <div style={{ position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)', background: '#00a884', color: 'white', fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', minWidth: '20px', textAlign: 'center' }}>
                {unreadCount}
              </div>
            )}
            <ArrowDown size={22}/>
          </button>
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div style={{ background: '#202c33', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid #2a3942' }}>
            {/* Animated dots */}
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00a884', animation: `bounce 1.2s ${i * 0.2}s infinite` }}/>
              ))}
            </div>
            <span style={{ fontSize: '13px', color: '#8696a0' }}>
              {typingUsers.length === 1
                ? `${typingUsers[0].name} is typing...`
                : `${typingUsers.map(u => u.name).join(', ')} are typing...`
              }
            </span>
          </div>
        )}

        {/* Message Input */}
        <div style={isMobile ? { paddingBottom: 'env(safe-area-inset-bottom)', backgroundColor: '#1c1c1e' } : {}}>
          <MessageInput
            onSend={handleSend}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            team={team}
            onTyping={handleTyping}
          />
        </div>
      </div>

      {/* RIGHT PANEL - Group Info */}
      {showInfo && (
        <GroupInfoPanel
          team={team}
          currentUserId={currentUser?.uid}
          onClose={() => setShowInfo(false)}
          onShowStarred={() => setShowStarred(true)}
          onShowToast={showToast}
        />
      )}

      {/* RIGHT PANEL - Starred Messages */}
      {showStarred && (
        <div style={{ width: '400px', background: '#111b21', borderLeft: '1px solid #2a3942', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0 20px', background: '#202c33', display: 'flex', alignItems: 'center', gap: '24px', height: '59px', flexShrink: 0 }}>
            <button onClick={() => setShowStarred(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aebac1', padding: 0, display: 'flex' }}>
              <XIcon size={24}/>
            </button>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#e9edef' }}>Starred messages</h2>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {messages.filter(m => (m.starredBy || []).includes(currentUser?.uid) && !m.isDeleted).length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '32px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#202c33', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="#aebac1"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                </div>
                <p style={{ color: '#8696a0', fontSize: '15px', textAlign: 'center', margin: 0 }}>No starred messages yet.</p>
                <p style={{ color: '#667781', fontSize: '13px', textAlign: 'center', marginTop: '8px' }}>Star a message from the context menu to save it here.</p>
              </div>
            ) : (
              messages
                .filter(m => (m.starredBy || []).includes(currentUser?.uid) && !m.isDeleted)
                .map(m => {
                  const isMe = m.senderId === currentUser?.uid;
                  const senderName = isMe ? 'You' : (m.senderName || team.find(t => t.id === m.senderId)?.name || 'Unknown');
                  return (
                    <div
                      key={m.id}
                      onClick={() => { setShowStarred(false); setTimeout(() => scrollToMessage(m.id), 200); }}
                      style={{ padding: '16px 20px', borderBottom: '1px solid #2a3942', cursor: 'pointer', background: '#111b21' }}
                      onMouseOver={e => e.currentTarget.style.background = '#202c33'}
                      onMouseOut={e => e.currentTarget.style.background = '#111b21'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#00a884' }}>{senderName}</span>
                        <span style={{ fontSize: '12px', color: '#667781' }}>{new Date(m.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div style={{ fontSize: '14px', color: '#e9edef', lineHeight: '20px', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {m.text}
                      </div>
                      <div style={{ fontSize: '12px', color: '#667781', marginTop: '6px' }}>Tap to see in chat →</div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Floating Menus */}
      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onReply={setReplyingTo}
        onStar={handleStar}
        onDelete={handleDelete}
        onPin={handlePin}
        onForward={handleForward}
        currentUserId={currentUser?.uid}
        onReactOpen={(msg) => openReactionMenu(null, msg)}
      />
      <ReactionPicker
        menu={reactionMenu}
        onClose={() => setReactionMenu(null)}
        onReact={handleReact}
        currentReaction={reactionMenu?.msg?.reactions?.[currentUser?.uid]}
      />

      {/* Forward Modal */}
      {forwardMsg && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11,20,26,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#202c33', width: '400px', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #2a3942', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: '#e9edef', margin: 0, fontSize: '18px', fontWeight: 500 }}>Forward message to</h2>
              <button onClick={() => setForwardMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aebac1' }}><XIcon size={24}/></button>
            </div>
            <div style={{ padding: '12px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0', cursor: 'pointer', borderBottom: '1px solid #2a3942' }} onClick={() => { handleSend(`Forwarded: ${forwardMsg.text}`); setForwardMsg(null); }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={20} color="white"/></div>
                <div style={{ color: '#e9edef', fontSize: '16px' }}>Evorise Global Team</div>
              </div>
              <div style={{ padding: '16px 0', color: '#8696a0', fontSize: '14px', textAlign: 'center' }}>More contacts will appear here</div>
            </div>
          </div>
        </div>
      )}

      {/* Call Modal */}
      {activeCall && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11,20,26,0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '800px', height: '80vh', background: '#111b21', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            
            {activeCall.type === 'video' ? (
              <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '24px', left: '24px', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={24} color="white" />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>Evorise Global Team</h2>
                    <span style={{ fontSize: '14px', color: '#aebac1' }}>00:14</span>
                  </div>
                </div>
                <div style={{ color: '#8696a0', fontSize: '18px' }}>Waiting for others to join video...</div>
                
                {/* PIP self view placeholder */}
                <div style={{ position: 'absolute', bottom: '100px', right: '24px', width: '120px', height: '160px', background: '#202c33', borderRadius: '8px', border: '2px solid #2a3942' }}></div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 0 0 10px rgba(0, 168, 132, 0.2)' }}>
                  <Users size={60} color="white" />
                </div>
                <h2 style={{ color: '#e9edef', margin: '0 0 8px 0', fontSize: '24px', fontWeight: 500 }}>Evorise Global Team</h2>
                <p style={{ color: '#8696a0', margin: '0 0 32px 0', fontSize: '16px' }}>00:14</p>
              </div>
            )}

            <div style={{ height: '80px', width: '100%', background: '#202c33', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', borderTop: '1px solid #2a3942' }}>
              <button style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#2a3942', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aebac1' }}>
                <Video size={24} />
              </button>
              <button style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#2a3942', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aebac1' }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
              </button>
              <button onClick={() => setActiveCall(null)} style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ea4335', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(234,67,53,0.3)' }}>
                <Phone size={24} color="white" style={{ transform: 'rotate(135deg)' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Viewer */}
      {lightboxImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setLightboxImage(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#e9edef' }}>
            <XIcon size={24} />
          </button>
          <img src={lightboxImage} alt="Fullscreen Attachment" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}

      {/* Global Toast Notification */}
      {toastMsg && (
        <div style={{ position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.9)', color: '#111b21', padding: '10px 20px', borderRadius: '20px', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 99999, animation: 'fadeInOut 3s forwards' }}>
          {toastMsg}
        </div>
      )}

      {/* MOBILE FAB FOR NEW CHAT */}
      {isMobile && (
        <button
          onClick={() => setActiveSidebarModal('new_group')}
          style={{ position: 'fixed', right: '16px', bottom: '80px', width: '56px', height: '56px', borderRadius: '50%', background: '#00a884', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100, cursor: 'pointer' }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
      )}

      {/* FULL SCREEN MOBILE OVERLAYS */}
      {isMobile && activeSidebarModal === 'profile' && <div style={{position:'fixed', inset:0, zIndex:200}}><ProfileModal onClose={() => setActiveSidebarModal(null)} userData={userData} /></div>}
      {isMobile && activeSidebarModal === 'settings' && <div style={{position:'fixed', inset:0, zIndex:200}}><SettingsModal onClose={() => setActiveSidebarModal(null)} /></div>}
      {isMobile && activeSidebarModal === 'communities' && <div style={{position:'fixed', inset:0, zIndex:200}}><CommunitiesModal onClose={() => setActiveSidebarModal(null)} /></div>}
      {isMobile && activeSidebarModal === 'new_group' && <div style={{position:'fixed', inset:0, zIndex:200}}><NewGroupModal onClose={() => setActiveSidebarModal(null)} team={team} /></div>}

    </div>
  );
};

const WhatsAppWithErrorBoundary = (props) => (
  <ErrorBoundary>
    <WhatsApp {...props} />
  </ErrorBoundary>
);

export default WhatsAppWithErrorBoundary;
