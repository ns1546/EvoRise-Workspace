import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Terminal, LayoutDashboard, Users, Briefcase, CheckSquare, X, ArrowRight, Bot, Lock, Archive, Zap } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const ACTIONS = [
  { id: 'quick-create', label: 'Create New Task...', icon: <Plus size={16} />, type: 'Quick Action', action: 'quick_create' },
  { id: 'nav-dashboard', label: 'Go to Dashboard', icon: <LayoutDashboard size={16} />, type: 'Navigation', action: 'dashboard' },
  { id: 'nav-evoboard', label: 'Go to Evo Board', icon: <Briefcase size={16} />, type: 'Navigation', action: 'evoboard' },
  { id: 'nav-clients', label: 'Go to Clients', icon: <Users size={16} />, type: 'Navigation', action: 'clients' },
  { id: 'nav-instant', label: 'Go to Instant Work', icon: <CheckSquare size={16} />, type: 'Navigation', action: 'instant' },
  { id: 'nav-archive', label: 'Go to Archive Trash', icon: <Archive size={16} />, type: 'Navigation', action: 'archive' },
];

const GlobalCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('search'); // 'search' or 'create'
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Search Engine Data
  const [searchData, setSearchData] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const inputRef = useRef(null);
  const { userData } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setMode('search');
        setQuery('');
        setIsOpen(true);
      }
      
      // 'C' for Quick Create
      if (e.key.toLowerCase() === 'c' && !isOpen && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setMode('create');
        setQuery('');
        setIsOpen(true);
      }
    };
    
    const handleOpenPalette = () => {
        setMode('search');
        setQuery('');
        setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenPalette);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('open-command-palette', handleOpenPalette);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isDataLoaded) {
      const fetchData = async () => {
        try {
          const clientsSnap = await getDocs(collection(db, 'clients'));
          const clients = clientsSnap.docs.map(d => ({ id: d.id, label: `Client: ${d.data().name}`, icon: <Users size={16} />, type: 'Client', action: 'clients', payload: d.id }));
          
          const tasksSnap = await getDocs(collection(db, 'tasks'));
          const tasks = tasksSnap.docs.map(d => ({ id: d.id, label: `Task: ${d.data().title || d.data().taskName}`, icon: <CheckSquare size={16} />, type: 'Task', action: 'evoboard', payload: d.id }));
          
          const teamSnap = await getDocs(collection(db, 'users'));
          const users = teamSnap.docs.map(d => ({ id: d.id, label: `Team: ${d.data().name}`, icon: <Users size={16} />, type: 'Team', action: 'team', payload: d.id }));
          
          setSearchData([...clients, ...tasks, ...users]);
          setIsDataLoaded(true);
        } catch(e) {
          console.error("Search engine load error:", e);
        }
      };
      fetchData();
    }
  }, [isOpen, isDataLoaded]);

  // Unified Search Engine Filter
  const allActions = [...ACTIONS, ...searchData];
  const filteredActions = query 
    ? allActions.filter(a => a.label?.toLowerCase().includes(query.toLowerCase()))
    : ACTIONS;

  const handleCreateTask = async () => {
    if (!query.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'instant_work'), {
        taskName: query,
        description: 'Created via Global Quick Add',
        status: 'To Do',
        priority: 'Medium',
        assignedTo: userData?.name || auth.currentUser?.email || 'Unassigned',
        createdBy: userData?.name || 'Unknown',
        createdAt: serverTimestamp(),
      });
      setIsOpen(false);
      setQuery('');
      // Trigger a toast (optional, if your system supports it)
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: 'Task Created Quickly!', type: 'success' } }));
    } catch (err) {
      console.error("Error creating task:", err);
      alert("Failed to create task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelect = (action) => {
    if (action.action === 'quick_create') {
      setMode('create');
      setQuery('');
      setSelectedIndex(0);
      return;
    }
    window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: action.action } }));
    setIsOpen(false);
    setQuery('');
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (mode === 'create' && e.key === 'Enter') {
      e.preventDefault();
      handleCreateTask();
      return;
    }

    if (mode === 'search') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredActions.length > 0) {
        e.preventDefault();
        handleSelect(filteredActions[selectedIndex]);
      }
    }
  };

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', justifyContent: 'center', paddingTop: '15vh' }} onClick={() => setIsOpen(false)}>
      <div 
        className="matte-3d" 
        style={{ width: '600px', maxWidth: '90vw', borderRadius: '16px', overflow: 'hidden', animation: 'fade-in-up 0.2s ease-out', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', height: 'fit-content', maxHeight: '60vh' }}
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header / Input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-light)', gap: '12px' }}>
          {mode === 'search' ? (
            <Search size={22} color="var(--blue)" />
          ) : (
            <div style={{ background: 'var(--grad-teal)', borderRadius: '8px', padding: '4px', color: 'white', display: 'flex' }}>
              <Plus size={18} />
            </div>
          )}
          
          <input 
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={mode === 'create' ? "Type task name and press Enter..." : "Search commands, tasks, or jump to..."}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}
          />
          
          <div style={{ display: 'flex', gap: '6px' }}>
            <kbd style={{ background: 'rgba(0,0,0,0.06)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', border: '1px solid rgba(0,0,0,0.08)', fontWeight: 600 }}>ESC</kbd>
          </div>
        </div>

        {/* Results Area */}
        <div style={{ padding: '8px', overflowY: 'auto' }}>
          
          {mode === 'create' ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '13px', margin: 0 }}>Press <strong>Enter</strong> to instantly create this task in <strong>Instant Work</strong>.</p>
            </div>
          ) : (
            <>
              {filteredActions.length > 0 ? (
                filteredActions.map((action, idx) => (
                  <div 
                    key={action.id}
                    onClick={() => handleSelect(action)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', gap: '12px', cursor: 'pointer', transition: 'all 0.1s',
                      background: selectedIndex === idx ? 'rgba(0, 96, 223, 0.08)' : 'transparent',
                      borderLeft: selectedIndex === idx ? '3px solid var(--blue)' : '3px solid transparent'
                    }}
                  >
                    <div style={{ color: selectedIndex === idx ? 'var(--blue)' : 'var(--text-hint)' }}>
                      {action.icon}
                    </div>
                    <div style={{ flex: 1, fontSize: '14px', fontWeight: selectedIndex === idx ? 600 : 500, color: selectedIndex === idx ? 'var(--blue-deep)' : 'var(--text-primary)' }}>
                      {action.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                      {action.type}
                    </div>
                    {selectedIndex === idx && <ArrowRight size={14} color="var(--blue)" />}
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-hint)' }}>
                  No commands found.
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer Hints */}
        <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={{ background: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>↑↓</kbd> to navigate</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={{ background: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>↵</kbd> to select</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--teal-deep)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Terminal size={12} /> Evorise Command Palette
          </div>
        </div>

      </div>
    </div>
  );
};

export default GlobalCommandPalette;
