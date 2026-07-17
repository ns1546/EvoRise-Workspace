import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { Users, Briefcase, Plus, Target, CheckCircle, ChevronLeft, Edit, Trash2, Box, PackageOpen, Check, X, Mail, Phone, Globe, Info } from 'lucide-react';
import { useActivity } from '../contexts/ActivityContext';
import { useNotifications } from '../contexts/NotificationContext';
import { safeDelete } from '../utils/trashService';
import '../index.css';
import Pagination from './Pagination';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useIsMobile } from '../hooks/useIsMobile';

const defaultClientForm = { name: '', email: '', phone: '', website: '', details: '', durationMonths: 1, startDate: '', customFields: [] };
const defaultPackageForm = { name: '', details: '', services: [{ name: '', quantity: 1, prioritySeq: 1 }], workflows: [{ taskName: '' }] };

const ClientManagement = () => {
  const isMobile = useIsMobile();
  const [mainTab, setMainTab] = useState('clients');
  
  // Data States
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const { logActivity } = useActivity();
  const { sendNotification } = useNotifications();
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // Bulk Select & Inline Edit
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [editingField, setEditingField] = useState({ id: null, field: null, value: '' });

  useEffect(() => {
    setCurrentPage(1);
    setLastSelectedIndex(null);
  }, [mainTab]);

  useEffect(() => {
    const handler = () => {
      if (mainTab === 'clients') {
        setClientForm(defaultClientForm);
        setEditingClientId(null);
        setIsClientModalOpen(true);
      } else {
        setPackageForm(defaultPackageForm);
        setEditingPackageId(null);
        setIsPackageModalOpen(true);
      }
    };
    window.addEventListener('mobile-fab-clients', handler);
    return () => window.removeEventListener('mobile-fab-clients', handler);
  }, [mainTab]);
  
  const [clientServices, setClientServices] = useState([]);
  const [clientWorkflows, setClientWorkflows] = useState([]);

  // Modal States
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [isAssignPackageModalOpen, setIsAssignPackageModalOpen] = useState(false);

  // Edit Tracking
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState(null);

  // Deletion State
  const [clientToDelete, setClientToDelete] = useState(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  // Form States
  const [clientForm, setClientForm] = useState(defaultClientForm);
  const [packageForm, setPackageForm] = useState(defaultPackageForm);
  
  const [serviceForms, setServiceForms] = useState([{ name: '', quantity: 1, prioritySeq: 1 }]);
  const [workflowForms, setWorkflowForms] = useState([{ taskName: '' }]);
  
  const [selectedPackageToAssign, setSelectedPackageToAssign] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch Data
  useEffect(() => {
    const unsubClients = onSnapshot(query(collection(db, 'clients')), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setClients(data);
    });
    const unsubPackages = onSnapshot(query(collection(db, 'system_packages')), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setPackages(data);
    });
    return () => { unsubClients(); unsubPackages(); };
  }, []);

  useEffect(() => {
    if (!activeClient) return;
    const unsubServices = onSnapshot(query(collection(db, `clients/${activeClient.id}/services`)), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.prioritySeq - b.prioritySeq);
      setClientServices(data);
    });
    const unsubWorkflows = onSnapshot(query(collection(db, `clients/${activeClient.id}/workflows`)), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setClientWorkflows(data);
    });
    return () => { unsubServices(); unsubWorkflows(); };
  }, [activeClient]);

  const paginatedClients = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return clients.slice(start, start + itemsPerPage);
  }, [clients, currentPage, itemsPerPage]);

  const paginatedPackages = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return packages.slice(start, start + itemsPerPage);
  }, [packages, currentPage, itemsPerPage]);

  const toggleSelect = (id, idx, event, dataArray) => {
    if (event && event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, idx);
      const end = Math.max(lastSelectedIndex, idx);
      const rangeIds = dataArray.slice(start, end + 1).map(t => t.id);
      
      const isSelecting = !selectedClientIds.includes(id);
      let newSelections = [...selectedClientIds];
      
      if (isSelecting) newSelections = Array.from(new Set([...newSelections, ...rangeIds]));
      else newSelections = newSelections.filter(cId => !rangeIds.includes(cId));
      
      setSelectedClientIds(newSelections);
    } else {
      if (selectedClientIds.includes(id)) setSelectedClientIds(selectedClientIds.filter(cId => cId !== id));
      else setSelectedClientIds([...selectedClientIds, id]);
    }
    setLastSelectedIndex(idx);
  };

  const handleInlineSave = async () => {
    if (!editingField.id || !editingField.field) return;
    try {
      await updateDoc(doc(db, 'clients', editingField.id), { [editingField.field]: editingField.value });
      logActivity({ action: 'INLINE_EDIT_CLIENT', module: 'clients', detail: `Inline edited ${editingField.field}` });
    } catch (err) {
      console.error(err);
    }
    setEditingField({ id: null, field: null, value: '' });
  };

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') handleInlineSave();
    if (e.key === 'Escape') setEditingField({ id: null, field: null, value: '' });
  };

  // --- CLIENT MANAGEMENT ---
  const handleSaveClient = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanedClient = {
        ...clientForm,
        customFields: (clientForm.customFields || []).filter(f => f.label.trim() !== '' && f.value.trim() !== '')
      };
      if (editingClientId) {
        await updateDoc(doc(db, 'clients', editingClientId), cleanedClient);
        if (activeClient && activeClient.id === editingClientId) setActiveClient({ ...activeClient, ...cleanedClient });
        logActivity({ action: 'UPDATE_CLIENT', module: 'clients', detail: `Updated client: ${cleanedClient.name}` });
      } else {
        await addDoc(collection(db, 'clients'), { ...cleanedClient, status: 'Active', createdAt: new Date().toISOString() });
        logActivity({ action: 'CREATE_CLIENT', module: 'clients', detail: `Created client: ${cleanedClient.name}` });
        sendNotification({
          title: 'New Client Created',
          body: `${cleanedClient.name} was added to the system.`,
          module: 'clients',
          targetUid: 'admin',
          type: 'success'
        });
      }
      setIsClientModalOpen(false);
    } catch (err) {}
    setLoading(false);
  };

  const toggleClientStatus = async (client) => {
    const newStatus = client.status === 'Active' ? 'Dead' : 'Active';
    if (newStatus === 'Dead' && !window.confirm("Archive this client?")) return;
    await updateDoc(doc(db, 'clients', client.id), { status: newStatus });
    if (activeClient && activeClient.id === client.id) setActiveClient({ ...activeClient, status: newStatus });
    logActivity({ action: 'TOGGLE_CLIENT_STATUS', module: 'clients', detail: `Changed status of client ${client.name} to ${newStatus}` });
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    setIsDeletingClient(true);
    try {
      const taskQuery = query(collection(db, 'tasks'), where('clientId', '==', clientToDelete.id));
      const taskSnapshot = await getDocs(taskQuery);
      
      const batch = writeBatch(db);
      batch.delete(doc(db, 'clients', clientToDelete.id));
      taskSnapshot.forEach(taskDoc => {
        batch.delete(doc(db, 'tasks', taskDoc.id));
      });
      
      await batch.commit();
      
      setActiveClient(null);
      logActivity({ action: 'DELETE_CLIENT', module: 'clients', detail: `Deleted client and associated tasks: ${clientToDelete.name}` });
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingClient(false);
      setClientToDelete(null);
    }
  };

  // --- PACKAGE MANAGEMENT ---
  const handleSavePackage = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanedPackage = {
        ...packageForm,
        services: packageForm.services.filter(s => s.name.trim() !== ''),
        workflows: packageForm.workflows.filter(w => w.taskName.trim() !== '')
      };
      if (editingPackageId) {
        await updateDoc(doc(db, 'system_packages', editingPackageId), cleanedPackage);
        logActivity({ action: 'UPDATE_PACKAGE', module: 'clients', detail: `Updated package: ${cleanedPackage.name}` });
      } else {
        await addDoc(collection(db, 'system_packages'), cleanedPackage);
        logActivity({ action: 'CREATE_PACKAGE', module: 'clients', detail: `Created package: ${cleanedPackage.name}` });
        sendNotification({
          title: 'New Package Created',
          body: `Package "${cleanedPackage.name}" is now available.`,
          module: 'clients',
          targetUid: 'admin',
          type: 'info'
        });
      }
      setIsPackageModalOpen(false);
    } catch (err) {}
    setLoading(false);
  };

  const handleDeletePackage = async (id) => {
    if (window.confirm("Move this agency package to Archive Trash?")) await safeDelete('system_packages', id, userData);
  };

  const handleApplyPackageToClient = async (e) => {
    e.preventDefault();
    if (!selectedPackageToAssign) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const pkg = packages.find(p => p.id === selectedPackageToAssign);
      if (pkg.services) {
        pkg.services.forEach(svc => {
          const svcRef = doc(collection(db, `clients/${activeClient.id}/services`));
          batch.set(svcRef, { name: svc.name, quantity: svc.quantity, prioritySeq: svc.prioritySeq });
          // ENGINE MERGE: Generate sequence-wise tasks for this service
          for(let i = 0; i < svc.quantity; i++) {
            const taskRef = doc(collection(db, 'tasks'));
            batch.set(taskRef, {
              type: 'service_task',
              clientId: activeClient.id,
              clientName: activeClient.name,
              serviceId: svcRef.id,
              serviceName: svc.name,
              sequence: i + 1,
              status: 'To Do',
              assigneeId: null,
              priority: 'Medium',
              createdAt: Date.now()
            });
          }
        });
      }
      if (pkg.workflows) {
        pkg.workflows.forEach(wf => {
          const wfRef = doc(collection(db, `clients/${activeClient.id}/workflows`));
          batch.set(wfRef, { taskName: wf.taskName, isDone: false });
          // ENGINE MERGE: Add to global tasks as workflow_task
          const taskRef = doc(collection(db, 'tasks'));
          batch.set(taskRef, {
            type: 'workflow_task',
            clientId: activeClient.id,
            clientName: activeClient.name,
            workflowId: wfRef.id,
            taskName: wf.taskName,
            status: 'To Do',
            assigneeId: null,
            priority: 'Low',
            createdAt: Date.now()
          });
        });
      }
      await batch.commit();
      
      logActivity({ action: 'APPLY_PACKAGE', module: 'clients', detail: `Applied package ${pkg.name} to client ${activeClient.name}` });
      sendNotification({
        title: 'Package Applied',
        body: `Package "${pkg.name}" was applied to client "${activeClient.name}".`,
        module: 'clients',
        targetUid: 'admin',
        type: 'info'
      });
      
      setIsAssignPackageModalOpen(false);
      setSelectedPackageToAssign(null);
    } catch(err) {}
    setLoading(false);
  };

  // --- CUSTOM SERVICES (BULK & EDIT) ---
  const handleSaveCustomService = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingServiceId) {
        await updateDoc(doc(db, `clients/${activeClient.id}/services`, editingServiceId), serviceForms[0]);
      } else {
        const batch = writeBatch(db);
        const validServices = serviceForms.filter(s => s.name.trim() !== '');
        validServices.forEach((svc, idx) => {
          const docRef = doc(collection(db, `clients/${activeClient.id}/services`));
          
          const parsedQty = parseInt(svc.quantity, 10);
          const loopCount = isNaN(parsedQty) || parsedQty <= 0 ? 1 : parsedQty;

          batch.set(docRef, { name: svc.name, quantity: svc.quantity, prioritySeq: idx + 1 });
          // ENGINE MERGE: Generate tasks sequence-wise
          for(let i = 0; i < loopCount; i++) {
            const taskRef = doc(collection(db, 'tasks'));
            batch.set(taskRef, {
              type: 'service_task',
              clientId: activeClient.id,
              clientName: activeClient.name,
              serviceId: docRef.id,
              serviceName: svc.name,
              sequence: i + 1,
              status: 'To Do',
              assigneeId: null,
              priority: 'Medium',
              createdAt: Date.now()
            });
          }
        });
        await batch.commit();
      }
      setIsServiceModalOpen(false);
    } catch (err) {}
    setLoading(false);
  };

  // --- CUSTOM WORKFLOWS (BULK & EDIT) ---
  const handleSaveCustomWorkflow = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingWorkflowId) {
        await updateDoc(doc(db, `clients/${activeClient.id}/workflows`, editingWorkflowId), { taskName: workflowForms[0].taskName });
      } else {
        const batch = writeBatch(db);
        const validWorkflows = workflowForms.filter(w => w.taskName.trim() !== '');
        validWorkflows.forEach(wf => {
          const docRef = doc(collection(db, `clients/${activeClient.id}/workflows`));
          batch.set(docRef, { taskName: wf.taskName, isDone: false });
          // ENGINE MERGE: Also send to global tasks
          const taskRef = doc(collection(db, 'tasks'));
          batch.set(taskRef, {
            type: 'workflow_task',
            clientId: activeClient.id,
            clientName: activeClient.name,
            workflowId: docRef.id,
            taskName: wf.taskName,
            status: 'To Do',
            assigneeId: null,
            priority: 'Low',
            createdAt: Date.now()
          });
        });
        await batch.commit();
      }
      setIsWorkflowModalOpen(false);
    } catch (err) {}
    setLoading(false);
  };


  // --- RENDERING VIEWS ---
  if (!isMobile && activeClient) {
    const completedWorkflows = clientWorkflows.filter(w => w.isDone).length;
    const progressPercent = clientWorkflows.length === 0 ? 0 : Math.round((completedWorkflows / clientWorkflows.length) * 100);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '24px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-matte)', padding: '24px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <button onClick={() => setActiveClient(null)} style={{ background: 'white', border: 'none', padding: '8px', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}><ChevronLeft size={20} /></button>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0' }}>{activeClient.name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Started: {activeClient.startDate}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>•</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Duration: {activeClient.durationMonths} Mo.</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>•</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: activeClient.status === 'Active' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', color: activeClient.status === 'Active' ? '#10b981' : '#ef4444' }}>{activeClient.status}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto', marginTop: isMobile ? '16px' : '0' }}>
              <button onClick={() => { setIsAssignPackageModalOpen(true); setSelectedPackageToAssign(null); }} style={{ background: 'var(--color-ocean-blue)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,102,204,0.3)' }}><PackageOpen size={16} /> Import Package</button>
              <button onClick={() => { setClientForm({...defaultClientForm, ...activeClient, customFields: activeClient.customFields || []}); setEditingClientId(activeClient.id); setIsClientModalOpen(true); }} style={{ background: 'transparent', border: '1px solid var(--color-ocean-blue)', color: 'var(--color-ocean-blue)', padding: '10px 16px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}><Edit size={16} /> Edit Client</button>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
             {activeClient.email && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}><Mail size={16} color="var(--text-secondary)"/> {activeClient.email}</div>}
             {activeClient.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}><Phone size={16} color="var(--text-secondary)"/> {activeClient.phone}</div>}
             {activeClient.website && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}><Globe size={16} color="var(--text-secondary)"/> <a href={activeClient.website.startsWith('http') ? activeClient.website : `https://${activeClient.website}`} target="_blank" rel="noreferrer" style={{color: 'var(--color-ocean-blue)'}}>{activeClient.website}</a></div>}
             {activeClient.customFields && activeClient.customFields.map((field, idx) => (
               <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}><Info size={16} color="var(--text-secondary)"/> <strong>{field.label}:</strong> {field.value}</div>
             ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', flex: 1, minHeight: isMobile ? 'auto' : 0 }}>
          {/* Services */}
          <div className="matte-3d-inset" style={{ flex: 1, padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Briefcase size={18} color="var(--color-deep-orange)"/> Assigned Services</h3>
              <button onClick={() => { setServiceForms([{name:'', quantity:1, prioritySeq:1}]); setEditingServiceId(null); setIsServiceModalOpen(true); }} style={{ background: 'var(--color-deep-orange)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>+ Custom Service</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {clientServices.map(service => (
                <div key={service.id} className="matte-3d" style={{ padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Seq: {service.prioritySeq}</div>
                      <h4 style={{ margin: 0, fontSize: '15px' }}>{service.name}</h4>
                    </div>
                    <div style={{ background: 'rgba(255,87,34,0.1)', color: 'var(--color-deep-orange)', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>Qty: {service.quantity}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
                    <button onClick={() => { setServiceForms([service]); setEditingServiceId(service.id); setIsServiceModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'var(--color-ocean-blue)', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => { if(window.confirm("Remove service?")) deleteDoc(doc(db, `clients/${activeClient.id}/services`, service.id)) }} style={{ background: 'none', border: 'none', color: 'red', fontSize: '12px', cursor: 'pointer' }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workflows */}
          <div className="matte-3d-inset" style={{ flex: 1, padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={18} color="var(--color-ocean-blue)"/> Workflow Tasks</h3>
              <button onClick={() => { setWorkflowForms([{taskName:''}]); setEditingWorkflowId(null); setIsWorkflowModalOpen(true); }} style={{ background: 'transparent', border: '1px solid var(--color-ocean-blue)', color: 'var(--color-ocean-blue)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>+ Custom Task</button>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
              <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--color-ocean-blue)', transition: 'width 0.4s ease' }}></div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {clientWorkflows.map(task => (
                <div key={task.id} className="matte-3d" style={{ padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', background: 'white' }}>
                  <div onClick={() => updateDoc(doc(db, `clients/${activeClient.id}/workflows`, task.id), {isDone: !task.isDone})} style={{ width: '22px', height: '22px', borderRadius: '6px', border: `2px solid ${task.isDone ? 'var(--color-ocean-blue)' : 'var(--text-secondary)'}`, background: task.isDone ? 'var(--color-ocean-blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    {task.isDone && <Check size={14} color="white" />}
                  </div>
                  <span style={{ fontSize: '14px', flex: 1, textDecoration: task.isDone ? 'line-through' : 'none', color: task.isDone ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{task.taskName}</span>
                  <div style={{ display: 'flex', gap: '8px', opacity: 0.5 }}>
                    <Edit size={14} style={{ cursor: 'pointer' }} onClick={() => { setWorkflowForms([{taskName: task.taskName}]); setEditingWorkflowId(task.id); setIsWorkflowModalOpen(true); }} />
                    <Trash2 size={14} style={{ cursor: 'pointer', color: 'red' }} onClick={() => deleteDoc(doc(db, `clients/${activeClient.id}/workflows`, task.id))} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MODALS IN ACTIVE CLIENT VIEW */}
        {isAssignPackageModalOpen && (
          <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className={isMobile ? "mobile-bottom-sheet" : "matte-3d"} style={{ width: isMobile ? '100%' : '450px', background: 'white', padding: '30px', borderRadius: isMobile ? '24px 24px 0 0' : '24px' }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>Apply Full Package</h3>
              <form onSubmit={handleApplyPackageToClient} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <select required onChange={(e) => setSelectedPackageToAssign(e.target.value)} className="matte-3d-inset" style={{ padding: '12px', border: 'none', borderRadius: '12px', width: '100%' }}>
                  <option value="">-- Select Agency Package --</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="submit" disabled={loading || !selectedPackageToAssign} style={{ flex: 1, padding: '12px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Apply Package</button>
                  <button type="button" onClick={() => setIsAssignPackageModalOpen(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Bulk Custom Service Modal (Fixed Height Layout) */}
        {isServiceModalOpen && (
          <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className={isMobile ? "mobile-bottom-sheet" : "matte-3d"} style={{ width: isMobile ? '100%' : '550px', height: isMobile ? '85vh' : '65vh', display: 'flex', flexDirection: 'column', background: 'white', padding: '30px', borderRadius: isMobile ? '24px 24px 0 0' : '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '20px' }}>{editingServiceId ? 'Edit Service' : 'Add Custom Services'}</h3>
                {!editingServiceId && <button type="button" onClick={() => setServiceForms([...serviceForms, {name:'', quantity:'1', prioritySeq:1}])} style={{ background: 'var(--color-ocean-blue)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14}/> Add Row</button>}
              </div>
              <form onSubmit={handleSaveCustomService} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}>
                  {serviceForms.map((svc, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input type="text" placeholder="Service Name" required value={svc.name} onChange={e => { const newArr = serviceForms.map((item, i) => i === idx ? {...item, name: e.target.value} : item); setServiceForms(newArr); }} className="matte-3d-inset" style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '12px', fontSize: '14px' }} />
                      <input type="text" placeholder="Qty (e.g. 5, Fixed, N/A)" required value={svc.quantity} onChange={e => { const newArr = serviceForms.map((item, i) => i === idx ? {...item, quantity: e.target.value} : item); setServiceForms(newArr); }} className="matte-3d-inset" style={{ width: '160px', padding: '12px', border: 'none', borderRadius: '12px', fontSize: '14px' }} />
                      {!editingServiceId && <button type="button" onClick={() => { setServiceForms(serviceForms.filter((_, i) => i !== idx)); }} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', padding: '10px', borderRadius: '10px', color: '#ef4444', cursor: 'pointer' }}><X size={18}/></button>}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                  <button type="submit" disabled={loading} style={{ flex: 1, padding: '14px', background: 'var(--color-deep-orange)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>{loading ? 'Saving...' : 'Save Services'}</button>
                  <button type="button" onClick={() => setIsServiceModalOpen(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Custom Workflow Modal (Fixed Height Layout) */}
        {isWorkflowModalOpen && (
          <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className={isMobile ? "mobile-bottom-sheet" : "matte-3d"} style={{ width: isMobile ? '100%' : '550px', height: isMobile ? '85vh' : '65vh', display: 'flex', flexDirection: 'column', background: 'white', padding: '30px', borderRadius: isMobile ? '24px 24px 0 0' : '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '20px' }}>{editingWorkflowId ? 'Edit Task' : 'Add Workflow Tasks'}</h3>
                {!editingWorkflowId && <button type="button" onClick={() => setWorkflowForms([...workflowForms, {taskName:''}])} style={{ background: 'var(--color-ocean-blue)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14}/> Add Row</button>}
              </div>
              <form onSubmit={handleSaveCustomWorkflow} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}>
                  {workflowForms.map((wf, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input type="text" placeholder="Task description..." required value={wf.taskName} onChange={e => { const newArr = workflowForms.map((item, i) => i === idx ? {...item, taskName: e.target.value} : item); setWorkflowForms(newArr); }} className="matte-3d-inset" style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '12px', fontSize: '14px' }} />
                      {!editingWorkflowId && <button type="button" onClick={() => { setWorkflowForms(workflowForms.filter((_, i) => i !== idx)); }} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', padding: '10px', borderRadius: '10px', color: '#ef4444', cursor: 'pointer' }}><X size={18}/></button>}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                  <button type="submit" disabled={loading} style={{ flex: 1, padding: '14px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>{loading ? 'Saving...' : 'Save Tasks'}</button>
                  <button type="button" onClick={() => setIsWorkflowModalOpen(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MOBILE RENDER ──────────────────────────────────────────────
  if (isMobile) {
    // Active client detail view
    if (activeClient) {
      const completedWorkflows = clientWorkflows.filter(w => w.isDone).length;
      const progressPercent = clientWorkflows.length === 0 ? 0 : Math.round((completedWorkflows / clientWorkflows.length) * 100);
      return (
        <div className="mob-page" style={{ background:'#F2F2F7', paddingBottom:0 }}>
          {/* Header */}
          <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, background:'#F2F2F7', flexShrink:0 }}>
            <button onClick={() => setActiveClient(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#007AFF', display:'flex', alignItems:'center', gap:4, fontSize:15, fontWeight:500 }}>
              <ChevronLeft size={20} /> Clients
            </button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:17, fontWeight:700, color:'#000' }}>{activeClient.name}</div>
              <div style={{ fontSize:12, color:'#8E8E93' }}>{activeClient.status} · {activeClient.startDate}</div>
            </div>
          </div>

          <div style={{ flex:1, overflowY:'auto', paddingBottom:120 }}>
            {/* Contact info */}
            <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Contact Info</p>
            <div className="mob-group">
              {activeClient.email && (
                <div className="mob-form-row"><span className="mob-form-label">Email</span><span style={{ fontSize:14, color:'#3C3C43' }}>{activeClient.email}</span></div>
              )}
              {activeClient.phone && (
                <div className="mob-form-row"><span className="mob-form-label">Phone</span><span style={{ fontSize:14, color:'#3C3C43' }}>{activeClient.phone}</span></div>
              )}
              {activeClient.website && (
                <div className="mob-form-row" style={{ borderBottom:'none' }}><span className="mob-form-label">Website</span><a href={activeClient.website} target="_blank" rel="noreferrer" style={{ fontSize:14, color:'#007AFF' }}>{activeClient.website}</a></div>
              )}
            </div>

            {/* Services */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 16px 4px' }}>
              <p className="mob-sec-hdr" style={{ padding:0, margin:0 }}>Services ({clientServices.length})</p>
              <button onClick={() => { setServiceForms([{name:'',quantity:1,prioritySeq:1}]); setEditingServiceId(null); setIsServiceModalOpen(true); }}
                style={{ background:'none', border:'none', color:'#007AFF', fontSize:15, fontWeight:500, cursor:'pointer' }}>+ Add</button>
            </div>
            {clientServices.length > 0 && (
              <div className="mob-group">
                {clientServices.map((svc, i) => (
                  <div key={svc.id} className="mob-task-row" style={{ cursor:'default' }}>
                    <div className="mob-task-row__body">
                      <div className="mob-task-row__name">#{svc.prioritySeq} {svc.name}</div>
                      <div className="mob-task-row__meta">Qty: {svc.quantity}</div>
                    </div>
                    <div className="mob-task-row__trailing">
                      <button onClick={() => { setServiceForms([svc]); setEditingServiceId(svc.id); setIsServiceModalOpen(true); }} style={{ background:'none', border:'none', color:'#007AFF', cursor:'pointer', fontSize:13 }}>Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Workflows */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 16px 4px' }}>
              <p className="mob-sec-hdr" style={{ padding:0, margin:0 }}>Workflows ({clientWorkflows.length})</p>
              <button onClick={() => { setWorkflowForms([{taskName:''}]); setEditingWorkflowId(null); setIsWorkflowModalOpen(true); }}
                style={{ background:'none', border:'none', color:'#007AFF', fontSize:15, fontWeight:500, cursor:'pointer' }}>+ Add</button>
            </div>
            {clientWorkflows.length > 0 && (
              <>
                <div style={{ padding:'0 16px 8px' }}>
                  <div style={{ height:6, background:'#E5E5EA', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ width:`${progressPercent}%`, height:'100%', background:'#34C759', transition:'width 0.4s' }} />
                  </div>
                  <div style={{ fontSize:12, color:'#8E8E93', marginTop:4 }}>{completedWorkflows}/{clientWorkflows.length} done</div>
                </div>
                <div className="mob-group">
                  {clientWorkflows.map(task => (
                    <div key={task.id} className="mob-task-row" style={{ cursor:'default' }}>
                      <div onClick={() => updateDoc(doc(db, `clients/${activeClient.id}/workflows`, task.id), {isDone:!task.isDone})}
                        style={{ width:22, height:22, borderRadius:6, border:`2px solid ${task.isDone?'#34C759':'#C7C7CC'}`, background:task.isDone?'#34C759':'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                        {task.isDone && <Check size={13} color="white" />}
                      </div>
                      <div className="mob-task-row__body">
                        <div className={`mob-task-row__name${task.isDone?' done':''}`}>{task.taskName}</div>
                      </div>
                      <div className="mob-task-row__trailing" style={{ gap:12 }}>
                        <Edit size={14} style={{ cursor:'pointer', color:'#007AFF' }} onClick={() => { setWorkflowForms([{taskName:task.taskName}]); setEditingWorkflowId(task.id); setIsWorkflowModalOpen(true); }} />
                        <Trash2 size={14} style={{ cursor:'pointer', color:'#FF3B30' }} onClick={() => deleteDoc(doc(db, `clients/${activeClient.id}/workflows`, task.id))} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="mob-spacer-lg" />
          </div>

          {/* Client action buttons */}
          <div style={{ padding:'0 16px 24px', display:'flex', gap:8 }}>
            <button onClick={() => { setIsAssignPackageModalOpen(true); setSelectedPackageToAssign(null); }}
              className="mob-btn mob-btn--blue" style={{ flex:1 }}>
              <PackageOpen size={18}/> Import Package
            </button>
            <button onClick={() => { setClientForm({...defaultClientForm,...activeClient,customFields:activeClient.customFields||[]}); setEditingClientId(activeClient.id); setIsClientModalOpen(true); }}
              className="mob-btn mob-btn--ghost" style={{ flex:1 }}>
              <Edit size={18}/> Edit
            </button>
          </div>

          {/* Modals reused */}
          {isAssignPackageModalOpen && (
            <>
              <div className="mob-overlay" onClick={() => setIsAssignPackageModalOpen(false)} />
              <div className="mob-sheet">
                <div className="mob-sheet__nav">
                  <button className="mob-sheet__cancel" onClick={() => setIsAssignPackageModalOpen(false)}>Cancel</button>
                  <span className="mob-sheet__title">Import Package</span>
                  <button className="mob-sheet__confirm" onClick={handleApplyPackageToClient} disabled={!selectedPackageToAssign}>Apply</button>
                </div>
                <div className="mob-sheet__body">
                  <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Select Package</p>
                  <div className="mob-form-group" style={{ marginBottom:0 }}>
                    <div className="mob-form-row">
                      <select className="mob-form-select" value={selectedPackageToAssign||''} onChange={e => setSelectedPackageToAssign(e.target.value)}>
                        <option value="">— Choose —</option>
                        {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mob-spacer-lg" />
                </div>
              </div>
            </>
          )}
          {isClientModalOpen && (
            <>
              <div className="mob-overlay" onClick={() => setIsClientModalOpen(false)} />
              <div className="mob-sheet">
                <div className="mob-sheet__nav">
                  <button className="mob-sheet__cancel" onClick={() => setIsClientModalOpen(false)}>Cancel</button>
                  <span className="mob-sheet__title">{editingClientId?'Edit Client':'New Client'}</span>
                  <button className="mob-sheet__confirm" onClick={handleSaveClient} disabled={loading}>{loading?'…':'Save'}</button>
                </div>
                <div className="mob-sheet__body">
                  <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Client Info</p>
                  <div className="mob-form-group">
                    {[['name','Name *'],['email','Email'],['phone','Phone'],['website','Website']].map(([field,label]) => (
                      <div key={field} className="mob-form-row" style={{ padding:'12px 16px' }}>
                        <input className="mob-form-input" placeholder={label} value={clientForm[field]||''} onChange={e => setClientForm({...clientForm,[field]:e.target.value})}
                          style={{ border:'none', outline:'none', background:'transparent', fontSize:17, flex:1 }} />
                      </div>
                    ))}
                    <div className="mob-form-row" style={{ borderBottom:'none' }}>
                      <span className="mob-form-label">Start Date</span>
                      <input type="date" className="mob-form-select" value={clientForm.startDate||''} onChange={e => setClientForm({...clientForm,startDate:e.target.value})} />
                    </div>
                  </div>
                  <div className="mob-spacer-lg" />
                </div>
                <div className="mob-sheet__footer">
                  <button className="mob-btn mob-btn--blue" onClick={handleSaveClient} disabled={loading}>{loading?'Saving…':'Save Client'}</button>
                </div>
              </div>
            </>
          )}

          {isServiceModalOpen && (
            <>
              <div className="mob-overlay" onClick={() => setIsServiceModalOpen(false)} />
              <div className="mob-sheet">
                <div className="mob-sheet__nav">
                  <button className="mob-sheet__cancel" onClick={() => setIsServiceModalOpen(false)}>Cancel</button>
                  <span className="mob-sheet__title">{editingServiceId ? 'Edit Service' : 'Add Services'}</span>
                  <button className="mob-sheet__confirm" onClick={handleSaveCustomService} disabled={loading}>{loading?'…':'Save'}</button>
                </div>
                <div className="mob-sheet__body">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, paddingRight: 16 }}>
                    {!editingServiceId && <button onClick={() => setServiceForms([...serviceForms, {name:'', quantity:'1', prioritySeq:1}])} style={{ color: '#007AFF', background: 'none', border: 'none', fontWeight: 600, fontSize: 14 }}>+ Add Row</button>}
                  </div>
                  <div className="mob-form-group">
                    {serviceForms.map((svc, idx) => (
                      <div key={idx} className="mob-form-row" style={{ display: 'flex', gap: 8, padding: '8px 16px', alignItems: 'center', borderBottom: idx < serviceForms.length - 1 ? '1px solid #E5E5EA' : 'none' }}>
                        <input className="mob-form-input" placeholder="Service Name" value={svc.name} onChange={e => { const newArr = [...serviceForms]; newArr[idx].name = e.target.value; setServiceForms(newArr); }} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16 }} />
                        <input className="mob-form-input" placeholder="Qty" value={svc.quantity} onChange={e => { const newArr = [...serviceForms]; newArr[idx].quantity = e.target.value; setServiceForms(newArr); }} style={{ width: 60, border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontSize: 16 }} />
                        {!editingServiceId && <button onClick={() => setServiceForms(serviceForms.filter((_, i) => i !== idx))} style={{ color: '#FF3B30', background: 'none', border: 'none', padding: 4 }}><X size={18}/></button>}
                      </div>
                    ))}
                  </div>
                  <div className="mob-spacer-lg" />
                </div>
              </div>
            </>
          )}

          {isWorkflowModalOpen && (
            <>
              <div className="mob-overlay" onClick={() => setIsWorkflowModalOpen(false)} />
              <div className="mob-sheet">
                <div className="mob-sheet__nav">
                  <button className="mob-sheet__cancel" onClick={() => setIsWorkflowModalOpen(false)}>Cancel</button>
                  <span className="mob-sheet__title">{editingWorkflowId ? 'Edit Task' : 'Add Tasks'}</span>
                  <button className="mob-sheet__confirm" onClick={handleSaveCustomWorkflow} disabled={loading}>{loading?'…':'Save'}</button>
                </div>
                <div className="mob-sheet__body">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, paddingRight: 16 }}>
                    {!editingWorkflowId && <button onClick={() => setWorkflowForms([...workflowForms, {taskName:''}])} style={{ color: '#007AFF', background: 'none', border: 'none', fontWeight: 600, fontSize: 14 }}>+ Add Row</button>}
                  </div>
                  <div className="mob-form-group">
                    {workflowForms.map((wf, idx) => (
                      <div key={idx} className="mob-form-row" style={{ display: 'flex', gap: 8, padding: '8px 16px', alignItems: 'center', borderBottom: idx < workflowForms.length - 1 ? '1px solid #E5E5EA' : 'none' }}>
                        <input className="mob-form-input" placeholder="Task Description" value={wf.taskName} onChange={e => { const newArr = [...workflowForms]; newArr[idx].taskName = e.target.value; setWorkflowForms(newArr); }} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16 }} />
                        {!editingWorkflowId && <button onClick={() => setWorkflowForms(workflowForms.filter((_, i) => i !== idx))} style={{ color: '#FF3B30', background: 'none', border: 'none', padding: 4 }}><X size={18}/></button>}
                      </div>
                    ))}
                  </div>
                  <div className="mob-spacer-lg" />
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    // ── Client/Package List view ──────────────────────────
    return (
      <div className="mob-page" style={{ background:'#F2F2F7', paddingBottom:0 }}>
        {/* Tabs */}
        <div style={{ display:'flex', gap:8, padding:'0 16px 8px', overflowX:'auto', scrollbarWidth:'none' }}>
          {['clients','packages'].map(tab => (
            <button key={tab} onClick={() => { setMainTab(tab); setCurrentPage(1); }}
              style={{ flexShrink:0, padding:'7px 16px', borderRadius:16, border:'none', fontWeight:600, fontSize:13, cursor:'pointer', transition:'all 0.15s',
                background: mainTab===tab?'#007AFF':'#E3E3E8', color:mainTab===tab?'white':'#3C3C43' }}>
              {tab==='clients' ? `Clients (${clients.length})` : `Packages (${packages.length})`}
            </button>
          ))}
        </div>

        {/* Client list */}
        {mainTab === 'clients' && (
          <div style={{ flex:1, overflowY:'auto', paddingBottom:120 }}>
            {paginatedClients.length === 0 ? (
              <div className="mob-empty">
                <div className="mob-empty__icon"><Users size={36} color="#8E8E93" /></div>
                <p className="mob-empty__title">No Clients</p>
                <p className="mob-empty__sub">Add your first client.</p>
              </div>
            ) : (
              <>
                <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Active Clients</p>
                <div className="mob-group">
                  {paginatedClients.map(client => (
                    <div key={client.id} className="mob-task-row" onClick={() => setActiveClient(client)}>
                      <div style={{ width:44, height:44, borderRadius:22, background:'linear-gradient(135deg,#0b57d0,#1a73e8)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, flexShrink:0 }}>
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="mob-task-row__body">
                        <div className="mob-task-row__name">{client.name}</div>
                        <div className="mob-task-row__meta">{client.phone||client.email||'No contact info'}</div>
                      </div>
                      <div className="mob-task-row__trailing">
                        <span className={`mob-pill ${client.status==='Active'?'mob-pill--green':'mob-pill--red'}`} style={{ fontSize:11 }}>{client.status||'Active'}</span>
                        <span style={{ color:'#C7C7CC', fontSize:20, marginLeft:4 }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Package list */}
        {mainTab === 'packages' && (
          <div style={{ flex:1, overflowY:'auto', paddingBottom:120 }}>
            {paginatedPackages.length === 0 ? (
              <div className="mob-empty">
                <div className="mob-empty__icon"><PackageOpen size={36} color="#8E8E93" /></div>
                <p className="mob-empty__title">No Packages</p>
                <p className="mob-empty__sub">Create a master package.</p>
              </div>
            ) : (
              <>
                <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Master Packages</p>
                <div className="mob-group">
                  {paginatedPackages.map(pkg => (
                    <div key={pkg.id} className="mob-task-row"
                      onClick={() => { setPackageForm({...defaultPackageForm,...pkg}); setEditingPackageId(pkg.id); setIsPackageModalOpen(true); }}>
                      <div style={{ width:44, height:44, borderRadius:22, background:'linear-gradient(135deg,#8b5cf6,#7c3aed)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <PackageOpen size={22} />
                      </div>
                      <div className="mob-task-row__body">
                        <div className="mob-task-row__name">{pkg.name}</div>
                        <div className="mob-task-row__meta">{pkg.services?.length||0} Services · {pkg.workflows?.length||0} Tasks</div>
                      </div>
                      <span style={{ color:'#C7C7CC', fontSize:20 }}>›</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}



        {/* Add/Edit Client Sheet */}
        {isClientModalOpen && (
          <>
            <div className="mob-overlay" onClick={() => setIsClientModalOpen(false)} />
            <div className="mob-sheet">
              <div className="mob-sheet__nav">
                <button className="mob-sheet__cancel" onClick={() => setIsClientModalOpen(false)}>Cancel</button>
                <span className="mob-sheet__title">{editingClientId?'Edit Client':'New Client'}</span>
                <button className="mob-sheet__confirm" onClick={handleSaveClient} disabled={loading}>{loading?'…':'Save'}</button>
              </div>
              <div className="mob-sheet__body">
                <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Client Info</p>
                <div className="mob-form-group">
                  {[['name','Company Name *'],['email','Email'],['phone','Phone'],['website','Website']].map(([field,label]) => (
                    <div key={field} className="mob-form-row" style={{ padding:'12px 16px' }}>
                      <input className="mob-form-input" placeholder={label} value={clientForm[field]||''} onChange={e => setClientForm({...clientForm,[field]:e.target.value})}
                        style={{ border:'none', outline:'none', background:'transparent', fontSize:17, flex:1 }} />
                    </div>
                  ))}
                  <div className="mob-form-row" style={{ borderBottom:'none' }}>
                    <span className="mob-form-label">Start Date</span>
                    <input type="date" className="mob-form-select" value={clientForm.startDate||''} onChange={e => setClientForm({...clientForm,startDate:e.target.value})} />
                  </div>
                </div>
                <div className="mob-spacer-lg" />
              </div>
              <div className="mob-sheet__footer">
                <button className="mob-btn mob-btn--blue" onClick={handleSaveClient} disabled={loading || !clientForm.name}>{loading?'Saving…':'Create Client'}</button>
              </div>
            </div>
          </>
        )}

        {isPackageModalOpen && (
          <>
            <div className="mob-overlay" onClick={() => setIsPackageModalOpen(false)} />
            <div className="mob-sheet">
              <div className="mob-sheet__nav">
                <button className="mob-sheet__cancel" onClick={() => setIsPackageModalOpen(false)}>Cancel</button>
                <span className="mob-sheet__title">{editingPackageId ? 'Edit Package' : 'New Package'}</span>
                <button className="mob-sheet__confirm" onClick={handleSavePackage} disabled={loading}>{loading?'…':'Save'}</button>
              </div>
              <div className="mob-sheet__body">
                <p className="mob-sec-hdr" style={{ paddingTop:12 }}>Package Details</p>
                <div className="mob-form-group">
                  <div className="mob-form-row" style={{ padding:'12px 16px', borderBottom: 'none' }}>
                    <input className="mob-form-input" placeholder="Package Name *" required value={packageForm.name||''} onChange={e => setPackageForm({...packageForm, name: e.target.value})} style={{ border:'none', outline:'none', background:'transparent', fontSize:17, flex:1 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingLeft: 16, paddingRight: 16 }}>
                  <p className="mob-sec-hdr" style={{ padding: 0, margin: 0 }}>Included Services</p>
                  <button onClick={() => setPackageForm({...packageForm, services: [...packageForm.services, {name:'', quantity:1, prioritySeq:1}]})} style={{ color: '#007AFF', background: 'none', border: 'none', fontWeight: 600, fontSize: 14 }}>+ Add</button>
                </div>
                <div className="mob-form-group">
                  {packageForm.services.map((svc, idx) => (
                    <div key={idx} className="mob-form-row" style={{ display: 'flex', gap: 8, padding: '8px 16px', alignItems: 'center', borderBottom: idx < packageForm.services.length - 1 ? '1px solid #E5E5EA' : 'none' }}>
                      <input className="mob-form-input" placeholder="Service Name" value={svc.name} onChange={e => { const newSvc = [...packageForm.services]; newSvc[idx].name = e.target.value; setPackageForm({...packageForm, services: newSvc}); }} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16 }} />
                      <input type="number" className="mob-form-input" placeholder="Qty" value={svc.quantity} onChange={e => { const newSvc = [...packageForm.services]; newSvc[idx].quantity = parseInt(e.target.value) || 1; setPackageForm({...packageForm, services: newSvc}); }} style={{ width: 40, border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontSize: 16 }} />
                      <button onClick={() => setPackageForm({...packageForm, services: packageForm.services.filter((_, i) => i !== idx)})} style={{ color: '#FF3B30', background: 'none', border: 'none', padding: 4 }}><X size={18}/></button>
                    </div>
                  ))}
                  {packageForm.services.length === 0 && <div style={{ padding: 16, color: '#8E8E93', fontSize: 14, textAlign: 'center' }}>No services added</div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingLeft: 16, paddingRight: 16 }}>
                  <p className="mob-sec-hdr" style={{ padding: 0, margin: 0 }}>Included Tasks</p>
                  <button onClick={() => setPackageForm({...packageForm, workflows: [...packageForm.workflows, {taskName:''}]})} style={{ color: '#007AFF', background: 'none', border: 'none', fontWeight: 600, fontSize: 14 }}>+ Add</button>
                </div>
                <div className="mob-form-group">
                  {packageForm.workflows.map((wf, idx) => (
                    <div key={idx} className="mob-form-row" style={{ display: 'flex', gap: 8, padding: '8px 16px', alignItems: 'center', borderBottom: idx < packageForm.workflows.length - 1 ? '1px solid #E5E5EA' : 'none' }}>
                      <input className="mob-form-input" placeholder="Task description" value={wf.taskName} onChange={e => { const newWf = [...packageForm.workflows]; newWf[idx].taskName = e.target.value; setPackageForm({...packageForm, workflows: newWf}); }} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16 }} />
                      <button onClick={() => setPackageForm({...packageForm, workflows: packageForm.workflows.filter((_, i) => i !== idx)})} style={{ color: '#FF3B30', background: 'none', border: 'none', padding: 4 }}><X size={18}/></button>
                    </div>
                  ))}
                  {packageForm.workflows.length === 0 && <div style={{ padding: 16, color: '#8E8E93', fontSize: 14, textAlign: 'center' }}>No tasks added</div>}
                </div>

                <div className="mob-spacer-lg" />
              </div>
            </div>
          </>
        )}

        {/* Delete confirm */}
        {clientToDelete && (
          <ConfirmDeleteModal title={`Delete ${clientToDelete.name}?`} message="This removes the client and all related tasks."
            onConfirm={handleDeleteClient} onCancel={() => setClientToDelete(null)} isDeleting={isDeletingClient} />
        )}
      </div>
    );
  }

  // ── DESKTOP RENDER ─────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Agency Operations</h2></div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {mainTab === 'clients' ? (
              <button onClick={() => { setClientForm(defaultClientForm); setEditingClientId(null); setIsClientModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}><Plus size={18} /> Add Client</button>
            ) : (
              <button onClick={() => { setPackageForm(defaultPackageForm); setEditingPackageId(null); setIsPackageModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}><Plus size={18} /> Create Master Package</button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => setMainTab('clients')} style={{ background: mainTab === 'clients' ? 'var(--color-ocean-blue)' : 'transparent', color: mainTab === 'clients' ? 'white' : 'var(--text-primary)', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Active Clients</button>
        <button onClick={() => setMainTab('packages')} style={{ background: mainTab === 'packages' ? 'var(--color-ocean-blue)' : 'transparent', color: mainTab === 'packages' ? 'white' : 'var(--text-primary)', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Master Packages</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {mainTab === 'clients' && (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '0', background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {paginatedClients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No clients found.</div>
              ) : paginatedClients.map((client, index) => (
                <div key={client.id} onClick={() => setActiveClient(client)} style={{ background: 'white', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: index < paginatedClients.length - 1 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #0b57d0, #1a73e8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, flexShrink: 0 }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {client.phone ? client.phone : client.email ? client.email : 'No contact info'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: client.status === 'Active' ? '#10b981' : '#ef4444' }}>
                      {client.status || 'Active'}
                    </span>
                    <ChevronRight size={18} color="rgba(0,0,0,0.2)"/>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="evo-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}><input type="checkbox" onChange={(e) => setSelectedClientIds(e.target.checked ? paginatedClients.map(c=>c.id) : [])} checked={paginatedClients.length > 0 && selectedClientIds.length === paginatedClients.length} style={{cursor:'pointer'}} /></th>
                    <th>Client Name</th>
                    <th>Contact Info</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClients.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No clients found.</td></tr>
                  ) : paginatedClients.map((client, idx) => (
                    <tr key={client.id} onClick={() => setActiveClient(client)} style={{ cursor: 'pointer', background: selectedClientIds.includes(client.id) ? 'rgba(0,102,204,0.03)' : 'transparent', transition: 'background 0.2s' }}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedClientIds.includes(client.id)} onClick={(e) => toggleSelect(client.id, idx, e, paginatedClients)} onChange={()=>{}} style={{cursor:'pointer'}}/></td>
                      <td data-label="Client Name" onClick={(e) => e.stopPropagation()}>
                        {editingField.id === client.id && editingField.field === 'name' ? (
                          <input type="text" autoFocus value={editingField.value} onChange={e => setEditingField({...editingField, value: e.target.value})} onBlur={handleInlineSave} onKeyDown={handleInlineKeyDown} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--color-ocean-blue)', outline: 'none', fontSize: '14px', fontWeight: 700 }} />
                        ) : (
                          <div onClick={() => setEditingField({id: client.id, field: 'name', value: client.name})} style={{ fontWeight: 700, color: 'var(--color-ocean-blue)', cursor: 'text', borderBottom: '1px dashed transparent', display: 'inline-block' }} onMouseOver={e=>e.currentTarget.style.borderBottom='1px dashed var(--glass-border)'} onMouseOut={e=>e.currentTarget.style.borderBottom='1px dashed transparent'} title="Click to edit name">{client.name}</div>
                        )}
                      </td>
                      <td data-label="Contact Info">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {client.email && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12}/>{client.email}</div>}
                          {client.phone && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12}/>{client.phone}</div>}
                        </div>
                      </td>
                      <td data-label="Status" onClick={(e) => e.stopPropagation()}>
                        {editingField.id === client.id && editingField.field === 'status' ? (
                          <select autoFocus value={editingField.value} onChange={e => setEditingField({...editingField, value: e.target.value})} onBlur={handleInlineSave} onKeyDown={handleInlineKeyDown} style={{ padding: '4px', borderRadius: '6px', border: '1px solid var(--color-ocean-blue)', outline: 'none', fontSize: '12px' }}>
                            <option value="Active">Active</option>
                            <option value="Dead">Dead</option>
                          </select>
                        ) : (
                          <span onClick={() => setEditingField({id: client.id, field: 'status', value: client.status || 'Active'})} style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', background: client.status === 'Active' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', color: client.status === 'Active' ? '#10b981' : '#ef4444', cursor: 'pointer', border: '1px dashed transparent' }} onMouseOver={e=>e.currentTarget.style.border='1px dashed var(--glass-border)'} onMouseOut={e=>e.currentTarget.style.border='1px dashed transparent'} title="Click to edit status">
                            {client.status || 'Active'}
                          </span>
                        )}
                      </td>
                      <td data-label="Joined">
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{client.startDate || 'N/A'}</span>
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button onClick={(e) => { e.stopPropagation(); setActiveClient(client); }} style={{ padding: '6px 12px', background: 'var(--bg-matte)', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Manage</button>
                          <button onClick={(e) => { e.stopPropagation(); setClientForm({...defaultClientForm, ...client, customFields: client.customFields || []}); setEditingClientId(client.id); setIsClientModalOpen(true); }} style={{ padding: '6px', background: 'rgba(0,102,204,0.1)', border: 'none', color: 'var(--color-ocean-blue)', borderRadius: '6px', cursor: 'pointer' }}><Edit size={14}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setClientToDelete(client); }} style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {mainTab === 'packages' && (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '0', background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {paginatedPackages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No master packages found.</div>
              ) : paginatedPackages.map((pkg, index) => (
                <div key={pkg.id} onClick={() => { setPackageForm({...defaultPackageForm, ...pkg}); setEditingPackageId(pkg.id); setIsPackageModalOpen(true); }} style={{ background: 'white', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: index < paginatedPackages.length - 1 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PackageOpen size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                      <span>{pkg.services?.length || 0} Services</span>
                      <span>•</span>
                      <span>{pkg.workflows?.length || 0} Tasks</span>
                    </div>
                  </div>
                  <ChevronRight size={18} color="rgba(0,0,0,0.2)"/>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="evo-table">
                <thead>
                  <tr>
                    <th>Package Name</th>
                    <th>Services Overview</th>
                    <th>Tasks Overview</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPackages.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No master packages found.</td></tr>
                  ) : paginatedPackages.map(pkg => (
                    <tr key={pkg.id}>
                      <td data-label="Package Name">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PackageOpen size={16} color="var(--color-ocean-blue)"/>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pkg.name}</span>
                        </div>
                      </td>
                      <td data-label="Services Overview">
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>{pkg.services?.length || 0} Services</span>
                          {pkg.services?.slice(0,3).map(s => s.name).join(', ')}{pkg.services?.length > 3 ? '...' : ''}
                        </div>
                      </td>
                      <td data-label="Tasks Overview">
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>{pkg.workflows?.length || 0} Tasks</span>
                          {pkg.workflows?.slice(0,3).map(w => w.taskName).join(', ')}{pkg.workflows?.length > 3 ? '...' : ''}
                        </div>
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button onClick={() => { setPackageForm({...defaultPackageForm, ...pkg}); setEditingPackageId(pkg.id); setIsPackageModalOpen(true); }} style={{ padding: '6px', background: 'rgba(0,102,204,0.1)', border: 'none', color: 'var(--color-ocean-blue)', borderRadius: '6px', cursor: 'pointer' }}><Edit size={14}/></button>
                          <button onClick={() => handleDeletePackage(pkg.id)} style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Pagination Controls */}
      {(() => {
        const activeArray = mainTab === 'clients' ? clients : packages;
        if (activeArray.length === 0) return null;
        return (
          <Pagination
            currentPage={currentPage}
            totalItems={activeArray.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        );
      })()}

      {/* COMPREHENSIVE ADD/EDIT CLIENT MODAL (Fixed Height Layout) */}
      {isClientModalOpen && (
        <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className={isMobile ? "mobile-bottom-sheet" : "matte-3d"} style={{ width: isMobile ? '100%' : '650px', height: isMobile ? '92vh' : '85vh', display: 'flex', flexDirection: 'column', background: 'white', padding: '30px', borderRadius: isMobile ? '24px 24px 0 0' : '24px' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>{editingClientId ? 'Edit Client Profile' : 'Add New Client'}</h3>
            <form onSubmit={handleSaveClient} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div><label style={{fontSize:'12px', color:'gray'}}>Company / Client Name *</label><input type="text" required value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="matte-3d-inset" style={{ width:'100%', padding: '12px', border: 'none', borderRadius: '12px' }} /></div>
                  <div><label style={{fontSize:'12px', color:'gray'}}>Email Address</label><input type="email" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} className="matte-3d-inset" style={{ width:'100%', padding: '12px', border: 'none', borderRadius: '12px' }} /></div>
                  <div><label style={{fontSize:'12px', color:'gray'}}>Phone Number</label><input type="text" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="matte-3d-inset" style={{ width:'100%', padding: '12px', border: 'none', borderRadius: '12px' }} /></div>
                  <div><label style={{fontSize:'12px', color:'gray'}}>Website URL</label><input type="text" value={clientForm.website} onChange={e => setClientForm({...clientForm, website: e.target.value})} className="matte-3d-inset" style={{ width:'100%', padding: '12px', border: 'none', borderRadius: '12px' }} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div><label style={{fontSize:'12px', color:'gray'}}>Duration (Months) *</label><input type="number" min="1" required value={clientForm.durationMonths} onChange={e => setClientForm({...clientForm, durationMonths: parseInt(e.target.value)})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '12px' }} /></div>
                  <div><label style={{fontSize:'12px', color:'gray'}}>Start Date *</label><input type="date" required value={clientForm.startDate} onChange={e => setClientForm({...clientForm, startDate: e.target.value})} className="matte-3d-inset" style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '12px' }} /></div>
                </div>
                <div>
                  <label style={{fontSize:'12px', color:'gray'}}>Additional Notes / Requirements</label>
                  <textarea value={clientForm.details} onChange={e => setClientForm({...clientForm, details: e.target.value})} className="matte-3d-inset" style={{ width:'100%', padding: '12px', border: 'none', borderRadius: '12px', minHeight: '80px' }} />
                </div>
                <div style={{ background: 'var(--bg-matte)', padding: '20px', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px' }}>Custom Detail Fields</h4>
                    <button type="button" onClick={() => setClientForm({...clientForm, customFields: [...clientForm.customFields, {label:'', value:''}]})} style={{ background: 'var(--color-ocean-blue)', border: 'none', color: 'white', fontWeight: 600, fontSize: '12px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Plus size={14}/> Add Field</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {clientForm.customFields.map((field, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                        <input type="text" placeholder="Label (e.g. FB Page)" value={field.label} onChange={e => { const newFields = clientForm.customFields.map((f, i) => i === idx ? {...f, label: e.target.value} : f); setClientForm({...clientForm, customFields: newFields}); }} className="matte-3d-inset" style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', fontSize: '13px' }} />
                        <input type="text" placeholder="Value (e.g. fb.com/xyz)" value={field.value} onChange={e => { const newFields = clientForm.customFields.map((f, i) => i === idx ? {...f, value: e.target.value} : f); setClientForm({...clientForm, customFields: newFields}); }} className="matte-3d-inset" style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '8px', fontSize: '13px' }} />
                        <button type="button" onClick={() => { setClientForm({...clientForm, customFields: clientForm.customFields.filter((_, i) => i !== idx)}); }} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}><X size={18}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '14px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Save Client Profile</button>
                <button type="button" onClick={() => setIsClientModalOpen(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLEX PACKAGE MODAL (Fixed Height Layout) */}
      {isPackageModalOpen && (
        <div className={isMobile ? "mobile-bottom-sheet-overlay" : ""} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className={isMobile ? "mobile-bottom-sheet" : "matte-3d"} style={{ width: isMobile ? '100%' : '800px', height: isMobile ? '80vh' : '85vh', display: 'flex', flexDirection: 'column', background: 'white', padding: isMobile ? '20px' : '30px', borderRadius: isMobile ? '24px 24px 0 0' : '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>{editingPackageId ? 'Edit Master Package' : 'Create Master Package'}</h3>
              {isMobile && (
                <button onClick={() => setIsPackageModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                  <X size={24} color="#8E8E93" />
                </button>
              )}
            </div>
            <form onSubmit={handleSavePackage} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '8px' }}>
                <input type="text" placeholder="Package Name (e.g. Standard Marketing)" required value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})} className="matte-3d-inset" style={{ padding: '16px', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 600 }} />
                
                <div style={{ display: 'flex', gap: '20px', flex: 1 }}>
                  {/* Services List Builder */}
                  <div style={{ flex: 1, background: 'var(--bg-matte)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px' }}>Included Services</h4>
                      <button type="button" onClick={() => setPackageForm({...packageForm, services: [...packageForm.services, {name:'', quantity:1, prioritySeq:1}]})} style={{ background: 'var(--color-ocean-blue)', border: 'none', color: 'white', fontWeight: 600, fontSize: '12px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Plus size={14}/> Add</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                      {packageForm.services.map((svc, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                          <input type="text" placeholder="Service Name" value={svc.name} onChange={e => { const newSvc = packageForm.services.map((item, i) => i === idx ? {...item, name: e.target.value} : item); setPackageForm({...packageForm, services: newSvc}); }} className="matte-3d-inset" style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '8px', fontSize: '13px' }} />
                          <input type="number" placeholder="Qty" min="1" value={svc.quantity} onChange={e => { const newSvc = packageForm.services.map((item, i) => i === idx ? {...item, quantity: parseInt(e.target.value)} : item); setPackageForm({...packageForm, services: newSvc}); }} className="matte-3d-inset" style={{ width: '60px', padding: '10px', border: 'none', borderRadius: '8px', fontSize: '13px' }} />
                          <button type="button" onClick={() => { setPackageForm({...packageForm, services: packageForm.services.filter((_, i) => i !== idx)}); }} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}><X size={18}/></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Workflows List Builder */}
                  <div style={{ flex: 1, background: 'var(--bg-matte)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px' }}>Included Workflow Tasks</h4>
                      <button type="button" onClick={() => setPackageForm({...packageForm, workflows: [...packageForm.workflows, {taskName:''}]})} style={{ background: 'var(--color-ocean-blue)', border: 'none', color: 'white', fontWeight: 600, fontSize: '12px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Plus size={14}/> Add</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                      {packageForm.workflows.map((wf, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                          <input type="text" placeholder="Task description" value={wf.taskName} onChange={e => { const newWf = packageForm.workflows.map((item, i) => i === idx ? {...item, taskName: e.target.value} : item); setPackageForm({...packageForm, workflows: newWf}); }} className="matte-3d-inset" style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontSize: '13px' }} />
                          <button type="button" onClick={() => { setPackageForm({...packageForm, workflows: packageForm.workflows.filter((_, i) => i !== idx)}); }} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}><X size={18}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '14px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Save Master Package</button>
                <button type="button" onClick={() => setIsPackageModalOpen(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {clientToDelete && (
        <ConfirmDeleteModal
          title={`Delete Client: ${clientToDelete.name}`}
          message="Are you sure you want to delete this client completely? This will also permanently delete ALL tasks associated with this client. This action cannot be undone."
          onConfirm={handleDeleteClient}
          onCancel={() => setClientToDelete(null)}
          isDeleting={isDeletingClient}
        />
      )}

    </div>
  );
};

export default ClientManagement;
