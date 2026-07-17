import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { Download, Upload, AlertOctagon, Settings as SettingsIcon, Shield, Database, Smartphone, HardDrive, Clock, LocateFixed, ChevronRight, LayoutDashboard, Keyboard, LogOut, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useIsMobile } from '../hooks/useIsMobile';

const COLLECTIONS = [
  'users', 'session_logs', 'tasks', 'clients', 'client_services', 
  'action_requests', 'evonotes', 'messages', 'notices', 'instant_tasks', 
  'notifications', 'activity_logs', 'trash', 'error_logs', 'performance_logs'
];

const SHORTCUTS = [
  { key: 'Cmd/Ctrl + K', desc: 'Open Command Palette' },
  { key: 'C', desc: 'Quick Create Task' },
  { key: 'Shift + D', desc: 'Go to Dashboard' },
  { key: 'Shift + M', desc: 'Go to My Day' },
  { key: 'Shift + E', desc: 'Go to EvoBoard' },
  { key: 'Shift + I', desc: 'Go to Instant Work' },
  { key: 'Shift + N', desc: 'Go to Evo Notes' },
  { key: 'Shift + C', desc: 'Go to Clients' },
  { key: 'Shift + W', desc: 'Go to Chat' },
  { key: '?', desc: 'Open Cheat Sheet Modal' }
];

