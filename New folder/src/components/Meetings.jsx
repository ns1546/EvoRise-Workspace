import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useActivity } from '../contexts/ActivityContext';
import { Video, VideoOff, Plus, X, Trash2, ExternalLink, Calendar as CalendarIcon, Clock, Users } from 'lucide-react';
import '../index.css';
import { useIsMobile } from '../hooks/useIsMobile';

const Meetings = () => {
  const { currentUser, userData } = useAuth();
  const { sendNotification } = useNotifications();
  const { logActivity } = useActivity();
  const isMobile = useIsMobile();
  
  const isAdmin = ['Admin', 'Partner', 'Administrator'].includes(userData?.role);

  const [meetings, setMeetings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mobileScheduleOpen, setMobileScheduleOpen] = useState(false);
  
  // Form States
  const [meetingName, setMeetingName] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'meetings'), snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setMeetings(data.sort((a,b) => b.startedAt - a.startedAt));
    });
    return () => unsub();
  }, []);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!meetingName || !meetingLink) return;
    
    // Auto-detect meet/zoom/teams, or just use the link
    let finalLink = meetingLink;
    if (!finalLink.startsWith('http')) {
      finalLink = 'https://' + finalLink;
    }

    try {
      await addDoc(collection(db, 'meetings'), {
        name: meetingName,
        link: finalLink,
        createdBy: userData?.name || 'Admin',
        creatorId: currentUser?.uid,
        isActive: true,
        startedAt: Date.now()
      });
      
      sendNotification({
        title: 'Live Meeting Started',
        body: `Join ${meetingName} now!`,
        module: 'meetings',
        targetUid: 'all',
        type: 'warning'
      });
      
      logActivity({ action: 'START_MEETING', module: 'meetings', detail: `Started live meeting: ${meetingName}` });

      setIsModalOpen(false);
      setMeetingName('');
      setMeetingLink('');
    } catch(err) {
      console.error(err);
    }
  };

  const endMeeting = async (meeting) => {
    if (window.confirm('Are you sure you want to end this meeting?')) {
      await updateDoc(doc(db, 'meetings', meeting.id), { isActive: false, endedAt: Date.now() });
      logActivity({ action: 'END_MEETING', module: 'meetings', detail: `Ended meeting: ${meeting.name}` });
    }
  };

  const deleteMeeting = async (id) => {
    if (window.confirm('Delete this meeting record permanently?')) {
      await deleteDoc(doc(db, 'meetings', id));
    }
  };

  const activeMeetings = meetings.filter(m => m.isActive);
  const pastMeetings = meetings.filter(m => !m.isActive);

  const handleInstantMeeting = async () => {
    const roomId = `Evorise_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const link = `https://meet.jit.si/${roomId}`;
    const mName = `Instant Meeting by ${userData?.name || 'Admin'}`;
    
    await addDoc(collection(db, 'meetings'), {
      name: mName,
      link: link,
      createdBy: userData?.name || 'Admin',
      creatorId: currentUser?.uid,
      isActive: true,
      startedAt: Date.now()
    });

    await addDoc(collection(db, 'calls'), {
      type: 'meeting',
      status: 'ringing',
      callerId: currentUser?.uid,
      callerName: userData?.name || 'Admin',
      targetUid: 'all',
      link: link,
      createdAt: Date.now()
    });
    
    window.open(link, '_blank');
  };

  // ── MOBILE NATIVE RENDER ───────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', background: '#F2F2F7', minHeight: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button onClick={handleInstantMeeting} style={{ padding: '16px', background: 'linear-gradient(135deg, #34C759, #30B050)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(52,199,89,0.3)' }}>
              <Video size={24} />
              Instant Meeting
            </button>
            {isAdmin && (
              <button onClick={() => setMobileScheduleOpen(true)} style={{ padding: '16px', background: 'linear-gradient(135deg, #007AFF, #0056CC)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,122,255,0.3)' }}>
                <Plus size={24} />
                Schedule
              </button>
            )}
          </div>

          {/* Live Now */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', background: '#34C759', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 0 3px rgba(52,199,89,0.25)' }} />
              Live Now
            </div>
            {activeMeetings.length === 0 ? (
              <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', textAlign: 'center', color: '#8E8E93' }}>
                <VideoOff size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No active meetings</p>
              </div>
            ) : activeMeetings.map(m => (
              <div key={m.id} style={{ background: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid #34C759', marginBottom: '10px' }}>
                <div style={{ padding: '16px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#000', marginBottom: '4px' }}>{m.name}</div>
                  <div style={{ fontSize: '12px', color: '#8E8E93', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> Started {new Date(m.startedAt).toLocaleTimeString()} by {m.createdBy}
                  </div>
                </div>
                <div style={{ display: 'flex', borderTop: '0.5px solid #E5E5EA' }}>
                  <a href={m.link} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                    <button style={{ width: '100%', padding: '14px', background: '#34C759', color: 'white', border: 'none', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                      <Video size={18} /> Join Now
                    </button>
                  </a>
                  {(isAdmin || m.creatorId === currentUser?.uid) && (
                    <button onClick={() => endMeeting(m)} style={{ padding: '14px 20px', background: '#FF3B30', color: 'white', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                      End
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Past Meetings */}
          {pastMeetings.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Past Meetings</div>
              <div style={{ background: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {pastMeetings.slice(0, 15).map((m, i) => (
                  <div key={m.id} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: i < Math.min(pastMeetings.length, 15) - 1 ? '0.5px solid #E5E5EA' : 'none' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,122,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Video size={18} color="#007AFF" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: '#8E8E93' }}>{new Date(m.startedAt).toLocaleDateString()} · {m.createdBy}</div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteMeeting(m.id)} style={{ background: 'none', border: 'none', color: '#FF3B30', padding: '4px', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Schedule Meeting Bottom Sheet */}
        {(isModalOpen || mobileScheduleOpen) && (
          <>
            <div onClick={() => { setIsModalOpen(false); setMobileScheduleOpen(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301, background: '#F2F2F7', borderRadius: '24px 24px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))' }}>
              <div style={{ width: '36px', height: '4px', background: '#C7C7CC', borderRadius: '2px', margin: '0 auto 20px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#000' }}>Schedule Meeting</span>
                <button onClick={() => { setIsModalOpen(false); setMobileScheduleOpen(false); }} style={{ background: '#E5E5EA', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} color="#8E8E93" />
                </button>
              </div>
              <form onSubmit={(e) => { handleCreateMeeting(e); setMobileScheduleOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: '#8E8E93', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Meeting Topic</label>
                  <input value={meetingName} onChange={e => setMeetingName(e.target.value)} placeholder="e.g. Daily Standup" required style={{ width: '100%', padding: '14px 16px', background: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '15px', outline: 'none', color: '#000', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: '#8E8E93', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Meeting URL</label>
                  <input value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." required style={{ width: '100%', padding: '14px 16px', background: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '15px', outline: 'none', color: '#000', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" style={{ padding: '16px', background: 'linear-gradient(135deg, #007AFF, #0056CC)', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '16px', cursor: 'pointer', marginTop: '8px' }}>
                  Go Live
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      
      {/* Header */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '16px' : '0', padding: isMobile ? '20px' : '24px 32px', borderRadius: '24px', background: 'var(--bg-matte)' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Video size={isMobile ? 24 : 32} color="var(--color-ocean-blue)" /> Meeting Universe
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>Centralized hub for all team video conferences and external links.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
          <button 
            onClick={handleInstantMeeting}
            style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', gap: '8px', cursor: 'pointer', boxShadow: '0 8px 16px rgba(16,185,129,0.25)', width: isMobile ? '100%' : 'auto' }}
          >
            <Video size={20} /> Instant Meeting
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ background: 'linear-gradient(135deg, var(--color-ocean-blue) 0%, #004488 100%)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', gap: '8px', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,102,204,0.25)', width: isMobile ? '100%' : 'auto' }}
          >
            <Plus size={20} /> Schedule Meeting
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', flex: 1, overflow: isMobile ? 'auto' : 'hidden' }}>
        
        {/* Active Meetings */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: isMobile ? 'visible' : 'auto' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="live-dot" style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
            LIVE NOW
          </h3>
          
          {activeMeetings.length === 0 ? (
            <div className="matte-3d" style={{ padding: '60px', textAlign: 'center', borderRadius: '24px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <VideoOff size={48} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: '16px', fontWeight: 600 }}>No active meetings right now</div>
            </div>
          ) : (
            activeMeetings.map(m => (
              <div key={m.id} className="matte-3d" style={{ padding: '24px', borderRadius: '20px', background: 'white', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #10b98130', borderLeft: '4px solid #10b981' }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-start', gap: isMobile ? '12px' : '0' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14}/> Started at {new Date(m.startedAt).toLocaleTimeString()} by {m.createdBy}
                    </p>
                  </div>
                  {(isAdmin || m.creatorId === currentUser?.uid) && (
                    <button onClick={() => endMeeting(m)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      End Meeting
                    </button>
                  )}
                </div>
                
                <a href={m.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <button style={{ width: '100%', background: '#10b981', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}>
                    <Video size={20} /> Join Meeting Now
                  </button>
                </a>
              </div>
            ))
          )}
        </div>

        {/* Past Meetings */}
        <div style={{ width: isMobile ? '100%' : '380px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: isMobile ? 'visible' : 'auto' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>Past Meetings</h3>
          {pastMeetings.length === 0 ? (
            <div className="matte-3d" style={{ padding: '40px 20px', textAlign: 'center', borderRadius: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              No past meetings recorded.
            </div>
          ) : (
            pastMeetings.map(m => (
              <div key={m.id} className="matte-3d" style={{ padding: '16px', borderRadius: '16px', background: 'white', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</h4>
                  {isAdmin && (
                    <button onClick={() => deleteMeeting(m.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarIcon size={12}/> {new Date(m.startedAt).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={12}/> Hosted by {m.createdBy}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div onClick={() => setIsModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={handleCreateMeeting} style={{ background: 'white', width: '100%', maxWidth: isMobile ? '100%' : '440px', borderRadius: isMobile ? '24px 24px 0 0' : '24px', padding: isMobile ? '24px' : '32px', paddingBottom: isMobile ? 'max(24px, env(safe-area-inset-bottom))' : '32px', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', animation: isMobile ? 'slide-up 0.3s ease-out' : 'float-in 0.3s ease-out' }}>
            {isMobile && <div style={{ width: '40px', height: '4px', background: 'var(--glass-border)', borderRadius: '2px', margin: '0 auto 16px' }} />}
            <button type="button" onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: isMobile ? '16px' : '24px', right: isMobile ? '16px' : '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={24}/>
            </button>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Video size={28} color="var(--color-ocean-blue)"/> Host Meeting
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Meeting Topic / Name</label>
                <input 
                  type="text" 
                  value={meetingName}
                  onChange={e => setMeetingName(e.target.value)}
                  placeholder="e.g. Daily Standup"
                  required
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #e2e8f0', outline: 'none', fontSize: '15px' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Meeting URL (Zoom, Meet, Teams)</label>
                <input 
                  type="text" 
                  value={meetingLink}
                  onChange={e => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  required
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #e2e8f0', outline: 'none', fontSize: '15px' }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                <strong>Tip:</strong> Paste your external meeting link above. When you start the meeting, team members will be notified and can join directly by clicking the link in the Meeting Universe.
              </div>

              <button type="submit" style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: 'var(--color-ocean-blue)', color: 'white', fontWeight: 700, fontSize: '16px', cursor: 'pointer', marginTop: '8px', boxShadow: '0 8px 16px rgba(0,102,204,0.2)' }}>
                Go Live
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default Meetings;
