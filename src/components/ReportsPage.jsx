import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, BorderStyle, WidthType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { FileText, Download, Calendar, User, Briefcase, FileSignature } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

const ReportsPage = () => {
  const { userData } = useAuth();
  const isAdmin = ['Admin','Administrator','Partner'].includes(userData?.role);
  
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Reporting Engine States
  const [reportType, setReportType] = useState('agency');
  const [reportTargetId, setReportTargetId] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [generating, setGenerating] = useState(null);

  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, 'tasks'), s => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubTasks(); unsubUsers(); };
  }, []);

  const clients = useMemo(() => {
    const names = new Set(tasks.map(t => t.clientName).filter(Boolean));
    return Array.from(names).sort();
  }, [tasks]);

  const getTaskDisplayTitle = (task) => {
    if (task.customName) return task.customName;
    if (task.type === 'service_task') return `${task.serviceName} #${task.sequence}`;
    if (task.type === 'workflow_task') return `Workflow: ${task.taskName}`;
    return task.title || task.taskName || 'Untitled Task';
  };

  const getReportTasks = () => {
    let filtered = [...tasks];
    if (reportType === 'user' && reportTargetId) {
      filtered = filtered.filter(t => t.assignedTo === reportTargetId || t.assignedUserId === reportTargetId || t.assigneeId === reportTargetId);
    } else if (reportType === 'client' && reportTargetId) {
      filtered = filtered.filter(t => t.clientName === reportTargetId);
    }
    if (dateRange.start) {
      const start = new Date(dateRange.start);
      filtered = filtered.filter(t => {
        const tDate = t.createdAt?.toDate?.() || new Date(t.createdAt || t.timestamp);
        return tDate >= start;
      });
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => {
        const tDate = t.createdAt?.toDate?.() || new Date(t.createdAt || t.timestamp);
        return tDate <= end;
      });
    }
    return filtered;
  };

  const generatePDF = () => {
    setGenerating('pdf');
    try {
      const filteredTasks = getReportTasks();
      const pdf = new jsPDF();
      pdf.setFontSize(24); pdf.setTextColor(11, 87, 208);
      pdf.text('EVORISE SOLUTIONS', 14, 25);
      pdf.setFontSize(14); pdf.setTextColor(40);
      let subtitle = 'Agency Operations Report';
      if (reportType === 'user') subtitle = `Performance Report - ${users.find(u => u.id === reportTargetId)?.name || 'Unknown'}`;
      if (reportType === 'client') subtitle = `Client Report - ${reportTargetId}`;
      pdf.text(subtitle, 14, 35);
      pdf.setFontSize(10); pdf.setTextColor(100);
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, 14, 42);
      if (dateRange.start || dateRange.end) {
        pdf.text(`Period: ${dateRange.start || 'Beginning'} to ${dateRange.end || 'Present'}`, 14, 48);
      }
      const completed = filteredTasks.filter(t => t.status === 'Done' || t.status === 'Completed').length;
      pdf.setFontSize(12); pdf.setTextColor(0);
      pdf.text(`Total Tasks: ${filteredTasks.length}    Completed: ${completed}    Completion Rate: ${filteredTasks.length ? Math.round((completed/filteredTasks.length)*100) : 0}%`, 14, 60);

      const tableData = filteredTasks.map(t => {
        const title = getTaskDisplayTitle(t);
        return [
          title.substring(0, 40) + (title.length > 40 ? '...' : ''),
          t.clientName || 'N/A',
          t.status || 'Pending',
          t.assignedToName || t.assigneeName || 'Unassigned',
          new Date(t.createdAt?.toDate?.() || t.timestamp || Date.now()).toLocaleDateString()
        ];
      });

      autoTable(pdf, {
        startY: 70,
        head: [['Task Title', 'Client', 'Status', 'Assignee', 'Created']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [11, 87, 208] },
        styles: { fontSize: 9 }
      });
      pdf.save(`Evorise_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error generating PDF.');
    } finally {
      setGenerating(null);
    }
  };

  const generateDOCX = async () => {
    setGenerating('docx');
    try {
      const filteredTasks = getReportTasks();
      let subtitle = 'Agency Operations Report';
      if (reportType === 'user') subtitle = `Performance Report - ${users.find(u => u.id === reportTargetId)?.name || 'Unknown'}`;
      if (reportType === 'client') subtitle = `Client Report - ${reportTargetId}`;
      const completed = filteredTasks.filter(t => t.status === 'Done' || t.status === 'Completed').length;

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({ text: "EVORISE SOLUTIONS", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: subtitle, heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `Generated on: ${new Date().toLocaleString()}` }),
            new Paragraph({ text: `Period: ${dateRange.start || 'Beginning'} to ${dateRange.end || 'Present'}` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: `Total Tasks: ${filteredTasks.length} | Completed: ${completed} | Completion Rate: ${filteredTasks.length ? Math.round((completed/filteredTasks.length)*100) : 0}%` }),
            new Paragraph({ text: "" }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
              },
              rows: [
                new TableRow({
                  children: ['Task Title', 'Client', 'Status', 'Assignee', 'Created'].map(h => 
                    new TableCell({ children: [new Paragraph({ text: h, bold: true })] })
                  )
                }),
                ...filteredTasks.map(t => new TableRow({
                  children: [
                    getTaskDisplayTitle(t),
                    t.clientName || 'N/A',
                    t.status || 'Pending',
                    t.assignedToName || t.assigneeName || 'Unassigned',
                    new Date(t.createdAt?.toDate?.() || t.timestamp || Date.now()).toLocaleDateString()
                  ].map(c => new TableCell({ children: [new Paragraph({ text: c })] }))
                }))
              ]
            })
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Evorise_Report_${new Date().toISOString().split('T')[0]}.docx`);
    } catch (err) {
      console.error(err);
      alert('Error generating Word Document.');
    } finally {
      setGenerating(null);
    }
  };

  const isMobile = useIsMobile();
  
  if (!isAdmin) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>You do not have permission to view this module.</div>;
  }

  if (isMobile) {
    return (
      <div style={{ backgroundColor: '#f2f2f7', minHeight: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', paddingBottom: '40px' }}>
        
        {/* iOS Large Title Header */}
        <div style={{ padding: '44px 16px 16px 16px', backgroundColor: '#f2f2f7', position: 'sticky', top: 0, zIndex: 10 }}>
          <h2 style={{ fontSize: '34px', fontWeight: 700, margin: 0, color: '#000', letterSpacing: '-0.5px' }}>
            Reports
          </h2>
        </div>

        <div style={{ fontSize: '13px', color: '#8e8e93', textTransform: 'uppercase', marginBottom: '8px', marginLeft: '32px', marginTop: '8px' }}>Report Configuration</div>
        <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', margin: '0 16px 24px 16px' }}>
          
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #c6c6c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: '#007aff', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Briefcase size={16}/></div>
              <div style={{ fontSize: '17px', color: '#000' }}>Scope</div>
            </div>
            <select value={reportType} onChange={e => { setReportType(e.target.value); setReportTargetId(''); }} style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', backgroundColor: 'transparent', textAlign: 'right', WebkitAppearance: 'none' }} dir="rtl">
              <option value="agency">All Operations</option>
              <option value="user">Employee</option>
              <option value="client">Client</option>
            </select>
          </div>

          {reportType === 'user' && (
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #c6c6c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: '#ff9500', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><User size={16}/></div>
                <div style={{ fontSize: '17px', color: '#000' }}>Employee</div>
              </div>
              <select value={reportTargetId} onChange={e => setReportTargetId(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', backgroundColor: 'transparent', textAlign: 'right', WebkitAppearance: 'none', maxWidth: '50%' }} dir="rtl">
                <option value="">Select...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          {reportType === 'client' && (
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #c6c6c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: '#ff9500', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Briefcase size={16}/></div>
                <div style={{ fontSize: '17px', color: '#000' }}>Client</div>
              </div>
              <select value={reportTargetId} onChange={e => setReportTargetId(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', backgroundColor: 'transparent', textAlign: 'right', WebkitAppearance: 'none', maxWidth: '50%' }} dir="rtl">
                <option value="">Select...</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #c6c6c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: '#34c759', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Calendar size={16}/></div>
              <div style={{ fontSize: '17px', color: '#000' }}>Start Date</div>
            </div>
            <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', backgroundColor: 'transparent', textAlign: 'right' }} />
          </div>

          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: '#34c759', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Calendar size={16}/></div>
              <div style={{ fontSize: '17px', color: '#000' }}>End Date</div>
            </div>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', backgroundColor: 'transparent', textAlign: 'right' }} />
          </div>

        </div>

        <div style={{ fontSize: '13px', color: '#8e8e93', textTransform: 'uppercase', marginBottom: '8px', marginLeft: '32px' }}>Export Actions</div>
        <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', margin: '0 16px 24px 16px' }}>
          <button 
            onClick={generatePDF} 
            disabled={!!generating || (reportType !== 'agency' && !reportTargetId)}
            style={{ width: '100%', padding: '12px 16px', border: 'none', borderBottom: '0.5px solid #c6c6c8', backgroundColor: 'transparent', fontSize: '17px', color: '#007aff', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', opacity: (!!generating || (reportType !== 'agency' && !reportTargetId)) ? 0.5 : 1 }}
          >
            <FileText size={18}/> {generating === 'pdf' ? 'Generating PDF...' : 'Export as PDF'}
          </button>
          
          <button 
            onClick={generateDOCX} 
            disabled={!!generating || (reportType !== 'agency' && !reportTargetId)}
            style={{ width: '100%', padding: '12px 16px', border: 'none', backgroundColor: 'transparent', fontSize: '17px', color: '#007aff', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', opacity: (!!generating || (reportType !== 'agency' && !reportTargetId)) ? 0.5 : 1 }}
          >
            <Download size={18}/> {generating === 'docx' ? 'Generating DOCX...' : 'Export as DOCX'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #0b57d0, #1a73e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(11,87,208,0.3)' }}>
          <FileSignature size={24} color="white"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Report Universe</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Generate professional client and user performance reports.</p>
        </div>
      </div>

      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--glass-border)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}><Briefcase size={14}/> Report Scope</label>
            <select value={reportType} onChange={e => { setReportType(e.target.value); setReportTargetId(''); }} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }}>
              <option value="agency">Entire Agency (All Operations)</option>
              <option value="user">Specific Employee Performance</option>
              <option value="client">Specific Client Summary</option>
            </select>
          </div>

          {reportType === 'user' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}><User size={14}/> Select Employee</label>
              <select value={reportTargetId} onChange={e => setReportTargetId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }}>
                <option value="">-- Choose Employee --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          {reportType === 'client' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}><Briefcase size={14}/> Select Client</label>
              <select value={reportTargetId} onChange={e => setReportTargetId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }}>
                <option value="">-- Choose Client --</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}><Calendar size={14}/> Custom Date Range (Optional)</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)', outline: 'none' }}/>
              <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)', outline: 'none' }}/>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button 
              onClick={generatePDF} 
              disabled={!!generating || (reportType !== 'agency' && !reportTargetId)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: 'linear-gradient(135deg, #ea4335, #c5221f)', color: 'white', border: 'none', borderRadius: '12px', cursor: (!!generating || (reportType !== 'agency' && !reportTargetId)) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (!!generating || (reportType !== 'agency' && !reportTargetId)) ? 0.6 : 1 }}
            >
              <FileText size={18}/> {generating === 'pdf' ? 'Building...' : 'Export as PDF'}
            </button>
            <button 
              onClick={generateDOCX} 
              disabled={!!generating || (reportType !== 'agency' && !reportTargetId)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: 'linear-gradient(135deg, #1a73e8, #0b57d0)', color: 'white', border: 'none', borderRadius: '12px', cursor: (!!generating || (reportType !== 'agency' && !reportTargetId)) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (!!generating || (reportType !== 'agency' && !reportTargetId)) ? 0.6 : 1 }}
            >
              <Download size={18}/> {generating === 'docx' ? 'Building...' : 'Export as DOCX'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
