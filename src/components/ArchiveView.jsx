import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Archive, RefreshCw, HardDrive, Clock, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

const ArchiveView = () => {
  const { userData } = useAuth();
  const isMobile = useIsMobile();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const userRole = userData?.role || 'Employee';
  const isAdmin = userRole.toLowerCase() === 'admin' || userRole.toLowerCase() === 'administrator';

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'archived_tasks'),
      orderBy('archivedAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setArchives(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching archives:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="matte-3d-inset" style={{ padding: '40px', textAlign: 'center' }}>
        <Archive size={48} color="var(--color-deep-orange)" style={{ marginBottom: '20px' }} />
        <h2>Archive Center (Restricted)</h2>
        <p>Only Administrators can view archived system data.</p>
      </div>
    );
  }

  const filteredArchives = archives.filter(item => 
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.assignedToName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', background: 'transparent' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? '12px' : '0' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HardDrive size={24} color="var(--color-ocean-blue)" />
            Data Archive
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: isMobile ? '13px' : 'inherit' }}>View and restore historical tasks automatically moved by the system policy.</p>
        </div>

        <div className={isMobile ? '' : 'matte-3d-inset'} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '12px', width: isMobile ? '100%' : '300px', background: isMobile ? 'white' : '', boxShadow: isMobile ? '0 1px 4px rgba(0,0,0,0.05)' : '' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search archived data..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', paddingLeft: '12px', width: '100%', fontSize: '14px', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div className={isMobile ? '' : 'matte-3d-inset'} style={{ flex: 1, borderRadius: isMobile ? '16px' : '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: isMobile ? 'white' : '', boxShadow: isMobile ? '0 1px 4px rgba(0,0,0,0.04)' : '' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)', padding: '40px' }}>
            <RefreshCw size={32} className="spin" style={{ marginBottom: '16px', color: 'var(--color-ocean-blue)' }} />
            <p>Loading deep storage...</p>
          </div>
        ) : filteredArchives.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)', padding: '40px' }}>
            <Archive size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>No archived tasks found.</p>
          </div>
        ) : isMobile ? (
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {filteredArchives.map((item, index) => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', borderBottom: index < filteredArchives.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-ocean-blue)' }}>{item.clientName || 'Internal'}</div>
                  </div>
                  <ChevronRight size={16} color="rgba(0,0,0,0.2)"/>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--color-deep-orange)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                      {item.assignedToName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span>{item.assignedToName || 'Unassigned'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table className="evo-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>TITLE / CLIENT</th>
                  <th style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>ASSIGNED TO</th>
                  <th style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>COMPLETED ON</th>
                  <th style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>ARCHIVED AT</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchives.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-ocean-blue)' }}>{item.clientName || 'Internal'}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-deep-orange)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                          {item.assignedToName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{item.assignedToName || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        <Clock size={14} />
                        {item.archivedAt ? new Date(item.archivedAt).toLocaleDateString() : 'Unknown'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchiveView;
