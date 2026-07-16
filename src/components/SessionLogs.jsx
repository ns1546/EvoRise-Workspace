import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where, limit, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Activity, MapPin, Clock, User, LogIn, LogOut, Filter, Calendar, Layers, AlertCircle, Download, ChevronRight } from 'lucide-react';
import Pagination from './Pagination';
import { useIsMobile } from '../hooks/useIsMobile';

const ACTION_ICONS = {
  CREATE: { color: '#137333', bg: 'rgba(19,115,51,0.08)', label: '+ Created' },
  EDIT:   { color: '#0b57d0', bg: 'rgba(11,87,208,0.08)', label: '✎ Edited'  },
  UPDATE: { color: '#0b57d0', bg: 'rgba(11,87,208,0.08)', label: '✎ Updated' },
  DELETE: { color: '#c5221f', bg: 'rgba(197,34,31,0.08)', label: '✕ Deleted' },
  LOGIN:  { color: '#7b1fa2', bg: 'rgba(123,31,162,0.08)', label: '→ Login'  },
  LOGOUT: { color: '#e37400', bg: 'rgba(227,116,0,0.08)', label: '← Logout'  },
  SEND:   { color: '#0b57d0', bg: 'rgba(11,87,208,0.08)', label: '✉ Sent'   },
  VIEW:   { color: '#5f6368', bg: 'rgba(95,99,104,0.08)', label: '👁 Viewed'  },
  COMPLETE: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: '✓ Completed' },
  FAIL:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: '✕ Failed' },
  START:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: '▶ Started' },
  END:    { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', label: '■ Ended' },
  PIN:    { color: '#00a884', bg: 'rgba(0,168,132,0.08)', label: '📌 Pinned' },
  UNPIN:  { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', label: '📌 Unpinned' },
  APPLY:  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', label: '⚙ Applied' },
  TOGGLE: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', label: '⚙ Toggled' },
  ASSIGN: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: '👤 Assigned' },
  REASSIGN: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: '👤 Reassigned' },
  SUBMIT: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: '✓ Submitted' },
};

