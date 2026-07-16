import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Heart, MessageCircle, ChevronDown, ChevronUp, Trash2, Send, Megaphone, X } from 'lucide-react';
import Linkify from './Linkify';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useIsMobile } from '../hooks/useIsMobile';

const NoticeBoard = () => {
  const { currentUser, userData } = useAuth();
  const isAdmin = ['Admin','Administrator','Partner'].includes(userData?.role);
  const isMobile = useIsMobile();
  const [notices, setNotices] = useState([]);
  const [noticeForm, setNoticeForm] = useState({ title: '', body: '' });
  const [expandedNotice, setExpandedNotice] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [noticePage, setNoticePage] = useState(1);
  const [noticeToDelete, setNoticeToDelete] = useState(null);
  const [isDeletingNotice, setIsDeletingNotice] = useState(false);
  const [mobileCreate, setMobileCreate] = useState(false);
  const NOTICES_PER_PAGE = 5;

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'notices'), orderBy('createdAt', 'desc')), s => {
      setNotices(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const h = () => {
      setNoticeForm({ title: '', body: '' });
      setMobileCreate(true);
    };
    window.addEventListener('mobile-fab-noticeboard', h);
    return () => window.removeEventListener('mobile-fab-noticeboard', h);
  }, []);

  const postNotice = async (e) => {
    e.preventDefault();
    if (!noticeForm.title || !noticeForm.body) return;
    
    // Create the notice
    const newNoticeRef = await addDoc(collection(db, 'notices'), {
      ...noticeForm,
      authorId: currentUser.uid,
      authorName: userData?.name || 'Admin',
      authorRole: userData?.role || 'Employee',
      likes: [], comments: [],
      createdAt: serverTimestamp(),
      deleted: false
    });
    
    // Notify everyone
    await addDoc(collection(db, 'notifications'), {
      targetUid: 'all',
      title: 'New Notice Posted',
      body: `"${noticeForm.title}" by ${userData?.name || 'Admin'}`,
      type: 'info',
      module: 'noticeboard',
      createdAt: serverTimestamp(),
      readBy: []
    });

    setNoticeForm({ title: '', body: '' });
  };

  const toggleLike = async (notice) => {
    const liked = (notice.likes || []).includes(currentUser.uid);
    await updateDoc(doc(db, 'notices', notice.id), {
      likes: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
    
    // Notify the author if they are not the ones liking it
    if (!liked && notice.authorId && notice.authorId !== currentUser.uid) {
      await addDoc(collection(db, 'notifications'), {
        targetUid: notice.authorId,
        title: 'Notice Liked',
        body: `${userData?.name || 'Someone'} liked your notice: "${notice.title}"`,
        type: 'info',
        module: 'noticeboard',
        createdAt: serverTimestamp(),
        readBy: []
      });
    }
  };

  const postComment = async (noticeId) => {
    const text = commentInputs[noticeId]?.trim();
    if (!text) return;
    const notice = notices.find(n => n.id === noticeId);
    await updateDoc(doc(db, 'notices', noticeId), {
      comments: [...(notice.comments || []), {
        uid: currentUser.uid, name: userData?.name || 'User',
        text, createdAt: Date.now()
      }]
    });
    
    // Notify the author if they are not the ones commenting
    if (notice.authorId && notice.authorId !== currentUser.uid) {
      await addDoc(collection(db, 'notifications'), {
        targetUid: notice.authorId,
        title: 'New Comment on Notice',
        body: `${userData?.name || 'Someone'} commented on: "${notice.title}"`,
        type: 'info',
        module: 'noticeboard',
        createdAt: serverTimestamp(),
        readBy: []
      });
    }

    setCommentInputs(prev => ({ ...prev, [noticeId]: '' }));
  };

  const deleteNotice = async () => {
    if (!noticeToDelete) return;
    setIsDeletingNotice(true);
    try {
      await updateDoc(doc(db, 'notices', noticeToDelete.id), { deleted: true });
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingNotice(false);
      setNoticeToDelete(null);
    }
  };

  const activeNotices = notices.filter(n => !n.deleted);
  const totalPages = Math.ceil(activeNotices.length / NOTICES_PER_PAGE);
  const paginatedNotices = activeNotices.slice((noticePage - 1) * NOTICES_PER_PAGE, noticePage * NOTICES_PER_PAGE);

  // ── MOBILE NATIVE RENDER ───────────────────────────────────────
  if (isMobile) {
    return (
      <div className="mob-page" style={{ background:'#F2F2F7', paddingBottom:0 }}>

        {/* ── Feed ─────────────────────────────────── */}
        <div style={{ flex:1, overflowY:'auto', paddingBottom:120 }}>
          {activeNotices.length === 0 && (
            <div className="mob-empty">
              <div className="mob-empty__icon"><Megaphone size={36} color="#8E8E93" /></div>
              <p className="mob-empty__title">No Notices Yet</p>
              <p className="mob-empty__sub">Company announcements will appear here.</p>
            </div>
          )}

          {activeNotices.map(notice => {
            const isExpanded = expandedNotice === notice.id;
            const liked = (notice.likes || []).includes(currentUser?.uid);
            return (
              <div key={notice.id} style={{ background:'#FFF', borderRadius:16, margin:'0 16px 12px', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>

                {/* Author row */}
                <div style={{ padding:'14px 16px 0', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:20, background:'linear-gradient(135deg,#FF9500,#FF6D00)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:16, flexShrink:0 }}>
                    {(notice.authorName || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#000' }}>{notice.authorName}</div>
                    <div style={{ fontSize:11, color:'#8E8E93' }}>
                      {notice.authorRole} Â· {notice.createdAt?.toDate?.()?.toLocaleDateString()}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => setNoticeToDelete(notice)} style={{ background:'none', border:'none', padding:4, cursor:'pointer', color:'#FF3B30', display:'flex' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding:'10px 16px 14px' }}>
                  <div style={{ fontSize:16, fontWeight:700, color:'#000', marginBottom:6 }}>{notice.title}</div>
                  <div style={{ fontSize:14, color:'#3C3C43', lineHeight:1.55, whiteSpace:'pre-wrap' }}>
                    <Linkify text={notice.body} />
                  </div>
                </div>

                {/* Action bar */}
                <div style={{ borderTop:'0.5px solid #E5E5EA', display:'flex' }}>
                  <button onClick={() => toggleLike(notice)}
                    style={{ flex:1, border:'none', background:'none', padding:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:600, color:liked?'#FF3B30':'#8E8E93', cursor:'pointer' }}>
                    <Heart size={16} fill={liked?'#FF3B30':'none'} /> {(notice.likes||[]).length}
                  </button>
                  <div style={{ width:'0.5px', background:'#E5E5EA' }} />
                  <button onClick={() => setExpandedNotice(isExpanded ? null : notice.id)}
                    style={{ flex:1, border:'none', background:'none', padding:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:600, color:'#8E8E93', cursor:'pointer' }}>
                    <MessageCircle size={16} /> {(notice.comments||[]).length}
                  </button>
                </div>

                {/* Comments section */}
                {isExpanded && (
                  <div style={{ background:'#F9F9F9', borderTop:'0.5px solid #E5E5EA', padding:'12px 16px' }}>
                    {(notice.comments||[]).map((c,i) => (
                      <div key={i} style={{ display:'flex', gap:8, marginBottom:10 }}>
                        <div style={{ width:28, height:28, borderRadius:14, background:'#007AFF', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>
                          {(c.name||'U').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ background:'#EFEFF4', borderRadius:12, padding:'8px 12px', flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#000', marginBottom:2 }}>{c.name}</div>
                          <div style={{ fontSize:13, color:'#3C3C43' }}>{c.text}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <input
                        value={commentInputs[notice.id] || ''}
                        onChange={e => setCommentInputs(p => ({ ...p, [notice.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && postComment(notice.id)}
                        placeholder="Add a comment…"
                        style={{ flex:1, padding:'10px 14px', background:'#EFEFF4', border:'none', borderRadius:20, fontSize:14, outline:'none', color:'#000' }}
                      />
                      <button onClick={() => postComment(notice.id)}
                        style={{ background:'#007AFF', color:'white', border:'none', borderRadius:'50%', width:36, height:36, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Admin FAB removed: Replaced by App.jsx Global FAB ── */}

        {/* ── Create Notice Bottom Sheet ─────────── */}
        {mobileCreate && (
          <>
            <div className="mob-overlay" onClick={() => setMobileCreate(false)} />
            <div className="mob-sheet">
              <div className="mob-sheet__nav">
                <button className="mob-sheet__cancel" onClick={() => setMobileCreate(false)}>Cancel</button>
                <span className="mob-sheet__title">New Notice</span>
                <button className="mob-sheet__confirm"
                  onClick={async e => { await postNotice({ preventDefault:()=>{} }); setMobileCreate(false); }}>
                  Publish
                </button>
              </div>
              <div className="mob-sheet__body">
                <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Notice Details</p>
                <div className="mob-form-group">
                  <div className="mob-form-row" style={{ padding:'12px 16px' }}>
                    <input className="mob-form-input" placeholder="Title *" required
                      value={noticeForm.title} onChange={e => setNoticeForm(p => ({...p, title:e.target.value}))}
                      style={{ border:'none', outline:'none', background:'transparent', fontSize:17, flex:1 }} />
                  </div>
                </div>
                <p className="mob-sec-hdr">Message</p>
                <div className="mob-form-group" style={{ marginBottom:0 }}>
                  <div style={{ padding:'12px 16px' }}>
                    <textarea className="mob-form-textarea" placeholder="Full announcement…" required rows={6}
                      value={noticeForm.body} onChange={e => setNoticeForm(p => ({...p, body:e.target.value}))}
                      style={{ width:'100%', border:'none', outline:'none', background:'transparent', fontSize:15, resize:'none', lineHeight:1.5, fontFamily:'inherit' }} />
                  </div>
                </div>
                <div className="mob-spacer-lg" />
              </div>
              <div className="mob-sheet__footer">
                <button className="mob-btn mob-btn--green"
                  disabled={!noticeForm.title || !noticeForm.body}
                  onClick={async () => { await postNotice({ preventDefault:()=>{} }); setMobileCreate(false); }}>
                  <Megaphone size={20} /> Publish Notice
                </button>
              </div>
            </div>
          </>
        )}

        {noticeToDelete && (
          <ConfirmDeleteModal
            title="Delete Notice"
            message="This notice will be permanently removed from the board."
            onConfirm={deleteNotice}
            onCancel={() => setNoticeToDelete(null)}
            isDeleting={isDeletingNotice}
          />
        )}
      </div>
    );
  }


  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
          <Megaphone size={24} color="white"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Evorise Notice Board</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Company announcements and official updates</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? '16px' : '30px', paddingBottom: isMobile ? '60px' : '0' }}>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {paginatedNotices.map(notice => {
            const isExpanded = expandedNotice === notice.id;
            const liked = (notice.likes || []).includes(currentUser?.uid);
            return (
              <div key={notice.id} style={{ background: 'var(--bg-panel)', border: '1px solid var(--glass-border)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #e37400, #ff8f00)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '18px', flexShrink: 0, boxShadow: '0 4px 10px rgba(227,116,0,0.3)' }}>
                        {(notice.authorName || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{notice.authorName}</span>
                          <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '8px', fontWeight: 600 }}>{notice.authorRole}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{notice.createdAt?.toDate?.()?.toLocaleString()}</span>
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{notice.title}</h3>
                        <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}><Linkify text={notice.body} /></p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => setNoticeToDelete(notice)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px', borderRadius: '10px', marginLeft: '12px', transition: 'all 0.2s' }}>
                        <Trash2 size={18}/>
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '20px', paddingLeft: '64px' }}>
                    <button onClick={() => toggleLike(notice)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: liked ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${liked ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: liked ? '#ef4444' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
                      <Heart size={16} fill={liked ? '#ef4444' : 'none'}/> {(notice.likes || []).length} Likes
                    </button>
                    <button onClick={() => setExpandedNotice(isExpanded ? null : notice.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', transition: 'all 0.2s' }}>
                      <MessageCircle size={16}/> {(notice.comments || []).length} Comments {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 24px 24px 88px', background: 'rgba(0,0,0,0.15)' }}>
                    <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {(notice.comments || []).map((c, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-ocean-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>
                            {(c.name||'U').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '16px', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{new Date(c.createdAt).toLocaleString()}</div>
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}><Linkify text={c.text} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <input
                        value={commentInputs[notice.id] || ''}
                        onChange={e => setCommentInputs(p => ({ ...p, [notice.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && postComment(notice.id)}
                        placeholder="Write a comment..."
                        style={{ flex: 1, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '14px', outline: 'none', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                      />
                      <button onClick={() => postComment(notice.id)} style={{ background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', padding: '0 24px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,102,204,0.3)' }}>
                        <Send size={18}/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {activeNotices.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px dashed var(--glass-border)' }}>
              <Megaphone size={48} style={{ opacity: 0.2, marginBottom: '16px' }}/>
              <p style={{ fontSize: '16px', margin: 0 }}>No official notices posted yet.</p>
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '10px', padding: '20px', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <button 
                disabled={noticePage === 1}
                onClick={() => setNoticePage(p => p - 1)}
                style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '12px', cursor: noticePage === 1 ? 'not-allowed' : 'pointer', opacity: noticePage === 1 ? 0.5 : 1, fontWeight: 600 }}
              >
                Previous Page
              </button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Page {noticePage} of {totalPages}</span>
              <button 
                disabled={noticePage === totalPages}
                onClick={() => setNoticePage(p => p + 1)}
                style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '12px', cursor: noticePage === totalPages ? 'not-allowed' : 'pointer', opacity: noticePage === totalPages ? 0.5 : 1, fontWeight: 600 }}
              >
                Next Page
              </button>
            </div>
          )}
        </div>

        {isAdmin && (
          <div style={{ flex: 1 }}>
            <div style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <Plus size={20}/>
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Notice</h3>
              </div>
              <form onSubmit={postNotice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Notice Title</label>
                  <input value={noticeForm.title} onChange={e => setNoticeForm(p => ({ ...p, title: e.target.value }))} placeholder="E.g. Office Holiday Schedule" required style={{ width: '100%', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '14px', outline: 'none', background: 'rgba(0,0,0,0.2)', color: 'white' }}/>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Message</label>
                  <textarea value={noticeForm.body} onChange={e => setNoticeForm(p => ({ ...p, body: e.target.value }))} placeholder="Write the full announcement here..." required rows={6} style={{ width: '100%', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', background: 'rgba(0,0,0,0.2)', color: 'white' }}/>
                </div>
                <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', marginTop: '8px', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
                  Publish Notice
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {noticeToDelete && (
        <ConfirmDeleteModal
          title={`Delete Notice`}
          message="Are you sure you want to delete this notice? It will no longer be visible on the board."
          onConfirm={deleteNotice}
          onCancel={() => setNoticeToDelete(null)}
          isDeleting={isDeletingNotice}
        />
      )}
    </div>
  );
};

export default NoticeBoard;
