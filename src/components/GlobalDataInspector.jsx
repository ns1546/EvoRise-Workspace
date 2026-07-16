import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

const GlobalDataInspector = () => {
  const isMobile = useIsMobile();
  const [inspectData, setInspectData] = useState(null); // { title: '', type: 'tasks' | 'clients' | 'users', data: [] }
  const [inspectPage, setInspectPage] = useState(1);
  const inspectItemsPerPage = 15;

  useEffect(() => {
    const handleOpen = (e) => {
      setInspectData(e.detail);
      setInspectPage(1);
      // Push history state to intercept the back button explicitly for this modal
      window.history.pushState({ modal: 'inspector' }, '', window.location.hash || window.location.pathname);
    };
    const handleClose = () => {
      setInspectData(null);
    };
    window.addEventListener('open-data-inspector', handleOpen);
    window.addEventListener('close-modals', handleClose);
    return () => {
      window.removeEventListener('open-data-inspector', handleOpen);
      window.removeEventListener('close-modals', handleClose);
    };
  }, []);

  if (!inspectData) return null;

  const totalInspectPages = Math.ceil(inspectData.data.length / inspectItemsPerPage);
  const paginatedInspectData = inspectData.data.slice(
    (inspectPage - 1) * inspectItemsPerPage,
    inspectPage * inspectItemsPerPage
  );

  return (
    <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: isMobile ? '0' : '20px' }}>
      <div className={isMobile ? "mobile-bottom-sheet" : ""} style={isMobile ? { animation: 'fadeInUp 0.3s ease-out' } : { background: 'var(--bg-matte, white)', borderRadius: '24px', width: '100%', maxWidth: '900px', maxHeight: '90vh', height: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'fadeInUp 0.3s ease-out' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid var(--border-light)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{inspectData.title}</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Showing {inspectData.data.length} records</p>
          </div>
          <button onClick={() => setInspectData(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='rgba(239,68,68,0.1)'} onMouseOut={e=>e.currentTarget.style.background='rgba(0,0,0,0.05)'}>
            <X size={18}/>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {paginatedInspectData.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-hint)' }}>No records to show.</div>}
              
              {inspectData.type === 'tasks' && paginatedInspectData.map(task => (
                <div key={task.id} style={{ background: 'white', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{task.taskName || task.customName || task.serviceName || 'Unnamed Task'}</div>
                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.04)', fontSize: '11px', fontWeight: 700 }}>{task.status}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Priority: {task.priority || '-'}</div>
                    <button onClick={() => { 
                      setInspectData(null); 
                      window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: 'evoboard' } }));
                      setTimeout(() => window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId: task.id } })), 100);
                    }} style={{ padding: '8px 16px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Go to Board</button>
                  </div>
                </div>
              ))}

              {inspectData.type === 'clients' && paginatedInspectData.map(client => (
                <div key={client.id} style={{ background: 'white', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{client.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Contact: {client.phone || client.email || 'N/A'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Platform: {client.platform || 'General'}</div>
                    <button onClick={() => { setInspectData(null); window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: 'clients' } })); }} style={{ padding: '8px 16px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Manage Client</button>
                  </div>
                </div>
              ))}

              {inspectData.type === 'users' && paginatedInspectData.map(user => (
                <div key={user.id} style={{ background: 'white', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{user.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Email: {user.email || 'N/A'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Role: {user.role || 'Employee'}</div>
                    <button onClick={() => { setInspectData(null); window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: 'team' } })); }} style={{ padding: '8px 16px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>View Profile</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="evo-table">
                <thead>
                  {inspectData.type === 'tasks' && (
                    <tr>
                      <th>Task Name</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Action</th>
                    </tr>
                  )}
                  {inspectData.type === 'clients' && (
                    <tr>
                      <th>Client Name</th>
                      <th>Contact</th>
                      <th>Platform</th>
                      <th>Action</th>
                    </tr>
                  )}
                  {inspectData.type === 'users' && (
                    <tr>
                      <th>User Name</th>
                      <th>Role</th>
                      <th>Email</th>
                      <th>Action</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {paginatedInspectData.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-hint)' }}>No records to show.</td></tr>}
                  
                  {inspectData.type === 'tasks' && paginatedInspectData.map(task => (
                    <tr key={task.id}>
                      <td data-label="Task Name" style={{ fontWeight: 600 }}>{task.taskName || task.customName || task.serviceName || 'Unnamed Task'}</td>
                      <td data-label="Status">
                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.04)', fontSize: '12px', fontWeight: 700 }}>{task.status}</span>
                      </td>
                      <td data-label="Priority">{task.priority || '-'}</td>
                      <td data-label="Action">
                        <button onClick={() => { 
                          setInspectData(null); 
                          window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: 'evoboard' } }));
                          setTimeout(() => window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId: task.id } })), 100);
                        }} style={{ padding: '6px 12px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Go to Board</button>
                      </td>
                    </tr>
                  ))}

                  {inspectData.type === 'clients' && paginatedInspectData.map(client => (
                    <tr key={client.id}>
                      <td data-label="Client Name" style={{ fontWeight: 600 }}>{client.name}</td>
                      <td data-label="Contact">{client.phone || client.email || 'N/A'}</td>
                      <td data-label="Platform">{client.platform || 'General'}</td>
                      <td data-label="Action">
                        <button onClick={() => { setInspectData(null); window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: 'clients' } })); }} style={{ padding: '6px 12px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Manage Client</button>
                      </td>
                    </tr>
                  ))}

                  {inspectData.type === 'users' && paginatedInspectData.map(user => (
                    <tr key={user.id}>
                      <td data-label="User Name" style={{ fontWeight: 600 }}>{user.name}</td>
                      <td data-label="Role">{user.role || 'Employee'}</td>
                      <td data-label="Email">{user.email || 'N/A'}</td>
                      <td data-label="Action">
                        <button onClick={() => { setInspectData(null); window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: 'team' } })); }} style={{ padding: '6px 12px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>View Profile</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Pagination */}
        {totalInspectPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border-light)', background: 'white', borderRadius: '0 0 24px 24px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Showing {(inspectPage - 1) * inspectItemsPerPage + 1} to {Math.min(inspectPage * inspectItemsPerPage, inspectData.data.length)} of {inspectData.data.length}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setInspectPage(p => Math.max(1, p - 1))}
                disabled={inspectPage === 1}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: inspectPage === 1 ? 'var(--bg-matte)' : 'white', cursor: inspectPage === 1 ? 'not-allowed' : 'pointer' }}
              >Previous</button>
              <button 
                onClick={() => setInspectPage(p => Math.min(totalInspectPages, p + 1))}
                disabled={inspectPage === totalInspectPages}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: inspectPage === totalInspectPages ? 'var(--bg-matte)' : 'white', cursor: inspectPage === totalInspectPages ? 'not-allowed' : 'pointer' }}
              >Next</button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default GlobalDataInspector;
