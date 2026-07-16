import React, { useState } from 'react';
import { CheckCheck, Star, Trash2, ChevronDown, Smile } from 'lucide-react';

const SENDER_COLORS = ['#d93025','#e6711c','#9c27b0','#357ae8','#0088cc','#008069','#c2185b','#00796b'];

export const getSenderColor = (id = '') => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
};

const Tail = ({ isMe }) => (
  <svg viewBox="0 0 8 13" width="8" height="13"
    style={{ position:'absolute', top:0, [isMe?'right':'left']:'-8px', color: isMe?'#005c4b':'#1f2c34', flexShrink:0 }}>
    <path opacity=".13" d={isMe
      ?"M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z"
      :"M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"}/>
    <path fill="currentColor" d={isMe
      ?"M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z"
      :"M1.533 2.568L8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z"}/>
  </svg>
);

const parseDate = (ts) => {
  if (!ts) return new Date();
  if (typeof ts === 'number') return new Date(ts);
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? new Date() : d;
};

const MessageBubble = ({ msg, isMe, prevMsg, nextMsg, currentUserId, team, onReply, onStar, onDelete, onReact, onScrollTo, onImageClick, dateStr, isSelectingMessages }) => {
  const [hovered, setHovered] = useState(false);

  const showTail = !prevMsg || prevMsg.senderId !== msg.senderId || parseDate(prevMsg.timestamp).toLocaleDateString() !== dateStr;
  const isLastFromUser = !nextMsg || nextMsg.senderId !== msg.senderId || parseDate(nextMsg.timestamp).toLocaleDateString() !== dateStr;

  const senderColor = getSenderColor(msg.senderId);
  const senderName = msg.senderName || team.find(t => t.id === msg.senderId)?.name || 'Unknown';
  const isStarred = (msg.starredBy || []).includes(currentUserId);

  const reactionCounts = {};
  if (msg.reactions) Object.values(msg.reactions).forEach(r => reactionCounts[r] = (reactionCounts[r] || 0) + 1);
  const hasReactions = Object.keys(reactionCounts).length > 0;

  const timeStr = parseDate(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderText = (text) => {
    if (!text) return null;
    // Simple regex to find @Name patterns
    const parts = text.split(/(@[a-zA-Z0-9_]+(?:\s[a-zA-Z0-9_]+)?)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} style={{ color: '#53bdeb' }}>{part}</span>;
      }
      return part;
    });
  };

  return (
    <div
      id={`msg-container-${msg.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        paddingLeft: '16px',
        paddingRight: '16px',
        marginBottom: hasReactions ? '20px' : (isLastFromUser ? '12px' : '2px'),
        position: 'relative',
        transition: 'background 0.3s ease',
      }}
    >
      {isSelectingMessages && (
        <input 
          type="checkbox" 
          style={{ width: '20px', height: '20px', marginRight: '16px', accentColor: '#00a884', cursor: 'pointer', zIndex: 10, flexShrink: 0 }} 
        />
      )}

      <div id={`msg-bubble-${msg.id}`} style={{
        maxWidth: '65%',
        minWidth: '100px',
        background: isMe ? '#005c4b' : '#1f2c34',
        color: isMe ? '#e9edef' : '#e9edef',
        borderRadius: isMe
          ? (showTail ? '8px 0 8px 8px' : '8px')
          : (showTail ? '0 8px 8px 8px' : '8px'),
        boxShadow: '0 1px 0.5px rgba(0,0,0,.25)',
        position: 'relative',
        padding: msg.mediaUrl && msg.mediaType === 'image' ? '4px 4px 8px 4px' : '6px 7px 8px 9px',
      }}>
        <Tail isMe={isMe} />

        {/* Sender name (group, not me, first in sequence) */}
        {!isMe && showTail && (
          <div style={{ fontSize: '12.5px', fontWeight: 500, color: senderColor, marginBottom: '2px', lineHeight: '21px', padding: msg.mediaUrl && msg.mediaType === 'image' ? '4px 4px 0 4px' : '0' }}>
            {senderName}
          </div>
        )}

        {/* Reply quote block */}
        {msg.replyTo && !msg.isDeleted && (
          <div
            onClick={() => onScrollTo(msg.replyTo.id)}
            style={{
              background: isMe ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.05)',
              borderLeft: `4px solid ${getSenderColor(msg.replyTo.senderId || '')}`,
              borderRadius: '4px',
              padding: '5px 8px',
              marginBottom: '5px',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: getSenderColor(msg.replyTo.senderId || ''), marginBottom: '2px' }}>
              {msg.replyTo.senderName}
            </div>
            <div style={{ fontSize: '13px', color: '#54656f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
              {msg.replyTo.text}
            </div>
          </div>
        )}

        {/* MEDIA CONTENT */}
        {msg.mediaUrl && msg.mediaType === 'image' && (
          <div style={{ margin: '0 0 4px 0', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => onImageClick?.(msg.mediaUrl)}>
            <img src={msg.mediaUrl} alt="image" style={{ display: 'block', maxWidth: '100%', maxHeight: '280px', objectFit: 'cover', width: '100%' }}/>
          </div>
        )}
        {msg.mediaType === 'document' && (
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: isMe ? '#007aff' : '#007aff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '14px', color: '#e9edef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.mediaName}</div>
              {msg.mediaUrl ? (
                <a href={msg.mediaUrl} download={msg.mediaName} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#53bdeb', marginTop: '2px', textDecoration: 'none', fontWeight: 500 }}>Download Document</a>
              ) : (
                <div style={{ fontSize: '12px', color: '#aebac1', marginTop: '2px' }}>Document</div>
              )}
            </div>
          </div>
        )}
        {msg.mediaType === 'audio' && (
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', color: '#e9edef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.mediaName}</div>
                <div style={{ fontSize: '12px', color: '#aebac1', marginTop: '2px' }}>Audio</div>
              </div>
            </div>
            {msg.mediaUrl && (
              <audio controls src={msg.mediaUrl} style={{ width: '100%', height: '36px', outline: 'none' }} />
            )}
          </div>
        )}

        {/* Message text + timestamp inline */}
        {(!msg.mediaUrl || msg.text) && (
        <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontSize: '14.2px', lineHeight: '19px', color: msg.isDeleted ? '#8696a0' : '#e9edef', fontStyle: msg.isDeleted ? 'italic' : 'normal', padding: msg.mediaUrl && msg.mediaType === 'image' ? '4px 4px 0 4px' : '0' }}>
          {msg.isDeleted && (
            <svg viewBox="0 0 19 18" width="14" height="14" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
              <path fill="#8696a0" d="M9.5.5c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 1c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8zm-.5 3v5l4.25 2.52.77-1.28-3.52-2.09V4.5H9z"/>
            </svg>
          )}
          {renderText(msg.text)}
          {/* Spacer pushes timestamp to bottom-right */}
          <span style={{ display: 'inline-block', width: isStarred ? '90px' : '74px' }}></span>
        </div>
        )}

        {/* Timestamp + status absolute */}
        <div style={{
          position: 'absolute',
          right: '8px',
          bottom: '4px',
          fontSize: '11px',
          color: '#aebac1',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          userSelect: 'none',
          background: msg.mediaUrl && msg.mediaType === 'image' ? 'rgba(0,0,0,0.4)' : 'transparent',
          padding: msg.mediaUrl && msg.mediaType === 'image' ? '2px 4px' : '0',
          borderRadius: '4px',
        }}>
          {isStarred && <Star size={10} fill="#aebac1" color="#aebac1" />}
          <span>{timeStr}</span>
          {isMe && !msg.isDeleted && (
            <CheckCheck size={15} color={msg.read ? '#53bdeb' : '#aebac1'} style={{ marginLeft: '1px' }} />
          )}
        </div>

        {/* Reactions pill */}
        {hasReactions && (
          <div style={{
            position: 'absolute',
            bottom: '-14px',
            [isMe ? 'right' : 'left']: isMe && showTail ? '20px' : '12px',
            display: 'flex',
            gap: '2px',
            background: 'white',
            padding: '2px 6px',
            borderRadius: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
            border: '1px solid #e9edef',
            zIndex: 2,
            fontSize: '12px',
          }}>
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <span key={emoji} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {emoji}
                {count > 1 && <span style={{ color: '#54656f', fontSize: '11px' }}>{count}</span>}
              </span>
            ))}
          </div>
        )}

        {/* Hover actions */}
        {hovered && !msg.isDeleted && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: isMe
              ? 'linear-gradient(90deg, transparent, #005c4b 40%)'
              : 'linear-gradient(90deg, transparent, #1f2c34 40%)',
            padding: '4px 6px 10px 20px',
            borderRadius: '0 8px 0 0',
            zIndex: 3,
          }}>
            <span title="React" onClick={e => { e.stopPropagation(); onReact(e, msg); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Smile size={18} color="#aebac1" />
            </span>
            <span title="More options" onClick={e => { e.stopPropagation(); onDelete(e, msg); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ChevronDown size={20} color="#aebac1" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