const SessionLogsPage = () => {
  const { currentUser, userData } = useAuth();
  const isAdmin = userData?.role === 'Admin' || userData?.role === 'Administrator' || userData?.role === 'Partner';
  const isMobile = useIsMobile();

  const [sessions, setSessions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('sessions');
  const [filterUser, setFilterUser] = useState('all');
  const [filterModule, setFilterModule] = useState('all');
  const [users, setUsers] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterUser, filterModule]);

  // ─── Real-time data listeners ──────────────────────────────────────────────
  useEffect(() => {
    // Safety Limit: Max 1000 logs to prevent Firebase memory/cost crashes over time
    const q = query(collection(db, 'session_logs'), orderBy('loginAt', 'desc'), limit(1000));
    const unsub = onSnapshot(q, snap => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!isAdmin) data = data.filter(d => d.uid === currentUser?.uid);
      setSessions(data);
    });

    const q2 = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(1000));
    const unsub2 = onSnapshot(q2, snap => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!isAdmin) data = data.filter(d => d.uid === currentUser?.uid);
      setActivityLogs(data);
    });

    const unsub3 = onSnapshot(collection(db, 'users'), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsub(); unsub2(); unsub3(); };
  }, [currentUser?.uid, isAdmin]);

  const filteredLogs = useMemo(() => {
    return activityLogs.filter(l => {
      if (filterUser !== 'all' && l.uid !== filterUser) return false;
      if (filterModule !== 'all' && l.module !== filterModule) return false;
      return true;
    });
  }, [activityLogs, filterUser, filterModule]);

  const filteredSessions = useMemo(() => {
    if (filterUser === 'all') return sessions;
    return sessions.filter(s => s.uid === filterUser);
  }, [sessions, filterUser]);

  const totalActiveMinutes = sessions.reduce((acc, s) => acc + (s.activeMinutes || 0), 0);
  const uniqueUsers = [...new Set(sessions.map(s => s.uid))].length;
  const activeSessions = sessions.filter(s => s.sessionStatus === 'active').length;
  const modules = [...new Set(activityLogs.map(l => l.module).filter(Boolean))];

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const filteredMapSessions = useMemo(() => sessions.filter(s => s.location), [sessions]);
  const paginatedMapSessions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMapSessions.slice(start, start + itemsPerPage);
  }, [filteredMapSessions, currentPage, itemsPerPage]);

  const formatDuration = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const exportCSV = () => {
    const headers = ['User', 'Action', 'Module', 'Detail', 'Time'];
    const rows = filteredLogs.map(l => [
      l.userName, l.action, l.module, l.detail,
      l.timestamp?.toDate?.()?.toLocaleString() || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'activity_log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (log) => {
    if (!log.targetCollection || !log.targetId || !log.oldData) {
      alert("Missing restoration data for this action.");
      return;
    }
    if (window.confirm("Are you sure you want to restore the data to this previous state?")) {
      try {
        await updateDoc(doc(db, log.targetCollection, log.targetId), log.oldData);
        alert("Restored successfully.");
        setExpandedLog(null);
      } catch (err) {
        console.error("Restore via updateDoc failed:", err);
        // Fallback for document creation if it was deleted
        try {
          await setDoc(doc(db, log.targetCollection, log.targetId), log.oldData);
          alert("Restored (re-created) successfully.");
          setExpandedLog(null);
        } catch (err2) {
          alert("Failed to restore: " + err2.message);
        }
      }
    }
  };

  return (
    <div className={isMobile ? "mob-page" : ""} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '20px', padding: isMobile ? '16px' : '0' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isMobile && (
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #137333, #34a853)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(19,115,51,0.3)', flexShrink: 0 }}>
              <Activity size={24} color="white"/>
            </div>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '22px', fontWeight: 800, color: 'var(--text-primary)' }}>System Audits</h1>
            {!isMobile && <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Complete audit trail — login history, locations, and every action</p>}
          </div>
        </div>
        <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '8px 12px' : '10px 18px', background: 'rgba(19,115,51,0.1)', color: '#137333', border: '1px solid rgba(19,115,51,0.2)', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? '12px' : '14px' }}>
          <Download size={16}/> {isMobile ? 'Export' : 'Export CSV'}
        </button>
      </div>

      {/* ── Stats Row ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '8px' : '16px' }}>
        {[
          { label: 'Total Sessions', value: sessions.length, icon: <LogIn size={16}/>, color: '#7b1fa2', bg: 'rgba(123,31,162,0.08)' },
          { label: 'Active Right Now', value: activeSessions, icon: <Activity size={16}/>, color: '#137333', bg: 'rgba(19,115,51,0.08)' },
          { label: 'Total Active Time', value: formatDuration(totalActiveMinutes), icon: <Clock size={16}/>, color: '#0b57d0', bg: 'rgba(11,87,208,0.08)' },
          { label: 'Unique Users', value: uniqueUsers, icon: <User size={16}/>, color: '#e37400', bg: 'rgba(227,116,0,0.08)' },
        ].map(stat => (
          <div key={stat.label} style={{ background: stat.bg, border: `1px solid ${stat.color}20`, borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '12px' : '20px 24px', display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
            <div style={{ width: isMobile ? '32px' : '44px', height: isMobile ? '32px' : '44px', borderRadius: '10px', background: stat.bg, border: `1px solid ${stat.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color, flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 800, color: stat.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stat.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.04)', padding: '4px', borderRadius: '14px', width: isMobile ? '100%' : 'fit-content', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {[['sessions','Login History'],['activity','System Audit Trail'],['map','GPS Tracking']].map(([key,label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{ flexShrink: 0, padding: isMobile ? '8px 12px' : '8px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: activeTab === key ? 700 : 500, fontSize: isMobile ? '12px' : '14px', background: activeTab === key ? 'white' : 'transparent', color: activeTab === key ? '#0b57d0' : 'var(--text-secondary)', boxShadow: activeTab === key ? '0 2px 8px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Filter size={16} color="var(--text-secondary)"/>
        {isAdmin && (
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--glass-border, #e0e0e0)', borderRadius: '10px', fontSize: '13px', outline: 'none', background: 'white', flex: isMobile ? 1 : 'none' }}>
            <option value="all">All Users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        )}
        {activeTab === 'activity' && (
          <select value={filterModule} onChange={e => setFilterModule(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--glass-border, #e0e0e0)', borderRadius: '10px', fontSize: '13px', outline: 'none', background: 'white', flex: isMobile ? 1 : 'none' }}>
            <option value="all">All Modules</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {/* ── Content Area ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '0', background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {filteredSessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No sessions found</div>
              ) : (
                paginatedSessions.map((s, index) => (
                  <div key={s.id} onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)} style={{ background: 'white', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: index < paginatedSessions.length - 1 ? '1px solid var(--border-light)' : 'none', borderLeft: s.sessionStatus === 'active' ? '4px solid #137333' : '4px solid transparent', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-ocean-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, flexShrink: 0 }}>
                        {(s.userName || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.userName}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.userRole}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        {s.sessionStatus === 'active' ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#137333', background: 'rgba(19,115,51,0.1)', padding: '4px 8px', borderRadius: '8px' }}>● LIVE</span>
                        ) : (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: '8px' }}>Ended</span>
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDuration(s.activeMinutes)}</span>
                      </div>
                    </div>
                    {selectedSession?.id === s.id && (
                      <div style={{ background: 'var(--bg-matte)', borderRadius: '12px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Login:</span><span style={{ fontSize: '13px', fontWeight: 500 }}>{s.loginAt?.toDate?.()?.toLocaleString() || '—'}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Logout:</span><span style={{ fontSize: '13px', fontWeight: 500 }}>{s.logoutAt?.toDate?.()?.toLocaleString() || (s.sessionStatus === 'active' ? '— (Active)' : 'Tab closed')}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Loc:</span><span style={{ fontSize: '13px', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{s.location ? `${s.location.lat.toFixed(4)}, ${s.location.lng.toFixed(4)}` : 'Not captured'}</span></div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="evo-table">
                <thead>
                  <tr>
                    <th>User Profile</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Login Time</th>
                    <th>Active Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No sessions found</td></tr>
                  ) : (
                    paginatedSessions.map(s => (
                      <React.Fragment key={s.id}>
                        <tr onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)} style={{ cursor: 'pointer', background: s.sessionStatus === 'active' ? 'rgba(19,115,51,0.02)' : 'transparent' }}>
                          <td data-label="User Profile">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--color-ocean-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                {(s.userName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.userName}</span>
                            </div>
                          </td>
                          <td data-label="Role" style={{ color: 'var(--text-secondary)' }}>{s.userRole}</td>
                          <td data-label="Status">
                            {s.sessionStatus === 'active' ? (
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#137333', background: 'rgba(19,115,51,0.1)', padding: '4px 8px', borderRadius: '6px' }}>● LIVE</span>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: '6px' }}>Ended</span>
                            )}
                          </td>
                          <td data-label="Login Time" style={{ fontWeight: 600 }}>
                            {s.loginAt?.toDate?.()?.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'N/A'}
                          </td>
                          <td data-label="Active Duration" style={{ color: 'var(--text-secondary)' }}>
                            {formatDuration(s.activeMinutes)}
                          </td>
                        </tr>
                        {selectedSession?.id === s.id && (
                          <tr style={{ background: 'var(--bg-matte)' }}>
                            <td colSpan="5" style={{ padding: '16px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                <div><span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>LOGIN</span><div style={{ fontSize: '13px', marginTop: '4px', fontWeight: 500 }}>{s.loginAt?.toDate?.()?.toLocaleString() || '—'}</div></div>
                                <div><span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>LOGOUT</span><div style={{ fontSize: '13px', marginTop: '4px', fontWeight: 500 }}>{s.logoutAt?.toDate?.()?.toLocaleString() || (s.sessionStatus === 'active' ? '— (Active)' : 'Tab closed')}</div></div>
                                <div><span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>LOCATION</span><div style={{ fontSize: '13px', marginTop: '4px', fontWeight: 500 }}>{s.location ? `${s.location.lat.toFixed(4)}, ${s.location.lng.toFixed(4)}` : 'Not captured'}</div></div>
                                <div><span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>DEVICE</span><div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-secondary)' }}>{s.device || '—'}</div></div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '0', background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {filteredLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No activity logs found</div>
              ) : (
                paginatedLogs.map((log, index) => {
                  const actionKey = Object.keys(ACTION_ICONS).find(k => log.action?.includes(k)) || 'VIEW';
                  const cfg = ACTION_ICONS[actionKey];
                  return (
                    <div 
                      key={log.id} 
                      onClick={() => setExpandedLog(expandedLog?.id === log.id ? null : log)}
                      style={{ background: 'white', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: log.oldData ? 'pointer' : 'default', borderBottom: index < paginatedLogs.length - 1 ? '1px solid var(--border-light)' : 'none', borderLeft: expandedLog?.id === log.id ? `4px solid ${cfg.color}` : '4px solid transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '4px 10px', borderRadius: '8px' }}>{cfg.label}</span>
                          {log.oldData && <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(245,158,11,0.1)', color: '#d97706', borderRadius: '4px' }}>Restorable</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {log.timestamp?.toDate?.()?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        {log.detail || log.action}
                      </div>

                      {isAdmin && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={12}/> {log.userName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Layers size={12}/> {log.module}</div>
                        </div>
                      )}

                      {expandedLog?.id === log.id && log.oldData && isAdmin && (
                        <div style={{ background: 'var(--bg-matte)', borderRadius: '12px', padding: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Previous State Data:</div>
                          <pre style={{ background: 'rgba(0,0,0,0.04)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-secondary)', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', maxHeight: '300px' }}>
                            {JSON.stringify(log.oldData, null, 2)}
                          </pre>
                          <button 
                            onClick={() => handleRestore(log)}
                            style={{ alignSelf: 'flex-start', padding: '8px 16px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                          >
                            Restore This Version
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="evo-table">
                <thead>
                  <tr>
                    <th>Action Type</th>
                    <th>Detail</th>
                    {isAdmin && <th>User & Module</th>}
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr><td colSpan={isAdmin ? "4" : "3"} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No activity logs found</td></tr>
                  ) : (
                    paginatedLogs.map(log => {
                      const actionKey = Object.keys(ACTION_ICONS).find(k => log.action?.includes(k)) || 'VIEW';
                      const cfg = ACTION_ICONS[actionKey];
                      return (
                        <React.Fragment key={log.id}>
                          <tr 
                            onClick={() => setExpandedLog(expandedLog?.id === log.id ? null : log)}
                            style={{ cursor: log.oldData ? 'pointer' : 'default', background: expandedLog?.id === log.id ? 'rgba(0,0,0,0.02)' : 'transparent' }}
                          >
                            <td data-label="Action Type">
                              <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '4px 10px', borderRadius: '8px' }}>{cfg.label}</span>
                            </td>
                            <td data-label="Detail" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {log.detail || log.action}
                              {log.oldData && <span style={{ fontSize: '10px', marginLeft: '8px', padding: '2px 6px', background: 'rgba(245,158,11,0.1)', color: '#d97706', borderRadius: '4px' }}>Restorable</span>}
                            </td>
                            {isAdmin && (
                              <td data-label="User & Module" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                {log.userName} <span style={{ opacity: 0.5 }}>·</span> {log.module}
                              </td>
                            )}
                            <td data-label="Time" style={{ color: 'var(--text-secondary)', fontSize: '13px', whiteSpace: 'nowrap' }}>
                              {log.timestamp?.toDate?.()?.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—'}
                            </td>
                          </tr>
                          {expandedLog?.id === log.id && log.oldData && isAdmin && (
                            <tr style={{ background: 'var(--bg-matte)' }}>
                              <td colSpan={isAdmin ? "4" : "3"} style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Previous State Data:</div>
                                  <pre style={{ background: 'rgba(0,0,0,0.04)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-secondary)', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', maxHeight: '300px' }}>
                                    {JSON.stringify(log.oldData, null, 2)}
                                  </pre>
                                  <button 
                                    onClick={() => handleRestore(log)}
                                    style={{ alignSelf: 'flex-start', padding: '8px 16px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                                  >
                                    Restore This Version
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Location Map Tab */}
        {activeTab === 'map' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(11,87,208,0.06)', border: '1px solid rgba(11,87,208,0.15)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={18} color="#0b57d0"/>
              <p style={{ margin: 0, fontSize: '13px', color: '#0b57d0' }}>Location map shows login coordinates captured at session start. Open the Google Maps link to see exact position.</p>
            </div>
            
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '0', background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {filteredMapSessions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No location data captured yet</div>
                ) : (
                  paginatedMapSessions.map((s, index) => (
                    <div key={s.id} style={{ background: 'white', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: index < paginatedMapSessions.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0,102,204,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b57d0', flexShrink: 0 }}>
                        <MapPin size={24}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.userName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {s.loginAt?.toDate?.()?.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—'}
                        </div>
                      </div>
                      <a href={`https://maps.google.com/?q=${s.location.lat},${s.location.lng}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: 'rgba(11,87,208,0.08)', color: '#0b57d0', borderRadius: '10px', flexShrink: 0, textDecoration: 'none' }}>
                        ↗
                      </a>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="evo-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Login Time</th>
                      <th>Coordinates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMapSessions.length === 0 ? (
                      <tr><td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No location data captured yet</td></tr>
                    ) : (
                      paginatedMapSessions.map(s => (
                        <tr key={s.id}>
                          <td data-label="User">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(0,102,204,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b57d0' }}>
                                <MapPin size={16}/>
                              </div>
                              <span style={{ fontWeight: 700 }}>{s.userName}</span>
                            </div>
                          </td>
                          <td data-label="Login Time" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {s.loginAt?.toDate?.()?.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—'}
                          </td>
                          <td data-label="Coordinates">
                            <a href={`https://maps.google.com/?q=${s.location.lat},${s.location.lng}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#0b57d0', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(11,87,208,0.3)', borderRadius: '8px', background: 'transparent' }} onMouseOver={e=>e.currentTarget.style.background='rgba(11,87,208,0.05)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                              {s.location.lat.toFixed(4)}, {s.location.lng.toFixed(4)} ↗
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* PAGINATION CONTROLS */}
      {(() => {
        const activeArray = activeTab === 'sessions' ? filteredSessions : activeTab === 'activity' ? filteredLogs : filteredMapSessions;
        if (activeArray.length === 0) return null;
        return (
          <Pagination
            currentPage={currentPage}
            totalItems={activeArray.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        );
      })()}
    </div>
  );
};

export default SessionLogsPage;
