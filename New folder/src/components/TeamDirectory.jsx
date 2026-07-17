import React, { useState, useEffect } from 'react';
import { db, secondaryAuth } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Mail, Phone, Briefcase, MapPin, Plus, Edit, Trash2, UserX, X, ChevronRight, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActivity } from '../contexts/ActivityContext';
import { useNotifications } from '../contexts/NotificationContext';
import { safeDelete } from '../utils/trashService';
import Pagination from './Pagination';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useIsMobile } from '../hooks/useIsMobile';
import '../index.css';

const TeamDirectory = () => {
  const { userData } = useAuth();
  const isMobile = useIsMobile();
  const { logActivity } = useActivity();
  const { sendNotification } = useNotifications();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEditingId, setCurrentEditingId] = useState(null);
  
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'Employee', joiningDate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check Admin
  const userRole = userData?.role || 'Employee';
  const isAdmin = userRole.toLowerCase() === 'admin' || userRole.toLowerCase() === 'administrator';

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(50);

  // Bulk Select & Inline Edit
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [editingField, setEditingField] = useState({ id: null, field: null, value: '' });

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setTeam(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Firebase read error", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handler = () => {
      openAddModal();
    };
    window.addEventListener('mobile-fab-team', handler);
    return () => window.removeEventListener('mobile-fab-team', handler);
  }, []);

  const openAddModal = () => {
    setFormData({ name: '', email: '', password: '', role: 'Employee', joiningDate: new Date().toISOString().split('T')[0] });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setFormData({ name: user.name, email: user.email, password: '', role: user.role, joiningDate: user.joiningDate || '' });
    setCurrentEditingId(user.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (isEditMode) {
        // Edit Existing User
        const userRef = doc(db, 'users', currentEditingId);
        const updates = { name: formData.name, role: formData.role, joiningDate: formData.joiningDate };
        // We do not change email/password from client-side for existing auth users here for security, only profile details.
        // Password recovery should be done via Firebase Password Reset Email.
        await updateDoc(userRef, updates);
        
        logActivity({ action: 'UPDATE_TEAM_MEMBER', module: 'team', detail: `Updated profile for team member: ${formData.name}` });
        
        alert("User profile updated successfully!");
      } else {
        // Add New User using Secondary Auth
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const newUid = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', newUid), {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          joiningDate: formData.joiningDate,
          status: 'Active'
        });
        
        // Sign out secondary auth so it doesn't conflict
        await secondaryAuth.signOut();
        
        logActivity({ action: 'CREATE_TEAM_MEMBER', module: 'team', detail: `Added new team member: ${formData.name}` });
        sendNotification({
          title: 'New Team Member',
          body: `${formData.name} has joined the workspace as a ${formData.role}.`,
          module: 'team',
          targetUid: 'admin',
          type: 'info'
        });
        
        alert("New user added successfully!");
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving user:", error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await safeDelete('users', userToDelete.id, userData);
      logActivity({ action: 'DELETE_TEAM_MEMBER', module: 'team', detail: `Moved team member profile to trash` });
    } catch (err) {
      console.error("Failed to delete", err);
    } finally {
      setIsDeletingUser(false);
      setUserToDelete(null);
    }
  };

  const handleToggleStatus = async (member) => {
    const isResigning = member.status !== 'Resigned';
    const confirmMsg = isResigning 
      ? `Are you sure you want to mark ${member.name} as Resigned? They will be locked out of the system.`
      : `Are you sure you want to resume ${member.name}'s access? They will be able to log in again.`;
      
    if (window.confirm(confirmMsg)) {
      try {
        const newStatus = isResigning ? 'Resigned' : 'Active';
        await updateDoc(doc(db, 'users', member.id), { status: newStatus });
        logActivity({ action: isResigning ? 'MARK_RESIGNED' : 'RESUME_EMPLOYEE', module: 'team', detail: `Marked team member ${member.name} as ${newStatus}` });
      } catch (err) {
        console.error("Failed to update status", err);
      }
    }
  };

  const paginatedTeam = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return team.slice(start, start + itemsPerPage);
  }, [team, currentPage, itemsPerPage]);

  const toggleSelect = (id, idx, event, dataArray) => {
    if (event && event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, idx);
      const end = Math.max(lastSelectedIndex, idx);
      const rangeIds = dataArray.slice(start, end + 1).map(t => t.id);
      
      const isSelecting = !selectedUserIds.includes(id);
      let newSelections = [...selectedUserIds];
      
      if (isSelecting) newSelections = Array.from(new Set([...newSelections, ...rangeIds]));
      else newSelections = newSelections.filter(uId => !rangeIds.includes(uId));
      
      setSelectedUserIds(newSelections);
    } else {
      if (selectedUserIds.includes(id)) setSelectedUserIds(selectedUserIds.filter(uId => uId !== id));
      else setSelectedUserIds([...selectedUserIds, id]);
    }
    setLastSelectedIndex(idx);
  };

  const handleInlineSave = async () => {
    if (!editingField.id || !editingField.field) return;
    try {
      await updateDoc(doc(db, 'users', editingField.id), { [editingField.field]: editingField.value });
      logActivity({ action: 'INLINE_EDIT_TEAM', module: 'team', detail: `Inline edited ${editingField.field}` });
    } catch (err) {
      console.error(err);
    }
    setEditingField({ id: null, field: null, value: '' });
  };

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') handleInlineSave();
    if (e.key === 'Escape') setEditingField({ id: null, field: null, value: '' });
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ MOBILE RENDER Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  if (isMobile) {
    const [mobileSelected, setMobileSelected] = React.useState(null);

    const statusColor = (s) => s === 'Active' ? '#34C759' : s === 'Resigned' ? '#FF3B30' : '#8E8E93';
    const statusPill  = (s) => s === 'Active' ? 'mob-pill--green' : 'mob-pill--red';

    return (
      <div className="mob-page" style={{ paddingBottom: 0 }}>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Team List Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div style={{ flex:1, overflowY:'auto', paddingBottom:120 }}>
          {loading && (
            <div className="mob-empty">
              <p className="mob-empty__title">Loading team...</p>
            </div>
          )}
          {!loading && team.length === 0 && (
            <div className="mob-empty">
              <div className="mob-empty__icon"><Users size={36} color="#8E8E93" /></div>
              <p className="mob-empty__title">No Members</p>
              <p className="mob-empty__sub">Add your first team member.</p>
            </div>
          )}
          {!loading && team.length > 0 && (
            <>
              <p className="mob-sec-hdr" style={{ paddingTop:12 }}>All Members ({team.length})</p>
              <div className="mob-group">
                {team.map((member, index) => (
                  <div key={member.id}
                    className="mob-task-row"
                    style={{ opacity: member.status === 'Resigned' ? 0.55 : 1 }}
                    onClick={() => setMobileSelected(member)}>

                    {/* Avatar */}
                    <div style={{
                      width:44, height:44, borderRadius:22, flexShrink:0,
                      background: member.status === 'Resigned' ? '#C7C7CC' : '#007AFF',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'white', fontWeight:700, fontSize:18, overflow:'hidden',
                    }}>
                      {member.avatar
                        ? <img src={member.avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : (member.name || 'U').charAt(0).toUpperCase()
                      }
                    </div>

                    <div className="mob-task-row__body">
                      <div className="mob-task-row__name">{member.name || 'Unnamed'}</div>
                      <div className="mob-task-row__meta">
                        {member.role || 'Employee'}
                        {member.joiningDate && ` · Joined ${member.joiningDate}`}
                      </div>
                    </div>

                    <div className="mob-task-row__trailing">
                      <span className={`mob-pill ${statusPill(member.status)}`} style={{ fontSize:11 }}>
                        {member.status || 'Active'}
                      </span>
                      {isAdmin && <span style={{ color:'#C7C7CC', fontSize:20, marginLeft:4 }}>&rsaquo;</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Admin FAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {/* Local Admin FAB removed: Replaced by App.jsx Global FAB */}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Member Detail / Edit Sheet Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {mobileSelected && isAdmin && (
          <>
            <div className="mob-overlay" onClick={() => setMobileSelected(null)} />
            <div className="mob-sheet">
              <div className="mob-sheet__nav">
                <button className="mob-sheet__cancel" onClick={() => setMobileSelected(null)}>Close</button>
                <span className="mob-sheet__title">Member</span>
                <button className="mob-sheet__confirm" onClick={() => { openEditModal(mobileSelected); setMobileSelected(null); }}>Edit</button>
              </div>
              <div className="mob-sheet__body">
                {/* Profile Hero */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 16px 16px' }}>
                  <div style={{
                    width:80, height:80, borderRadius:40,
                    background: mobileSelected.status==='Resigned'?'#C7C7CC':'#007AFF',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'white', fontWeight:700, fontSize:32, overflow:'hidden', marginBottom:12,
                  }}>
                    {mobileSelected.avatar
                      ? <img src={mobileSelected.avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : (mobileSelected.name||'U').charAt(0).toUpperCase()
                    }
                  </div>
                  <h2 style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, color:'#000' }}>{mobileSelected.name}</h2>
                  <p style={{ margin:0, fontSize:15, color:'#8E8E93' }}>{mobileSelected.role || 'Employee'}</p>
                </div>

                {/* Info rows */}
                <p className="mob-sec-hdr" style={{ paddingTop:0 }}>Profile</p>
                <div className="mob-group" style={{ marginBottom:0 }}>
                  <div className="mob-form-row">
                    <span className="mob-form-label">Email</span>
                    <span style={{ fontSize:15, color:'#3C3C43' }}>{mobileSelected.email}</span>
                  </div>
                  <div className="mob-form-row">
                    <span className="mob-form-label">Status</span>
                    <span className={`mob-pill ${statusPill(mobileSelected.status)}`}>{mobileSelected.status || 'Active'}</span>
                  </div>
                  <div className="mob-form-row" style={{ borderBottom:'none' }}>
                    <span className="mob-form-label">Joined</span>
                    <span style={{ fontSize:15, color:'#3C3C43' }}>{mobileSelected.joiningDate || 'Ã¢â‚¬â€'}</span>
                  </div>
                </div>

                <div className="mob-spacer-lg" />
              </div>

              {/* Sheet Footer Ã¢â‚¬â€ admin actions */}
              <div className="mob-sheet__footer" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button className={`mob-btn ${mobileSelected.status !== 'Resigned' ? 'mob-btn--orange' : 'mob-btn--green'}`}
                  onClick={async () => { await handleToggleStatus(mobileSelected); setMobileSelected(null); }}>
                  {mobileSelected.status !== 'Resigned' ? <><UserX size={16} style={{marginRight:6, position:'relative', top:3}}/> Mark Resigned</> : <><Plus size={16} style={{marginRight:6, position:'relative', top:3}}/> Resume Access</>}
                </button>
                <button className="mob-btn mob-btn--red"
                  onClick={() => { setUserToDelete(mobileSelected); setMobileSelected(null); }}>
                  <Trash2 size={16} style={{marginRight:6, position:'relative', top:3}}/> Delete Profile
                </button>
              </div>
            </div>
          </>
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Add/Edit Member Sheet Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {isModalOpen && (
          <>
            <div className="mob-overlay" onClick={() => setIsModalOpen(false)} />
            <div className="mob-sheet">
              <div className="mob-sheet__nav">
                <button className="mob-sheet__cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <span className="mob-sheet__title">{isEditMode ? 'Edit Member' : 'New Member'}</span>
                <button className="mob-sheet__confirm" onClick={handleFormSubmit} disabled={isSubmitting}>
                  {isSubmitting ? '...' : 'Save'}
                </button>
              </div>
              <div className="mob-sheet__body">
                <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Details</p>
                <div className="mob-form-group">
                  <div className="mob-form-row" style={{ padding:'12px 16px' }}>
                    <input className="mob-form-input" type="text" placeholder="Full Name *" required
                      value={formData.name} onChange={e => setFormData({...formData, name:e.target.value})}
                      style={{ border:'none', outline:'none', background:'transparent', fontSize:17, flex:1 }} />
                  </div>
                  <div className="mob-form-row" style={{ padding:'12px 16px' }}>
                    <input className="mob-form-input" type="email" placeholder="Email Address *" required
                      disabled={isEditMode}
                      value={formData.email} onChange={e => setFormData({...formData, email:e.target.value})}
                      style={{ border:'none', outline:'none', background:'transparent', fontSize:17, flex:1, opacity:isEditMode?0.5:1 }} />
                  </div>
                  {!isEditMode && (
                    <div className="mob-form-row" style={{ padding:'12px 16px' }}>
                      <input className="mob-form-input" type="password" placeholder="Password (min 6)" required minLength={6}
                        value={formData.password} onChange={e => setFormData({...formData, password:e.target.value})}
                        style={{ border:'none', outline:'none', background:'transparent', fontSize:17, flex:1 }} />
                    </div>
                  )}
                  <div className="mob-form-row">
                    <span className="mob-form-label">Role</span>
                    <select className="mob-form-select" value={formData.role}
                      onChange={e => setFormData({...formData, role:e.target.value})}>
                      <option>Admin</option>
                      <option>Partner</option>
                      <option>Employee</option>
                      <option>Client</option>
                    </select>
                  </div>
                  <div className="mob-form-row" style={{ borderBottom:'none' }}>
                    <span className="mob-form-label">Joining Date</span>
                    <input type="date" className="mob-form-select"
                      value={formData.joiningDate} onChange={e => setFormData({...formData, joiningDate:e.target.value})} />
                  </div>
                </div>
                <div className="mob-spacer-lg" />
              </div>
              <div className="mob-sheet__footer">
                <button className="mob-btn mob-btn--blue" onClick={handleFormSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Profile' : 'Create Account')}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Confirm Delete */}
        {userToDelete && (
          <ConfirmDeleteModal
            title={`Delete ${userToDelete.name}?`}
            message="This will remove their system access completely."
            onConfirm={handleDelete}
            onCancel={() => setUserToDelete(null)}
            isDeleting={isDeletingUser}
          />
        )}
      </div>
    );
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ DESKTOP RENDER Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Team Directory</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '14px' }}>Manage agency members, roles, and access.</p>
        </div>
        
        {isAdmin && (
          <button onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,102,204,0.3)' }}>
            <Plus size={18} /> Add User
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <p>Loading team database...</p>}
        {!loading && team.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No users found in database.</p>}
        
        {!loading && team.length > 0 && (
          <div className="table-wrapper">
            <table className="evo-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>{isAdmin && <input type="checkbox" onChange={(e) => setSelectedUserIds(e.target.checked ? paginatedTeam.map(u=>u.id) : [])} checked={paginatedTeam.length > 0 && selectedUserIds.length === paginatedTeam.length} style={{cursor:'pointer'}} />}</th>
                  <th>Profile</th>
                  <th>Contact</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedTeam.map((member, idx) => (
                  <tr key={member.id} style={{ opacity: member.status === 'Resigned' ? 0.6 : 1, background: selectedUserIds.includes(member.id) ? 'rgba(0,102,204,0.03)' : 'transparent', transition: 'background 0.2s' }}>
                    <td onClick={(e) => e.stopPropagation()}>{isAdmin && <input type="checkbox" checked={selectedUserIds.includes(member.id)} onClick={(e) => toggleSelect(member.id, idx, e, paginatedTeam)} onChange={()=>{}} style={{cursor:'pointer'}}/>}</td>
                    <td data-label="Profile">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: member.status === 'Resigned' ? '#999' : 'linear-gradient(135deg, var(--color-ocean-blue), #004488)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, overflow: 'hidden' }}>
                          {member.avatar ? (
                            <img src={member.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            member.name ? member.name.charAt(0).toUpperCase() : 'U'
                          )}
                        </div>
                        <div>
                          {editingField.id === member.id && editingField.field === 'name' ? (
                            <input type="text" autoFocus value={editingField.value} onChange={e => setEditingField({...editingField, value: e.target.value})} onBlur={handleInlineSave} onKeyDown={handleInlineKeyDown} style={{ padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-ocean-blue)', outline: 'none', fontSize: '14px', fontWeight: 600, width: '120px' }} />
                          ) : (
                            <div onClick={() => isAdmin && setEditingField({id: member.id, field: 'name', value: member.name})} style={{ fontWeight: 600, cursor: isAdmin ? 'text' : 'default', borderBottom: '1px dashed transparent', display: 'inline-block' }} onMouseOver={e=>isAdmin && (e.currentTarget.style.borderBottom='1px dashed var(--glass-border)')} onMouseOut={e=>e.currentTarget.style.borderBottom='1px dashed transparent'} title={isAdmin ? "Click to edit name" : ""}>{member.name}</div>
                          )}
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <Briefcase size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }}/>
                            {editingField.id === member.id && editingField.field === 'role' ? (
                              <select autoFocus value={editingField.value} onChange={e => setEditingField({...editingField, value: e.target.value})} onBlur={handleInlineSave} onKeyDown={handleInlineKeyDown} style={{ padding: '2px', borderRadius: '4px', border: '1px solid var(--color-ocean-blue)', outline: 'none', fontSize: '11px' }}>
                                <option>Admin</option>
                                <option>Partner</option>
                                <option>Employee</option>
                                <option>Client</option>
                              </select>
                            ) : (
                              <span onClick={() => isAdmin && setEditingField({id: member.id, field: 'role', value: member.role})} style={{ cursor: isAdmin ? 'pointer' : 'default', borderBottom: '1px dashed transparent' }} onMouseOver={e=>isAdmin && (e.currentTarget.style.borderBottom='1px dashed var(--glass-border)')} onMouseOut={e=>e.currentTarget.style.borderBottom='1px dashed transparent'} title={isAdmin ? "Click to edit role" : ""}>{member.role || 'Member'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Contact">
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}><Mail size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }}/>{member.email}</div>
                    </td>
                    <td data-label="Status">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: member.status === 'Active' ? '#34d399' : (member.status === 'Resigned' ? '#ef4444' : 'var(--text-secondary)') }}></div>
                        {member.status || 'Active'}
                      </div>
                    </td>
                    {isAdmin && (
                      <td data-label="Actions">
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button onClick={() => openEditModal(member)} title="Edit Profile" style={{ padding: '6px', border: 'none', background: 'rgba(0,102,204,0.1)', color: 'var(--color-ocean-blue)', borderRadius: '6px', cursor: 'pointer' }}><Edit size={14} /></button>
                          
                          {member.status !== 'Resigned' ? (
                            <button onClick={() => handleToggleStatus(member)} title="Mark Resigned (Lock out)" style={{ padding: '6px', border: 'none', background: 'rgba(255,152,0,0.1)', color: '#FF9800', borderRadius: '6px', cursor: 'pointer' }}><UserX size={14} /></button>
                          ) : (
                            <button onClick={() => handleToggleStatus(member)} title="Resume Employee (Restore Access)" style={{ padding: '6px', border: 'none', background: 'rgba(52,211,153,0.1)', color: '#10b981', borderRadius: '6px', cursor: 'pointer' }}><Plus size={14} /></button>
                          )}
                          
                          <button onClick={() => setUserToDelete(member)} title="Delete Profile" style={{ padding: '6px', border: 'none', background: 'rgba(244,67,54,0.1)', color: '#F44336', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && team.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={team.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className={isMobile ? "mobile-bottom-sheet" : "matte-3d"} style={{ width: isMobile ? '100%' : '400px', maxHeight: '90vh', overflowY: 'auto', background: 'white', padding: '30px', borderRadius: isMobile ? '24px 24px 0 0' : '24px', animation: 'float-in 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>{isEditMode ? 'Edit User Profile' : 'Add New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--text-secondary)" /></button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Full Name</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', outline: 'none', borderRadius: '12px' }} />
              </div>
              
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Email Address</label>
                <input type="email" required disabled={isEditMode} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', outline: 'none', borderRadius: '12px', opacity: isEditMode ? 0.5 : 1 }} />
              </div>

              {!isEditMode && (
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Initial Password</label>
                  <input type="password" required minLength={6} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', outline: 'none', borderRadius: '12px' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>System Role</label>
                  <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', outline: 'none', borderRadius: '12px', background: 'transparent' }}>
                    <option>Admin</option>
                    <option>Partner</option>
                    <option>Employee</option>
                    <option>Client</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Joining Date</label>
                  <input type="date" required value={formData.joiningDate} onChange={(e) => setFormData({...formData, joiningDate: e.target.value})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', outline: 'none', borderRadius: '12px' }} />
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} style={{ marginTop: '16px', padding: '14px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Profile' : 'Create Account')}
              </button>
            </form>
          </div>
        </div>
      )}

      {userToDelete && (
        <ConfirmDeleteModal
          title={`Delete User: ${userToDelete.name}`}
          message="Are you sure you want to delete this profile? This will remove their system access completely."
          onConfirm={handleDelete}
          onCancel={() => setUserToDelete(null)}
          isDeleting={isDeletingUser}
        />
      )}
    </div>
  );
};

export default TeamDirectory;
