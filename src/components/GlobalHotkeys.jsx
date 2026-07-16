import React, { useState, useEffect } from 'react';
import { Keyboard, X, LayoutDashboard, Target, Briefcase, FileText, CheckSquare, MessageCircle, Command, Plus } from 'lucide-react';

const GlobalHotkeys = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      // '?' or 'Shift + ?' to open cheat sheet
      if (e.key === '?') {
        e.preventDefault();
        setIsOpen(true);
      }
      
      // ESC to close cheat sheet
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }

      // Quick Navigation Hotkeys (using Shift + Key)
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        let targetMenu = null;

        switch (key) {
          case 'd': targetMenu = 'dashboard'; break;
          case 'm': targetMenu = 'myday'; break;
          case 'e': targetMenu = 'evoboard'; break;
          case 'n': targetMenu = 'evonotes'; break;
          case 'c': targetMenu = 'clients'; break;
          case 'w': targetMenu = 'whatsapp'; break;
          case 'i': targetMenu = 'instant'; break;
          default: break;
        }

        if (targetMenu) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: targetMenu } }));
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Cmd/Ctrl + K', desc: 'Open Command Palette', icon: <Command size={14} /> },
    { key: 'C', desc: 'Quick Create Task', icon: <Plus size={14} /> },
    { key: 'Shift + D', desc: 'Go to Dashboard', icon: <LayoutDashboard size={14} /> },
    { key: 'Shift + M', desc: 'Go to My Day', icon: <Target size={14} /> },
    { key: 'Shift + E', desc: 'Go to EvoBoard', icon: <Briefcase size={14} /> },
    { key: 'Shift + I', desc: 'Go to Instant Work', icon: <CheckSquare size={14} /> },
    { key: 'Shift + N', desc: 'Go to Evo Notes', icon: <FileText size={14} /> },
    { key: 'Shift + C', desc: 'Go to Clients', icon: <Briefcase size={14} /> },
    { key: 'Shift + W', desc: 'Go to Chat', icon: <MessageCircle size={14} /> },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setIsOpen(false)}>
      <div 
        className="matte-3d" 
        style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-matte, white)', borderRadius: '24px', overflow: 'hidden', animation: 'float-in 0.3s cubic-bezier(0.22,1,0.36,1) forwards', border: '1px solid var(--border-light)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(42,159,175,0.05), rgba(0,96,223,0.05))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--grad-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 12px var(--blue-glow)' }}>
              <Keyboard size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Keyboard Shortcuts</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Work faster in Evorise OS</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={16}/>
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
          {shortcuts.map((sc, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'white', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--blue)' }}>{sc.icon}</span>
                {sc.desc}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {sc.key.split(' + ').map((k, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <span style={{ color: 'var(--text-hint)', fontSize: '12px', alignSelf: 'center', margin: '0 2px' }}>+</span>}
                    <kbd style={{ background: 'rgba(0,0,0,0.04)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {k}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ padding: '12px 24px', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border-light)', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Press <kbd style={{ background: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>?</kbd> anytime to open this menu
        </div>
      </div>
    </div>
  );
};

export default GlobalHotkeys;