const SystemSettings = () => {
  const { userData } = useAuth();
  const { settings, updateSettings, loading } = useSettings();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('general');
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [resetStep, setResetStep] = useState(0); // 0: initial, 1: confirm 1, 2: confirm 2, 3: final
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Check if user is admin
  const userRole = userData?.role || 'Employee';
  const isAdmin = userRole.toLowerCase() === 'admin' || userRole.toLowerCase() === 'administrator';

  const exportData = async () => {
    try {
      setIsExporting(true);
      const backupData = {};
      
      for (const colName of COLLECTIONS) {
        const querySnapshot = await getDocs(collection(db, colName));
        backupData[colName] = [];
        querySnapshot.forEach((doc) => {
          backupData[colName].push({ id: doc.id, ...doc.data() });
        });
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", `evorise_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Failed to export data. Check permissions.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setIsRestoring(true);
        const data = JSON.parse(e.target.result);
        
        // This is a simplified restore logic. For thousands of docs, chunking is required.
        const batch = writeBatch(db);
        let count = 0;

        for (const colName of Object.keys(data)) {
          if (COLLECTIONS.includes(colName)) {
            data[colName].forEach((item) => {
              const { id, ...docData } = item;
              const docRef = doc(db, colName, id);
              batch.set(docRef, docData);
              count++;
            });
          }
        }
        
        if (count > 0) {
          await batch.commit();
          alert(`Successfully restored ${count} records!`);
        } else {
          alert("No valid data found in backup file.");
        }
      } catch (error) {
        console.error("Restore failed:", error);
        alert("Failed to restore data. Invalid file or network error.");
      } finally {
        setIsRestoring(false);
        event.target.value = ''; // Reset input
      }
    };
    reader.readAsText(file);
  };

  const handleSystemReset = async () => {
    if (resetConfirmText !== 'EVORISE-RESET-CONFIRM') {
      alert("Verification text does not match!");
      return;
    }
    
    try {
      setIsExporting(true);
      // Try to trigger a backup, but if it fails don't abort
      try {
        await exportData();
      } catch(e) {
        console.error("Backup skipped/failed", e);
      }
      
      let totalDeleted = 0;

      // Delete collection by collection using batch
      for (const colName of COLLECTIONS) {
        const querySnapshot = await getDocs(collection(db, colName));
        let batch = writeBatch(db);
        let count = 0;

        querySnapshot.forEach((docSnap) => {
          // Safeguard: do not delete the current admin user
          if (colName === 'users' && (docSnap.id === userData?.uid || docSnap.id === userData?.id)) {
             return; 
          }
          
          batch.delete(doc(db, colName, docSnap.id));
          count++;
          totalDeleted++;

          // Commit every 400 deletions to respect Firestore limits
          if (count >= 400) {
            batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        });

        // Commit any remaining
        if (count > 0) {
          await batch.commit();
        }
        
        console.log(`Successfully wiped ${colName}`);
      }
      
      alert(`System Reset Complete! Wiped ${totalDeleted} documents. You have a fresh slate.`);
      setResetStep(0);
      setResetConfirmText('');
    } catch (error) {
      console.error("Reset failed", error);
      alert(`Reset failed partially. Error: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className={isMobile ? "" : "matte-3d-inset"} style={{ padding: '40px', textAlign: 'center', backgroundColor: isMobile ? '#f2f2f7' : '', minHeight: '100%' }}>
        <Shield size={48} color="var(--color-deep-orange)" style={{ marginBottom: '20px' }} />
        <h2 style={isMobile ? { color: '#000' } : {}}>Access Denied</h2>
        <p style={isMobile ? { color: '#8e8e93' } : {}}>Only Administrators can access System Settings.</p>
      </div>
    );
  }

  if (isMobile) {
    const MobileSettingRow = ({ icon, iconBg, title, value, onChange, options, onClick, isDestructive, hideChevron, children }) => (
      <div 
        onClick={onClick}
        style={{ padding: '12px 16px', borderBottom: '0.5px solid #E5E5EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: onClick ? 'pointer' : 'default', background: 'white' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {icon && (
            <div style={{ backgroundColor: iconBg, borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              {icon}
            </div>
          )}
          <div style={{ fontSize: '17px', color: isDestructive ? '#ff3b30' : '#000' }}>{title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {children ? children : options ? (
            <select 
              value={value} 
              onChange={onChange} 
              style={{ border: 'none', outline: 'none', fontSize: '17px', color: '#8e8e93', backgroundColor: 'transparent', textAlign: 'right', WebkitAppearance: 'none' }} 
              dir="rtl"
            >
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: '17px', color: '#8e8e93' }}>{value}</div>
          )}
          {!hideChevron && <ChevronRight size={20} color="#C6C6C8" />}
        </div>
      </div>
    );

    return (
      <div className="mob-page" style={{ backgroundColor: '#f2f2f7', minHeight: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        
        {/* iOS Large Title Header */}
        <div style={{ padding: '24px 16px 12px 16px', backgroundColor: '#f2f2f7', position: 'sticky', top: 0, zIndex: 10 }}>
          <h2 style={{ fontSize: '34px', fontWeight: 800, margin: 0, color: '#000', letterSpacing: '-0.5px' }}>
            Settings
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#8e8e93' }}>Loading settings...</div>
        ) : (
          <div style={{ paddingBottom: '40px' }}>
            {/* GENERAL SECTION */}
            <div style={{ fontSize: '13px', color: '#8e8e93', textTransform: 'uppercase', marginBottom: '6px', marginLeft: '32px', marginTop: '12px' }}>General Preferences</div>
            <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', margin: '0 16px 24px 16px' }}>
              <MobileSettingRow 
                icon={<Clock size={16}/>} iconBg="#007aff" 
                title="Auto-Lock" 
                value={settings?.general?.autoLockTimeout || '10'} 
                onChange={e => updateSettings({ 'general.autoLockTimeout': e.target.value })}
                options={[{value:'5',label:'5 Min'}, {value:'10',label:'10 Min'}, {value:'30',label:'30 Min'}, {value:'60',label:'60 Min'}, {value:'never',label:'Never'}]}
              />
              <MobileSettingRow 
                icon={<Clock size={16}/>} iconBg="#5856d6" 
                title="Time Format" 
                value={settings?.general?.timeFormat || '12h'} 
                onChange={e => updateSettings({ 'general.timeFormat': e.target.value })}
                options={[{value:'12h',label:'12-Hour'}, {value:'24h',label:'24-Hour'}]}
              />
              <MobileSettingRow 
                icon={<Shield size={16}/>} iconBg="#000" 
                title="Dynamic Island (PC)" 
                value={settings?.general?.dynamicIsland !== false ? 'enabled' : 'disabled'} 
                onChange={e => updateSettings({ 'general.dynamicIsland': e.target.value === 'enabled' })}
                options={[{value:'enabled',label:'Enabled'}, {value:'disabled',label:'Disabled'}]}
              />
              <MobileSettingRow 
                icon={<Target size={16}/>} iconBg="#ff9500" 
                title="Auto-Open Reminders" 
                value={settings?.general?.autoNavigateOnReminder ? 'enabled' : 'disabled'} 
                onChange={e => updateSettings({ 'general.autoNavigateOnReminder': e.target.value === 'enabled' })}
                options={[{value:'enabled',label:'Enabled'}, {value:'disabled',label:'Disabled'}]}
              />
            </div>

            {/* AUTOMATION SECTION */}
            <div style={{ fontSize: '13px', color: '#8e8e93', textTransform: 'uppercase', marginBottom: '6px', marginLeft: '32px' }}>Automation & Cleanup</div>
            <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', margin: '0 16px 24px 16px' }}>
              <MobileSettingRow 
                icon={<HardDrive size={16}/>} iconBg="#ff9500" 
                title="Archive Tasks" 
                value={settings?.automation?.autoArchiveDays || '30'} 
                onChange={e => updateSettings({ 'automation.autoArchiveDays': parseInt(e.target.value) })}
                options={[{value:'15',label:'15 Days'}, {value:'30',label:'30 Days'}, {value:'60',label:'60 Days'}, {value:'90',label:'90 Days'}, {value:'999',label:'Never'}]}
              />
              <MobileSettingRow 
                icon={<AlertOctagon size={16}/>} iconBg="#ff3b30" 
                title="Log Retention" 
                value={settings?.automation?.logRetentionDays || '90'} 
                onChange={e => updateSettings({ 'automation.logRetentionDays': parseInt(e.target.value) })}
                options={[{value:'30',label:'30 Days'}, {value:'90',label:'90 Days'}, {value:'180',label:'6 Months'}, {value:'365',label:'1 Year'}]}
              />
            </div>

            {/* SECURITY SECTION */}
            <div style={{ fontSize: '13px', color: '#8e8e93', textTransform: 'uppercase', marginBottom: '6px', marginLeft: '32px' }}>Security</div>
            <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', margin: '0 16px 24px 16px' }}>
              <MobileSettingRow 
                icon={<LocateFixed size={16}/>} iconBg="#34c759" 
                title="Location Status" 
                value={settings?.security?.locationStrictness || 'strict'} 
                onChange={e => updateSettings({ 'security.locationStrictness': e.target.value })}
                options={[{value:'strict',label:'Required'}, {value:'audit',label:'Optional'}]}
              />
              <MobileSettingRow 
                icon={<LogOut size={16}/>} iconBg="#ff3b30" 
                title="Auto-Logout" 
                value={settings?.security?.autoLogout || 'disabled'} 
                onChange={e => updateSettings({ 'security.autoLogout': e.target.value })}
                options={[{value:'disabled',label:'Keep Signed In'}, {value:'enabled',label:'On Browser Close'}]}
              />
            </div>

            {/* DATABASE SECTION */}
            <div style={{ fontSize: '13px', color: '#8e8e93', textTransform: 'uppercase', marginBottom: '6px', marginLeft: '32px' }}>Database</div>
            <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', margin: '0 16px 24px 16px' }}>
              <MobileSettingRow 
                icon={<Download size={16}/>} iconBg="#007aff" 
                title="Export Backup JSON" 
                onClick={!isExporting ? exportData : undefined}
                hideChevron={true}
              >
                {isExporting ? <span style={{ color: '#8e8e93', fontSize: '15px' }}>Exporting...</span> : null}
              </MobileSettingRow>
              <input type="file" id="restore-file-mobile" style={{ display: 'none' }} accept=".json" onChange={handleRestore} />
              <MobileSettingRow 
                icon={<Upload size={16}/>} iconBg="#ff9500" 
                title="Restore from JSON" 
                onClick={!isRestoring ? () => document.getElementById('restore-file-mobile').click() : undefined}
                hideChevron={true}
              >
                {isRestoring ? <span style={{ color: '#8e8e93', fontSize: '15px' }}>Restoring...</span> : null}
              </MobileSettingRow>
            </div>

            {/* SHORTCUTS SECTION */}
            <div style={{ fontSize: '13px', color: '#8e8e93', textTransform: 'uppercase', marginBottom: '6px', marginLeft: '32px' }}>Keyboard Shortcuts</div>
            <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', margin: '0 16px 24px 16px', padding: '8px 0' }}>
              {SHORTCUTS.map((sc, i) => (
                <div key={i} style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', color: '#000' }}>{sc.desc}</span>
                  <span style={{ fontSize: '13px', color: '#8e8e93', background: '#f2f2f7', padding: '4px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>{sc.key}</span>
                </div>
              ))}
            </div>

            {/* DANGER ZONE */}
            <div style={{ fontSize: '13px', color: '#8e8e93', textTransform: 'uppercase', marginBottom: '6px', marginLeft: '32px' }}>Danger Zone</div>
            <div style={{ backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', margin: '0 16px 24px 16px' }}>
              {resetStep === 0 && (
                <MobileSettingRow 
                  title="Factory Reset OS" 
                  isDestructive={true}
                  hideChevron={true}
                  onClick={() => setResetStep(1)}
                />
              )}
              {resetStep === 1 && (
                <div style={{ padding: '16px' }}>
                  <div style={{ fontSize: '15px', color: '#ff3b30', marginBottom: '16px', fontWeight: 600 }}>Are you absolutely sure? This cannot be undone.</div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setResetStep(0)} style={{ flex: 1, padding: '12px', backgroundColor: '#e3e3e8', color: '#000', borderRadius: '10px', border: 'none', fontWeight: 600, fontSize: '15px' }}>Cancel</button>
                    <button onClick={() => setResetStep(2)} style={{ flex: 1, padding: '12px', backgroundColor: '#ff3b30', color: 'white', borderRadius: '10px', border: 'none', fontWeight: 600, fontSize: '15px' }}>Yes, proceed</button>
                  </div>
                </div>
              )}
              {resetStep === 2 && (
                <div style={{ padding: '16px' }}>
                  <div style={{ fontSize: '15px', color: '#ff3b30', marginBottom: '12px', fontWeight: 600 }}>Type <strong>EVORISE-RESET-CONFIRM</strong></div>
                  <input type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', border: '1px solid #ff3b30', borderRadius: '10px', fontSize: '15px', marginBottom: '16px', outline: 'none' }}/>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => {setResetStep(0); setResetConfirmText('');}} style={{ flex: 1, padding: '12px', backgroundColor: '#e3e3e8', color: '#000', borderRadius: '10px', border: 'none', fontWeight: 600, fontSize: '15px' }}>Abort</button>
                    <button onClick={handleSystemReset} disabled={isExporting} style={{ flex: 1, padding: '12px', backgroundColor: '#ff3b30', color: 'white', borderRadius: '10px', border: 'none', fontWeight: 600, fontSize: '15px', opacity: resetConfirmText === 'EVORISE-RESET-CONFIRM' ? 1 : 0.5 }}>
                      {isExporting ? 'Executing...' : 'Execute Wipe'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // DESKTOP RENDER
  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', gap: '24px' }}>
      
      {/* Settings Navigation */}
      <div className="matte-3d" style={{ width: '268px', borderRadius: '20px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
        <div style={{ padding: '8px 12px 12px', borderBottom: '1px solid rgba(42,159,175,0.12)', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>System Settings</h3>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-hint)' }}>Workspace configuration</p>
        </div>
        <SettingsTab active={activeTab === 'general'}    onClick={() => setActiveTab('general')}    icon={<SettingsIcon size={16} />} label="General" isMobile={false} />
        <SettingsTab active={activeTab === 'automation'} onClick={() => setActiveTab('automation')} icon={<HardDrive size={16} />}   label="Automation" isMobile={false} />
        <SettingsTab active={activeTab === 'database'}   onClick={() => setActiveTab('database')}   icon={<Database size={16} />}    label="Backup" isMobile={false} />
        <SettingsTab active={activeTab === 'security'}   onClick={() => setActiveTab('security')}   icon={<Shield size={16} />}      label="Security" isMobile={false} />
        <SettingsTab active={activeTab === 'shortcuts'}  onClick={() => setActiveTab('shortcuts')}  icon={<Keyboard size={16} />}    label="Shortcuts" isMobile={false} />
      </div>

      {/* Settings Content Area */}
      <div className="matte-3d-inset" style={{ flex: 1, padding: '30px', borderRadius: '24px', overflowY: 'auto' }}>
        
        {activeTab === 'general' && (
          <div className="fade-in">
            <h2>General System Preferences</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Configure global OS behaviors.</p>
            
            {loading ? <p>Loading settings...</p> : (
              <div className="matte-3d" style={{ padding: '18px', marginTop: '16px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="icon-pill icon-pill-teal"><Clock size={18}/></div>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Auto-Lock Inactivity Timeout</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Time before system locks automatically</p>
                    </div>
                  </div>
                  <select 
                    value={settings?.general?.autoLockTimeout || '10'}
                    onChange={e => updateSettings({ 'general.autoLockTimeout': e.target.value })}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-matte)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="5">5 Minutes</option>
                    <option value="10">10 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="60">60 Minutes</option>
                    <option value="never">Never</option>
                  </select>
                </div>
                
                <div className="card-divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="icon-pill icon-pill-blue"><Clock size={18}/></div>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Date & Time Format</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Standard format across the workspace</p>
                    </div>
                  </div>
                  <select 
                    value={settings?.general?.timeFormat || '12h'}
                    onChange={e => updateSettings({ 'general.timeFormat': e.target.value })}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-matte)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="12h">12-Hour (AM/PM)</option>
                    <option value="24h">24-Hour</option>
                  </select>
                </div>

                <div className="card-divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="icon-pill icon-pill-purple"><Shield size={18}/></div>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Dynamic Island Overlay</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Enable PC floating multi-tool</p>
                    </div>
                  </div>
                  <select 
                    value={settings?.general?.dynamicIsland !== false ? 'enabled' : 'disabled'}
                    onChange={e => updateSettings({ 'general.dynamicIsland': e.target.value === 'enabled' })}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-matte)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div className="card-divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="icon-pill icon-pill-orange"><Target size={18}/></div>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Auto-Open Task Reminders</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Automatically focus on task when reminded</p>
                    </div>
                  </div>
                  <select 
                    value={settings?.general?.autoNavigateOnReminder ? 'enabled' : 'disabled'}
                    onChange={e => updateSettings({ 'general.autoNavigateOnReminder': e.target.value === 'enabled' })}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-matte)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div className="card-divider" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div className="icon-pill icon-pill-teal"><LayoutDashboard size={18}/></div>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Dynamic Island Testing</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Simulate system events globally</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('TRIGGER_DYNAMIC_ISLAND', { detail: { type: 'nova-announcement', data: { title: 'Nova AI', body: 'System performance successfully optimized.', actionUrl: '#' } } }))}
                      className="glass-btn" style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--grad-blue)', color: 'white', border: 'none' }}>Nova Announcement</button>
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('TRIGGER_DYNAMIC_ISLAND', { detail: { type: 'stopwatch' } }))}
                      className="glass-btn" style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--color-deep-orange)', color: 'white', border: 'none' }}>Start Stopwatch</button>

                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('TRIGGER_DYNAMIC_ISLAND', { detail: { type: 'stopwatch', action: 'remove' } }))}
                      className="glass-btn" style={{ padding: '8px 16px', fontSize: '13px', background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)' }}>Clear Stopwatch</button>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="fade-in">
            <h2>Automation & Storage Cleanup</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Configure automated housekeeping to maintain database speed.</p>
            
            {loading ? <p>Loading settings...</p> : (
              <div className="matte-3d" style={{ padding: '18px', marginTop: '16px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="icon-pill icon-pill-orange"><HardDrive size={18}/></div>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Auto-Archive Old Tasks</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Move 'Done' tasks to archive after this many days</p>
                    </div>
                  </div>
                  <select 
                    value={settings?.automation?.autoArchiveDays || '30'}
                    onChange={e => updateSettings({ 'automation.autoArchiveDays': parseInt(e.target.value) })}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-matte)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="15">15 Days</option>
                    <option value="30">30 Days</option>
                    <option value="60">60 Days</option>
                    <option value="90">90 Days</option>
                    <option value="999">Never</option>
                  </select>
                </div>

                <div className="card-divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="icon-pill icon-pill-red"><AlertOctagon size={18}/></div>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Log Retention Period</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Auto-delete session logs after this many days</p>
                    </div>
                  </div>
                  <select 
                    value={settings?.automation?.logRetentionDays || '90'}
                    onChange={e => updateSettings({ 'automation.logRetentionDays': parseInt(e.target.value) })}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-matte)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="180">6 Months</option>
                    <option value="365">1 Year</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'database' && (
          <div className="fade-in">
            <h2>Database Backup & Restore</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Export system data to JSON or restore from a previous state.</p>
            
            <div style={{ display: 'flex', gap: '20px', marginTop: '24px' }}>
              <div className="matte-3d" style={{ flex: 1, padding: '24px', borderRadius: '16px', textAlign: 'center' }}>
                <Download size={32} color="var(--color-ocean-blue)" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px 0' }}>Export Database</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Downloads all system collections (Clients, Tasks, Users) to a secure JSON file.</p>
                <button 
                  onClick={exportData}
                  disabled={isExporting}
                  style={{ width: '100%', padding: '12px', background: 'var(--color-ocean-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isExporting ? 'Exporting Data...' : 'Export JSON Backup'}
                </button>
              </div>

              <div className="matte-3d" style={{ flex: 1, padding: '24px', borderRadius: '16px', textAlign: 'center' }}>
                <Upload size={32} color="var(--color-deep-orange)" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px 0' }}>Restore System</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Upload a JSON backup file to overwrite current database records.</p>
                
                <input type="file" id="restore-file" style={{ display: 'none' }} accept=".json" onChange={handleRestore} />
                <button 
                  onClick={() => document.getElementById('restore-file').click()}
                  disabled={isRestoring}
                  style={{ width: '100%', padding: '12px', background: 'rgba(255, 87, 34, 0.1)', color: 'var(--color-deep-orange)', border: '1px solid rgba(255, 87, 34, 0.3)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isRestoring ? 'Restoring System...' : 'Upload JSON Backup'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="fade-in">
            <h2>Security & Access Policies</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Manage global access permissions and location strictness.</p>
            
            {loading ? <p>Loading settings...</p> : (
              <div className="matte-3d" style={{ padding: '20px', marginTop: '20px', borderRadius: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}><LocateFixed size={20}/></div>
                    <div>
                      <h4 style={{ margin: 0 }}>Location Strictness</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Require location sharing to log into Evorise OS</p>
                    </div>
                  </div>
                  <select 
                    value={settings?.security?.locationStrictness || 'strict'}
                    onChange={e => updateSettings({ 'security.locationStrictness': e.target.value })}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-matte)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="strict">Strict (Required)</option>
                    <option value="audit">Audit Mode (Optional)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}><LogOut size={20}/></div>
                    <div>
                      <h4 style={{ margin: 0 }}>Auto-Logout</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Log users out when they close their browser</p>
                    </div>
                  </div>
                  <select 
                    value={settings?.security?.autoLogout || 'disabled'}
                    onChange={e => updateSettings({ 'security.autoLogout': e.target.value })}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-matte)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="disabled">Keep Signed In</option>
                    <option value="enabled">On Browser Close</option>
                  </select>
                </div>
              </div>
            )}

            <h2 style={{ color: '#D32F2F', marginTop: '40px' }}>Danger Zone: System Reset</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Wipe all application data. This requires 3-step verification.</p>
            
            <div className="matte-3d" style={{ padding: '24px', marginTop: '16px', borderRadius: '16px', border: '1px solid rgba(211, 47, 47, 0.3)', background: 'rgba(211, 47, 47, 0.05)' }}>
              
              {resetStep === 0 && (
                <>
                  <h3 style={{ margin: '0 0 8px 0', color: '#D32F2F' }}>Factory Reset OS</h3>
                  <p style={{ fontSize: '14px', marginBottom: '20px' }}>This will delete all tasks, users, and logs. An automatic backup will be downloaded before execution.</p>
                  <button onClick={() => setResetStep(1)} style={{ padding: '10px 20px', background: '#D32F2F', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Initiate Reset Sequence</button>
                </>
              )}

              {resetStep === 1 && (
                <div className="fade-in">
                  <h3 style={{ color: '#D32F2F' }}>Step 1: Are you absolutely sure?</h3>
                  <p>This action cannot be undone from the cloud once executed.</p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button onClick={() => setResetStep(2)} style={{ padding: '10px 20px', background: '#D32F2F', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Yes, proceed</button>
                    <button onClick={() => setResetStep(0)} style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}

              {resetStep === 2 && (
                <div className="fade-in">
                  <h3 style={{ color: '#D32F2F' }}>Step 2: Final Verification</h3>
                  <p>Type <strong>EVORISE-RESET-CONFIRM</strong> below to execute the reset.</p>
                  <input 
                    type="text" 
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="Type confirmation here..."
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(211,47,47,0.5)', background: 'white', marginBottom: '16px' }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleSystemReset} disabled={isExporting} style={{ padding: '10px 20px', background: '#D32F2F', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', opacity: resetConfirmText === 'EVORISE-RESET-CONFIRM' ? 1 : 0.5 }}>
                      {isExporting ? 'Executing...' : 'EXECUTE SYSTEM WIPE'}
                    </button>
                    <button onClick={() => {setResetStep(0); setResetConfirmText('');}} style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Abort</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="fade-in">
            <h2>Keyboard Shortcuts</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Master these hotkeys to navigate the workspace instantly.</p>
            
            <div className="matte-3d" style={{ marginTop: '20px', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1px', background: 'var(--border-light)' }}>
                {SHORTCUTS.map((sc, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'white' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{sc.desc}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {sc.key.split(' + ').map((k, j) => (
                        <React.Fragment key={j}>
                          {j > 0 && <span style={{ color: 'var(--text-hint)', fontSize: '12px', alignSelf: 'center' }}>+</span>}
                          <kbd style={{ background: 'rgba(0,0,0,0.04)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const SettingsTab = ({ active, onClick, icon, label, isMobile }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: isMobile ? '8px 16px' : '10px 12px',
      width: isMobile ? 'auto' : '100%',
      border: '1px solid transparent',
      borderRadius: '11px',
      background: active ? 'rgba(42,159,175,0.10)' : 'transparent',
      color: active ? 'var(--teal-deep)' : 'var(--text-secondary)',
      fontWeight: active ? 700 : 500,
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      textAlign: 'left',
      borderColor: active ? 'rgba(42,159,175,0.22)' : 'transparent',
      fontFamily: 'Inter, sans-serif',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}
    onMouseOver={(e) => { if(!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
    onMouseOut={(e)  => { if(!active) e.currentTarget.style.background = 'transparent' }}
  >
    <span style={{ color: active ? 'var(--teal)' : 'var(--text-hint)', display: 'flex', flexShrink: 0 }}>{icon}</span>
    {label}
  </button>
);

export default SystemSettings;
