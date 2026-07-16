import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { restoreFromTrash, permanentDelete, autoCleanTrash } from '../utils/trashService';
import { Trash2, RotateCcw, AlertTriangle, ShieldAlert, Search } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useIsMobile } from '../hooks/useIsMobile';

const ArchiveTrash = () => {
    const { userData } = useAuth();
    const isMobile = useIsMobile();
    const [trashItems, setTrashItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionItem, setActionItem] = useState(null); // { type: 'restore' | 'delete', item: {} }
    
    // Pagination and Filtering State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCollection, setFilterCollection] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredItems = trashItems.filter(item => {
        const matchesSearch = (item.data.title || item.data.name || item.data.email || item.data.taskName || item.originalId).toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCollection = filterCollection ? item.originalCollection === filterCollection : true;
        return matchesSearch && matchesCollection;
    });

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        if (userData?.role !== 'Admin' && userData?.role !== 'Partner') {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'archive_trash'), orderBy('deletedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTrashItems(items);
            setLoading(false);
            
            // Auto clean older than 30 days
            autoCleanTrash(items).catch(console.error);
        });

        return () => unsubscribe();
    }, [userData]);

    const handleAction = async () => {
        if (!actionItem) return;
        
        try {
            if (actionItem.type === 'restore') {
                await restoreFromTrash(actionItem.item.id);
            } else if (actionItem.type === 'delete') {
                await permanentDelete(actionItem.item.id);
            }
        } catch (error) {
            console.error("Failed to perform action:", error);
            alert("Error: " + error.message);
        } finally {
            setActionItem(null);
        }
    };

    if (userData?.role !== 'Admin' && userData?.role !== 'Partner') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-hint)' }}>
                <ShieldAlert size={64} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <h2>Access Denied</h2>
                <p>Only Administrators can access the System Trash.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fafbfc' }}>
            <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Trash2 size={24} color="#ef4444" /> Archive Trash
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Items are automatically deleted permanently after 30 days.</p>
                </div>
            </div>

            <div style={{ padding: '0 32px 16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px', background: 'white', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', background: 'var(--bg-matte)', padding: '10px 16px', borderRadius: '12px' }}>
                    <Search size={18} color="var(--text-secondary)" style={{ marginRight: '10px' }} />
                    <input type="text" placeholder="Search deleted items..." value={searchQuery} onChange={(e) => {setSearchQuery(e.target.value); setCurrentPage(1);}} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '100%', fontWeight: 500 }} />
                </div>
                <select value={filterCollection} onChange={(e) => {setFilterCollection(e.target.value); setCurrentPage(1);}} className="matte-3d-inset" style={{ padding: '10px 16px', border: 'none', borderRadius: '10px', fontSize: '13px', outline: 'none', fontWeight: 500, color: 'var(--text-primary)', width: isMobile ? '100%' : 'auto' }}>
                    <option value="">All Collections</option>
                    <option value="tasks">Tasks</option>
                    <option value="instant_tasks">Instant Tasks</option>
                    <option value="clients">Clients</option>
                    <option value="users">Users</option>
                    <option value="system_packages">System Packages</option>
                </select>
            </div>

            <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-hint)' }}>Loading...</div>
                ) : filteredItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-hint)' }}>
                        <Trash2 size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                        <h3>No matching items found</h3>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0' : '16px', marginBottom: '24px', background: isMobile ? 'white' : 'transparent', borderRadius: isMobile ? '16px' : '0', boxShadow: isMobile ? '0 1px 4px rgba(0,0,0,0.04)' : 'none', overflow: isMobile ? 'hidden' : 'visible' }}>
                            {paginatedItems.map((item, index) => (
                                <div key={item.id} className={isMobile ? '' : 'glass-panel'} style={{ padding: '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', borderBottom: isMobile && index < paginatedItems.length - 1 ? '1px solid var(--border-light)' : (isMobile ? 'none' : '') }}>
                                    <div style={{ marginBottom: isMobile ? '16px' : '0' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--bg-matte)', border: '1px solid var(--border-light)', fontSize: '12px', fontWeight: 700, color: 'var(--color-ocean-blue)', textTransform: 'uppercase' }}>
                                                {item.originalCollection}
                                            </span>
                                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                Deleted by <strong style={{ color: 'var(--text-primary)' }}>{item.deletedBy}</strong> on {new Date(item.deletedAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-primary)' }}>
                                            {item.data.title || item.data.name || item.data.email || item.data.taskName || `ID: ${item.originalId}`}
                                        </h4>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        <button 
                                            onClick={() => setActionItem({ type: 'restore', item })}
                                            style={{ flex: isMobile ? 1 : 'none', justifyContent: 'center', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'white', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                        >
                                            <RotateCcw size={16} /> Restore
                                        </button>
                                        <button 
                                            onClick={() => setActionItem({ type: 'delete', item })}
                                            style={{ flex: isMobile ? 1 : 'none', justifyContent: 'center', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
                                </span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: currentPage === 1 ? 'var(--bg-matte)' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                        Previous
                                    </button>
                                    <span style={{ padding: '6px 12px', fontWeight: 600 }}>Page {currentPage} of {totalPages}</span>
                                    <button 
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: currentPage === totalPages ? 'var(--bg-matte)' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {actionItem && (
                <ConfirmDeleteModal 
                    title={actionItem.type === 'restore' ? 'Restore Item?' : 'Permanently Delete?'}
                    message={actionItem.type === 'restore' ? 'This will restore the item to its original location.' : 'Are you sure? This will delete the item forever from the database.'}
                    onConfirm={handleAction}
                    onCancel={() => setActionItem(null)}
                    isDeleting={false}
                />
            )}
        </div>
    );
};

export default ArchiveTrash;
