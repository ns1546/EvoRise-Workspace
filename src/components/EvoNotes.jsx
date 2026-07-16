import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Trash2, Pin, CheckSquare, Palette, X, Edit2, Check } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import '../index.css';

const NOTE_COLORS = ['#ffffff', '#fef3c7', '#dcfce7', '#e0e7ff', '#fce7f3', '#f3f4f6'];

const EvoNotes = () => {
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  
  // Note Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [pinned, setPinned] = useState(false);
  const [checklist, setChecklist] = useState([]); // {id, text, done}
  const [newChecklistItem, setNewChecklistItem] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'evonotes'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      // Sort: Pinned first, then by createdAt descending
      data.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setNotes(data);
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    const handler = () => {
      handleOpenModal();
    };
    window.addEventListener('mobile-fab-evonotes', handler);
    return () => window.removeEventListener('mobile-fab-evonotes', handler);
  }, []);

  const resetForm = () => {
    setEditingNoteId(null);
    setTitle('');
    setContent('');
    setColor('#ffffff');
    setPinned(false);
    setChecklist([]);
    setNewChecklistItem('');
  };

  const handleOpenModal = (note = null) => {
    if (note) {
      setEditingNoteId(note.id);
      setTitle(note.title || '');
      setContent(note.content || '');
      setColor(note.color || '#ffffff');
      setPinned(note.pinned || false);
      setChecklist(note.checklist || []);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist([...checklist, { id: Date.now().toString(), text: newChecklistItem.trim(), done: false }]);
    setNewChecklistItem('');
  };

  const handleToggleChecklistItem = (id) => {
    setChecklist(checklist.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  const handleRemoveChecklistItem = (id) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  const handleSaveNote = async () => {
    if (!title && !content && checklist.length === 0) return;
    try {
      const noteData = {
        userId: currentUser.uid,
        title: title || 'Untitled Note',
        content,
        color,
        pinned,
        checklist,
        updatedAt: Date.now()
      };

      if (editingNoteId) {
        await updateDoc(doc(db, 'evonotes', editingNoteId), noteData);
      } else {
        await addDoc(collection(db, 'evonotes'), { ...noteData, createdAt: Date.now() });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this note?')) {
      await deleteDoc(doc(db, 'evonotes', id));
    }
  };

  const handleTogglePin = async (note, e) => {
    e.stopPropagation();
    await updateDoc(doc(db, 'evonotes', note.id), { pinned: !note.pinned });
  };

  // ── MOBILE NATIVE RENDER ───────────────────────────────────────
  if (isMobile) {
    const pinnedNotes = notes.filter(n => n.pinned);
    const otherNotes = notes.filter(n => !n.pinned);

    const NoteCard = ({ note }) => {
      const completed = (note.checklist || []).filter(i => i.done).length;
      const total = (note.checklist || []).length;
      return (
        <div
          onClick={() => handleOpenModal(note)}
          style={{ background: note.color || '#FFFFFF', borderRadius: '16px', padding: '14px', cursor: 'pointer', minHeight: '100px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', position: 'relative', boxSizing: 'border-box' }}
        >
          {note.pinned && (
            <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
              <Pin size={12} fill="#FF9500" color="#FF9500" />
            </div>
          )}
          {note.title && (
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#000', paddingRight: note.pinned ? '20px' : '0', lineHeight: 1.3 }}>{note.title}</div>
          )}
          {note.content && (
            <div style={{ fontSize: '12px', color: '#3C3C43', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{note.content}</div>
          )}
          {total > 0 && (
            <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '11px', color: '#8E8E93', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckSquare size={10} />{completed}/{total}
              </div>
              <div style={{ height: '3px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${total > 0 ? (completed / total * 100) : 0}%`, background: '#34C759', borderRadius: '2px' }} />
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', background: '#F2F2F7', minHeight: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
          {notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8E8E93' }}>
              <FileText size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '15px', margin: 0, fontWeight: 600 }}>No Notes Yet</p>
              <p style={{ fontSize: '13px', margin: '4px 0 0', color: '#AEAEB2' }}>Tap + to create your first note.</p>
            </div>
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Pinned</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                    {pinnedNotes.map(n => <NoteCard key={n.id} note={n} />)}
                  </div>
                </>
              )}
              {otherNotes.length > 0 && (
                <>
                  {pinnedNotes.length > 0 && <div style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Others</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {otherNotes.map(n => <NoteCard key={n.id} note={n} />)}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Create/Edit Bottom Sheet */}
        {isModalOpen && (
          <>
            <div className="mob-overlay" onClick={() => setIsModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300 }} />
            <div style={{ position: 'fixed', top: '60px', bottom: 0, left: 0, right: 0, zIndex: 301, background: color, borderRadius: '24px 24px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              <div style={{ width: '36px', height: '4px', background: 'rgba(0,0,0,0.15)', borderRadius: '2px', margin: '0 auto 16px', flexShrink: 0 }} />
              
              {/* Toolbar (Fixed Top) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {NOTE_COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, border: color === c ? '2.5px solid #007AFF' : '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setPinned(!pinned)} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: pinned ? '#FF9500' : '#8E8E93' }}>
                    <Pin size={18} fill={pinned ? '#FF9500' : 'none'} />
                  </button>
                  {editingNoteId && (
                    <button onClick={(e) => { handleDeleteNote(editingNoteId, e); setIsModalOpen(false); }} style={{ background: 'rgba(255,59,48,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30' }}>
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button onClick={() => { setIsModalOpen(false); resetForm(); }} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} color="#8E8E93" />
                  </button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingBottom: '16px', scrollbarWidth: 'none' }}>
                {/* Title */}
                <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', fontSize: '24px', fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', color: '#000', marginBottom: '12px', boxSizing: 'border-box' }} />
                {/* Body */}
                <textarea placeholder="Note..." value={content} onChange={e => setContent(e.target.value)} style={{ width: '100%', minHeight: '120px', fontSize: '15px', border: 'none', background: 'transparent', outline: 'none', resize: 'none', color: '#3C3C43', lineHeight: 1.6, boxSizing: 'border-box' }} />
                
                {/* Checklist */}
                {checklist.length > 0 && (
                  <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)', paddingTop: '16px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {checklist.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div onClick={() => handleToggleChecklistItem(item.id)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: `2px solid ${item.done ? '#34C759' : '#C7C7CC'}`, background: item.done ? '#34C759' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          {item.done && <Check size={14} color="white" />}
                        </div>
                        <span style={{ flex: 1, fontSize: '15px', color: item.done ? '#8E8E93' : '#000', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                        <button onClick={() => handleRemoveChecklistItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', padding: 0 }}><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add Checklist */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <input type="text" placeholder="Add checklist item..." value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()} style={{ flex: 1, padding: '12px 16px', background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '12px', fontSize: '15px', outline: 'none', color: '#000' }} />
                  <button onClick={handleAddChecklistItem} style={{ background: 'rgba(0,122,255,0.1)', color: '#007AFF', border: 'none', borderRadius: '12px', padding: '0 16px', fontWeight: 600, cursor: 'pointer', fontSize: '15px' }}>Add</button>
                </div>
              </div>

              {/* Fixed Footer (Save Button) */}
              <div style={{ paddingTop: '12px', flexShrink: 0 }}>
                <button onClick={handleSaveNote} style={{ width: '100%', padding: '16px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,122,255,0.3)' }}>
                  {editingNoteId ? 'Update Note' : 'Save Note'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {!isMobile && (
        <div className="matte-3d" style={{ padding: '24px', borderRadius: '24px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileText size={28} color="var(--color-ocean-blue)" /> Evo Notes
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>Your private knowledge base and personal task checklists</p>
        </div>
        <button onClick={() => handleOpenModal()} style={{ background: 'var(--color-ocean-blue)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,102,204,0.3)' }}>
          <Plus size={20}/> Create Note
        </button>
      </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notes.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--text-secondary)' }}>
            <FileText size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <h3>No notes yet</h3>
            <p>Create your first Evo Note to start organizing your personal workflow.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', paddingBottom: '40px' }}>
            {notes.map(note => (
              <div 
                key={note.id} 
                onClick={() => handleOpenModal(note)}
                className="matte-3d" 
                style={{ background: note.color || '#ffffff', padding: '20px', borderRadius: '20px', position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--glass-border)', transition: 'transform 0.2s', minHeight: '150px' }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', paddingRight: '40px' }}>{note.title}</h4>
                  <div style={{ display: 'flex', gap: '8px', position: 'absolute', top: '16px', right: '16px' }}>
                    <button onClick={(e) => handleTogglePin(note, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: note.pinned ? 'var(--color-deep-orange)' : 'var(--text-secondary)', padding: 0 }}>
                      <Pin size={18} fill={note.pinned ? 'var(--color-deep-orange)' : 'none'}/>
                    </button>
                    <button onClick={(e) => handleDeleteNote(note.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0 }}>
                      <Trash2 size={18}/>
                    </button>
                  </div>
                </div>

                {note.content && (
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {note.content}
                  </p>
                )}

                {note.checklist && note.checklist.length > 0 && (
                  <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <CheckSquare size={14}/> 
                      {note.checklist.filter(i => i.done).length} / {note.checklist.length} Completed
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note Edit Modal */}
      {isModalOpen && (
        <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className={isMobile ? "mobile-bottom-sheet" : "matte-3d"} style={{ background: color, width: isMobile ? '100%' : '90%', maxWidth: '600px', height: isMobile ? '92vh' : 'auto', borderRadius: isMobile ? '24px 24px 0 0' : '24px', padding: '30px', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
            
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.05)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18}/>
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {NOTE_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: color === c ? '2px solid var(--color-ocean-blue)' : '1px solid var(--glass-border)', cursor: 'pointer' }}/>
                ))}
              </div>
              <button onClick={() => setPinned(!pinned)} style={{ background: 'none', border: 'none', color: pinned ? 'var(--color-deep-orange)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Pin size={18} fill={pinned ? 'var(--color-deep-orange)' : 'none'}/> {pinned ? 'Pinned' : 'Pin Note'}
              </button>
            </div>

            <input 
              type="text" 
              placeholder="Title" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: '100%', fontSize: '24px', fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', marginBottom: '16px', color: 'var(--text-primary)' }}
            />
            
            <textarea 
              placeholder="Take a note..." 
              value={content}
              onChange={e => setContent(e.target.value)}
              style={{ width: '100%', flex: 1, minHeight: '150px', fontSize: '15px', border: 'none', background: 'transparent', outline: 'none', resize: 'vertical', color: 'var(--text-secondary)', lineHeight: 1.6 }}
            />

            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed var(--glass-border)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckSquare size={16}/> Checklist Items</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {checklist.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="checkbox" checked={item.done} onChange={() => handleToggleChecklistItem(item.id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <span style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'gray' : 'black', fontSize: '14px' }}>{item.text}</span>
                    <button onClick={() => handleRemoveChecklistItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14}/></button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Add checklist item..." 
                  value={newChecklistItem}
                  onChange={e => setNewChecklistItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)', outline: 'none', background: 'white' }}
                />
                <button onClick={handleAddChecklistItem} style={{ background: 'rgba(0,102,204,0.1)', color: 'var(--color-ocean-blue)', border: 'none', padding: '0 16px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Add</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
              <button onClick={handleSaveNote} style={{ background: 'var(--color-ocean-blue)', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', fontSize: '15px' }}>
                {editingNoteId ? 'Update Note' : 'Save Note'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default EvoNotes;
