import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useActivity } from '../contexts/ActivityContext';
import { AlertCircle, CheckCircle, Target, ArrowRight, ArrowLeft, Briefcase, Clock, CheckSquare, MessageCircle, History, ChevronRight, X, Search } from 'lucide-react';
import Pagination from './Pagination';
import Linkify from './Linkify';
import { useIsMobile } from '../hooks/useIsMobile';
import '../index.css';

const MyDay = () => {
  const { currentUser } = useAuth();
  const { logActivity } = useActivity();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyMode, setHistoryMode] = useState(false);
  const [sortBy, setSortBy] = useState('priority');
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [responseNotes, setResponseNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  // Mobile-specific state
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileDetailTask, setMobileDetailTask] = useState(null);

  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, 'tasks'), snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setTasks(data);
    });
    const unsubClients = onSnapshot(collection(db, 'clients'), snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setClients(data);
    });
    return () => { unsubTasks(); unsubClients(); };
  }, []);

  const getClientName = (task) => {
    const c = clients.find(cl => cl.id === task.clientId);
    return c ? c.name : 'Internal / No Client';
  };

  const getTaskDisplayTitle = (task) => {
    if (task.customName) return task.customName;
    if (task.type === 'service_task') return `${task.serviceName} #${task.sequence}`;
    if (task.type === 'workflow_task') return `Workflow: ${task.taskName}`;
    return task.taskName || 'Untitled Task';
  };

  const myTasks = tasks.filter(t => t.assigneeId === currentUser?.uid);

  const previousPendingTasks = useMemo(() => {
    return myTasks.filter(t => {
       if (t.status === 'Done') return false;
       let tDate = '';
       if (t.createdAt) { 
         try { 
           const d = typeof t.createdAt === 'number' ? new Date(t.createdAt) : (t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt));
           if (!isNaN(d.getTime())) tDate = d.toISOString().split('T')[0];
         } catch(e) {} 
       }
       return tDate && tDate < selectedDate;
    });
  }, [myTasks, selectedDate]);

  const todaysTasks = useMemo(() => {
    return myTasks.filter(t => {
       let tDate = '';
       if (t.createdAt) { 
         try { 
           const d = typeof t.createdAt === 'number' ? new Date(t.createdAt) : (t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt));
           if (!isNaN(d.getTime())) tDate = d.toISOString().split('T')[0];
         } catch(e) {} 
       }
       return tDate === selectedDate;
    });
  }, [myTasks, selectedDate]);

  const wizardTasks = useMemo(() => {
    let combined = [];
    if (historyMode) {
      combined = myTasks.filter(t => t.status === 'Done' || t.status === 'pending_edit');
    } else {
      combined = [...previousPendingTasks, ...todaysTasks].filter(t => t.status !== 'Done' && t.status !== 'pending_edit');
    }
    if (searchQuery) {
      combined = combined.filter(t => getTaskDisplayTitle(t).toLowerCase().includes(searchQuery.toLowerCase()));
    }
    combined.sort((a, b) => {
      if (sortBy === 'priority') {
        const pMap = { 'High': 3, 'Medium': 2, 'Low': 1, '': 0, undefined: 0 };
        if (pMap[a.priority] !== pMap[b.priority]) return pMap[b.priority] - pMap[a.priority];
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return combined;
  }, [previousPendingTasks, todaysTasks, sortBy, searchQuery, historyMode]);

  const paginatedQueue = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return wizardTasks.slice(start, start + itemsPerPage);
  }, [wizardTasks, currentPage, itemsPerPage]);

  useEffect(() => {
    if (!activeTaskId && paginatedQueue.length > 0) setActiveTaskId(paginatedQueue[0].id);
  }, [paginatedQueue, activeTaskId]);

  const activeTask = wizardTasks.find(t => t.id === activeTaskId) || null;
  const activeTaskGlobalIndex = wizardTasks.findIndex(t => t.id === activeTaskId);

  useEffect(() => {
    if (activeTask?.submissionNotes) setResponseNotes(activeTask.submissionNotes);
    else setResponseNotes('');
  }, [activeTask?.id]);

  const handleSkip = () => {
    if (activeTaskGlobalIndex < wizardTasks.length - 1) {
      const nextTask = wizardTasks[activeTaskGlobalIndex + 1];
      setActiveTaskId(nextTask.id);
      const nextTaskPage = Math.ceil((activeTaskGlobalIndex + 2) / itemsPerPage);
      if (nextTaskPage !== currentPage) setCurrentPage(nextTaskPage);
    }
  };

  const handlePrevious = () => {
    if (activeTaskGlobalIndex > 0) {
      const prevTask = wizardTasks[activeTaskGlobalIndex - 1];
      setActiveTaskId(prevTask.id);
      const prevTaskPage = Math.ceil(activeTaskGlobalIndex / itemsPerPage);
      if (prevTaskPage !== currentPage) setCurrentPage(prevTaskPage);
    }
  };

  const handleSubmitResponse = async (overrideTask = null) => {
    const isEvent = overrideTask && typeof overrideTask.preventDefault === 'function';
    const targetTask = (!overrideTask || isEvent) ? activeTask : overrideTask;
    if (!targetTask) return;
    await updateDoc(doc(db, 'tasks', targetTask.id), {
      status: 'Done', completedAt: Date.now(),
      submissionNotes: targetTask.id === activeTask?.id ? responseNotes : (targetTask.submissionNotes || '')
    });
    logActivity({ action: 'COMPLETE_DASHBOARD_TASK', module: 'myday', detail: `Completed: ${getTaskDisplayTitle(targetTask)}` });
    if (targetTask.id === activeTask?.id) handleSkip();
    if (isMobile) { setMobileDetailOpen(false); setMobileDetailTask(null); }
  };

  const handleUndo = async () => {
    if (!activeTask) return;
    if (window.confirm('Undo this task?')) {
      await updateDoc(doc(db, 'tasks', activeTask.id), { status: 'pending', completedAt: null, editRequested: false });
      logActivity({ action: 'UNDO_TASK', module: 'myday', detail: `Undid: ${getTaskDisplayTitle(activeTask)}` });
    }
  };

  const completedToday = todaysTasks.filter(t => t.status === 'Done').length;
  const totalToday = todaysTasks.length;
  const progressPercent = totalToday === 0 ? 100 : Math.round((completedToday / totalToday) * 100);

  // ── MOBILE RENDER ───────────────────────────────────────────
  if (isMobile) {
    const pColor = p => p==='High'?'#FF3B30':p==='Medium'?'#FF9500':p==='Low'?'#34C759':'#8E8E93';
    const pPill  = p => p==='High'?'mob-pill--red':p==='Medium'?'mob-pill--orange':'mob-pill--green';

    const openDetail = (task) => {
      setMobileDetailTask(task);
      setResponseNotes(task.submissionNotes || '');
      setMobileDetailOpen(true);
    };

    // Group tasks by priority
    const highTasks = wizardTasks.filter(t => t.priority === 'High'   && t.status !== 'Done');
    const medTasks  = wizardTasks.filter(t => t.priority === 'Medium' && t.status !== 'Done');
    const lowTasks  = wizardTasks.filter(t => (!t.priority || t.priority === 'Low') && t.status !== 'Done');
    const doneTasks = wizardTasks.filter(t => t.status === 'Done');
    const histTasks = wizardTasks;

    return (
      <div className="mob-page" style={{ paddingBottom: 0 }}>

        {/* ── Progress bar strip ───────────────────────── */}
        {!historyMode && (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:13, color:'#8E8E93', fontWeight:600 }}>
                {completedToday} of {totalToday} done today
              </span>
              <span style={{ fontSize:15, fontWeight:800, color:'#34C759' }}>{progressPercent}%</span>
            </div>
            <div className="mob-progress">
              <div className="mob-progress__fill" style={{ width:`${progressPercent}%`, background:'#34C759' }}/>
            </div>
          </div>
        )}

        {/* ── Search + History toggle ──────────────────── */}
        <div style={{ display:'flex', gap:10, padding:'0 16px 4px' }}>
          <div className="mob-search" style={{ flex:1, margin:0 }}>
            <Search size={16} color="#8E8E93" />
            <input className="mob-search__input" type="text" placeholder="Search tasks"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <button onClick={() => { setHistoryMode(!historyMode); setCurrentPage(1); setActiveTaskId(null); }}
            style={{ padding:'8px 14px', borderRadius:10, border:'none', fontWeight:600, fontSize:14,
              background: historyMode ? '#FF9500' : '#E3E3E8', color: historyMode ? '#FFF' : '#000',
              cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            {historyMode ? '← Queue' : 'History'}
          </button>
        </div>

        {/* ── Task List ────────────────────────────────── */}
        <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling: 'touch', paddingBottom:100 }}>

          {wizardTasks.length === 0 ? (
            <div className="mob-empty">
              <div className="mob-empty__icon">
                <Target size={36} color={historyMode ? '#8E8E93' : '#34C759'} />
              </div>
              <p className="mob-empty__title">{historyMode ? 'No history' : 'All done! 🎉'}</p>
              <p className="mob-empty__sub">
                {historyMode ? 'No completed tasks yet.' : 'You have no pending tasks for today.'}
              </p>
            </div>
          ) : historyMode ? (
            /* History view — flat list */
            <>
              <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Work History ({histTasks.length})</p>
              <div className="mob-group">
                {histTasks.map(task => (
                  <div key={task.id} className="mob-task-row" onClick={() => openDetail(task)}>
                    <div className="mob-task-row__check done"><CheckCircle size={14} color="white" /></div>
                    <div className="mob-task-row__body">
                      <div className="mob-task-row__name done">{getTaskDisplayTitle(task)}</div>
                      {task.clientId && <div className="mob-task-row__meta" style={{ color:'#007AFF', marginTop: '2px', fontSize: '11px', fontWeight: 600 }}>{getClientName(task)}</div>}
                      {task.submissionNotes && <div className="mob-task-row__meta">Note: {task.submissionNotes.slice(0,40)}</div>}
                    </div>
                    <div className="mob-task-row__trailing"><span style={{ color:'#C7C7CC', fontSize:20 }}>›</span></div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Queue — grouped by priority */
            <>
              {highTasks.length > 0 && (
                <>
                  <p className="mob-sec-hdr" style={{ paddingTop:12 }}>🔴 High Priority ({highTasks.length})</p>
                  <div className="mob-group">
                    {highTasks.map(task => (
                      <div key={task.id} className="mob-task-row" onClick={() => openDetail(task)}>
                        <div className="mob-task-row__check" />
                        <div className="mob-task-row__body">
                          <div className="mob-task-row__name">{getTaskDisplayTitle(task)}</div>
                          {task.clientId && <div className="mob-task-row__meta" style={{ color:'#007AFF', marginTop: '2px', fontSize: '11px', fontWeight: 600 }}>{getClientName(task)}</div>}
                          {task.status === 'pending_edit' && <div className="mob-task-row__meta" style={{ color:'#FF9500' }}>Edit Requested</div>}
                        </div>
                        <div className="mob-task-row__trailing">
                          <span className="mob-pill mob-pill--red">High</span>
                          <span style={{ color:'#C7C7CC', fontSize:20, marginLeft:4 }}>›</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {medTasks.length > 0 && (
                <>
                  <p className="mob-sec-hdr">🟡 Medium Priority ({medTasks.length})</p>
                  <div className="mob-group">
                    {medTasks.map(task => (
                      <div key={task.id} className="mob-task-row" onClick={() => openDetail(task)}>
                        <div className="mob-task-row__check" />
                        <div className="mob-task-row__body">
                          <div className="mob-task-row__name">{getTaskDisplayTitle(task)}</div>
                          {task.clientId && <div className="mob-task-row__meta" style={{ color:'#007AFF', marginTop: '2px', fontSize: '11px', fontWeight: 600 }}>{getClientName(task)}</div>}
                          {task.status === 'pending_edit' && <div className="mob-task-row__meta" style={{ color:'#FF9500' }}>Edit Requested</div>}
                        </div>
                        <div className="mob-task-row__trailing">
                          <span className="mob-pill mob-pill--orange">Med</span>
                          <span style={{ color:'#C7C7CC', fontSize:20, marginLeft:4 }}>›</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {lowTasks.length > 0 && (
                <>
                  <p className="mob-sec-hdr">🟢 Other Tasks ({lowTasks.length})</p>
                  <div className="mob-group">
                    {lowTasks.map(task => (
                      <div key={task.id} className="mob-task-row" onClick={() => openDetail(task)}>
                        <div className="mob-task-row__check" />
                        <div className="mob-task-row__body">
                          <div className="mob-task-row__name">{getTaskDisplayTitle(task)}</div>
                          {task.clientId && <div className="mob-task-row__meta" style={{ color:'#007AFF', marginTop: '2px', fontSize: '11px', fontWeight: 600 }}>{getClientName(task)}</div>}
                        </div>
                        <div className="mob-task-row__trailing">
                          <span style={{ color:'#C7C7CC', fontSize:20 }}>›</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {doneTasks.length > 0 && (
                <>
                  <p className="mob-sec-hdr">✅ Done Today ({doneTasks.length})</p>
                  <div className="mob-group">
                    {doneTasks.map(task => (
                      <div key={task.id} className="mob-task-row" onClick={() => openDetail(task)}>
                        <div className="mob-task-row__check done"><CheckCircle size={14} color="white" /></div>
                        <div className="mob-task-row__body">
                          <div className="mob-task-row__name done">{getTaskDisplayTitle(task)}</div>
                          {task.clientId && <div className="mob-task-row__meta" style={{ color:'#007AFF', marginTop: '2px', fontSize: '11px', fontWeight: 600 }}>{getClientName(task)}</div>}
                        </div>
                        <div className="mob-task-row__trailing">
                          <span className="mob-pill mob-pill--green">Done</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {highTasks.length === 0 && medTasks.length === 0 && lowTasks.length === 0 && doneTasks.length === 0 && (
                <div className="mob-empty">
                  <div className="mob-empty__icon"><Target size={36} color="#34C759" /></div>
                  <p className="mob-empty__title">All Done! 🎉</p>
                  <p className="mob-empty__sub">No pending tasks found.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Task Detail Bottom Sheet ─────────────────── */}
        {mobileDetailOpen && mobileDetailTask && (
          <>
            <div className="mob-overlay" onClick={() => setMobileDetailOpen(false)} />
            <div className="mob-sheet">
              {/* Sheet Nav */}
              <div className="mob-sheet__nav">
                <button className="mob-sheet__cancel" onClick={() => setMobileDetailOpen(false)}>Cancel</button>
                <span className="mob-sheet__title">Task Detail</span>
                <div style={{ minWidth:60 }} />
              </div>

              {/* Sheet Body */}
              <div className="mob-sheet__body">
                {/* Title + Status */}
                <div style={{ padding:'16px 16px 0' }}>
                  <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                    {mobileDetailTask.priority && (
                      <span className={`mob-pill ${pPill(mobileDetailTask.priority)}`}>{mobileDetailTask.priority}</span>
                    )}
                    <span className={`mob-pill ${mobileDetailTask.status==='Done' ? 'mob-pill--green' : 'mob-pill--blue'}`}>
                      {mobileDetailTask.status==='Done' ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <h2 style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, color:'#000', letterSpacing:'-0.02em', lineHeight:1.2 }}>
                    {getTaskDisplayTitle(mobileDetailTask)}
                  </h2>
                  {mobileDetailTask.clientId && (
                    <div style={{ color: '#007AFF', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                      Client: {getClientName(mobileDetailTask)}
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <p className="mob-sec-hdr" style={{ paddingTop:0 }}>Instructions</p>
                <div className="mob-group" style={{ marginBottom:0 }}>
                  <div style={{ padding:'14px 16px', fontSize:17, lineHeight:1.5, color:'#000' }}>
                    <Linkify text={mobileDetailTask.description || mobileDetailTask.notes || 'No details provided for this task.'} />
                  </div>
                </div>

                {/* Response notes */}
                {mobileDetailTask.status !== 'Done' && (
                  <>
                    <p className="mob-sec-hdr">Your Response</p>
                    <div className="mob-form-group" style={{ marginBottom:0 }}>
                      <textarea className="mob-form-textarea"
                        value={responseNotes}
                        onChange={e => setResponseNotes(e.target.value)}
                        placeholder="Type your notes, completion summary..." />
                    </div>
                  </>
                )}

                {/* Submitted notes (read-only) */}
                {mobileDetailTask.submissionNotes && mobileDetailTask.status === 'Done' && (
                  <>
                    <p className="mob-sec-hdr">Submitted Notes</p>
                    <div className="mob-group" style={{ marginBottom:0 }}>
                      <div style={{ padding:'14px 16px', fontSize:17, lineHeight:1.5, color:'#000' }}>
                        {mobileDetailTask.submissionNotes}
                      </div>
                    </div>
                  </>
                )}

                <div className="mob-spacer-lg" />
              </div>

              {/* Sheet Footer */}
              <div className="mob-sheet__footer">
                {mobileDetailTask.status !== 'Done' && mobileDetailTask.status !== 'pending_edit' ? (
                  <button className="mob-btn mob-btn--green"
                    onClick={() => handleSubmitResponse(mobileDetailTask)}>
                    <CheckCircle size={20} /> Mark as Done
                  </button>
                ) : mobileDetailTask.status === 'Done' ? (
                  <button className="mob-btn mob-btn--ghost"
                    onClick={handleUndo}>
                    ↩ Undo Completion
                  </button>
                ) : (
                  <button className="mob-btn mob-btn--ghost" disabled>
                    Edit Requested — Awaiting Admin
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      
      {/* Top Header */}
      <div className="glass-panel" style={{ padding: '12px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #0b57d0, #1a73e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(11,87,208,0.2)' }}>
            <Target size={20} color="white"/>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Focus Mode</h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Master-Detail task execution</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
             <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Daily Progress</span>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <div style={{ width: '120px', height: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                 <div style={{ width: `${progressPercent}%`, height: '100%', background: '#10b981', transition: 'width 0.5s ease' }} />
               </div>
               <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{progressPercent}%</span>
             </div>
          </div>
          <select value={sortBy} onChange={e => { setSortBy(e.target.value); setCurrentPage(1); setActiveTaskId(null); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', fontWeight: 600, background: 'rgba(0,0,0,0.02)', fontSize: '13px' }}>
             <option value="priority">Sort: Priority (High to Low)</option>
             <option value="time">Sort: Newest First</option>
          </select>
          <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setCurrentPage(1); setActiveTaskId(null); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', fontWeight: 600, background: 'rgba(0,0,0,0.02)', fontSize: '13px' }} disabled={historyMode} />
          
          <button 
            onClick={() => { setHistoryMode(!historyMode); setCurrentPage(1); setActiveTaskId(null); }}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', fontWeight: 600, background: historyMode ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(0,0,0,0.02)', color: historyMode ? 'white' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <History size={14} /> {historyMode ? 'Back to Queue' : 'Work History'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        
        {/* Left Sidebar: Paginated Queue */}
        <div className="glass-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', borderRadius: '16px', background: 'white', flexShrink: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <CheckSquare size={16} /> Fast Task Queue ({wizardTasks.length})
            </h3>
            <input 
              type="text" 
              placeholder="🔍 Search tasks..." 
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', background: 'rgba(0,0,0,0.03)', fontSize: '13px', fontWeight: 600 }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px' }}>
            {paginatedQueue.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks for this date.</div>
            ) : (
              paginatedQueue.map((task, index) => {
                const isActive = task.id === activeTaskId;
                const isDone = task.status === 'Done';
                const isPendingEdit = task.status === 'pending_edit';
                const hasDetails = !!(task.description || task.notes);
                
                let priorityColor = 'var(--text-secondary)';
                if(task.priority === 'High') priorityColor = '#ef4444';
                if(task.priority === 'Medium') priorityColor = '#f59e0b';
                if(task.priority === 'Low') priorityColor = '#10b981';
                
                const seqNumber = index + 1 + (currentPage - 1) * itemsPerPage;

                return (
                  <div 
                    key={task.id} 
                    onClick={() => setActiveTaskId(task.id)}
                    style={{ 
                      padding: '6px 8px', 
                      borderRadius: '6px', 
                      background: isActive ? 'linear-gradient(135deg, #0b57d0, #1a73e8)' : isDone ? 'rgba(16,185,129,0.05)' : 'white',
                      border: `1px solid ${isActive ? 'transparent' : isDone ? 'rgba(16,185,129,0.2)' : 'var(--glass-border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                      boxShadow: isActive ? '0 2px 4px rgba(11,87,208,0.2)' : 'none',
                      color: isActive ? 'white' : 'var(--text-primary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, opacity: isActive ? 0.9 : 0.5, minWidth: '16px' }}>#{seqNumber}</span>
                      {isDone ? (
                        <CheckCircle size={14} color={isActive ? 'white' : '#10b981'} style={{ flexShrink: 0 }} />
                      ) : isPendingEdit ? (
                        <AlertCircle size={14} color={isActive ? 'white' : '#f59e0b'} style={{ flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${isActive ? 'white' : 'var(--color-ocean-blue)'}`, flexShrink: 0 }} />
                      )}
                      <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone && !isActive ? 0.6 : 1, display: 'flex', flexDirection: 'column' }}>
                        <div>{getTaskDisplayTitle(task)}</div>
                        {task.clientId && <div style={{ fontSize: '11px', color: '#007AFF', marginTop: '2px', fontWeight: 600 }}>{getClientName(task)}</div>}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, paddingLeft: '8px' }}>
                      {hasDetails && (
                        <Briefcase size={12} color={isActive ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)'} title="Has Instructions" />
                      )}
                      {task.priority && (
                         <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: isActive ? 'rgba(255,255,255,0.2)' : `${priorityColor}15`, color: isActive ? 'white' : priorityColor }}>
                           {task.priority.charAt(0)}
                         </span>
                      )}
                      {!isDone && !isPendingEdit && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSubmitResponse(task); }}
                          title="Quick Complete"
                          style={{ background: isActive ? 'white' : '#10b981', color: isActive ? 'var(--color-ocean-blue)' : 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <CheckCircle size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {wizardTasks.length > itemsPerPage && (
            <div style={{ padding: '16px', borderTop: '1px solid var(--glass-border)' }}>
              <Pagination
                currentPage={currentPage}
                totalItems={wizardTasks.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={() => {}}
              />
            </div>
          )}
        </div>

        {/* Right Area: Active Task Details */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '16px', background: 'white', overflow: 'hidden' }}>
          {!activeTask ? (
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
               <Target size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
               <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>No Task Selected</h2>
               <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>Select a task from the queue to begin.</p>
             </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Task Header info */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'rgba(0,0,0,0.01)', flexShrink: 0 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ padding: '4px 8px', background: activeTask.status === 'Done' ? 'rgba(16,185,129,0.1)' : activeTask.status === 'pending_edit' ? 'rgba(245,158,11,0.1)' : 'rgba(11,87,208,0.1)', color: activeTask.status === 'Done' ? '#10b981' : activeTask.status === 'pending_edit' ? '#f59e0b' : 'var(--color-ocean-blue)', borderRadius: '6px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {activeTask.status === 'Done' ? <CheckCircle size={12}/> : activeTask.status === 'pending_edit' ? <AlertCircle size={12}/> : <Clock size={12}/>}
                      {activeTask.status === 'Done' ? 'Completed' : activeTask.status === 'pending_edit' ? 'Edit Pending' : 'Pending Action'}
                    </span>
                    <span style={{ fontSize: '11px', color: activeTask.priority === 'High' ? '#ef4444' : activeTask.priority === 'Medium' ? '#f59e0b' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, background: activeTask.priority === 'High' ? 'rgba(239,68,68,0.1)' : activeTask.priority === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
                      <AlertCircle size={12}/> Priority: {activeTask.priority || 'Medium'}
                    </span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                    {getTaskDisplayTitle(activeTask)}
                  </h2>
                  {activeTask.clientId && (
                    <div style={{ color: '#007AFF', fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
                      Client: {getClientName(activeTask)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  Task {activeTaskGlobalIndex + 1} of {wizardTasks.length}
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Briefcase size={16}/> Instructions & Details
                  </h4>
                  <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    <Linkify text={activeTask.description || activeTask.notes || 'No detailed instructions provided for this task.'} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageCircle size={16} /> Your Response / Work Submission
                  </h4>
                  <textarea 
                    value={responseNotes}
                    onChange={e => setResponseNotes(e.target.value)}
                    placeholder="Type your notes, paste links, or provide a completion summary here..."
                    style={{ flex: 1, minHeight: '120px', padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '14px', resize: 'vertical', background: 'white', fontFamily: 'inherit', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                    disabled={activeTask.status === 'Done'}
                  />
                </div>

              </div>

              {/* Fixed Footer Controls */}
              <div style={{ padding: '12px 20px', background: 'white', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                
                <button 
                  onClick={handlePrevious} 
                  disabled={activeTaskGlobalIndex === 0}
                  style={{ padding: '8px 16px', background: 'white', border: '1px solid var(--glass-border)', borderRadius: '10px', cursor: activeTaskGlobalIndex === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', opacity: activeTaskGlobalIndex === 0 ? 0.5 : 1, transition: 'all 0.2s', color: 'var(--text-primary)' }}
                >
                  <ArrowLeft size={14}/> Previous
                </button>

                <div style={{ display: 'flex', gap: '12px' }}>
                  {activeTask.status !== 'Done' && (
                    <button 
                      onClick={handleSkip}
                      style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s' }}
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      Skip
                    </button>
                  )}

                  {activeTask.status === 'Done' && (
                    <button 
                      onClick={handleUndo}
                      style={{ padding: '8px 16px', background: 'transparent', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <History size={16}/> Undo Completion
                    </button>
                  )}

                  {activeTask.status !== 'Done' && activeTask.status !== 'pending_edit' ? (
                    <button 
                      onClick={() => handleSubmitResponse()}
                      style={{ padding: '8px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', transition: 'transform 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'none'}
                    >
                      <CheckCircle size={16}/> Submit & Mark Done
                    </button>
                  ) : (
                    <button 
                      onClick={handleSkip}
                      style={{ padding: '8px 24px', background: 'linear-gradient(135deg, #0b57d0, #1a73e8)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(11,87,208,0.3)' }}
                    >
                      Next Task <ArrowRight size={16}/>
                    </button>
                  )}
                </div>

              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyDay;
