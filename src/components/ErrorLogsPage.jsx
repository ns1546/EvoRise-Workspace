import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { AlertOctagon, Eye, Download, Trash2, RefreshCw, CheckCircle, XCircle, Clock, ShieldAlert, FileSearch, User } from 'lucide-react';
import Pagination from './Pagination';

// ─── Global Error Boundary state store ───────────────────────────────────────
let _addLogEntry = null;
export const setLogWriter = (fn) => { _addLogEntry = fn; };
export const writeErrorLog = (error, info = '', crashData = null) => {
  if (_addLogEntry) _addLogEntry({ error, info, crashData });
};

// ─── React ErrorBoundary ──────────────────────────────────────────────────────
export class GlobalErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, crashDataStr: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    const dataDump = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      localStorage: { ...localStorage }
    };
    const crashDataStr = JSON.stringify(dataDump);
    this.setState({ crashDataStr });
    writeErrorLog(error?.toString?.() || 'Unknown error', JSON.stringify(info?.componentStack || '').slice(0, 500), crashDataStr);
  }
  handleDownloadOfflineBackup = () => {
    const blob = new Blob([this.state.crashDataStr], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `evorise_crash_backup_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }
  render() {
    if (this.state.hasError) return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:'16px', padding:'40px' }}>
        <XCircle size={40} color="var(--color-deep-orange)"/>
        <h2 style={{ margin:0, color:'var(--color-deep-orange)' }}>Page Crashed</h2>
        <p style={{ margin:0, color:'var(--text-secondary)', textAlign:'center', maxWidth:'400px', fontSize:'14px', lineHeight:'1.6' }}>{this.state.error?.toString?.()}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => this.setState({ hasError:false, error:null })} className="btn-primary" style={{ padding:'10px 24px', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', gap:'8px' }}>
            <RefreshCw size={16}/> Try Again
          </button>
          {this.state.crashDataStr && (
            <button onClick={this.handleDownloadOfflineBackup} style={{ padding:'10px 24px', background:'var(--blue-subtle)', color:'var(--color-ocean-blue)', border:'1px solid var(--blue-glow)', borderRadius:'12px', cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', gap:'8px' }}>
              <Download size={16}/> Download Offline Backup
            </button>
          )}
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ─── Details Modal ────────────────────────────────────────────────────────────
const DetailsModal = ({ log, onClose, onToggleResolved, onDelete }) => {
  if (!log) return null;
  const isEditRequest = log.error?.toLowerCase().includes('edit');
  const time = log.createdAt?.toDate?.()?.toLocaleString() || 'Unknown time';

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
      onClick={onClose}>
      <div className="glass-panel" style={{ background:'white', width:'660px', maxWidth:'92vw', maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'24px 28px', borderBottom:'1px solid var(--border-light)', display:'flex', justifyContent:'space-between', alignItems:'center', background: 'var(--bg-matte)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'42px', height:'42px', borderRadius:'12px', background: isEditRequest ? 'var(--orange-subtle)' : 'var(--orange-subtle)', border: isEditRequest ? '1px solid var(--orange-glow)' : '1px solid var(--orange-glow)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {isEditRequest ? <FileSearch size={20} color="var(--orange)"/> : <AlertOctagon size={20} color="var(--color-deep-orange)"/>}
            </div>
            <div>
              <div style={{ fontSize:'18px', fontWeight:800, color:'var(--text-primary)' }}>
                {isEditRequest ? 'Edit Request Details' : 'Error Log Details'}
              </div>
              <div style={{ fontSize:'13px', color:'var(--text-secondary)', fontWeight: 600, marginTop:'2px' }}>{time}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(0,0,0,0.05)', border:'none', color:'var(--text-secondary)', width:'36px', height:'36px', borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}
            onMouseOver={e=>{e.currentTarget.style.background='rgba(0,0,0,0.1)';e.currentTarget.style.color='var(--text-primary)';}}
            onMouseOut={e=>{e.currentTarget.style.background='rgba(0,0,0,0.05)';e.currentTarget.style.color='var(--text-secondary)';}}>
            <XCircle size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding:'24px 28px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'20px' }}>

          {/* Meta info */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div className="matte-3d" style={{ background:'white', padding:'14px 18px' }}>
              <div style={{ fontSize:'11px', fontWeight:800, color:'var(--text-hint)', letterSpacing:'1px', marginBottom:'6px' }}>STATUS</div>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: log.resolved ? 'var(--green)' : 'var(--color-deep-orange)', boxShadow: log.resolved ? '0 0 8px var(--green)' : '0 0 8px var(--color-deep-orange)' }}/>
                <span style={{ fontSize:'14px', fontWeight:800, color: log.resolved ? 'var(--green)' : 'var(--color-deep-orange)' }}>{log.resolved ? 'RESOLVED' : 'OPEN'}</span>
              </div>
            </div>
            <div className="matte-3d" style={{ background:'white', padding:'14px 18px' }}>
              <div style={{ fontSize:'11px', fontWeight:800, color:'var(--text-hint)', letterSpacing:'1px', marginBottom:'6px' }}>REPORTED BY</div>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <User size={14} color="var(--color-ocean-blue)"/>
                <span style={{ fontSize:'14px', fontWeight:700, color:'var(--text-primary)' }}>{log.reporterName || 'System'}</span>
              </div>
            </div>
          </div>

          {/* Main error/request content */}
          <div className="matte-3d" style={{ background:'var(--orange-subtle)', border:'1px solid var(--orange-glow)', padding:'18px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:800, color:'var(--color-deep-orange)', letterSpacing:'1px', marginBottom:'10px', textTransform:'uppercase' }}>
              {isEditRequest ? 'Request Summary' : 'Error Message'}
            </div>
            <div style={{ fontSize:'15px', fontWeight:600, color:'var(--text-primary)', lineHeight:'1.6', wordBreak:'break-word' }}>
              {log.error}
            </div>
          </div>

          {/* Info / Stack Trace */}
          {log.info && (
            <div className="matte-3d" style={{ background:'var(--bg-matte)', padding:'18px 20px' }}>
              <div style={{ fontSize:'11px', fontWeight:800, color:'var(--text-secondary)', letterSpacing:'1px', marginBottom:'10px', textTransform:'uppercase' }}>
                {isEditRequest ? 'Additional Details / Task Info' : 'Stack Trace'}
              </div>
              <pre style={{ margin:0, fontSize:'13px', color:'var(--text-secondary)', fontWeight:500, lineHeight:'1.7', whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:'"Courier New", monospace' }}>
                {log.info}
              </pre>
            </div>
          )}

          {/* Admin notes field placeholder */}
          {isEditRequest && (
            <div className="matte-3d" style={{ background:'var(--blue-subtle)', border:'1px solid var(--color-ocean-blue)', padding:'16px 20px' }}>
              <div style={{ fontSize:'11px', fontWeight:800, color:'var(--color-ocean-blue)', letterSpacing:'1px', marginBottom:'6px', textTransform:'uppercase' }}>Admin Guidance</div>
              <div style={{ fontSize:'13px', color:'var(--text-secondary)', fontWeight: 600, lineHeight:'1.6' }}>
                Review the edit request above. If the employee's reason is valid, resolve this log and update the task directly from the <strong style={{color:'var(--color-ocean-blue)'}}>Status Log</strong> tab in Instant Work or EvoBoard.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ padding:'18px 28px', borderTop:'1px solid var(--border-light)', display:'flex', gap:'10px', justifyContent:'flex-end', background: 'var(--bg-matte)' }}>
          {log.crashData && (
            <button onClick={() => {
                const blob = new Blob([log.crashData], { type:'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `crash_backup_${log.id}.json`; a.click();
                URL.revokeObjectURL(url);
              }}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'10px 18px', background:'var(--blue-subtle)', border:'1px solid var(--blue-glow)', borderRadius:'50px', cursor:'pointer', fontSize:'13px', fontWeight:700, color:'var(--color-ocean-blue)', transition:'all 0.2s', marginRight: 'auto' }}
              onMouseOver={e=>e.currentTarget.style.background='var(--blue-glow)'} onMouseOut={e=>e.currentTarget.style.background='var(--blue-subtle)'}>
              <Download size={14}/> Download Crash Data
            </button>
          )}
          <button onClick={() => { onDelete(log.id); onClose(); }}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'10px 18px', background:'var(--orange-subtle)', border:'1px solid var(--orange-glow)', borderRadius:'50px', cursor:'pointer', fontSize:'13px', fontWeight:700, color:'var(--color-deep-orange)', transition:'all 0.2s' }}
            onMouseOver={e=>e.currentTarget.style.background='var(--orange-glow)'} onMouseOut={e=>e.currentTarget.style.background='var(--orange-subtle)'}>
            <Trash2 size={14}/> Delete
          </button>
          <button onClick={() => onToggleResolved(log)}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'10px 22px', background: log.resolved ? 'var(--orange-subtle)' : 'var(--green)', border: log.resolved ? '1px solid var(--orange-glow)' : 'none', borderRadius:'50px', cursor:'pointer', fontSize:'13px', fontWeight:800, color: log.resolved ? 'var(--color-deep-orange)' : 'white', transition:'all 0.2s' }}
            onMouseOver={e=>e.currentTarget.style.transform='scale(1.04)'} onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}>
            {log.resolved ? <><XCircle size={14}/> Reopen</> : <><CheckCircle size={14}/> Mark Resolved</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Admin Error Log Page ─────────────────────────────────────────────────────
const ErrorLogsPage = () => {
  const { currentUser, userData } = useAuth();
  const isAdmin = ['Admin','Administrator','Partner'].includes(userData?.role);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => { setCurrentPage(1); }, [filter]);

  const addLogEntry = useCallback(async ({ error, info, crashData }) => {
    try {
      await addDoc(collection(db, 'error_logs'), {
        error: String(error).slice(0, 2000),
        info: String(info).slice(0, 2000),
        crashData: crashData ? String(crashData).slice(0, 500000) : null,
        resolved: false,
        createdAt: serverTimestamp(),
        reportedBy: currentUser?.uid || 'boundary',
        reporterName: userData?.name || 'System',
      });
    } catch (e) { console.error('Failed to write error log:', e); }
  }, [currentUser?.uid, userData?.name]);

  useEffect(() => { setLogWriter(addLogEntry); return () => setLogWriter(null); }, [addLogEntry]);

  useEffect(() => {
    // Safety Limit: Max 500 error logs to prevent memory leaks over time
    const q = query(collection(db, 'error_logs'), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const toggleResolved = async (log) => {
    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'error_logs', log.id), { resolved: !log.resolved });
    if (selectedLog?.id === log.id) setSelectedLog(prev => ({ ...prev, resolved: !prev.resolved }));
  };

  const deleteLog = async (id) => {
    await deleteDoc(doc(db, 'error_logs', id));
    if (selectedLog?.id === id) setSelectedLog(null);
  };

  const downloadAllLogs = () => {
    const text = logs.map(l =>
      `[${l.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}] ${l.resolved ? '[RESOLVED]' : '[OPEN]'}\nERROR: ${l.error}\nSTACK: ${l.info}\n${'─'.repeat(60)}`
    ).join('\n\n');
    const blob = new Blob([text], { type:'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `evorise_error_logs_${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = logs.filter(l => {
    if (filter === 'unresolved') return !l.resolved;
    if (filter === 'resolved') return l.resolved;
    return true;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const unresolvedCount = logs.filter(l => !l.resolved).length;
  const editRequests = logs.filter(l => l.error?.toLowerCase().includes('edit')).length;

  if (!isAdmin) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:'12px' }}>
      <ShieldAlert size={48} color="var(--color-deep-orange)" strokeWidth={1.5}/>
      <p style={{ color:'var(--text-secondary)', fontSize:'15px', fontWeight:600 }}>Admin access required.</p>
    </div>
  );

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* Details Modal */}
      {selectedLog && (
        <DetailsModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onToggleResolved={toggleResolved}
          onDelete={deleteLog}
        />
      )}

      {/* Header */}
      <div className="glass-panel" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', padding: '16px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'16px', background:'var(--color-deep-orange)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <AlertOctagon size={26} color="white"/>
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:'22px', fontWeight:800, color:'var(--text-primary)', letterSpacing:'-0.3px' }}>Error & Audit Logs</h1>
            <p style={{ margin:0, fontSize:'13px', fontWeight: 600, color:'var(--text-secondary)', marginTop:'2px' }}>
              {unresolvedCount > 0 ? `${unresolvedCount} open issue${unresolvedCount > 1 ? 's' : ''} requiring attention` : '✓ All clear — no open issues'}
            </p>
          </div>
        </div>
        <button onClick={downloadAllLogs} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'11px 20px', background:'var(--blue-subtle)', color:'var(--color-ocean-blue)', border:'1px solid var(--blue-glow)', borderRadius:'50px', cursor:'pointer', fontWeight:700, fontSize:'13px', transition:'all 0.2s' }}
          onMouseOver={e=>e.currentTarget.style.background='var(--blue-glow)'} onMouseOut={e=>e.currentTarget.style.background='var(--blue-subtle)'}>
          <Download size={15}/> Export Logs
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:'14px' }}>
        {[
          { label:'Total Logs', value:logs.length, color:'var(--color-ocean-blue)', bg: 'var(--blue-subtle)', icon:'📋' },
          { label:'Open Issues', value:unresolvedCount, color:'var(--color-deep-orange)', bg: 'var(--orange-subtle)', icon:'🔴' },
          { label:'Edit Requests', value:editRequests, color:'var(--orange)', bg: 'rgba(240,115,32,0.1)', icon:'✏️' },
          { label:'Resolved', value:logs.length - unresolvedCount, color:'var(--green)', bg: 'var(--green-bg)', icon:'✅' },
        ].map(s => (
          <div key={s.label} className="matte-3d" style={{ background:'white', padding:'18px 20px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'80px', height:'80px', borderRadius:'50%', background:s.bg, filter:'blur(20px)' }}/>
            <div style={{ fontSize:'11px', fontWeight:800, color:'var(--text-secondary)', letterSpacing:'1px', marginBottom:'8px', textTransform:'uppercase' }}>{s.label}</div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'28px', fontWeight:900, color:s.color }}>{s.value}</span>
              <span style={{ fontSize:'22px' }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:'4px', background:'rgba(0,0,0,0.05)', padding:'4px', borderRadius:'14px', width:'fit-content', border:'1px solid var(--border-light)' }}>
        {[['all','All'],['unresolved','Open'],['resolved','Resolved']].map(([key,label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{ padding:'8px 20px', borderRadius:'10px', border:'none', cursor:'pointer', fontWeight:700, fontSize:'13px', background: filter === key ? 'var(--color-ocean-blue)' : 'transparent', color: filter === key ? 'white' : 'var(--text-secondary)', boxShadow: filter === key ? '0 4px 14px var(--blue-glow)' : 'none', transition:'all 0.2s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Log List */}
      <div className="glass-panel" style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'10px', padding: '16px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 0', color:'var(--text-hint)' }}>
            <CheckCircle size={48} strokeWidth={1.5} style={{ marginBottom:'12px', color:'var(--green)' }}/>
            <p style={{ margin:0, fontSize:'16px', fontWeight: 600 }}>No logs found</p>
          </div>
        )}

        {paginated.map(log => {
          const isEdit = log.error?.toLowerCase().includes('edit');
          const accentColor = log.resolved ? 'var(--green)' : isEdit ? 'var(--orange)' : 'var(--color-deep-orange)';
          const accentBg = log.resolved ? 'var(--green-bg)' : isEdit ? 'rgba(240,115,32,0.1)' : 'var(--orange-subtle)';
          const time = log.createdAt?.toDate?.()?.toLocaleString() || 'Unknown';

          return (
            <div key={log.id} className="matte-3d" style={{ background:'white', borderLeft:`4px solid ${accentColor}`, overflow:'hidden', transition:'all 0.2s', cursor:'default' }}
              onMouseOver={e=>e.currentTarget.style.boxShadow=`0 4px 12px rgba(0,0,0,0.05)`}
              onMouseOut={e=>e.currentTarget.style.boxShadow='none'}>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', gap:'12px', flexWrap:'wrap' }}>

                {/* Left: status + meta */}
                <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap', minWidth:0 }}>
                  <span style={{ fontSize:'10px', fontWeight:900, padding:'4px 10px', borderRadius:'8px', background:accentBg, color:accentColor, border:`1px solid ${accentBg}`, letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
                    {log.resolved ? '✓ RESOLVED' : isEdit ? '✏️ EDIT REQ' : '● OPEN'}
                  </span>
                  <span style={{ fontSize:'12px', color:'var(--text-secondary)', fontWeight: 600, display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                    <Clock size={11}/> {time}
                  </span>
                  {log.reporterName && (
                    <span style={{ fontSize:'12px', color:'var(--text-secondary)', fontWeight: 600, display:'flex', alignItems:'center', gap:'4px' }}>
                      <User size={11}/> {log.reporterName}
                    </span>
                  )}
                </div>

                {/* Right: actions */}
                <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                  <button onClick={() => setSelectedLog(log)}
                    style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 14px', background:accentBg, border:`none`, borderRadius:'50px', cursor:'pointer', fontSize:'12px', fontWeight:700, color:accentColor, transition:'all 0.2s' }}>
                    <Eye size={13}/> View Details
                  </button>
                  <button onClick={() => toggleResolved(log)}
                    style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 14px', background: log.resolved ? 'var(--orange-subtle)' : 'var(--green-bg)', border: 'none', borderRadius:'50px', cursor:'pointer', fontSize:'12px', fontWeight:700, color: log.resolved ? 'var(--color-deep-orange)' : 'var(--green)', transition:'all 0.2s' }}>
                    {log.resolved ? <><XCircle size={12}/> Reopen</> : <><CheckCircle size={12}/> Resolve</>}
                  </button>
                  <button onClick={() => deleteLog(log.id)}
                    style={{ display:'flex', alignItems:'center', padding:'7px 10px', background:'var(--orange-subtle)', border:'none', borderRadius:'50px', cursor:'pointer', color:'var(--color-deep-orange)', transition:'all 0.2s' }}
                    onMouseOver={e=>e.currentTarget.style.background='var(--orange-glow)'} onMouseOut={e=>e.currentTarget.style.background='var(--orange-subtle)'}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>

              {/* Summary line — ONE line max, never overflows */}
              <div style={{ padding:'0 18px 14px 18px' }}>
                <div style={{ fontSize:'14px', fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%' }}>
                  {log.error}
                </div>
                {log.reportedBy && (
                  <div style={{ fontSize:'11px', fontWeight: 600, color:'var(--text-hint)', marginTop:'4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    ID: {log.reportedBy}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <Pagination currentPage={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage}/>
      )}
    </div>
  );
};

export default ErrorLogsPage;
