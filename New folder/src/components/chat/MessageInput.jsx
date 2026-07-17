import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Smile, Paperclip, Mic, Send, X, Image as ImageIcon, FileText, Camera, Music, MapPin, User, File } from 'lucide-react';

const QUICK_EMOJIS = ['😀','😂','😍','🥺','😭','🤣','❤️','😊','😒','🙏','💀','😩','😤','😔','🤔','😑','😢','🤗','😏','😌','🥴','🤭','😅','🥰','😳','🙄','😪','😁','😬','🤩'];

const SENDER_COLORS = ['#d93025','#e6711c','#9c27b0','#357ae8','#0088cc','#008069','#c2185b','#00796b'];
const getSenderColor = (id = '') => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
};

const MessageInput = ({ onSend, replyingTo, onCancelReply, team, onTyping }) => {
  const [value, setValue] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // { file, previewUrl, type }
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const textareaRef = useRef(null);
  const typingTimerRef = useRef(null);

  // File input refs for each type
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const docInputRef = useRef(null);
  const audioInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '20px';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [value]);

  useEffect(() => {
    if (replyingTo && textareaRef.current) textareaRef.current.focus();
  }, [replyingTo]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (selectedFile?.previewUrl) URL.revokeObjectURL(selectedFile.previewUrl);
    };
  }, [selectedFile]);

  const handleSend = useCallback(() => {
    if (!value.trim() && !selectedFile) return;
    onSend(value.trim(), selectedFile || null);
    setValue('');
    setSelectedFile(null);
    if (textareaRef.current) textareaRef.current.style.height = '20px';
    setShowEmoji(false);
    if (onTyping) { onTyping(false); clearTimeout(typingTimerRef.current); }
  }, [value, selectedFile, onSend, onTyping]);

  const handleKey = (e) => {
    if (showMention) {
      if (e.key === 'Escape') { setShowMention(false); return; }
      // Could add up/down/enter navigation here, but keeping it simple for now
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setValue(val);
    
    // Check for @mention
    const words = val.split(/[\s\n]+/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@')) {
      setShowMention(true);
      setMentionFilter(lastWord.substring(1).toLowerCase());
    } else {
      setShowMention(false);
    }

    if (onTyping) {
      onTyping(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => onTyping(false), 3000);
    }
  };

  const appendEmoji = (emoji) => {
    setValue(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleFileSelected = (e, fileType) => {
    const file = e.target.files[0];
    if (!file) return;
    setShowAttach(false);

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    let previewUrl = null;
    if (isImage || isVideo) {
      previewUrl = URL.createObjectURL(file);
    }

    setSelectedFile({ file, previewUrl, type: fileType, name: file.name, size: file.size, isImage, isVideo, isAudio });
    // Reset input so same file can be re-selected
    e.target.value = '';
    textareaRef.current?.focus();
  };

  const removeFile = () => {
    if (selectedFile?.previewUrl) URL.revokeObjectURL(selectedFile.previewUrl);
    setSelectedFile(null);
  };

  const handleLocationShare = () => {
    setShowAttach(false);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
        onSend(`📍 Location: ${mapsUrl}`, null);
      },
      () => alert('Unable to retrieve your location. Please allow location access.')
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div style={{ background: '#202c33', flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {/* Hidden File Inputs */}
      <input ref={photoInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => handleFileSelected(e, 'media')} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="camera" style={{ display: 'none' }} onChange={e => handleFileSelected(e, 'camera')} />
      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx,.csv,.zip" style={{ display: 'none' }} onChange={e => handleFileSelected(e, 'document')} />
      <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => handleFileSelected(e, 'audio')} />

      {/* Emoji picker */}
      {showEmoji && (
        <div style={{ padding: '12px 16px', background: '#1f2c34', borderTop: '1px solid #2a3942', display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
          {QUICK_EMOJIS.map(e => (
            <button key={e} type="button" onClick={(e2) => { e2.preventDefault(); appendEmoji(e); }}
              style={{ fontSize: '22px', cursor: 'pointer', background: 'transparent', border: 'none', borderRadius: '4px', padding: '4px', lineHeight: 1, transition: 'background 0.1s' }}
              onMouseOver={e2 => e2.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e2 => e2.currentTarget.style.background = 'transparent'}
            >{e}</button>
          ))}
        </div>
      )}

      {/* Mention picker */}
      {showMention && team && (
        <div style={{ position: 'absolute', bottom: '66px', left: '16px', background: '#233138', borderRadius: '8px', padding: '8px 0', minWidth: '200px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 101, border: '1px solid #2a3942' }}>
          {team.filter(t => t.name.toLowerCase().includes(mentionFilter)).length === 0 ? (
            <div style={{ padding: '8px 16px', color: '#8696a0', fontSize: '14px' }}>No matches found</div>
          ) : (
            team.filter(t => t.name.toLowerCase().includes(mentionFilter)).map(t => (
              <div
                key={t.id}
                onClick={() => {
                  const words = value.split(/[\s\n]+/);
                  words[words.length - 1] = `@${t.name} `;
                  setValue(words.join(' '));
                  setShowMention(false);
                  textareaRef.current?.focus();
                }}
                style={{ padding: '8px 16px', color: '#e9edef', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6b7c85', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                  {t.name.charAt(0).toUpperCase()}
                </div>
                {t.name}
              </div>
            ))
          )}
        </div>
      )}

      {/* Attachment menu popup */}
      {showAttach && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', bottom: '66px', left: '60px', background: '#233138', borderRadius: '16px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100, border: '1px solid #2a3942' }}
        >
          {[
            { icon: <ImageIcon size={22} color="white"/>, color: '#007bfc', label: 'Photos & Videos', onClick: () => photoInputRef.current?.click() },
            { icon: <Camera size={22} color="white"/>, color: '#ff2e74', label: 'Camera', onClick: () => cameraInputRef.current?.click() },
            { icon: <FileText size={22} color="white"/>, color: '#7f66ff', label: 'Document', onClick: () => docInputRef.current?.click() },
            { icon: <Music size={22} color="white"/>, color: '#e6711c', label: 'Audio', onClick: () => audioInputRef.current?.click() },
            { icon: <MapPin size={22} color="white"/>, color: '#0088cc', label: 'Location', onClick: handleLocationShare },
          ].map(a => (
            <div
              key={a.label}
              onClick={a.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', padding: '10px 12px', borderRadius: '10px', transition: 'background 0.15s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{a.icon}</div>
              <span style={{ fontSize: '15px', color: '#e9edef' }}>{a.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* File Preview / staging area */}
      {selectedFile && (
        <div style={{ padding: '12px 16px', background: '#1f2c34', borderTop: '1px solid #2a3942', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* Preview */}
          {selectedFile.isImage && selectedFile.previewUrl ? (
            <div style={{ position: 'relative' }}>
              <img
                src={selectedFile.previewUrl}
                alt="preview"
                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
              />
            </div>
          ) : selectedFile.isVideo && selectedFile.previewUrl ? (
            <div style={{ width: '80px', height: '80px', borderRadius: '8px', background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="#aebac1"><path d="M8 5v14l11-7z"/></svg>
            </div>
          ) : (
            <div style={{ width: '52px', height: '52px', borderRadius: '8px', background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {selectedFile.isAudio ? <Music size={24} color="#00a884"/> : <File size={24} color="#00a884"/>}
            </div>
          )}

          {/* File info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', color: '#e9edef', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedFile.name}
            </div>
            <div style={{ fontSize: '12px', color: '#8696a0', marginTop: '4px' }}>
              {formatFileSize(selectedFile.size)} · {selectedFile.isImage ? 'Image' : selectedFile.isVideo ? 'Video' : selectedFile.isAudio ? 'Audio' : 'Document'}
            </div>
            {selectedFile.size > 900 * 1024 && (
              <div style={{ fontSize: '11px', color: '#ff9800', marginTop: '4px' }}>⚠ Large file — preview only for sender</div>
            )}
          </div>

          {/* Remove button */}
          <button onClick={removeFile} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} color="#aebac1"/>
          </button>
        </div>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #2a3942', display: 'flex', alignItems: 'center', gap: '12px', background: '#1f2c34' }}>
          <div style={{ width: '4px', alignSelf: 'stretch', background: getSenderColor(replyingTo.senderId || ''), borderRadius: '2px', flexShrink: 0 }}></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: getSenderColor(replyingTo.senderId || '') }}>
              {replyingTo.senderName || team?.find(t => t.id === replyingTo.senderId)?.name || 'Unknown'}
            </div>
            <div style={{ fontSize: '13px', color: '#8696a0', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyingTo.text}
            </div>
          </div>
          <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#aebac1', display: 'flex', alignItems: 'center' }}>
            <X size={22}/>
          </button>
        </div>
      )}

      {/* Main input row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '10px 16px', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', paddingBottom: '10px', alignItems: 'center' }}>
          <button onClick={e => { e.stopPropagation(); setShowEmoji(!showEmoji); setShowAttach(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} title="Emoji">
            <Smile size={28} color={showEmoji ? '#00a884' : '#aebac1'} />
          </button>
          <button onClick={e => { e.stopPropagation(); setShowAttach(!showAttach); setShowEmoji(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', transform: showAttach ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} title="Attach">
            <Paperclip size={24} color={showAttach ? '#00a884' : '#aebac1'} />
          </button>
        </div>

        <div style={{ flex: 1, background: '#2a3942', borderRadius: '8px', padding: '9px 12px', display: 'flex', alignItems: 'flex-end', minHeight: '42px' }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextChange}
            onKeyDown={handleKey}
            placeholder="Type a message"
            rows={1}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', background: 'transparent', resize: 'none', height: '20px', maxHeight: '100px', fontFamily: '"Segoe UI","Helvetica Neue",Arial,sans-serif', lineHeight: '20px', color: '#e9edef', overflowY: 'auto' }}
          />
        </div>

        <div style={{ paddingBottom: '10px' }}>
          {(value.trim() || selectedFile) ? (
            <button onClick={handleSend} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <Send size={26} color="#00a884" />
            </button>
          ) : (
            <Mic size={26} color="#aebac1" style={{ cursor: 'pointer' }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
