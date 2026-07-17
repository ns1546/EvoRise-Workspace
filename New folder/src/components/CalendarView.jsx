import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useActivity } from '../contexts/ActivityContext';
import { ChevronLeft, ChevronRight, Plus, CheckCircle, Calendar as CalendarIcon, X, Clock, CheckSquare, Trash2, User, Edit2, Check } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import '../index.css';

const CalendarView = () => {
  const { currentUser, userData } = useAuth();
  const { sendNotification } = useNotifications();
  const { logActivity } = useActivity();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('deadlines'); // deadlines, team_events
  
  const isAdmin = ['Admin', 'Partner', 'Administrator'].includes(userData?.role);

  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);

  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDayItems, setSelectedDayItems] = useState(null); // { dateStr, items, dayNumber }

  // Form States
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventType, setNewEventType] = useState('task'); // task, urgent, meeting, etc
  const [newEventAssignee, setNewEventAssignee] = useState('');
  const [editItemId, setEditItemId] = useState(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setUsers(data);
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setTasks(data);
    });
    
    const unsubEvents = onSnapshot(collection(db, 'events'), snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setEvents(data);
    });

    return () => { unsubUsers(); unsubTasks(); unsubEvents(); };
  }, []);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEventTitle || !newEventDate) return;
    try {
      if (editItemId) {
        if (viewMode === 'deadlines') {
          await updateDoc(doc(db, 'tasks', editItemId), {
            taskName: newEventTitle,
            dueDate: newEventDate,
            dueTime: newEventTime,
            assigneeId: newEventAssignee || currentUser.uid
          });
          sendNotification({
            title: 'Deadline Updated',
            body: `${newEventTitle} is now due on ${newEventDate} ${newEventTime}`,
            module: 'calendar',
            targetUid: newEventAssignee || 'admin',
            type: 'warning'
          });
          logActivity({ action: 'EDIT_DEADLINE', module: 'calendar', detail: `Edited deadline: ${newEventTitle}` });
        } else {
          await updateDoc(doc(db, 'events', editItemId), {
            title: newEventTitle,
            dateStr: newEventDate,
            timeStr: newEventTime,
            type: newEventType
          });
          sendNotification({
            title: 'Calendar Event Updated',
            body: `${newEventTitle} is now scheduled on ${newEventDate} ${newEventTime}`,
            module: 'calendar',
            targetUid: 'admin',
            type: 'info'
          });
          logActivity({ action: 'EDIT_EVENT', module: 'calendar', detail: `Edited event: ${newEventTitle}` });
        }
      } else {
        if (viewMode === 'deadlines') {
          // Create a basic calendar task
          await addDoc(collection(db, 'tasks'), {
            taskName: newEventTitle,
            dueDate: newEventDate,
            dueTime: newEventTime,
            assigneeId: newEventAssignee || currentUser.uid,
            status: 'Pending',
            createdBy: currentUser?.uid,
            createdAt: Date.now()
          });
          sendNotification({
            title: 'New Deadline Scheduled',
            body: `${newEventTitle} is due on ${newEventDate} ${newEventTime}`,
            module: 'calendar',
            targetUid: newEventAssignee || 'admin',
            type: 'warning'
          });
          logActivity({ action: 'CREATE_DEADLINE', module: 'calendar', detail: `Created deadline: ${newEventTitle}` });
        } else {
          await addDoc(collection(db, 'events'), {
            title: newEventTitle,
            dateStr: newEventDate,
            timeStr: newEventTime,
            type: newEventType,
            createdBy: currentUser?.uid,
            createdAt: Date.now()
          });
          sendNotification({
            title: 'New Calendar Event',
            body: `${newEventTitle} scheduled on ${newEventDate} ${newEventTime}`,
            module: 'calendar',
            targetUid: 'admin',
            type: 'info'
          });
          logActivity({ action: 'CREATE_EVENT', module: 'calendar', detail: `Created event: ${newEventTitle}` });
        }
      }

      setIsEventModalOpen(false);
      setNewEventTitle('');
      setNewEventDate('');
      setNewEventTime('');
      setNewEventAssignee('');
      setEditItemId(null);
    } catch(err) {
      console.error(err);
    }
  };

  const openEditModal = (item, type) => {
    setEditItemId(item.id);
    if (type === 'task') {
      setNewEventTitle(item.taskName || item.customName || 'Task');
      setNewEventDate(item.dueDate || '');
      setNewEventTime(item.dueTime || '');
      setNewEventAssignee(item.assigneeId || '');
    } else {
      setNewEventTitle(item.title || '');
      setNewEventDate(item.dateStr || '');
      setNewEventTime(item.timeStr || '');
      setNewEventType(item.type || 'meeting');
    }
    setIsEventModalOpen(true);
  };

  const markTaskDone = async (taskId, title, e) => {
    e.stopPropagation();
    await updateDoc(doc(db, 'tasks', taskId), { status: 'Done', completedAt: Date.now() });
    logActivity({ action: 'COMPLETE_CALENDAR_TASK', module: 'calendar', detail: `Marked task done via calendar: ${title}` });
  };

  const handleDeleteItem = async (itemId, type, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this item?')) {
      if (type === 'task') {
        await deleteDoc(doc(db, 'tasks', itemId));
        logActivity({ action: 'DELETE_CALENDAR_TASK', module: 'calendar', detail: `Deleted task ID: ${itemId}` });
      } else {
        await deleteDoc(doc(db, 'events', itemId));
        logActivity({ action: 'DELETE_CALENDAR_EVENT', module: 'calendar', detail: `Deleted event ID: ${itemId}` });
      }
      
      // Update modal state if open
      if (selectedDayItems) {
        setSelectedDayItems(prev => ({
          ...prev,
          items: prev.items.filter(item => item.id !== itemId)
        }));
      }
    }
  };

  // Calendar Engine
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const getDayItems = (dayNumber) => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(dayNumber).padStart(2, '0');
    const targetDateStr = `${y}-${m}-${d}`;
    
    if (viewMode === 'deadlines') {
      return tasks.filter(t => {
        if (!isAdmin && t.assigneeId !== currentUser?.uid) return false;
        let tDateStr = '';
        if (t.dueDate) {
           tDateStr = t.dueDate;
        } else if (t.createdAt) {
           try { tDateStr = new Date(t.createdAt).toISOString().split('T')[0]; } catch(e){}
        }
        return tDateStr === targetDateStr;
      });
    } else {
      return events.filter(ev => ev.dateStr === targetDateStr);
    }
  };

  const renderCells = () => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} style={{ padding: '8px', border: '1px solid #f1f3f4', background: '#f8f9fa', borderRadius: '12px' }}></div>);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const isToday = new Date().getDate() === i && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
      
      const dayItems = getDayItems(i);
      const displayItems = dayItems.slice(0, 3);
      const remainingCount = dayItems.length - 3;
      
      cells.push(
        <div key={i} onClick={() => setSelectedDayItems({ dayNumber: i, dateStr: `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`, items: dayItems })} style={{ padding: '10px', border: isToday ? '2px solid var(--color-ocean-blue)' : '1px solid var(--border-light)', borderRadius: '12px', minHeight: '140px', cursor: 'pointer', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: isToday ? '0 8px 24px var(--blue-glow)' : 'none', overflow: 'hidden' }} onMouseOver={e=>{e.currentTarget.style.borderColor='var(--color-ocean-blue)'; e.currentTarget.style.transform='translateY(-2px)'}} onMouseOut={e=>{e.currentTarget.style.borderColor=isToday?'var(--color-ocean-blue)':'var(--border-light)'; e.currentTarget.style.transform='translateY(0)'}}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ 
              fontSize: '13px', 
              fontWeight: isToday ? 800 : 700, 
              color: isToday ? 'var(--color-ocean-blue)' : 'var(--text-primary)',
              width: '26px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: isToday ? 'var(--blue-subtle)' : 'transparent'
            }}>{i}</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflow: 'hidden' }}>
            {displayItems.map((item, idx) => {
               if (viewMode === 'deadlines') {
                  const isDone = item.status === 'Done';
                  const title = item.customName || item.taskName || item.serviceName || 'Task';
                  return (
                    <div key={idx} style={{ fontSize: '11px', padding: '4px 6px', borderRadius: '6px', background: isDone ? 'var(--green-bg)' : 'var(--orange-subtle)', color: isDone ? 'var(--green)' : 'var(--color-deep-orange)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '4px', border: `1px solid ${isDone ? 'var(--green-border)' : 'var(--orange-glow)'}` }}>
                      {isDone ? <CheckSquare size={11}/> : <Clock size={11}/>}
                      {title}
                    </div>
                  );
               } else {
                  return (
                    <div key={idx} style={{ fontSize: '11px', padding: '4px 6px', borderRadius: '6px', background: item.type === 'urgent' ? 'var(--orange-subtle)' : 'var(--blue-subtle)', color: item.type === 'urgent' ? 'var(--color-deep-orange)' : 'var(--color-ocean-blue)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CalendarIcon size={11}/> {item.title}
                    </div>
                  );
               }
            })}
            {remainingCount > 0 && (
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-hint)', marginTop: 'auto', padding: '2px 0 0 2px' }}>
                {remainingCount} more...
              </div>
            )}
          </div>
        </div>
      );
    }
    return cells;
  };

  // ── MOBILE RENDER ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ backgroundColor: '#f2f2f7', minHeight: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', paddingBottom: '80px' }}>
        
        {/* iOS Large Title Header */}
        <div style={{ padding: '44px 16px 16px 16px', backgroundColor: '#f2f2f7', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '34px', fontWeight: 700, margin: 0, color: '#000', letterSpacing: '-0.5px' }}>
            Calendar
          </h2>
          {(isAdmin || viewMode === 'team_events') && (
            <button onClick={() => { setEditItemId(null); setNewEventTitle(''); setNewEventDate(''); setNewEventTime(''); setNewEventAssignee(''); setIsEventModalOpen(true); }} style={{ background: 'none', border: 'none', color: '#007aff', fontSize: '24px', padding: 0 }}>
              <Plus size={28} />
            </button>
          )}
        </div>

        {/* Segmented Control */}
        <div style={{ padding: '0 16px 16px 16px' }}>
          <div style={{ backgroundColor: '#e3e3e8', borderRadius: '8px', padding: '2px', display: 'flex' }}>
            <button onClick={() => setViewMode('deadlines')}
              style={{ flex: 1, padding: '6px 0', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                backgroundColor: viewMode === 'deadlines' ? 'white' : 'transparent', color: '#000', boxShadow: viewMode === 'deadlines' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              Tasks
            </button>
            <button onClick={() => setViewMode('team_events')}
              style={{ flex: 1, padding: '6px 0', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                backgroundColor: viewMode === 'team_events' ? 'white' : 'transparent', color: '#000', boxShadow: viewMode === 'team_events' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              Events
            </button>
          </div>
        </div>

        {/* Month Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 16px 16px' }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#007aff', padding: '4px' }}><ChevronLeft size={24} /></button>
          <span style={{ fontSize: '17px', fontWeight: 600, color: '#000' }}>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#007aff', padding: '4px' }}><ChevronRight size={24} /></button>
        </div>

        {/* Calendar Grid */}
        <div style={{ backgroundColor: 'white', borderTop: '0.5px solid #c6c6c8', borderBottom: '0.5px solid #c6c6c8' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '0.5px solid #e5e5ea' }}>
            {dayNames.map(day => (
              <div key={day} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#8e8e93', padding: '8px 0', textTransform: 'uppercase' }}>
                {day.charAt(0)}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} style={{ height: '50px', borderBottom: '0.5px solid #e5e5ea', borderRight: '0.5px solid #e5e5ea' }}></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isToday = new Date().getDate() === dayNum && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
              const items = getDayItems(dayNum);
              const hasItems = items.length > 0;
              return (
                <div key={dayNum} onClick={() => hasItems && setSelectedDayItems({ dayNumber: dayNum, dateStr: `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`, items })} 
                  style={{ height: '50px', borderBottom: '0.5px solid #e5e5ea', borderRight: '0.5px solid #e5e5ea', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? '#ff3b30' : 'transparent', color: isToday ? 'white' : '#000', fontSize: '15px', fontWeight: isToday ? 600 : 400 }}>
                    {dayNum}
                  </div>
                  {hasItems && (
                    <div style={{ display: 'flex', gap: '2px', position: 'absolute', bottom: '4px' }}>
                      {items.slice(0,3).map((it, idx) => (
                        <div key={idx} style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: viewMode === 'deadlines' ? (it.status === 'Done' ? '#34c759' : '#007aff') : (it.type === 'urgent' ? '#ff9500' : '#5856d6') }}></div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda Bottom Sheet */}
        {selectedDayItems && (
          <div onClick={() => setSelectedDayItems(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 800, display: 'flex', alignItems: 'flex-end' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '90vh', backgroundColor: '#f2f2f7', borderRadius: '10px 10px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f2f2f7', borderBottom: '0.5px solid #c6c6c8' }}>
                <div style={{ width: '60px' }}></div>
                <div style={{ fontSize: '17px', fontWeight: 600, color: '#000' }}>{monthNames[currentDate.getMonth()]} {selectedDayItems.dayNumber}</div>
                <button onClick={() => setSelectedDayItems(null)} style={{ width: '60px', background: 'none', border: 'none', color: '#007aff', fontSize: '17px', fontWeight: 600, padding: 0, textAlign: 'right' }}>Done</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden' }}>
                  {selectedDayItems.items.map((item, idx) => {
                    const isLast = idx === selectedDayItems.items.length - 1;
                    if (viewMode === 'deadlines') {
                      const isDone = item.status === 'Done';
                      const title = item.customName || item.taskName || item.serviceName || 'Task';
                      const assigneeName = users.find(u => u.id === item.assigneeId)?.name || 'Unassigned';
                      return (
                        <div key={idx} style={{ padding: '12px 16px', borderBottom: isLast ? 'none' : '0.5px solid #c6c6c8', display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div onClick={(e) => !isDone && markTaskDone(item.id, title, e)} style={{ width: '22px', height: '22px', borderRadius: '50%', border: isDone ? 'none' : '1.5px solid #c6c6c8', backgroundColor: isDone ? '#34c759' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isDone && <Check size={14} color="white" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '17px', color: isDone ? '#8e8e93' : '#000', textDecoration: isDone ? 'line-through' : 'none' }}>{title}</div>
                            <div style={{ fontSize: '15px', color: '#8e8e93', marginTop: '2px' }}>{item.dueTime || 'All Day'} • {assigneeName}</div>
                          </div>
                          {(isAdmin || item.createdBy === currentUser?.uid) && (
                            <button onClick={(e) => { e.stopPropagation(); openEditModal(item, 'task'); }} style={{ background: 'none', border: 'none', color: '#007aff', padding: '4px' }}>Edit</button>
                          )}
                        </div>
                      );
                    } else {
                      return (
                        <div key={idx} style={{ padding: '12px 16px', borderBottom: isLast ? 'none' : '0.5px solid #c6c6c8', display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '4px', height: '40px', borderRadius: '2px', backgroundColor: item.type === 'urgent' ? '#ff3b30' : '#007aff' }}></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '17px', color: '#000' }}>{item.title}</div>
                            <div style={{ fontSize: '15px', color: '#8e8e93', marginTop: '2px' }}>{item.timeStr || 'All Day'}</div>
                          </div>
                          {(isAdmin || item.createdBy === currentUser?.uid) && (
                            <button onClick={(e) => { e.stopPropagation(); openEditModal(item, 'event'); }} style={{ background: 'none', border: 'none', color: '#007aff', padding: '4px' }}>Edit</button>
                          )}
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Modal Bottom Sheet */}
        {isEventModalOpen && (
          <div onClick={() => setIsEventModalOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 800, display: 'flex', alignItems: 'flex-end' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '90vh', backgroundColor: '#f2f2f7', borderRadius: '10px 10px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f2f2f7', borderBottom: '0.5px solid #c6c6c8' }}>
                <button onClick={() => setIsEventModalOpen(false)} style={{ background: 'none', border: 'none', color: '#007aff', fontSize: '17px', padding: 0 }}>Cancel</button>
                <div style={{ fontSize: '17px', fontWeight: 600, color: '#000' }}>{editItemId ? 'Edit' : 'New'} {viewMode === 'deadlines' ? 'Task' : 'Event'}</div>
                <button onClick={handleAddEvent} disabled={!newEventTitle || !newEventDate} style={{ background: 'none', border: 'none', color: (!newEventTitle || !newEventDate) ? '#8e8e93' : '#007aff', fontSize: '17px', fontWeight: 600, padding: 0 }}>Save</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
                  <div style={{ padding: '4px 16px', borderBottom: '0.5px solid #c6c6c8' }}>
                    <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="Title" style={{ width: '100%', border: 'none', padding: '12px 0', fontSize: '17px', outline: 'none' }} />
                  </div>
                  <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #c6c6c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '17px', color: '#000' }}>Date</div>
                    <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', textAlign: 'right', backgroundColor: 'transparent' }} />
                  </div>
                  <div style={{ padding: '12px 16px', borderBottom: viewMode === 'team_events' || isAdmin ? '0.5px solid #c6c6c8' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '17px', color: '#000' }}>Time</div>
                    <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', textAlign: 'right', backgroundColor: 'transparent' }} />
                  </div>
                  {viewMode === 'deadlines' && isAdmin && (
                    <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '17px', color: '#000' }}>Assignee</div>
                      <select value={newEventAssignee} onChange={e => setNewEventAssignee(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', textAlign: 'right', backgroundColor: 'transparent', WebkitAppearance: 'none', dir: 'rtl' }}>
                        <option value="" disabled>Select User</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  )}
                  {viewMode === 'team_events' && (
                    <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '17px', color: '#000' }}>Type</div>
                      <select value={newEventType} onChange={e => setNewEventType(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', textAlign: 'right', backgroundColor: 'transparent', WebkitAppearance: 'none', dir: 'rtl' }}>
                        <option value="meeting">Meeting</option>
                        <option value="urgent">Urgent</option>
                        <option value="holiday">Holiday</option>
                      </select>
                    </div>
                  )}
                </div>
                {editItemId && (
                  <button onClick={(e) => { handleDeleteItem(editItemId, viewMode === 'deadlines' ? 'task' : 'event', e); setIsEventModalOpen(false); }} style={{ width: '100%', backgroundColor: 'white', color: '#ff3b30', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '17px', fontWeight: 600 }}>
                    Delete Event
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── DESKTOP RENDER ───────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', position: 'relative' }}>
      
      {/* Main Calendar Controls */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', width: '180px' }}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={prevMonth} style={{ padding: '8px', border: 'none', background: 'transparent', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(0,0,0,0.05)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}><ChevronLeft size={20} /></button>
              <button onClick={nextMonth} style={{ padding: '8px', border: 'none', background: 'transparent', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(0,0,0,0.05)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}><ChevronRight size={20} /></button>
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'var(--border-light)' }}></div>

          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.04)', padding: '4px', borderRadius: '12px' }}>
             <button onClick={() => setViewMode('deadlines')} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: viewMode === 'deadlines' ? 'white' : 'transparent', color: viewMode === 'deadlines' ? 'var(--color-ocean-blue)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', boxShadow: viewMode === 'deadlines' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
               Tasks
             </button>
             <button onClick={() => setViewMode('team_events')} style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: viewMode === 'team_events' ? 'white' : 'transparent', color: viewMode === 'team_events' ? 'var(--color-ocean-blue)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', boxShadow: viewMode === 'team_events' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
               Events
             </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {(isAdmin || viewMode === 'team_events') && (
            <button className="btn-primary" onClick={() => { setEditItemId(null); setNewEventTitle(''); setNewEventDate(''); setNewEventTime(''); setNewEventAssignee(''); setIsEventModalOpen(true); }} style={{ padding: '10px 20px', borderRadius: '24px', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> {viewMode === 'deadlines' ? 'Create Deadline' : 'Create Event'}
            </button>
          )}
        </div>
      </div>

      {/* Grid Container */}
      <div className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '16px', marginBottom: '16px' }}>
            {dayNames.map(day => (
              <div key={day} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-hint)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {day}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '16px', paddingBottom: '16px', alignContent: 'start' }}>
            {renderCells()}
          </div>
        </div>
      </div>

      {/* DAY DETAIL MODAL */}
      {selectedDayItems && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(32,33,36,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', width: '90%', maxWidth: '600px', borderRadius: '16px', position: 'relative', boxShadow: '0 24px 40px rgba(0,0,0,0.2)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-matte)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedDayItems.dayNumber} {monthNames[currentDate.getMonth()]}
                </h2>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>{selectedDayItems.items.length} scheduled items</span>
              </div>
              <button onClick={() => setSelectedDayItems(null)} style={{ background: 'transparent', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-secondary)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(0,0,0,0.05)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                <X size={24}/>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {selectedDayItems.items.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-hint)', padding: '40px 0' }}>
                  <CalendarIcon size={48} style={{ opacity: 0.2, marginBottom: '16px' }}/>
                  <p style={{ margin: 0, fontWeight: 600 }}>Nothing scheduled for this day.</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedDayItems.items.map((item, idx) => {
                   if (viewMode === 'deadlines') {
                     const isDone = item.status === 'Done';
                     const title = item.customName || item.taskName || item.serviceName || 'Task';
                     const assigneeName = users.find(u => u.id === item.assigneeId)?.name || 'Unassigned';
                     
                     return (
                       <div key={idx} className="matte-3d" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px', background: 'white' }}>
                         <div style={{ paddingTop: '2px' }}>
                           {isDone ? (
                             <CheckCircle size={24} color="var(--green)" />
                           ) : (
                             <div onClick={(e) => markTaskDone(item.id, title, e)} style={{ width: '22px', height: '22px', borderRadius: '4px', border: '2px solid var(--text-hint)', cursor: 'pointer' }} title="Mark Done"></div>
                           )}
                         </div>
                         <div style={{ flex: 1 }}>
                           <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: isDone ? 'var(--text-hint)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>{title} {item.dueTime ? `at ${item.dueTime}` : ''}</h4>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                             <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '6px' }}>
                               <User size={12}/> {assigneeName}
                             </span>
                             <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status: {item.status}</span>
                           </div>
                         </div>
                         {(isAdmin || item.createdBy === currentUser?.uid) && (
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                             <button onClick={(e) => { e.stopPropagation(); openEditModal(item, 'task'); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-ocean-blue)', cursor: 'pointer', padding: '4px' }}>
                               <Edit2 size={16}/>
                             </button>
                             <button onClick={(e) => handleDeleteItem(item.id, 'task', e)} style={{ background: 'transparent', border: 'none', color: 'var(--color-deep-orange)', cursor: 'pointer', padding: '4px' }}>
                               <Trash2 size={16}/>
                             </button>
                           </div>
                         )}
                       </div>
                     );
                   } else {
                     return (
                       <div key={idx} className="matte-3d" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderLeft: item.type === 'urgent' ? '4px solid var(--color-deep-orange)' : '4px solid var(--color-ocean-blue)', background: 'white' }}>
                         <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: item.type === 'urgent' ? 'var(--orange-subtle)' : 'var(--blue-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.type === 'urgent' ? 'var(--color-deep-orange)' : 'var(--color-ocean-blue)' }}>
                           <CalendarIcon size={20}/>
                         </div>
                         <div style={{ flex: 1 }}>
                           <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title} {item.timeStr ? `at ${item.timeStr}` : ''}</h4>
                           <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)} Event</p>
                         </div>
                         {(isAdmin || item.createdBy === currentUser?.uid) && (
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                             <button onClick={(e) => { e.stopPropagation(); openEditModal(item, 'event'); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-ocean-blue)', cursor: 'pointer', padding: '4px' }}>
                               <Edit2 size={16}/>
                             </button>
                             <button onClick={(e) => handleDeleteItem(item.id, 'event', e)} style={{ background: 'transparent', border: 'none', color: 'var(--color-deep-orange)', cursor: 'pointer', padding: '4px' }}>
                               <Trash2 size={16}/>
                             </button>
                           </div>
                         )}
                       </div>
                     );
                   }
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ITEM MODAL */}
      {isEventModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleAddEvent} className="matte-3d" style={{ background: 'white', width: '440px', borderRadius: '16px', padding: '32px', position: 'relative' }}>
            <button type="button" onClick={() => setIsEventModalOpen(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-hint)' }}>
              <X size={24}/>
            </button>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {viewMode === 'deadlines' ? <CheckSquare size={28} color="var(--color-ocean-blue)"/> : <CalendarIcon size={28} color="var(--color-ocean-blue)"/>}
              {editItemId ? (viewMode === 'deadlines' ? 'Edit Deadline' : 'Edit Event') : (viewMode === 'deadlines' ? 'New Deadline' : 'New Event')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <input 
                  type="text" 
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                  placeholder={viewMode === 'deadlines' ? "Task Title" : "Event Title"}
                  required
                  style={{ width: '100%', padding: '12px 0', border: 'none', borderBottom: '2px solid var(--color-ocean-blue)', outline: 'none', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Date</label>
                  <input 
                    type="date" 
                    value={newEventDate}
                    onChange={e => setNewEventDate(e.target.value)}
                    required
                    className="matte-3d-inset"
                    style={{ width: '100%', padding: '12px 16px', border: 'none', outline: 'none', fontSize: '14px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Time (Optional)</label>
                  <input 
                    type="time" 
                    value={newEventTime}
                    onChange={e => setNewEventTime(e.target.value)}
                    className="matte-3d-inset"
                    style={{ width: '100%', padding: '12px 16px', border: 'none', outline: 'none', fontSize: '14px' }}
                  />
                </div>
              </div>

              {viewMode === 'deadlines' && isAdmin && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Assign To</label>
                  <select 
                    value={newEventAssignee}
                    onChange={e => setNewEventAssignee(e.target.value)}
                    required
                    className="matte-3d-inset"
                    style={{ width: '100%', padding: '12px 16px', border: 'none', outline: 'none', fontSize: '14px', background: 'transparent' }}
                  >
                    <option value="" disabled>Select User</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {viewMode === 'team_events' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Event Type</label>
                  <select 
                    value={newEventType}
                    onChange={e => setNewEventType(e.target.value)}
                    className="matte-3d-inset"
                    style={{ width: '100%', padding: '12px 16px', border: 'none', outline: 'none', fontSize: '14px', background: 'transparent' }}
                  >
                    <option value="meeting">Meeting</option>
                    <option value="urgent">Urgent</option>
                    <option value="holiday">Holiday</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="submit" className="btn-primary">
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default CalendarView;
