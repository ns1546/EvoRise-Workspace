import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, CheckCircle, User, X, FileText, Clock, AlertCircle } from 'lucide-react';
import Linkify from './Linkify';
import { useIsMobile } from '../hooks/useIsMobile';

const PerformancePage = () => {
  const { userData } = useAuth();
  const isAdmin = ['Admin','Administrator','Partner'].includes(userData?.role);
  const isMobile = useIsMobile();
  
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [logPage, setLogPage] = useState(1);
  const [mobileMember, setMobileMember] = useState(null);
  const TASKS_PER_PAGE = 15;

  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, 'tasks'), s => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(collection(db, 'clients'), s => setClients(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubTasks(); unsubUsers(); unsubClients(); };
  }, []);

  const getTaskDisplayTitle = (task) => {
    if (task.customName) return task.customName;
    if (task.type === 'service_task') return `${task.serviceName} #${task.sequence}`;
    if (task.type === 'workflow_task') return `Workflow: ${task.taskName}`;
    return task.title || task.taskName || 'Untitled Task';
  };

  const getClientName = (task) => {
    if (task.clientName) return task.clientName;
    if (task.clientId) {
      const c = clients.find(cl => cl.id === task.clientId);
      return c ? c.name : 'Unknown Client';
    }
    return 'N/A';
  };

  const leaderboard = useMemo(() => {
    return users.map(u => {
      const myTasks = tasks.filter(t => t.assignedTo === u.id || t.assignedUserId === u.id || t.assigneeId === u.id);
      const completed = myTasks.filter(t => t.status === 'Done' || t.status === 'Completed').length;
      const inProgress = myTasks.filter(t => t.status === 'In Progress').length;
      const pending = myTasks.filter(t => !t.status || t.status.toLowerCase() === 'pending').length;
      const overdue = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done' && t.status !== 'Completed').length;
      const score = (completed * 10) - (overdue * 5) + (inProgress * 2);
      return { ...u, completed, inProgress, pending, overdue, score, total: myTasks.length, myTasks };
    }).sort((a, b) => b.score - a.score);
  }, [users, tasks]);

  useEffect(() => {
    if (!selectedUser && leaderboard.length > 0) {
      setSelectedUser(leaderboard[0]);
    } else if (selectedUser) {
      const updated = leaderboard.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    }
  }, [leaderboard]);

  const RANK_STYLES = [
    { bg: 'linear-gradient(135deg, #f9a825, #ffd54f)', color: '#5d4037', icon: '🥇' },
    { bg: 'linear-gradient(135deg, #9e9e9e, #e0e0e0)', color: '#424242', icon: '🥈' },
    { bg: 'linear-gradient(135deg, #a1887f, #d7b99e)', color: '#4e342e', icon: '🥉' },
  ];

  if (!isAdmin) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>You do not have permission to view this module.</div>;
  }

  // ── MOBILE NATIVE RENDER ───────────────────────────────────────
  if (isMobile) {
    if (mobileMember) {
      const sortedTasks = [...(mobileMember.myTasks || [])].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', background: '#F2F2F7', minHeight: '100%' }}>
          {/* Inline back bar */}
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: '#F2F2F7', borderBottom: '0.5px solid #E5E5EA' }}>
            <button onClick={() => setMobileMember(null)} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '16px', fontWeight: 600, cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', gap: '4px', minHeight: 0 }}>
              ‹ Back
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
            {/* Profile */}
            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#007AFF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, overflow: 'hidden', flexShrink: 0 }}>
                {mobileMember.avatar ? <img src={mobileMember.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : mobileMember.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#000' }}>{mobileMember.name}</div>
                <div style={{ fontSize: '13px', color: '#8E8E93' }}>{mobileMember.role}</div>
              </div>
            </div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {[
                { label: 'Score', value: mobileMember.score, color: '#34C759' },
                { label: 'Done', value: mobileMember.completed, color: '#007AFF' },
                { label: 'Overdue', value: mobileMember.overdue, color: '#FF3B30' },
              ].map(s => (
                <div key={s.label} style={{ background: '#FFFFFF', borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: '#8E8E93', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Task Log */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Work Log</div>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {sortedTasks.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#8E8E93' }}>No tasks recorded.</div>
              ) : sortedTasks.map((t, i) => {
                const isDone = t.status === 'Done' || t.status === 'Completed';
                return (
                  <div key={t.id} style={{ padding: '14px 16px', borderBottom: i < sortedTasks.length - 1 ? '0.5px solid #E5E5EA' : 'none', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#34C759' : t.status === 'In Progress' ? '#FF9500' : '#C7C7CC', marginTop: '5px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#000', marginBottom: '2px' }}>{getTaskDisplayTitle(t)}</div>
                      <div style={{ fontSize: '11px', color: '#8E8E93' }}>
                        {getClientName(t) !== 'N/A' ? `${getClientName(t)} · ` : ''}{t.status || 'Pending'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', background: '#F2F2F7', minHeight: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Team Ranking</div>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {leaderboard.map((member, idx) => {
              const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              return (
                <div
                  key={member.id}
                  onClick={() => setMobileMember(member)}
                  style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: idx < leaderboard.length - 1 ? '0.5px solid #E5E5EA' : 'none', cursor: 'pointer' }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: idx < 3 ? 'linear-gradient(135deg, #f9a825, #ffd54f)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: idx < 3 ? '20px' : '14px', fontWeight: 700, color: idx < 3 ? '#5d4037' : '#8E8E93', flexShrink: 0, overflow: 'hidden' }}>
                    {member.avatar ? <img src={member.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} alt="" /> : rankEmoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
                    <div style={{ fontSize: '12px', color: '#8E8E93' }}>Score {member.score} · {member.completed} done</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '12px', color: '#8E8E93' }}>›</div>
                </div>
              );
            })}
            {leaderboard.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8E8E93' }}>No team data available.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #0b57d0, #1a73e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(11,87,208,0.3)' }}>
          <Trophy size={24} color="white"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Performance Logs</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Detailed activity, scores, and submitted task logs for every employee.</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', minHeight: 0, overflowY: isMobile ? 'auto' : 'visible' }}>
        
        {/* Left Side: Leaderboard List */}
        <div style={{ width: isMobile ? '100%' : '380px', height: isMobile ? 'auto' : '100%', background: 'white', border: '1px solid var(--glass-border)', borderRadius: '20px', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.01)' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}><Trophy size={16} color="#e37400"/> Team Ranking</h3>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: isMobile ? '300px' : 'none' }}>
            {leaderboard.map((member, idx) => {
              const isSelected = selectedUser?.id === member.id;
              const rankStyle = RANK_STYLES[idx] || { bg: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)', icon: `#${idx+1}` };
              return (
                <div 
                  key={member.id} 
                  onClick={() => { setSelectedUser(member); setLogPage(1); }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
                    background: isSelected ? 'rgba(11,87,208,0.06)' : idx < 3 ? 'rgba(249,168,37,0.03)' : 'white', 
                    border: `1px solid ${isSelected ? 'var(--color-ocean-blue)' : idx < 3 ? 'rgba(249,168,37,0.2)' : 'var(--glass-border)'}`, 
                    borderRadius: '12px', cursor: 'pointer', transition: 'all 0.1s' 
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: member.avatar ? 'transparent' : rankStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: rankStyle.color, flexShrink: 0, overflow: 'hidden' }}>
                    {member.avatar ? <img src={member.avatar} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : rankStyle.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score: {member.score}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{member.completed}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Done</div>
                  </div>
                </div>
              );
            })}
            {leaderboard.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No team data.</div>}
          </div>
        </div>

        {/* Right Side: Detailed Log Universe */}
        <div style={{ flex: 1, background: 'white', border: '1px solid var(--glass-border)', borderRadius: '20px', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {selectedUser ? (
            <>
              {/* User Header & Stats */}
              <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', background: 'linear-gradient(to right, rgba(11,87,208,0.02), transparent)', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'var(--color-ocean-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800, overflow: 'hidden' }}>
                    {selectedUser.avatar ? <img src={selectedUser.avatar} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: 'var(--text-primary)' }}>{selectedUser.name}</h2>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>{selectedUser.role} · {selectedUser.email}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '12px' }}>
                  <div style={{ background: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', gridColumn: isMobile ? 'span 2' : 'auto' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>{selectedUser.score}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Score</div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-ocean-blue)' }}>{selectedUser.completed}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Tasks Done</div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#8b5cf6' }}>{selectedUser.pending}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending</div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>{selectedUser.inProgress}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>In Progress</div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>{selectedUser.overdue}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Overdue</div>
                  </div>
                </div>
              </div>

              {/* Detailed Activity Log */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.01)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><User size={16}/> Detailed Work Log</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(() => {
                    const sortedTasks = [...(selectedUser.myTasks || [])].sort((a,b)=> (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
                    const totalPages = Math.ceil(sortedTasks.length / TASKS_PER_PAGE);
                    const paginatedTasks = sortedTasks.slice((logPage - 1) * TASKS_PER_PAGE, logPage * TASKS_PER_PAGE);
                    
                    return (
                      <>
                        {paginatedTasks.map(t => {
                          const isDone = t.status === 'Done' || t.status === 'Completed';
                          return (
                            <div 
                              key={t.id} 
                              onClick={() => setSelectedTaskDetails(t)}
                              style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.15s' }}
                              onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'}
                              onMouseOut={e=>e.currentTarget.style.transform='none'}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>{getTaskDisplayTitle(t)}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    {getClientName(t) !== 'N/A' ? `${getClientName(t)} · ` : ''} 
                                    {new Date(t.createdAt?.toDate?.() || t.timestamp || Date.now()).toLocaleString()}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: isDone ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.05)', color: isDone ? '#10b981' : 'var(--text-secondary)', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                                  {isDone && <CheckCircle size={12}/>}
                                  {t.status || 'Pending'}
                                </div>
                              </div>
                              
                              {(t.description || t.notes || t.submissionNotes) && (
                                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5', border: '1px solid rgba(0,0,0,0.03)' }}>
                                  {(t.description || t.notes) && (
                                    <div style={{ marginBottom: t.submissionNotes ? '12px' : '0' }}>
                                      <strong style={{ color: 'var(--text-secondary)', fontSize: '11px', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Instructions</strong> 
                                      <Linkify text={t.description || t.notes} />
                                    </div>
                                  )}
                                  {t.submissionNotes && (
                                    <div style={{ borderTop: (t.description || t.notes) ? '1px dashed var(--glass-border)' : 'none', paddingTop: (t.description || t.notes) ? '12px' : '0' }}>
                                      <strong style={{ color: '#10b981', fontSize: '11px', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Submitted Response</strong> 
                                      <Linkify text={t.submissionNotes} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {sortedTasks.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No tasks recorded for this user.</div>
                        )}
                        
                        {totalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '10px', paddingBottom: isMobile ? '20px' : '0' }}>
                            <button 
                              disabled={logPage === 1}
                              onClick={() => setLogPage(p => p - 1)}
                              style={{ padding: '6px 12px', background: 'white', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', cursor: logPage === 1 ? 'not-allowed' : 'pointer', opacity: logPage === 1 ? 0.5 : 1, fontSize: '12px', fontWeight: 600 }}
                            >
                              Previous
                            </button>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Page {logPage} of {totalPages}</span>
                            <button 
                              disabled={logPage === totalPages}
                              onClick={() => setLogPage(p => p + 1)}
                              style={{ padding: '6px 12px', background: 'white', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', cursor: logPage === totalPages ? 'not-allowed' : 'pointer', opacity: logPage === totalPages ? 0.5 : 1, fontSize: '12px', fontWeight: 600 }}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>
              Select an employee from the leaderboard to view their performance logs.
            </div>
          )}
        </div>

      </div>

      {/* Full Detail Modal */}
      {selectedTaskDetails && (
        <div onClick={() => setSelectedTaskDetails(null)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? '0' : '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: isMobile ? '100%' : '800px', maxWidth: '100%', maxHeight: isMobile ? '90vh' : '90vh', background: 'white', borderRadius: isMobile ? '24px 24px 0 0' : '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'float-in 0.3s ease-out' }}>
            
            <div style={{ padding: '24px', background: 'linear-gradient(to right, rgba(11,87,208,0.05), transparent)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', color: 'var(--text-primary)' }}>{getTaskDisplayTitle(selectedTaskDetails)}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Task ID: {selectedTaskDetails.id}</span>
                  <span style={{ padding: '4px 10px', background: (selectedTaskDetails.status === 'Done' || selectedTaskDetails.status === 'Completed') ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.05)', color: (selectedTaskDetails.status === 'Done' || selectedTaskDetails.status === 'Completed') ? '#10b981' : 'var(--text-secondary)', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                    {selectedTaskDetails.status || 'Pending'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedTaskDetails(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} color="var(--text-secondary)"/>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px' : '30px', display: 'flex', flexDirection: 'column', gap: '24px', background: '#f8fafc', paddingBottom: isMobile ? 'max(20px, env(safe-area-inset-bottom))' : '30px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><User size={16} color="var(--color-ocean-blue)"/> Assignment</h4>
                  <div style={{ fontSize: '13px' }}><strong>Client:</strong> {getClientName(selectedTaskDetails)}</div>
                  <div style={{ fontSize: '13px' }}><strong>Assigned To:</strong> {selectedTaskDetails.assigneeName || selectedTaskDetails.assignedToName || 'Unknown'}</div>
                  <div style={{ fontSize: '13px' }}><strong>Created By:</strong> {selectedTaskDetails.creatorName || selectedTaskDetails.authorName || 'System'}</div>
                </div>
                
                <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16} color="#f59e0b"/> Timeline</h4>
                  <div style={{ fontSize: '13px' }}><strong>Created:</strong> {new Date(selectedTaskDetails.createdAt?.toDate?.() || selectedTaskDetails.timestamp || Date.now()).toLocaleString()}</div>
                  <div style={{ fontSize: '13px' }}><strong>Due Date:</strong> {selectedTaskDetails.dueDate ? new Date(selectedTaskDetails.dueDate).toLocaleString() : 'No Due Date'}</div>
                  {selectedTaskDetails.completedAt && (
                    <div style={{ fontSize: '13px' }}><strong>Completed:</strong> {new Date(selectedTaskDetails.completedAt).toLocaleString()}</div>
                  )}
                </div>
              </div>

              <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={16} color="var(--text-secondary)"/> Detailed Instructions / Notes</h4>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.03)' }}>
                  <Linkify text={selectedTaskDetails.description || selectedTaskDetails.notes || 'No detailed instructions provided.'} />
                </div>
              </div>

              {(selectedTaskDetails.submissionNotes || selectedTaskDetails.submissionLink) && (
                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #10b981', boxShadow: '0 4px 12px rgba(16,185,129,0.05)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={16} color="#10b981"/> Employee Submission</h4>
                  
                  {selectedTaskDetails.submissionNotes && (
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap', background: 'rgba(16,185,129,0.05)', padding: '16px', borderRadius: '12px', marginBottom: selectedTaskDetails.submissionLink ? '12px' : 0 }}>
                      <strong>Notes:</strong><br/>
                      <Linkify text={selectedTaskDetails.submissionNotes} />
                    </div>
                  )}
                  
                  {selectedTaskDetails.submissionLink && (
                    <div style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong>Attachment/Link:</strong>
                      <a href={selectedTaskDetails.submissionLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-ocean-blue)', textDecoration: 'none', fontWeight: 600 }}>View Resource →</a>
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformancePage;
