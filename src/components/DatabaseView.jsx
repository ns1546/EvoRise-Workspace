import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Database, Download, FileJson, Table2, Users, Briefcase, ListTodo, Activity, Megaphone, ChevronRight } from 'lucide-react';
import Pagination from './Pagination';
import { useIsMobile } from '../hooks/useIsMobile';

const DatabaseView = () => {
  const { userData } = useAuth();
  const isMobile = useIsMobile();
  const isAdmin = ['Admin', 'Administrator', 'Partner'].includes(userData?.role);
  
  const [activeTab, setActiveTab] = useState('users');
  const [data, setData] = useState({
    users: [],
    clients: [],
    tasks: [],
    notices: [],
    activity_logs: []
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (!isAdmin) return;
    
    const unsubUsers = onSnapshot(collection(db, 'users'), s => setData(p => ({...p, users: s.docs.map(d => ({id: d.id, ...d.data()}))})));
    const unsubClients = onSnapshot(collection(db, 'clients'), s => setData(p => ({...p, clients: s.docs.map(d => ({id: d.id, ...d.data()}))})));
    const unsubTasks = onSnapshot(collection(db, 'tasks'), s => setData(p => ({...p, tasks: s.docs.map(d => ({id: d.id, ...d.data()}))})));
    const unsubNotices = onSnapshot(collection(db, 'notices'), s => setData(p => ({...p, notices: s.docs.map(d => ({id: d.id, ...d.data()}))})));
    const unsubLogs = onSnapshot(query(collection(db, 'activity_logs'), limit(1000)), s => setData(p => ({...p, activity_logs: s.docs.map(d => ({id: d.id, ...d.data()}))})));

    return () => { unsubUsers(); unsubClients(); unsubTasks(); unsubNotices(); unsubLogs(); };
  }, [isAdmin]);

  const convertToCSV = (arr) => {
    if (!arr || !arr.length) return '';
    const keys = Array.from(new Set(arr.flatMap(obj => Object.keys(obj))));
    const csvContent = [
      keys.join(','),
      ...arr.map(obj => keys.map(k => {
        let val = obj[k];
        if (typeof val === 'object' && val !== null) {
          if (val.seconds) val = new Date(val.seconds * 1000).toISOString();
          else val = JSON.stringify(val);
        }
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(','))
    ].join('\n');
    return csvContent;
  };

  const downloadFile = (content, fileName, type = 'text/csv') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const csv = convertToCSV(data[activeTab]);
    downloadFile(csv, `Evorise_${activeTab}_export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(data[activeTab], null, 2);
    downloadFile(json, `Evorise_${activeTab}_export_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  if (!isAdmin) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Access Restricted.</div>;

  const currentData = data[activeTab] || [];
  const paginatedData = currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const allKeys = Array.from(new Set(currentData.flatMap(obj => Object.keys(obj)))).filter(k => k !== 'password' && k !== 'passwordHash');

  const TABS = [
    { id: 'users', label: 'Users', icon: <Users size={16}/> },
    { id: 'clients', label: 'Clients', icon: <Briefcase size={16}/> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo size={16}/> },
    { id: 'notices', label: 'Notices', icon: <Megaphone size={16}/> },
    { id: 'activity_logs', label: 'Logs', icon: <Activity size={16}/> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: isMobile ? '12px' : '20px', padding: isMobile ? '16px' : '0' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-start', flexShrink: 0, gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #4f46e5, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(79,70,229,0.3)' }}>
            <Database size={24} color="white"/>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>System Database</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>View, inspect, and export all core system collections securely.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExportCSV} disabled={currentData.length===0} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'white', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '12px', fontWeight: 600, cursor: currentData.length===0 ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Table2 size={16}/> Export CSV
          </button>
          <button onClick={handleExportJSON} disabled={currentData.length===0} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: currentData.length===0 ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(0,102,204,0.3)' }}>
            <FileJson size={16}/> Export JSON
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: isMobile ? 'wrap' : 'nowrap', background: isMobile ? 'transparent' : 'white', padding: isMobile ? '0' : '12px', borderRadius: '16px', border: isMobile ? 'none' : '1px solid var(--glass-border)', flexShrink: 0, overflowX: isMobile ? 'auto' : 'visible' }}>
        {TABS.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: isMobile ? '8px 12px' : '10px 20px', 
              background: activeTab === tab.id ? (isMobile ? 'white' : 'var(--bg-matte)') : (isMobile ? '#e3e3e8' : 'transparent'),
              color: activeTab === tab.id ? (isMobile ? 'var(--color-ocean-blue)' : 'var(--text-primary)') : 'var(--text-secondary)',
              border: isMobile ? 'none' : `1px solid ${activeTab === tab.id ? 'var(--glass-border)' : 'transparent'}`,
              borderRadius: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            {tab.icon} {tab.label}
            {!isMobile && (
              <span style={{ background: activeTab === tab.id ? 'white' : 'rgba(0,0,0,0.05)', color: activeTab === tab.id ? 'var(--color-ocean-blue)' : 'var(--text-secondary)', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, border: activeTab === tab.id ? '1px solid var(--glass-border)' : 'none' }}>
                {data[tab.id]?.length || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className={isMobile ? "" : "matte-3d-inset"} style={{ flex: isMobile ? 'none' : 1, background: 'white', borderRadius: isMobile ? '16px' : '24px', border: isMobile ? 'none' : '1px solid var(--glass-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', background: 'var(--bg-matte)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Raw Data: {TABS.find(t=>t.id===activeTab)?.label}</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Showing top {currentData.length} documents</span>
        </div>
        
        <div style={isMobile ? {} : { flex: 1, overflow: 'auto' }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {currentData.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Database size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                  <div>No data found in this collection.</div>
                </div>
              ) : (
                paginatedData.map((row, idx) => {
                  const mainKey = allKeys[0] || 'id';
                  const subKey = allKeys[1];
                  const tertiaryKey = allKeys[2];
                  
                  const getSafeVal = (val) => {
                    if (val === undefined || val === null) return '-';
                    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                    if (typeof val === 'object') {
                      if (val.seconds) return new Date(val.seconds * 1000).toLocaleString();
                      return JSON.stringify(val).substring(0, 50) + (JSON.stringify(val).length > 50 ? '...' : '');
                    }
                    return String(val);
                  };
                  
                  return (
                    <div 
                      key={row.id || idx} 
                      onClick={() => setSelectedRecord(row)} 
                      style={{ padding: '16px', borderBottom: '1px solid #E5E5EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'white' }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#000000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
                          {getSafeVal(row[mainKey])}
                        </div>
                        {subKey && (
                          <div style={{ fontSize: '14px', color: '#666666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ fontWeight: 600, marginRight: '4px' }}>{subKey}:</span>
                            {getSafeVal(row[subKey])}
                          </div>
                        )}
                        {tertiaryKey && (
                          <div style={{ fontSize: '12px', color: '#8E8E93', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                            <span style={{ fontWeight: 600, marginRight: '4px' }}>{tertiaryKey}:</span>
                            {getSafeVal(row[tertiaryKey])}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={20} color="#C6C6C8" style={{ flexShrink: 0, marginLeft: '12px' }}/>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <tr>
                  {allKeys.map(key => (
                    <th key={key} style={{ padding: '12px 20px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.length === 0 ? (
                  <tr>
                    <td colSpan={allKeys.length || 1} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Database size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                      <div>No data found in this collection.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, idx) => (
                    <tr key={row.id || idx} onClick={() => setSelectedRecord(row)} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.1s', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='var(--bg-matte)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                      {allKeys.map(key => {
                        let val = row[key];
                        if (val === undefined || val === null) val = '-';
                        else if (typeof val === 'boolean') val = val ? 'TRUE' : 'FALSE';
                        else if (typeof val === 'object') {
                          if (val.seconds) val = new Date(val.seconds * 1000).toLocaleString();
                          else val = JSON.stringify(val).substring(0, 50) + (JSON.stringify(val).length > 50 ? '...' : '');
                        }
                        
                        return (
                          <td key={key} style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-primary)', borderRight: '1px solid var(--glass-border)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {currentData.length > 0 && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--glass-border)', background: 'white' }}>
            <Pagination 
              currentPage={currentPage}
              totalItems={currentData.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </div>
        )}
      </div>

      {selectedRecord && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className={isMobile ? "" : "matte-3d"} style={{ width: isMobile ? '100%' : '600px', maxHeight: isMobile ? '90vh' : '80vh', background: 'white', borderRadius: isMobile ? '24px 24px 0 0' : '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-matte)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={20} color="var(--color-ocean-blue)"/> Record Details</h3>
              <button onClick={() => setSelectedRecord(null)} style={{ background: 'white', border: '1px solid var(--glass-border)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <pre style={{ margin: 0, padding: '16px', background: '#1e293b', color: '#e2e8f0', borderRadius: '12px', fontSize: '13px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                {JSON.stringify(selectedRecord, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DatabaseView;
