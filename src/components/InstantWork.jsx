import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useActivity } from '../contexts/ActivityContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Timer, Play, CheckCircle, AlertTriangle, Clock, List, X, Calendar, Plus } from 'lucide-react';
import Pagination from './Pagination';
import Linkify from './Linkify';
import SideDrawer from './SideDrawer';
import { safeDelete } from '../utils/trashService';
import { useIsMobile } from '../hooks/useIsMobile';
import '../index.css';

const InstantWork = () => {
  const { currentUser, userData } = useAuth();
  const { logActivity } = useActivity();
  const { sendNotification } = useNotifications();
  const isMobile = useIsMobile();

  // Mobile-specific state
  const [mobileDetail, setMobileDetail] = useState(null);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);

  const [users, setUsers] = useState([]);
  const [instantTasks, setInstantTasks] = useState([]);

  const [activeTab, setActiveTab] = useState('my_active');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [statusTab, setStatusTab] = useState('Total');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Launch Form State
  const [isLaunchFormVisible, setIsLaunchFormVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  // Time Setup
  const [timeType, setTimeType] = useState('duration'); // 'duration' or 'deadline'
  const [durationValue, setDurationValue] = useState(15);
  const [durationUnit, setDurationUnit] = useState('minutes'); // minutes, hours, days
  const [deadlineDate, setDeadlineDate] = useState('');

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Bulk Select & Inline Edit
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [editingField, setEditingField] = useState({ id: null, field: null, value: '' });

  // Completion Modal State
  const [completingTask, setCompletingTask] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionStatus, setCompletionStatus] = useState('done');

  const [viewDetailsTask, setViewDetailsTask] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setUsers(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'instant_tasks'), (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => b.createdAt - a.createdAt);
      setInstantTasks(data);
    });
    return () => unsub();
  }, []);

  const isAdmin = userData?.role === 'Admin' || userData?.role === 'Partner' || userData?.role === 'Administrator';

  // Mobile FAB listener — opens the launch form when tapped from bottom nav FAB
  useEffect(() => {
    const handler = () => {
      if (isAdmin) {
        setEditingTaskId(null);
        setTaskTitle(''); setTaskDescription('');
        setAssigneeId(''); setTimeType('duration');
        setDurationValue(15); setDurationUnit('minutes');
        setDeadlineDate(''); setIsLaunchFormVisible(true); setMobileCreateOpen(true);
      }
    };
    window.addEventListener('mobile-fab-instant', handler);
    return () => window.removeEventListener('mobile-fab-instant', handler);
  }, [isAdmin]);

  useEffect(() => {
    setCurrentPage(1);
    setLastSelectedIndex(null);
  }, [activeTab, statusTab, searchQuery, dateFilter]);

  const toggleSelect = (id, idx, event, dataArray) => {
    if (event && event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, idx);
      const end = Math.max(lastSelectedIndex, idx);
      const rangeIds = dataArray.slice(start, end + 1).map(t => t.id);
      
      const isSelecting = !selectedTaskIds.includes(id);
      let newSelections = [...selectedTaskIds];
      
      if (isSelecting) newSelections = Array.from(new Set([...newSelections, ...rangeIds]));
      else newSelections = newSelections.filter(tId => !rangeIds.includes(tId));
      
      setSelectedTaskIds(newSelections);
    } else {
      if (selectedTaskIds.includes(id)) setSelectedTaskIds(selectedTaskIds.filter(tId => tId !== id));
      else setSelectedTaskIds([...selectedTaskIds, id]);
    }
    setLastSelectedIndex(idx);
  };

  const handleInlineSave = async () => {
    if (!editingField.id || !editingField.field) return;
    try {
      await updateDoc(doc(db, 'instant_tasks', editingField.id), { [editingField.field]: editingField.value });
      logActivity({ action: 'INLINE_EDIT_INSTANT_TASK', module: 'instant', detail: `Inline edited ${editingField.field}` });
    } catch (err) {
      console.error(err);
    }
    setEditingField({ id: null, field: null, value: '' });
  };

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') handleInlineSave();
    if (e.key === 'Escape') setEditingField({ id: null, field: null, value: '' });
  };

  const handleAssignInstantTask = async (e) => {
    e.preventDefault();
    if (!taskTitle || !assigneeId) return;
    setLoading(true);

    let totalMinutes = 0;

    if (timeType === 'duration') {
      totalMinutes = parseInt(durationValue);
      if (durationUnit === 'hours') totalMinutes = totalMinutes * 60;
      if (durationUnit === 'days') totalMinutes = totalMinutes * 24 * 60;
    } else {
      if (!deadlineDate) {
        alert('Please select a valid deadline date and time.');
        setLoading(false);
        return;
      }
      const targetTime = new Date(deadlineDate).getTime();
      const now = Date.now();
      if (targetTime <= now) {
        alert('Deadline must be in the future.');
        setLoading(false);
        return;
      }
      totalMinutes = Math.ceil((targetTime - now) / (60 * 1000));
    }

    try {
      if (editingTaskId) {
        await updateDoc(doc(db, 'instant_tasks', editingTaskId), {
          title: taskTitle,
          description: taskDescription,
          assigneeId: assigneeId,
          durationMinutes: totalMinutes,
          originalUnit: timeType === 'duration' ? durationUnit : 'deadline',
          originalValue: timeType === 'duration' ? parseInt(durationValue) : deadlineDate
        });
        setEditingTaskId(null);
      } else {
        await addDoc(collection(db, 'instant_tasks'), {
          title: taskTitle,
          description: taskDescription,
          assigneeId: assigneeId,
          durationMinutes: totalMinutes,
          originalUnit: timeType === 'duration' ? durationUnit : 'deadline',
          originalValue: timeType === 'duration' ? parseInt(durationValue) : deadlineDate,
          status: 'running',
          createdAt: Date.now(),
          startTime: Date.now(),
          assignedBy: currentUser.uid
        });

        let notifyBody = timeType === 'duration' ? `You have ${durationValue} ${durationUnit} to complete: ${taskTitle}` : `Task Deadline: ${new Date(deadlineDate).toLocaleString()}`;
        sendNotification({
          title: 'Instant Task Assigned!',
          body: notifyBody,
          module: 'instant',
          targetUid: assigneeId,
          type: 'warning'
        });

        logActivity({ action: 'CREATE_INSTANT_TASK', module: 'instant', detail: `Assigned instant task: ${taskTitle}` });
      }

      closeLaunchForm();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const closeLaunchForm = () => {
    setIsLaunchFormVisible(false);
    setTaskTitle('');
    setTaskDescription('');
    setAssigneeId('');
    setTimeType('duration');
    setDurationValue(15);
    setDurationUnit('minutes');
    setDeadlineDate('');
    setEditingTaskId(null);
  };

  const handleEditClick = (task) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description || '');
    setAssigneeId(task.assigneeId);
    if (task.originalUnit === 'deadline') {
      setTimeType('deadline');
      setDeadlineDate(task.originalValue);
    } else {
      setTimeType('duration');
      setDurationValue(task.originalValue || task.durationMinutes);
      setDurationUnit(task.originalUnit || 'minutes');
    }
    setIsLaunchFormVisible(true);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!completingTask) return;
    setLoading(true);

    if (completionStatus === 'done') {
      await updateDoc(doc(db, 'instant_tasks', completingTask.id), {
        status: 'done',
        completedAt: Date.now(),
        submissionNotes: completionNotes
      });
      logActivity({ action: 'COMPLETE_INSTANT_TASK', module: 'instant', detail: `Completed instant task: ${completingTask.title}` });
    } else {
      await updateDoc(doc(db, 'instant_tasks', completingTask.id), {
        status: 'failed',
        failedAt: Date.now(),
        submissionNotes: completionNotes
      });
      logActivity({ action: 'FAIL_INSTANT_TASK', module: 'instant', detail: `Failed instant task: ${completingTask.title}` });
    }

    setCompletingTask(null);
    setCompletionNotes('');
    setLoading(false);
  };

  const openCompletionModal = (task, status) => {
    setCompletingTask(task);
    setCompletionStatus(status);
    setCompletionNotes('');
  };

  const deleteTask = async (taskId, taskTitle) => {
    if (window.confirm("Are you sure you want to delete this instant task? It will be moved to the archive trash.")) {
      await safeDelete('instant_tasks', taskId, userData);
      logActivity({ action: 'DELETE_INSTANT_TASK', module: 'instant', detail: `Moved task to trash: ${taskTitle || taskId}` });
    }
  };

  const addExtraTime = async (task, extraMins) => {
    const newDuration = task.durationMinutes + extraMins;
    await updateDoc(doc(db, 'instant_tasks', task.id), { durationMinutes: newDuration });
  };

  const undoTask = async (taskId) => {
    await updateDoc(doc(db, 'instant_tasks', taskId), { status: 'running', startTime: Date.now() });
  };

  const getDurationString = (task) => {
    if (task.originalUnit === 'deadline') {
      return `Deadline: ${new Date(task.originalValue).toLocaleString()}`;
    }
    if (task.originalValue && task.originalUnit) {
      return `${task.originalValue} ${task.originalUnit}`;
    }
    return `${task.durationMinutes} Minutes`;
  };

  const myActiveTasks = instantTasks.filter(t => t.assigneeId === currentUser?.uid && t.status === 'running');
  const teamActiveTasks = instantTasks.filter(t => t.status === 'running' && t.assigneeId !== currentUser?.uid);
  const recentCompletions = instantTasks.filter(t => t.status !== 'running' && (isAdmin || t.assigneeId === currentUser?.uid));

  const getPaginatedData = (dataArray) => {
    const start = (currentPage - 1) * itemsPerPage;
    return dataArray.slice(start, start + itemsPerPage);
  };

  const handleRequestEdit = async (task) => {
    if (window.confirm("Request to edit this completed task? Admins will be notified.")) {
      await updateDoc(doc(db, 'instant_tasks', task.id), {
        status: 'pending_edit',
        editRequested: true,
        editRequestedAt: Date.now()
      });
      // Log to Error Logs so admin sees it
      await addDoc(collection(db, 'error_logs'), {
        error: `Task Edit Requested: ${task.title}`,
        info: `Employee requested to edit task ID: ${task.id}. User ID: ${currentUser?.uid}.`,
        resolved: false,
        createdAt: new Date(),
        reportedBy: currentUser?.uid,
        reporterName: userData?.name || 'Employee'
      });
      logActivity({ action: 'REQUEST_TASK_EDIT', module: 'instant', detail: `Requested edit for: ${task.title}` });
      alert("Edit request sent to Admin.");
    }
  };

  const filteredStatusTasks = instantTasks.filter(task => {
    if (!isAdmin && task.assigneeId !== currentUser?.uid) return false;
    let statusMatch = true;
    const isLate = task.status === 'running' && Date.now() > task.startTime + (task.durationMinutes * 60 * 1000);
    if (statusTab === 'Done' && task.status !== 'done') statusMatch = false;
    if (statusTab === 'Missed' && task.status !== 'failed' && !isLate) statusMatch = false;
    if (statusTab === 'Pending' && (task.status !== 'running' || isLate)) statusMatch = false;

    let dateMatch = true;
    if (dateFilter) {
      if (task.createdAt) {
        try {
          const taskDate = new Date(task.createdAt).toISOString().split('T')[0];
          if (taskDate !== dateFilter) dateMatch = false;
        } catch (e) { dateMatch = false; }
      } else { dateMatch = false; }
    }

    let searchMatch = true;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const titleMatch = task.title?.toLowerCase().includes(query);
      const descMatch = task.description?.toLowerCase().includes(query);
      const assigneeName = users.find(u => u.id === task.assigneeId)?.name?.toLowerCase() || '';
      const assigneeMatch = assigneeName.includes(query);
      if (!titleMatch && !descMatch && !assigneeMatch) searchMatch = false;
    }

    return statusMatch && dateMatch && searchMatch;
  });

  // ── MOBILE RENDER ───────────────────────────────────────────
  if (isMobile) {

    const tabs = [
      { key: 'my_active',         label: 'My Tasks' },
      ...(isAdmin ? [{ key: 'team_active', label: 'Team' }] : []),
      { key: 'recent_completions', label: 'History' },
    ];

    let currentList = activeTab === 'my_active' ? myActiveTasks
      : activeTab === 'team_active' ? teamActiveTasks
      : recentCompletions;

    const isHistory = activeTab === 'recent_completions';

    const getTimerColor = (task) => {
      if (task.isLate) return '#FF3B30';
      if (task.remainingMs != null && task.remainingMs < 10 * 60 * 1000) return '#FF9500';
      return '#34C759';
    };

    const getCardClass = (task) => {
      if (task.isLate) return 'mob-countdown overdue';
      if (task.remainingMs != null && task.remainingMs < 10 * 60 * 1000) return 'mob-countdown warning';
      return 'mob-countdown';
    };

    return (
      <div className="mob-page" style={{ paddingBottom: 0 }}>

        {/* ── Segmented Control ───────────────────────── */}
        <div className="mob-segment">
          {tabs.map(t => (
            <button key={t.key} className={`mob-seg-btn ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(t.key); setCurrentPage(1); }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto', paddingBottom:120, display:'flex', flexDirection:'column', gap:14 }}>
          {currentList.length === 0 ? (
            <div className="mob-empty">
              <div className="mob-empty__icon">
                <Timer size={36} color="#8E8E93" />
              </div>
              <p className="mob-empty__title">
                {isHistory ? 'No History' : 'No Active Tasks'}
              </p>
              <p className="mob-empty__sub">
                {isHistory ? 'Completed tasks appear here.' : 'No countdown tasks running.'}
              </p>
            </div>
          ) : currentList.map(task => {
            const assigneeName = users.find(u => u.id === task.assigneeId)?.name || 'Unassigned';
            
            if (!isHistory) {
              return (
                <CountdownCard
                  key={task.id}
                  task={task}
                  onDone={() => openCompletionModal(task, 'done')}
                  onFailed={() => openCompletionModal(task, 'failed')}
                  isMine={activeTab === 'my_active'}
                  user={users.find(u => u.id === task.assigneeId)}
                  onDelete={() => deleteTask(task.id, task.title)}
                  onAddExtraTime={(mins) => addExtraTime(task, mins)}
                  durationStr={getDurationString(task)}
                  isMobile={true}
                />
              );
            }

            const timerColor = '#34C759';
            const cardClass = 'mob-countdown';
            const timerStr = task.completedAt ? '✓ Done' : 'Ended';

            return (
              <div key={task.id} className={cardClass}>
                <div className="mob-countdown__top">
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="mob-countdown__title">
                      {task.customName || task.taskName || task.title || 'Untitled Task'}
                    </div>
                    <div style={{ fontSize:13, color:'#8E8E93', marginTop:3 }}>
                      {isAdmin && assigneeName !== 'Unassigned' ? `👤 ${assigneeName}` : `📋 ${task.status || 'Active'}`}
                    </div>
                  </div>
                  <span className={`mob-pill ${task.status === 'done' ? 'mob-pill--green' : 'mob-pill--red'}`} style={{ flexShrink:0 }}>
                    {task.status === 'done' ? 'Done' : 'Failed'}
                  </span>
                </div>
                {task.completionNotes && (
                  <div style={{ fontSize:15, color:'#3C3C43', lineHeight:1.4, padding:'0 2px' }}>
                    {task.completionNotes}
                  </div>
                )}
              </div>
            );
          })}
        </div>



        {/* ── Completion Bottom Sheet ─────────────────── */}
        {completingTask && (
          <>
            <div className="mob-overlay" onClick={() => { setCompletingTask(null); setCompletionNotes(''); }} />
            <div className="mob-sheet">
              <div className="mob-sheet__nav">
                <button className="mob-sheet__cancel" onClick={() => { setCompletingTask(null); setCompletionNotes(''); }}>Cancel</button>
                <span className="mob-sheet__title">
                  {completionStatus === 'done' ? '✅ Mark Done' : '❌ Mark Failed'}
                </span>
                <div style={{ minWidth:60 }} />
              </div>
              <div className="mob-sheet__body">
                <div style={{ padding:'16px 16px 0' }}>
                  <h3 style={{ margin:'0 0 4px', fontSize:20, fontWeight:700 }}>
                    {completingTask.customName || completingTask.taskName || 'Task'}
                  </h3>
                  <p style={{ margin:'0 0 16px', fontSize:15, color:'#8E8E93' }}>
                    Add notes for this {completionStatus === 'done' ? 'completion' : 'failure'}
                  </p>
                </div>
                <p className="mob-sec-hdr" style={{ paddingTop:0 }}>Notes (optional)</p>
                <div className="mob-form-group" style={{ marginBottom:0 }}>
                  <textarea className="mob-form-textarea" placeholder="Describe what happened..."
                    value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} />
                </div>
                <div className="mob-spacer-lg" />
              </div>
              <div className="mob-sheet__footer">
                <button onClick={handleFinalSubmit}
                  className={`mob-btn ${completionStatus === 'done' ? 'mob-btn--green' : 'mob-btn--red'}`}>
                  Confirm {completionStatus === 'done' ? 'Done' : 'Failed'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Create Task Bottom Sheet (Admin) ─────────── */}
        {mobileCreateOpen && isAdmin && (
          <>
            <div className="mob-overlay" onClick={() => setMobileCreateOpen(false)} />
            <div className="mob-sheet">
              <div className="mob-sheet__nav">
                <button className="mob-sheet__cancel" onClick={() => setMobileCreateOpen(false)}>Cancel</button>
                <span className="mob-sheet__title">New Instant Task</span>
                <button className="mob-sheet__confirm" onClick={(e) => { handleAssignInstantTask(e); setMobileCreateOpen(false); }}>Create</button>
              </div>
              <div className="mob-sheet__body">
                <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Task Details</p>
                <div className="mob-form-group">
                  <div className="mob-form-row">
                    <span className="mob-form-label">Assign to</span>
                    <select className="mob-form-select"
                      value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                      <option value="">— Select member —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="mob-form-row">
                    <span className="mob-form-label">Task</span>
                    <input className="mob-form-input" placeholder="Task name"
                      value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
                  </div>
                  <div className="mob-form-row">
                    <span className="mob-form-label">Duration</span>
                    <input className="mob-form-input" type="number" min="1" placeholder="Minutes"
                      value={durationValue} onChange={e => setDurationValue(e.target.value)} />
                  </div>
                </div>
                <p className="mob-sec-hdr">Description (optional)</p>
                <div className="mob-form-group" style={{ marginBottom:0 }}>
                  <textarea className="mob-form-textarea" placeholder="Task instructions..."
                    value={taskDescription} onChange={e => setTaskDescription(e.target.value)} />
                </div>
                <div className="mob-spacer-lg" />
              </div>
              <div className="mob-sheet__footer">
                <button className="mob-btn mob-btn--orange" onClick={(e) => { handleAssignInstantTask(e); setMobileCreateOpen(false); }}>
                  <Play size={20} /> Launch Task
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <style>{`
        @keyframes slideDownFadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(8px); }
        }
        @keyframes modalPopIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulseLowTime {
          0% { transform: scale(1); color: #f59e0b; }
          50% { transform: scale(1.05); color: #d97706; }
          100% { transform: scale(1); color: #f59e0b; }
        }
        @keyframes flashLate {
          0% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 20px 60px rgba(239,68,68,0.2); }
          50% { border-color: rgba(239, 68, 68, 0.8); box-shadow: 0 0 40px rgba(239, 68, 68, 0.4); }
          100% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 20px 60px rgba(239,68,68,0.2); }
        }
        @keyframes timerPulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animated-inline-form {
          animation: slideDownFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top;
        }
        .animated-overlay {
          animation: modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animated-modal {
          animation: modalPopIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: 'var(--color-deep-orange)', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px' }}>
            <Timer size={28} /> Instant Work Engine
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '14px', fontWeight: 500 }}>Real-time countdown tasks requiring immediate action.</p>
        </div>

        {isAdmin && !isLaunchFormVisible && (
          <button
            onClick={() => { setEditingTaskId(null); setTaskTitle(''); setTaskDescription(''); setAssigneeId(''); setTimeType('duration'); setDurationValue(15); setDurationUnit('minutes'); setDeadlineDate(''); setIsLaunchFormVisible(true); }}
            style={{ background: 'linear-gradient(135deg, var(--color-deep-orange) 0%, #d84315 100%)', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '50px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(216, 67, 21, 0.3)', transition: 'transform 0.1s' }}
          >
            <Play size={18} /> Launch Instant Work
          </button>
        )}
      </div>

      {/* INLINE LAUNCH FORM (Replaces the overlay modal) */}
      {isLaunchFormVisible && isAdmin && (
        <div className="animated-inline-form matte-3d" style={{ background: 'linear-gradient(135deg, var(--color-deep-orange) 0%, #d84315 100%)', borderRadius: '40px', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '24px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 20px 40px rgba(216, 67, 21, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={22} color="white" /> {editingTaskId ? 'Edit Instant Task' : 'Launch New Work'}
            </h2>
            <button onClick={closeLaunchForm} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleAssignInstantTask} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Task Objective</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="e.g., Update client dashboard"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px', marginTop: '8px', outline: 'none', fontSize: '15px', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Assign To</label>
                <select
                  required
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px', marginTop: '8px', outline: 'none', fontSize: '15px', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                >
                  <option value="" style={{ color: 'black' }}>Select Member...</option>
                  {users.filter(u => u.status !== 'Resigned').map(u => <option key={u.id} value={u.id} style={{ color: 'black' }}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Detailed Instructions (Optional)</label>
              <textarea
                value={taskDescription}
                onChange={e => setTaskDescription(e.target.value)}
                placeholder="Provide specific details about what needs to be done..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '16px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px', marginTop: '8px', outline: 'none', fontSize: '15px', background: 'rgba(255,255,255,0.1)', color: 'white', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '12px', display: 'block' }}>Time Limit Strategy</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>
                      <input type="radio" checked={timeType === 'duration'} onChange={() => setTimeType('duration')} style={{ width: '18px', height: '18px', accentColor: 'white' }} />
                      Fixed Duration (e.g. Hours/Days)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>
                      <input type="radio" checked={timeType === 'deadline'} onChange={() => setTimeType('deadline')} style={{ width: '18px', height: '18px', accentColor: 'white' }} />
                      Specific Deadline Time (e.g. July 16, 1 PM)
                    </label>
                  </div>
                </div>

                <div style={{ flex: 1.5, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '24px' }}>
                  {timeType === 'duration' ? (
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Set Duration</label>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <input
                          type="number"
                          required
                          min="1"
                          value={durationValue}
                          onChange={e => setDurationValue(e.target.value)}
                          style={{ flex: 1, padding: '12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', outline: 'none', fontSize: '15px', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                        />
                        <select
                          value={durationUnit}
                          onChange={e => setDurationUnit(e.target.value)}
                          style={{ flex: 1.5, padding: '12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', outline: 'none', fontSize: '15px', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                        >
                          <option value="minutes" style={{ color: 'black' }}>Minutes</option>
                          <option value="hours" style={{ color: 'black' }}>Hours</option>
                          <option value="days" style={{ color: 'black' }}>Days</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Set Exact Deadline</label>
                      <input
                        type="datetime-local"
                        required
                        value={deadlineDate}
                        onChange={e => setDeadlineDate(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', marginTop: '8px', outline: 'none', fontSize: '15px', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={closeLaunchForm}
                style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '50px', cursor: 'pointer', fontWeight: 700, fontSize: '15px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '14px 40px', background: 'white', color: 'var(--color-deep-orange)', border: 'none', borderRadius: '50px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)' }}
              >
                {loading ? 'Saving...' : (editingTaskId ? 'SAVE CHANGES' : 'LAUNCH WORK')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel" style={{ display: 'flex', gap: '8px', padding: '12px', borderRadius: '20px', background: 'white' }}>
        <button onClick={() => setActiveTab('my_active')} style={{ flex: 1, padding: '12px', borderRadius: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === 'my_active' ? 'linear-gradient(135deg, #0b57d0, #1a73e8)' : 'transparent', color: activeTab === 'my_active' ? 'white' : 'var(--text-secondary)' }}>My Countdowns</button>
        {isAdmin && (
          <button onClick={() => setActiveTab('team_active')} style={{ flex: 1, padding: '12px', borderRadius: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === 'team_active' ? 'linear-gradient(135deg, var(--color-deep-orange), #d84315)' : 'transparent', color: activeTab === 'team_active' ? 'white' : 'var(--text-secondary)' }}>Team Countdowns</button>
        )}
        <button onClick={() => setActiveTab('recent_completions')} style={{ flex: 1, padding: '12px', borderRadius: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === 'recent_completions' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent', color: activeTab === 'recent_completions' ? 'white' : 'var(--text-secondary)' }}>Recent Completions</button>
        <button onClick={() => setActiveTab('full_status')} style={{ flex: 1, padding: '12px', borderRadius: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === 'full_status' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'transparent', color: activeTab === 'full_status' ? 'white' : 'var(--text-secondary)' }}><List size={18} /> Status Log</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* TAB: MY ACTIVE */}
        {activeTab === 'my_active' && (
          <div className="matte-3d-inset" style={{ padding: '24px', borderRadius: '24px', background: 'white', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {myActiveTasks.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', border: '2px dashed var(--glass-border)', borderRadius: '16px', fontSize: '18px', fontWeight: 600 }}>
                No instant tasks assigned to you right now. Relax!
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {getPaginatedData(myActiveTasks).map(task => (
                    <CountdownCard key={task.id} task={task} onDone={() => openCompletionModal(task, 'done')} onFailed={() => openCompletionModal(task, 'failed')} isMine={true} durationStr={getDurationString(task)} />
                  ))}
                </div>
                <Pagination currentPage={currentPage} totalItems={myActiveTasks.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
              </>
            )}
          </div>
        )}

        {/* TAB: TEAM ACTIVE */}
        {activeTab === 'team_active' && isAdmin && (
          <div className="matte-3d" style={{ padding: '24px', borderRadius: '24px', background: 'white', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {teamActiveTasks.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '18px', fontWeight: 600 }}>No active team countdowns at the moment.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {getPaginatedData(teamActiveTasks).map(task => (
                    <CountdownCard key={task.id} task={task} user={users.find(u => u.id === task.assigneeId)} isMine={false} onDelete={() => deleteTask(task.id, task.title)} onAddExtraTime={(mins) => addExtraTime(task, mins)} durationStr={getDurationString(task)} />
                  ))}
                </div>
                <Pagination currentPage={currentPage} totalItems={teamActiveTasks.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
              </>
            )}
          </div>
        )}

        {/* TAB: RECENT COMPLETIONS */}
        {activeTab === 'recent_completions' && (
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px', background: 'white', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recentCompletions.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '18px', fontWeight: 600 }}>No recent completions found.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
                  {getPaginatedData(recentCompletions).map(task => (
                    <div key={task.id} style={{ display: 'flex', flexDirection: 'column', padding: '20px', background: 'var(--bg-matte)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '16px' }}>{task.title}</span>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Assigned to: {users.find(u => u.id === task.assigneeId)?.name || 'Unknown'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          {task.status === 'done' && <span style={{ color: '#10b981', fontWeight: 700, fontSize: '13px', background: 'rgba(16,185,129,0.1)', padding: '6px 12px', borderRadius: '8px' }}>✓ Completed</span>}
                          {task.status === 'failed' && <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '13px', background: 'rgba(239,68,68,0.1)', padding: '6px 12px', borderRadius: '8px' }}>✕ Failed / Late</span>}
                          {task.status === 'pending_edit' && <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '13px', background: 'rgba(245,158,11,0.1)', padding: '6px 12px', borderRadius: '8px' }}>⏳ Edit Pending</span>}

                          <div style={{ display: 'flex', gap: '8px' }}>
                            {!isAdmin && task.assigneeId === currentUser?.uid && task.status !== 'pending_edit' && (
                              <button onClick={() => handleRequestEdit(task)} style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid #f59e0b', background: 'transparent', color: '#f59e0b', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Request Edit</button>
                            )}
                            {isAdmin && <button onClick={() => undoTask(task.id)} style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--color-ocean-blue)', background: 'transparent', color: 'var(--color-ocean-blue)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Restart</button>}
                            {isAdmin && <button onClick={() => deleteTask(task.id, task.title)} style={{ fontSize: '11px', padding: '4px 8px', border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Delete</button>}
                          </div>
                        </div>
                      </div>

                      {(task.description || task.submissionNotes) ? (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
                          <button
                            onClick={() => setViewDetailsTask(task)}
                            style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'var(--color-ocean-blue)', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}
                          >
                            View Details
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          No additional details provided.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Pagination currentPage={currentPage} totalItems={recentCompletions.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
              </>
            )}
          </div>
        )}

        {/* TAB: FULL STATUS LOG (Paginated Table) */}
        {activeTab === 'full_status' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '16px', borderRadius: '16px' }} className="matte-3d">
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
                {['Total', 'Pending', 'Done', 'Missed'].map(tab => (
                  <button key={tab} onClick={() => { setStatusTab(tab); setCurrentPage(1); }} style={{ background: statusTab === tab ? 'var(--color-ocean-blue)' : 'transparent', color: statusTab === tab ? 'white' : 'var(--text-primary)', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{tab}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search tasks, names..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', width: '200px' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--glass-border)', paddingLeft: '16px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date:</span>
                  <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                  {dateFilter && <button onClick={() => { setDateFilter(''); setCurrentPage(1); }} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Clear</button>}
                </div>
              </div>
            </div>

            <div className="matte-3d-inset" style={{ borderRadius: '24px', overflowX: 'auto', background: 'white' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead style={{ background: 'var(--bg-matte)' }}>
                  <tr>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, width: '40px' }}><input type="checkbox" onChange={(e) => setSelectedTaskIds(e.target.checked ? getPaginatedData(filteredStatusTasks).map(t=>t.id) : [])} checked={getPaginatedData(filteredStatusTasks).length > 0 && selectedTaskIds.length === getPaginatedData(filteredStatusTasks).length} style={{cursor:'pointer'}} /></th>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>INSTANT TASK</th>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>ASSIGNEE</th>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>DURATION</th>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>CREATED AT</th>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>STATUS</th>
                    {isAdmin && <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>ACTIONS</th>}
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedData(filteredStatusTasks).length === 0 ? (
                    <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No records found.</td></tr>
                  ) : getPaginatedData(filteredStatusTasks).map((task, idx) => {
                    const assignee = users.find(u => u.id === task.assigneeId);

                    let isLate = false;
                    if (task.status === 'running') {
                      if (Date.now() > task.startTime + (task.durationMinutes * 60 * 1000)) {
                        isLate = true;
                      }
                    }

                    let statusBadge;
                    if (task.status === 'done') statusBadge = <span style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }}>Completed</span>;
                    else if (task.status === 'failed') statusBadge = <span style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>Failed</span>;
                    else if (isLate) statusBadge = <span style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>Late (Time Up)</span>;
                    else statusBadge = <span style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(0,102,204,0.1)', color: 'var(--color-ocean-blue)', fontWeight: 600 }}>Running</span>;

                    return (
                      <React.Fragment key={task.id}>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', background: selectedTaskIds.includes(task.id) ? 'rgba(0,102,204,0.03)' : 'transparent', transition: 'background 0.2s' }}>
                          <td data-label="" style={{ padding: '16px', verticalAlign: 'top' }} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedTaskIds.includes(task.id)} onClick={(e) => toggleSelect(task.id, idx, e, getPaginatedData(filteredStatusTasks))} onChange={()=>{}} style={{cursor:'pointer'}}/></td>
                          <td data-label="Task" style={{ padding: '16px', fontSize: '14px', fontWeight: 600, verticalAlign: 'top' }}>
                            {editingField.id === task.id && editingField.field === 'title' ? (
                              <input type="text" autoFocus value={editingField.value} onChange={e => setEditingField({...editingField, value: e.target.value})} onBlur={handleInlineSave} onKeyDown={handleInlineKeyDown} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--color-ocean-blue)', outline: 'none', fontSize: '14px', fontWeight: 600, width: '100%' }} />
                            ) : (
                              <div onClick={() => setEditingField({id: task.id, field: 'title', value: task.title})} style={{ cursor: 'text', borderBottom: '1px dashed transparent', display: 'inline-block' }} onMouseOver={e=>e.currentTarget.style.borderBottom='1px dashed var(--glass-border)'} onMouseOut={e=>e.currentTarget.style.borderBottom='1px dashed transparent'} title="Click to edit title">{task.title}</div>
                            )}
                            <div style={{ marginTop: '6px' }}>
                              {(!task.description && !task.submissionNotes) ? (
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, fontStyle: 'italic' }}>No additional details</span>
                              ) : (
                                <button onClick={() => setViewDetailsTask(task)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-ocean-blue)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  View Details
                                </button>
                              )}
                            </div>
                          </td>
                          <td data-label="Assignee" style={{ padding: '16px', fontSize: '13px', verticalAlign: 'top' }}>
                            {assignee ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-deep-orange)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600 }}>{(assignee.name || '?').charAt(0).toUpperCase()}</div><span>{assignee.name || 'Unknown'}</span></div>
                            ) : <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Unknown</span>}
                          </td>
                          <td data-label="Duration" style={{ padding: '16px', fontSize: '13px', fontWeight: 600, verticalAlign: 'top' }}>{getDurationString(task)}</td>
                          <td data-label="Created" style={{ padding: '16px', fontSize: '13px', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                            {(() => {
                              try { return task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'; }
                              catch (e) { return 'Invalid Date'; }
                            })()}
                          </td>
                          <td data-label="Status" style={{ padding: '16px', fontSize: '13px', verticalAlign: 'top' }}>
                            {editingField.id === task.id && editingField.field === 'status' ? (
                              <select autoFocus value={editingField.value} onChange={e => setEditingField({...editingField, value: e.target.value})} onBlur={handleInlineSave} onKeyDown={handleInlineKeyDown} style={{ padding: '4px', borderRadius: '6px', border: '1px solid var(--color-ocean-blue)', outline: 'none', fontSize: '12px' }}>
                                <option value="running">Running</option>
                                <option value="done">Done</option>
                                <option value="failed">Failed</option>
                              </select>
                            ) : (
                              <div onClick={() => setEditingField({id: task.id, field: 'status', value: task.status})} style={{ cursor: 'pointer', border: '1px dashed transparent', display: 'inline-block' }} onMouseOver={e=>e.currentTarget.style.border='1px dashed var(--glass-border)'} onMouseOut={e=>e.currentTarget.style.border='1px dashed transparent'} title="Click to edit status">{statusBadge}</div>
                            )}
                          </td>
                          {isAdmin && (
                            <td data-label="Actions" style={{ padding: '16px', display: 'flex', gap: '8px', verticalAlign: 'top' }}>
                              <button onClick={() => handleEditClick(task)} style={{ background: 'none', border: 'none', color: 'var(--color-ocean-blue)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Edit</button>
                              <button onClick={() => deleteTask(task.id, task.title)} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Delete</button>
                            </td>
                          )}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination currentPage={currentPage} totalItems={filteredStatusTasks.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
          </div>
        )}
      </div>

      {/* COMPLETION MODAL */}
      {completingTask && (
        <div className="animated-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animated-modal matte-3d" style={{ background: 'white', borderRadius: '24px', width: '500px', maxWidth: '90vw', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', borderTop: `8px solid ${completionStatus === 'done' ? '#10b981' : '#ef4444'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {completionStatus === 'done' ? <CheckCircle size={24} color="#10b981" /> : <AlertTriangle size={24} color="#ef4444" />}
                {completionStatus === 'done' ? 'Complete Task' : 'Fail Task'}
              </h2>
              <button onClick={() => setCompletingTask(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={24} />
              </button>
            </div>

            <div>
              <h3 style={{ fontSize: '16px', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{completingTask.title}</h3>
              {completingTask.description && (
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 16px 0', background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <Linkify text={completingTask.description} />
                </p>
              )}
            </div>

            <form onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Provide Completion Details / Reason</label>
                <textarea
                  required
                  value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                  placeholder={completionStatus === 'done' ? "Summarize what you did, paste links to the work, etc..." : "Provide a reason why this task failed or was not completed on time..."}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '16px', border: '1px solid var(--glass-border)', borderRadius: '12px', marginTop: '8px', outline: 'none', fontSize: '15px', background: 'rgba(0,0,0,0.02)', resize: 'vertical', minHeight: '120px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setCompletingTask(null)}
                  style={{ padding: '14px 24px', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '14px 32px', background: completionStatus === 'done' ? '#10b981' : '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', boxShadow: `0 8px 16px ${completionStatus === 'done' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}
                >
                  {loading ? 'Saving...' : (completionStatus === 'done' ? 'Submit & Mark Done' : 'Submit Failure')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS POPUP SIDE DRAWER */}
      <SideDrawer 
        isOpen={!!viewDetailsTask}
        onClose={() => setViewDetailsTask(null)}
        title="Task Details"
        width="550px"
      >
        {viewDetailsTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: 'var(--text-primary)', fontWeight: 800 }}>{viewDetailsTask.title}</h3>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Assigned to: {users.find(u => u.id === viewDetailsTask.assigneeId)?.name || 'Unknown'}</span>
            </div>

            {viewDetailsTask.description && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Instructions</span>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <Linkify text={viewDetailsTask.description} />
                </div>
              </div>
            )}

            {viewDetailsTask.submissionNotes && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-ocean-blue)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completion Response</span>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', background: 'rgba(11,87,208,0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(11,87,208,0.1)' }}>
                  <Linkify text={viewDetailsTask.submissionNotes} />
                </div>
              </div>
            )}
          </div>
        )}
      </SideDrawer>

    </div>
  );
};

const CountdownCard = ({ task, onDone, onFailed, isMine, user, onDelete, onAddExtraTime, durationStr, isMobile }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLate, setIsLate] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const targetTime = task.startTime + (task.durationMinutes * 60 * 1000);
    const totalMs = task.durationMinutes * 60 * 1000;
    let rafId;
    const tick = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeLeft(0); setProgress(1); setIsLate(true);
      } else {
        setTimeLeft(diff);
        // progress is the fraction of time ELAPSED. Clamped between 0 and 1.
        const elapsedFraction = Math.max(0, Math.min(1, 1 - (diff / totalMs)));
        setProgress(elapsedFraction);
        setIsLate(false);
        rafId = requestAnimationFrame(tick);
      }
    };
    tick();
    return () => cancelAnimationFrame(rafId);
  }, [task]);

  const d = Math.floor(timeLeft / 86400000);
  const h = Math.floor((timeLeft % 86400000) / 3600000);
  const m = Math.floor((timeLeft % 3600000) / 60000);
  const s = Math.floor((timeLeft % 60000) / 1000);
  const isLow = !isLate && progress > 0.80;

  const color = isLate ? '#ef4444' : isLow ? '#f59e0b' : '#6366f1';
  const glowColor = isLate ? 'rgba(239,68,68,0.25)' : isLow ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.25)';

  // DigitBlock renders one unit (e.g. "07" + "MIN")
  const DigitBlock = ({ val, label, big }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        background: 'rgba(255,255,255,0.08)', border: `1px solid ${color}35`,
        borderRadius: big ? '12px' : '8px',
        padding: big ? (isMobile ? '8px 10px' : '10px 12px') : '5px 7px',
        fontFamily: '"Courier New",monospace', fontWeight: 900,
        fontSize: big ? (isMobile ? '24px' : '30px') : '16px', color,
        lineHeight: 1, minWidth: big ? (isMobile ? '46px' : '56px') : '32px', textAlign: 'center',
        textShadow: `0 0 18px ${color}90`,
        boxShadow: `0 0 12px ${color}20, inset 0 1px 0 rgba(255,255,255,0.08)`,
        animation: isLow && big ? 'timerPulse 1s ease-in-out infinite' : 'none',
      }}>{String(val).padStart(2, '0')}</div>
      <span style={{ fontSize: '8px', fontWeight: 900, color: 'rgba(255,255,255,0.3)', marginTop: '5px', letterSpacing: '1.5px' }}>{label}</span>
    </div>
  );

  const Sep = ({ big }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: big ? '8px' : '5px', paddingBottom: big ? '16px' : '9px' }}>
      <div style={{ width: big ? '5px' : '3px', height: big ? '5px' : '3px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      <div style={{ width: big ? '5px' : '3px', height: big ? '5px' : '3px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
    </div>
  );

  const DigitalClock = ({ big }) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: big ? (isMobile ? '4px' : '6px') : '4px' }}>
      {d > 0 && <><DigitBlock val={d} label="DAYS" big={big} /><Sep big={big} /></>}
      {(h > 0 || d > 0) && <><DigitBlock val={h} label="HRS" big={big} /><Sep big={big} /></>}
      <DigitBlock val={m} label="MIN" big={big} />
      <Sep big={big} />
      <DigitBlock val={s} label="SEC" big={big} />
    </div>
  );

  const R = 52, C = 2 * Math.PI * R;
  // progress is elapsed fraction. 
  // We want full circle (offset=0) when progress=0.
  // We want empty circle (offset=C) when progress=1.
  const offset = C * progress;

  const darkCard = {
    borderRadius: '24px', overflow: 'hidden', position: 'relative',
    background: isLate
      ? 'linear-gradient(145deg,#120404 0%,#1e0808 100%)'
      : isLow
        ? 'linear-gradient(145deg,#130f00 0%,#1e1600 100%)'
        : 'linear-gradient(145deg,#07071a 0%,#0f0f2e 100%)',
    border: `1px solid ${color}40`,
    boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${color}15`,
    animation: isLate ? 'flashLate 2s infinite' : 'none',
  };

  if (isMine) {
    return (
      <div style={{ ...darkCard, padding: isMobile ? '20px 16px' : '28px 32px' }}>
        {/* ambient glow */}
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '280px', height: '280px', borderRadius: '50%', background: glowColor, filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', position: 'relative', zIndex: 1 }}>
          <span style={{ padding: '4px 14px', background: `${color}20`, color, border: `1px solid ${color}30`, borderRadius: '50px', fontSize: '11px', fontWeight: 900, letterSpacing: '1px' }}>
            {isLate ? '🔴 OVERDUE' : isLow ? '⚠️ URGENT' : '🎯 YOUR MISSION'}
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{durationStr}</span>
        </div>

        {/* Title */}
        <h4 style={{ margin: '0 0 14px 0', fontSize: isMobile ? '18px' : '22px', color: '#fff', fontWeight: 800, letterSpacing: '-0.3px', position: 'relative', zIndex: 1 }}>{task.title}</h4>

        {/* Description */}
        {task.description && (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '12px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.6', marginBottom: '24px', position: 'relative', zIndex: 1 }}>
            <Linkify text={task.description} />
          </div>
        )}

        {/* Clock + Ring + Buttons row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '16px' : '28px', flexWrap: 'wrap', position: 'relative', zIndex: 1, justifyContent: isMobile ? 'center' : 'flex-start' }}>

          {/* SVG Ring — strictly 130x130 box, no overflow */}
          <div style={{ width: isMobile ? '100px' : '130px', height: isMobile ? '100px' : '130px', flexShrink: 0, position: 'relative' }}>
            <svg width={isMobile ? "100" : "130"} height={isMobile ? "100" : "130"} viewBox="0 0 130 130" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
              <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
              <circle cx="65" cy="65" r={R} fill="none" stroke={color} strokeWidth="10"
                strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 12px ${color})`, transition: 'stroke 0.5s' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '15px', fontWeight: 900, color, textShadow: `0 0 16px ${color}` }}>
                {isLate ? 'OVER' : `${Math.round((1 - progress) * 100)}%`}
              </span>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginTop: '2px' }}>remaining</span>
            </div>
          </div>

          {/* Digital clock */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <DigitalClock big={true} />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
            <button onClick={onDone}
              style={{ flex: isMobile ? 1 : 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', padding: '13px 24px', borderRadius: '50px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(16,185,129,0.4)', whiteSpace: 'nowrap' }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
              <CheckCircle size={16} /> DONE
            </button>
            {isLate && (
              <button onClick={onFailed}
                style={{ flex: isMobile ? 1 : 'none', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', padding: '13px 24px', borderRadius: '50px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(239,68,68,0.4)', whiteSpace: 'nowrap' }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                <AlertTriangle size={16} /> FAIL
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === COMPACT TEAM CARD ===
  const SR = 26, SC = 2 * Math.PI * SR;
  const sOff = SC * progress;
  return (
    <div style={{ ...darkCard, padding: '20px' }}>
      <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '130px', height: '130px', borderRadius: '50%', background: glowColor, filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg,${color},${color}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: `0 4px 12px ${glowColor}` }}>
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>{user?.name || 'Unknown'}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{durationStr}</div>
          </div>
        </div>

        {/* Compact ring — strictly 64Ã—64 */}
        <div style={{ width: '64px', height: '64px', flexShrink: 0, position: 'relative' }}>
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
            <circle cx="32" cy="32" r={SR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx="32" cy="32" r={SR} fill="none" stroke={color} strokeWidth="6"
              strokeDasharray={SC} strokeDashoffset={sOff} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 900, color, textShadow: `0 0 8px ${color}` }}>
              {Math.round((1 - progress) * 100)}%
            </span>
          </div>
        </div>
      </div>

      <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#fff', position: 'relative', zIndex: 1 }}>{task.title}</h5>

      <div style={{ position: 'relative', zIndex: 1, marginBottom: '14px' }}>
        <DigitalClock big={false} />
      </div>

      <div style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 1 }}>
        <button onClick={() => onAddExtraTime(5)} style={{ flex: 1, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '8px', borderRadius: '50px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+5 Min</button>
        <button onClick={onDelete} style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', padding: '8px', borderRadius: '50px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
      </div>
    </div>
  );
};

export default InstantWork;
