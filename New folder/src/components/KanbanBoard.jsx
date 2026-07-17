import React, { useState } from 'react';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { Plus, MoreHorizontal, Clock, User, CheckCircle } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import '../index.css';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'var(--text-secondary)' },
  { id: 'inprogress', title: 'In Progress', color: 'var(--color-ocean-blue)' },
  { id: 'done', title: 'Done', color: '#34d399' }
];

const KanbanBoard = () => {
  const { state, saveState, loading } = useGlobalState();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const isMobile = useIsMobile();

  if (loading || !state) return <div style={{ padding: '20px' }}>Loading workspace data...</div>;

  const tasks = state.tasks || [];
  const users = state.users || [];

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    if (!taskId) return;
    
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, status: columnId };
      }
      return t;
    });

    // Mirror legacy interconnectivity: log the action if moved to done
    let updatedWorkLog = [...(state.workLog || [])];
    if (columnId === 'done') {
        updatedWorkLog.push({
            id: Math.max(0, ...updatedWorkLog.map(l => l.id)) + 1,
            taskId: taskId,
            timestamp: new Date().toISOString(),
            note: 'Task marked as done via Kanban Board.'
        });
    }

    await saveState({ tasks: updatedTasks, workLog: updatedWorkLog });
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    const newTask = {
        id: Math.max(0, ...tasks.map(t => t.id)) + 1,
        title: newTaskTitle,
        status: 'todo',
        priority: 'Medium',
        createdAt: new Date().toISOString(),
        assignedTo: null,
        comments: [],
        subtasks: []
    };

    await saveState({ tasks: [...tasks, newTask] });
    setNewTaskTitle('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      
      {/* Header and Add Task */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '16px' : '0' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Project Tasks</h2>
        
        <form onSubmit={addTask} style={{ display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="New task title..." 
            className="matte-3d-inset"
            style={{ padding: '8px 16px', border: 'none', outline: 'none', fontSize: '14px', width: isMobile ? '100%' : '250px', borderRadius: '12px' }}
          />
          <button type="submit" style={{ padding: '8px 16px', borderRadius: '12px', border: 'none', background: 'var(--color-ocean-blue)', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Add Task
          </button>
        </form>
      </div>

      {/* Kanban Columns */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', flex: 1, overflowX: isMobile ? 'visible' : 'auto', paddingBottom: '12px' }}>
        {COLUMNS.map(col => (
          <div 
            key={col.id} 
            className="glass-panel"
            style={{ 
              minWidth: isMobile ? '0' : '320px', 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '20px', 
              background: 'rgba(255, 255, 255, 0.4)' // Slightly less opaque for columns
            }}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: col.color }}></div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{col.title}</h3>
                <span style={{ background: 'var(--bg-matte)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {tasks.filter(t => t.status === col.id).length}
                </span>
              </div>
              <MoreHorizontal size={18} color="var(--text-secondary)" style={{ cursor: 'pointer' }} />
            </div>

            {/* Tasks Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
              {loading && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '20px' }}>Loading tasks...</div>}
              
              {tasks.filter(t => t.status === col.id).map(task => (
                <div 
                  key={task.id}
                  className="matte-3d"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'grab', background: '#ffffff' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, lineHeight: 1.4 }}>{task.title}</h4>
                    {task.priority === 'Urgent' && (
                      <span style={{ background: 'rgba(255,87,34,0.1)', color: 'var(--color-deep-orange)', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                        URGENT
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      <Clock size={12} />
                      <span>{task.dueDate || 'No Date'}</span>
                    </div>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-matte)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e0e0e0' }}>
                      <User size={12} color="var(--text-secondary)" />
                    </div>
                  </div>
                </div>
              ))}
              
              {!loading && tasks.filter(t => t.status === col.id).length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '20px', border: '2px dashed rgba(0,0,0,0.1)', borderRadius: '12px', marginTop: '8px' }}>
                  Drag tasks here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
