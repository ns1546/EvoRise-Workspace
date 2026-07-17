import React, { useState, useTransition, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CheckSquare, 
  Calendar, 
  MessageSquare,
  Building2,
  Settings,
  Bell,
  Search,
  Menu,
  ChevronRight,
  LogOut,
  Lock,
  FileText,
  MessageCircle,
  Mail,
  Activity,
  Trophy,
  AlertOctagon,
  Target,
  UserX,
  Video,
  BarChart2,
  Database,
  Archive,
  AlignJustify,
  Plus,
  X,
  MoreHorizontal,
  Home,
  Notebook,
  Zap,
  Settings2
} from 'lucide-react';
import './index.css';
import './mobile-app.css';
import useIsMobile from './hooks/useIsMobile';
import { useAuth } from './contexts/AuthContext';
import { useNotifications } from './contexts/NotificationContext';
import { useSettings } from './contexts/SettingsContext';

import EvoBoard from './components/EvoBoard';
import WhatsApp from './components/WhatsApp';
import Mailbox from './components/Mailbox';
import TeamDirectory from './components/TeamDirectory';
import CalendarView from './components/CalendarView';
import InstantWork from './components/InstantWork';
import SystemSettings from './components/SystemSettings';
import ClientManagement from './components/ClientManagement';
import Dashboard from './components/Dashboard';
import EvoNotes from './components/EvoNotes';
import NotificationCenter from './components/NotificationCenter';
import SessionLogs from './components/SessionLogs';
import PerformancePage from './components/PerformancePage';
import ReportsPage from './components/ReportsPage';
import NoticeBoard from './components/NoticeBoard';
import GlobalToastOverlay from './components/GlobalToastOverlay';
import ErrorLogsPage, { GlobalErrorBoundary } from './components/ErrorLogsPage';
import MyDay from './components/MyDay';
import Meetings from './components/Meetings';
import GlobalCallOverlay from './components/GlobalCallOverlay';
import WebRTCCallRoom from './components/WebRTCCallRoom';
import DatabaseView from './components/DatabaseView';
import AdvancedAnalytics from './components/AdvancedAnalytics';
import UserProfileModal from './components/UserProfileModal';
import ArchiveTrash from './components/ArchiveTrash';
import GlobalCommandPalette from './components/GlobalCommandPalette';
import NovaAssistant from './components/NovaAssistant';
import GlobalDataInspector from './components/GlobalDataInspector';
import TaskReminderService from './components/TaskReminderService';
import DynamicIsland from './components/DynamicIsland';
import GlobalHotkeys from './components/GlobalHotkeys';
import InstallAppPrompt from './components/InstallAppPrompt';
import LinkHub from './components/LinkHub';
import ControlCenter from './components/ControlCenter';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { App as CapacitorApp } from '@capacitor/app';

const App = () => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [activeMenu, _setActiveMenu] = useState('dashboard');
  const [isPending, startTransition] = useTransition();

  const setActiveMenu = (menu) => {
    if (activeMenu !== menu) {
      window.history.pushState({ menu }, '', `#${menu}`);
      startTransition(() => {
        _setActiveMenu(menu);
      });
    }
  };

  React.useEffect(() => {
    // Initial history state
    window.history.replaceState({ menu: activeMenu }, '', `#${activeMenu}`);

    const handlePopState = (event) => {
      // First, dispatch a global event to close any open modals (if they are listening)
      window.dispatchEvent(new CustomEvent('close-modals'));

      // Then restore the active menu if available in state
      if (event.state && event.state.menu) {
        startTransition(() => {
          _setActiveMenu(event.state.menu);
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeMenu]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCompactView, setIsCompactView] = useState(() => localStorage.getItem('compactView') === 'true');
  const [activeWebRTCCall, setActiveWebRTCCall] = useState(null); // { roomId, type }
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isTasksMenuOpen, setIsTasksMenuOpen] = useState(false);
  const { currentUser, userData, logout, systemLocked, lockSystem, unlockSystem, permissionDenied, forceUnlock, isUnlocking } = useAuth();
  const { unreadCount, badges, setIsDrawerOpen, markModuleAsRead } = useNotifications();
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  React.useEffect(() => {
    const handleIncomingReminder = (e) => {
      if (settings?.general?.autoNavigateOnReminder) {
        setActiveMenu('evoboard');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('focus-task', { detail: { taskId: e.detail.taskId } }));
        }, 300);
      }
    };
    window.addEventListener('incoming-reminder', handleIncomingReminder);
    return () => window.removeEventListener('incoming-reminder', handleIncomingReminder);
  }, [settings?.general?.autoNavigateOnReminder]);

  React.useEffect(() => {
    const hasGreeted = sessionStorage.getItem('novaGreeted');
    if (!hasGreeted && userData?.name) {
      sessionStorage.setItem('novaGreeted', 'true');
      setTimeout(() => {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        
        window.dispatchEvent(new CustomEvent('TRIGGER_DYNAMIC_ISLAND', {
          detail: {
            type: 'nova-announcement',
            data: {
              title: 'Nova',
              body: `${greeting}, ${userData.name.split(' ')[0]}. Welcome back to the Workspace.`
            }
          }
        }));
      }, 2000);
    }
  }, [userData]);

  const pageTitles = {
    dashboard: 'Dashboard', myday: 'My Day', evonotes: 'Evo Notes',
    clients: 'Clients & Services', evoboard: 'EvoBoard', instant: 'Instant Work',
    team: 'Team Directory', calendar: 'Calendar', meetings: 'Meetings',
    whatsapp: 'WhatsApp Chat', mailbox: 'Evorise Mail',
    notifications: 'Notifications', sessionlogs: 'System Audits',
    noticeboard: 'Notice Board', performance: 'Performance',
    reports: 'Reports', analytics: 'Analytics', database: 'Database',
    archive: 'Archive', errorlogs: 'Error Logs', settings: 'Settings',
    linkhub: 'Link Hub',
  };
  // Pages that need full-height zero-padding on mobile
  const fullHeightPages = ['whatsapp', 'evonotes', 'myday', 'noticeboard', 'meetings', 'performance'];

  const userRole = userData?.role || 'Employee';
  const isAdmin = userRole === 'Admin' || userRole === 'Administrator' || userRole === 'Partner';
  const isFullHeight = isMobile && fullHeightPages.includes(activeMenu);

  // Auto-clear notification badges when navigating to a non-task module
  React.useEffect(() => {
    if (!activeMenu || !markModuleAsRead) return;
    const taskModules = ['myday', 'evoboard', 'instant', 'notifications'];
    if (!taskModules.includes(activeMenu) && badges[activeMenu] > 0) {
       markModuleAsRead(activeMenu);
    }
  }, [activeMenu, markModuleAsRead, badges]);

  React.useEffect(() => {
    const handleStartCall = (e) => {
      setActiveWebRTCCall(e.detail);
    };
    window.addEventListener('START_NATIVE_CALL', handleStartCall);
    return () => window.removeEventListener('START_NATIVE_CALL', handleStartCall);
  }, []);

  // Initialize Native Device Features (Capacitor)
  React.useEffect(() => {
    const initNativeFeatures = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Make status bar dark (white text) to match our #070d1a theme
          await StatusBar.setStyle({ style: Style.Dark });
          
          // Android specific: prevent keyboard from pushing the entire UI off-screen
          if (Capacitor.getPlatform() === 'android') {
             await Keyboard.setResizeMode({ mode: 'none' });
          }

          // Handle Android hardware back button
          CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            if (!canGoBack) CapacitorApp.exitApp();
            else window.history.back();
          });
        } catch (e) {
          console.warn('Native init error:', e);
        }
      }
    };
    initNativeFeatures();
    
    return () => {
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.removeAllListeners();
      }
    };
  }, []);

  React.useEffect(() => {
    const handleNavigate = (e) => {
      if (e.detail?.menu) {
        setActiveMenu(e.detail.menu);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  React.useEffect(() => {
    if (isMobile && isMobileMoreOpen && activeMenu) {
      setTimeout(() => {
        const el = document.getElementById(`more-${activeMenu}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [isMobile, isMobileMoreOpen, activeMenu]);

  React.useEffect(() => {
    localStorage.setItem('compactView', isCompactView);
    if (isCompactView) document.body.classList.add('compact-view');
    else document.body.classList.remove('compact-view');
  }, [isCompactView]);

  if (userData?.status === 'Resigned') {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', background: 'var(--bg-matte)' }}>
        <div className="glass-panel" style={{ width: '400px', padding: '40px', borderRadius: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', animation: 'float-in 0.5s ease-out forwards', borderTop: '8px solid #ef4444' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', marginBottom: '10px' }}>
             <UserX size={40} />
          </div>
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Account Suspended</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
            Your employee account has been marked as resigned or suspended. You no longer have access to the Evorise Workspace.
          </p>
          <button 
             onClick={logout}
             style={{ padding: '14px 24px', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', marginTop: '10px', width: '100%', boxShadow: '0 10px 20px rgba(239, 68, 68, 0.3)' }}
          >
             Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (systemLocked) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', background: 'var(--bg-matte)' }}>
        <div className="glass-panel" style={{ width: '400px', padding: '40px', borderRadius: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', animation: 'float-in 0.5s ease-out forwards' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 87, 34, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-deep-orange)', marginBottom: '10px' }}>
             <Lock size={40} />
          </div>
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>System Locked</h2>
          
          {permissionDenied ? (
            <div style={{ background: 'rgba(255, 87, 34, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 87, 34, 0.2)' }}>
              <p style={{ margin: 0, color: 'var(--color-deep-orange)', fontSize: '14px', lineHeight: '1.6', fontWeight: 600 }}>
                Location Access Blocked
              </p>
              <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
                Your browser is blocking location access. Please click the lock icon (🔒) in your browser's address bar, enable Location, and then click Unlock.
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              Evorise OS requires location access for security and activity tracking. Please allow location access to continue.
            </p>
          )}

          <button 
             onClick={unlockSystem}
             disabled={isUnlocking}
             style={{ padding: '14px 24px', background: 'linear-gradient(135deg, var(--color-ocean-blue) 0%, #004488 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: isUnlocking ? 'wait' : 'pointer', marginTop: '10px', width: '100%', boxShadow: '0 10px 20px rgba(0, 102, 204, 0.3)', opacity: isUnlocking ? 0.7 : 1 }}
          >
             {isUnlocking ? "Requesting Location..." : permissionDenied ? "I have enabled it, Unlock Now" : "Grant Access & Unlock"}
          </button>

          <button 
             onClick={logout}
             style={{ background: 'transparent', border: 'none', color: 'var(--color-deep-orange)', cursor: 'pointer', fontSize: '14px', marginTop: '5px', fontWeight: 600 }}
          >
             Logout
          </button>
        </div>
      </div>
    );
  }


  const mobileNavNavigate = (menu) => {
    setActiveMenu(menu);
    setIsMobileMoreOpen(false);
    setIsTasksMenuOpen(false);
  };

  return (
    <div className="app-container">
      {/* Sidebar with Glassmorphism */}
      <nav className="sidebar glass-panel" style={{ 
        display: isMobile ? 'none' : 'flex',
        width: isSidebarCollapsed ? '72px' : '258px', 
        minWidth: isSidebarCollapsed ? '72px' : '258px',
        transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
        padding: isSidebarCollapsed ? '16px 8px' : '16px 11px'
      }}>
        {/* Real Image Logo Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid rgba(0, 80, 180, 0.10)', flexShrink: 0, gap: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img 
              src="/ev_logo.png" 
              alt="Evorise Logo" 
              style={{ width: '38px', height: '38px', objectFit: 'contain', flexShrink: 0 }}
            />
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap' }}>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 900, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, var(--teal) 0%, var(--blue) 50%, var(--orange) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EVORISE</h1>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '1.2px', textTransform: 'uppercase', marginTop: '-2px' }}>Workspace</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Nav Items */}
        <div className="sidebar-nav-scroll">
          {!isSidebarCollapsed && <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-hint)', padding: '6px 10px 3px', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Workspace</div>}
          <MenuButton icon={<LayoutDashboard size={18} />} label="Dashboard" isActive={activeMenu === 'dashboard'} onClick={() => setActiveMenu('dashboard')} badge={badges['dashboard'] > 0 ? badges['dashboard'] : null} isCollapsed={isSidebarCollapsed} />
          <MenuButton icon={<Notebook size={18} />} label="Link Hub" isActive={activeMenu === 'linkhub'} onClick={() => setActiveMenu('linkhub')} isCollapsed={isSidebarCollapsed} />
          <MenuButton icon={<Target size={18} />} label="My Day" isActive={activeMenu === 'myday'} onClick={() => setActiveMenu('myday')} badge={badges['myday'] > 0 ? badges['myday'] : null} isCollapsed={isSidebarCollapsed} />
          <MenuButton icon={<FileText size={18} />} label="Evo Notes" isActive={activeMenu === 'evonotes'} onClick={() => setActiveMenu('evonotes')} badge={badges['evonotes'] > 0 ? badges['evonotes'] : null} isCollapsed={isSidebarCollapsed} />
          {isAdmin && <MenuButton icon={<Building2 size={18} />} label="Clients & Services" isActive={activeMenu === 'clients'} onClick={() => setActiveMenu('clients')} badge={badges['clients'] > 0 ? badges['clients'] : null} isCollapsed={isSidebarCollapsed} />}
          {isAdmin && <MenuButton icon={<Briefcase size={18} />} label="Evo Board" isActive={activeMenu === 'evoboard'} onClick={() => setActiveMenu('evoboard')} badge={badges['evoboard'] > 0 ? badges['evoboard'] : null} isCollapsed={isSidebarCollapsed} />}
          <MenuButton icon={<CheckSquare size={18} />} label="Instant Work" isActive={activeMenu === 'instant'} onClick={() => setActiveMenu('instant')} badge={badges['instant'] > 0 ? badges['instant'] : null} isCollapsed={isSidebarCollapsed} />
          
          <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 6px' }}/>
          {!isSidebarCollapsed && <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-hint)', padding: '6px 10px 3px', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Communication</div>}
          <MenuButton icon={<Users size={18} />} label="Team Directory" isActive={activeMenu === 'team'} onClick={() => setActiveMenu('team')} badge={badges['team'] > 0 ? badges['team'] : null} isCollapsed={isSidebarCollapsed} />
          <MenuButton icon={<Calendar size={18} />} label="Calendar" isActive={activeMenu === 'calendar'} onClick={() => setActiveMenu('calendar')} badge={badges['calendar'] > 0 ? badges['calendar'] : null} isCollapsed={isSidebarCollapsed} />
          <MenuButton icon={<Video size={18} />} label="Meetings" isActive={activeMenu === 'meetings'} onClick={() => setActiveMenu('meetings')} badge={badges['meetings'] > 0 ? badges['meetings'] : null} isCollapsed={isSidebarCollapsed} />
          <MenuButton icon={<MessageCircle size={18} />} label="WhatsApp Chat" isActive={activeMenu === 'whatsapp'} onClick={() => setActiveMenu('whatsapp')} badge={badges['whatsapp'] > 0 ? badges['whatsapp'] : null} isCollapsed={isSidebarCollapsed} />
          <MenuButton icon={<Mail size={18} />} label="Evorise Mail" isActive={activeMenu === 'mailbox'} onClick={() => setActiveMenu('mailbox')} badge={badges['mailbox'] > 0 ? badges['mailbox'] : null} isCollapsed={isSidebarCollapsed} />
          
          <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 6px' }}/>
          {!isSidebarCollapsed && <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-hint)', padding: '6px 10px 3px', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Tracking</div>}
          <MenuButton
            icon={<Bell size={18} />}
            label="Notifications"
            isActive={activeMenu === 'notifications'}
            onClick={() => setActiveMenu('notifications')}
            badge={unreadCount > 0 ? unreadCount : null}
            isCollapsed={isSidebarCollapsed}
          />
          {isAdmin && <MenuButton icon={<Activity size={18} />} label="System Audits" isActive={activeMenu === 'sessionlogs'} onClick={() => setActiveMenu('sessionlogs')} badge={badges['sessionlogs'] > 0 ? badges['sessionlogs'] : null} isCollapsed={isSidebarCollapsed} />}
          <MenuButton icon={<AlertOctagon size={18} />} label="Notice Board" isActive={activeMenu === 'noticeboard'} onClick={() => setActiveMenu('noticeboard')} badge={badges['noticeboard'] > 0 ? badges['noticeboard'] : null} isCollapsed={isSidebarCollapsed} />
          {isAdmin && <MenuButton icon={<Trophy size={18} />} label="Performance Logs" isActive={activeMenu === 'performance'} onClick={() => setActiveMenu('performance')} badge={badges['performance'] > 0 ? badges['performance'] : null} isCollapsed={isSidebarCollapsed} />}
          
          {isAdmin && (
            <>
              <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 6px' }}/>
              {!isSidebarCollapsed && <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-hint)', padding: '6px 10px 3px', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Data & Analytics</div>}
              <MenuButton icon={<BarChart2 size={18} />} label="Reports" isActive={activeMenu === 'reports'} onClick={() => setActiveMenu('reports')} badge={badges['reports'] > 0 ? badges['reports'] : null} isCollapsed={isSidebarCollapsed} />
              <MenuButton icon={<Activity size={18} />} label="Deep Analytics" isActive={activeMenu === 'analytics'} onClick={() => setActiveMenu('analytics')} badge={badges['analytics'] > 0 ? badges['analytics'] : null} isCollapsed={isSidebarCollapsed} />
              <MenuButton icon={<Database size={18} />} label="Database" isActive={activeMenu === 'database'} onClick={() => setActiveMenu('database')} badge={badges['database'] > 0 ? badges['database'] : null} isCollapsed={isSidebarCollapsed} />
              <MenuButton icon={<Archive size={18} />} label="Data Archive" isActive={activeMenu === 'archive'} onClick={() => setActiveMenu('archive')} badge={badges['archive'] > 0 ? badges['archive'] : null} isCollapsed={isSidebarCollapsed} />
              <MenuButton icon={<AlertOctagon size={18} />} label="Error Logs" isActive={activeMenu === 'errorlogs'} onClick={() => setActiveMenu('errorlogs')} badge={badges['errorlogs'] > 0 ? badges['errorlogs'] : null} isCollapsed={isSidebarCollapsed} />
            </>
          )}

          <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 6px' }}/>
          {isAdmin && <MenuButton icon={<Settings size={17} />} label="Settings" isActive={activeMenu === 'settings'} onClick={() => setActiveMenu('settings')} isCollapsed={isSidebarCollapsed} />}
        </div>

        {/* Pinned Profile Footer */}
        <div className="sidebar-footer">
          <div 
            onClick={() => setIsProfileModalOpen(true)}
            style={{ padding: '10px 11px', borderRadius: '13px', background: 'rgba(232,67,10,0.06)', border: '1px solid rgba(232,67,10,0.15)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(232,67,10,0.11)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(232,67,10,0.06)'}
          >
            <div style={{ width: '33px', height: '33px', borderRadius: '50%', background: 'var(--grad-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '13px', flexShrink: 0, overflow: 'hidden', boxShadow: '0 3px 10px rgba(232,67,10,0.28)' }}>
              {userData?.avatar ? (
                <img src={userData.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (userData?.name || currentUser?.email || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ fontSize: '12.5px', margin: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{userData?.name || currentUser?.email?.split('@')[0] || 'User'}</h4>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>{userData?.role || 'Employee'}</p>
            </div>
            {!isSidebarCollapsed && (
              <button 
                onClick={(e) => { e.stopPropagation(); logout(); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--orange)', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '4px' }}
                title="Logout"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area — flex column for both PC and Mobile */}
      <div className="main-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: isMobile ? '0' : '20px', minWidth: 0 }}>
        
        {/* Mobile App Bar — Native Mobile Style */}
        {isMobile && activeMenu !== 'whatsapp' && (
          <header className="mobile-app-bar">
            <div className="mobile-app-bar__left">
              <div
                className="mobile-app-bar__avatar"
                onClick={() => setIsProfileModalOpen(true)}
              >
                {userData?.avatar
                  ? <img src={userData.avatar} alt="Profile" />
                  : (userData?.name || currentUser?.email || 'U').charAt(0).toUpperCase()
                }
              </div>
            </div>
            <div className="mobile-app-bar__center">
              <span className="mobile-app-bar__title">
                {pageTitles[activeMenu] || activeMenu}
              </span>
            </div>
            <div className="mobile-app-bar__actions">
              <button
                className="mobile-icon-btn"
                onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
                aria-label="Search"
              >
                <Search size={22} color="var(--blue)" />
              </button>
              <button
                className="mobile-icon-btn"
                onClick={() => setActiveMenu('notifications')}
                aria-label="Notifications"
              >
                <Bell size={22} color={unreadCount > 0 ? "var(--orange)" : "var(--blue)"} className={unreadCount > 0 ? "island-bell-ring" : ""} />
                {unreadCount > 0 && <span className="notif-dot" />}
              </button>
            </div>
          </header>
        )}

        {/* PC Top Navigation */}
        <header className="top-nav glass-panel" style={{ display: isMobile ? 'none' : 'flex', overflow: 'visible', zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
              style={{ cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.03)' }}
            >
              <Menu size={20} color="var(--text-tertiary)" />
            </div>
            <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
              {activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1)}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
               onClick={() => setIsCompactView(!isCompactView)}
               style={{ background: 'rgba(255,255,255,0.60)', border: '1px solid var(--border-strong)', padding: '7px 13px', borderRadius: '10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12.5px', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}
               onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.88)'}
               onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.60)'}
            >
               <AlignJustify size={14} /> {isCompactView ? "Cozy View" : "Compact View"}
            </button>
            <button 
               onClick={lockSystem}
               style={{ background: 'rgba(255,255,255,0.60)', border: '1px solid var(--border-strong)', padding: '7px 13px', borderRadius: '10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12.5px', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}
               onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.88)'}
               onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.60)'}
            >
               <Lock size={14} /> Lock OS
            </button>
            <div 
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              style={{ display: 'flex', alignItems: 'center', background: 'rgba(210,222,238,0.45)', border: '1px solid rgba(180,200,225,0.42)', borderRadius: '11px', padding: '7px 13px', width: '270px', backdropFilter: 'blur(12px)', gap: '8px', cursor: 'pointer' }}
            >
              <Search size={15} color="var(--text-hint)" />
              <input 
                type="text" 
                placeholder="Search tasks, users, clients..."
                readOnly
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', cursor: 'pointer', pointerEvents: 'none' }}
              />
            </div>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setActiveMenu('notifications')}>
              <div className="matte-3d" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
                <Bell size={20} color={unreadCount > 0 ? "var(--orange)" : "var(--text-primary)"} className={unreadCount > 0 ? "island-bell-ring" : ""} />
              </div>
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px', background: 'var(--color-deep-orange)', borderRadius: '9px', border: '2px solid var(--bg-matte)', fontSize: '10px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </div>
            
            {/* Control Center Toggle */}
            <div style={{ position: 'relative' }}>
              <div 
                className="matte-3d" 
                onClick={(e) => { e.stopPropagation(); setIsControlCenterOpen(!isControlCenterOpen); }}
                style={{ cursor: 'pointer', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: isControlCenterOpen ? 'var(--blue)' : 'var(--bg-matte)', color: isControlCenterOpen ? 'white' : 'var(--text-primary)' }}
              >
                <Settings2 size={20} />
              </div>
              <ControlCenter isOpen={isControlCenterOpen} onClose={() => setIsControlCenterOpen(false)} logout={logout} />
            </div>
          </div>
        </header>

        {/* Dynamic Workspace Content */}
        <main className={`main-content glass-panel ${isFullHeight ? 'full-height-mobile' : ''}`} style={{ flex: 1, overflowY: 'auto', position: 'relative', padding: isMobile ? (isFullHeight ? '0' : '16px') : '30px' }}>
          <GlobalErrorBoundary key={activeMenu}>
            {activeMenu === 'dashboard' && <Dashboard />}
            {activeMenu === 'linkhub' && <LinkHub />}
            {activeMenu === 'myday' && <MyDay />}
            {activeMenu === 'evonotes' && <EvoNotes />}
            {activeMenu === 'clients' && <ClientManagement />}
            {activeMenu === 'evoboard' && <EvoBoard />}
            {activeMenu === 'meetings' && <Meetings />}
            {activeMenu === 'whatsapp' && <WhatsApp />}
            {activeMenu === 'mailbox' && <Mailbox />}
            {activeMenu === 'team' && <TeamDirectory />}
            {activeMenu === 'calendar' && <CalendarView />}
            {activeMenu === 'instant' && <InstantWork />}
            {activeMenu === 'settings' && <SystemSettings />}
            {activeMenu === 'notifications' && <NotificationCenter />}
            {activeMenu === 'sessionlogs' && <SessionLogs />}
            {activeMenu === 'noticeboard' && <NoticeBoard />}
            {activeMenu === 'performance' && <PerformancePage />}
            {activeMenu === 'reports' && <ReportsPage />}
            {activeMenu === 'analytics' && <AdvancedAnalytics />}
            {activeMenu === 'database' && <DatabaseView />}
            {activeMenu === 'archive' && <ArchiveTrash />}
            {activeMenu === 'errorlogs' && <ErrorLogsPage />}
          </GlobalErrorBoundary>
        </main>
      </div>

      {/* ══ MOBILE FAB — context-aware primary action button ══ */}
      {isMobile && (
        ['clients', 'evonotes', 'noticeboard', 'mailbox'].includes(activeMenu) ||
        (activeMenu === 'evoboard' && isAdmin) ||
        (activeMenu === 'team' && isAdmin) ||
        (activeMenu === 'instant' && isAdmin)
      ) && (
        <button
          className="mobile-fab"
          aria-label="New item"
          onClick={() => {
            const eventMap = {
              evoboard:    'mobile-fab-evoboard',
              clients:     'mobile-fab-clients',
              evonotes:    'mobile-fab-evonotes',
              noticeboard: 'mobile-fab-noticeboard',
              mailbox:     'mobile-fab-mailbox',
              team:        'mobile-fab-team',
              instant:     'mobile-fab-instant',
            };
            window.dispatchEvent(new CustomEvent(eventMap[activeMenu]));
          }}
        >
          <Plus size={26} />
        </button>
      )}

      {/* ══════════════════════════════════════════════
           MOBILE BOTTOM NAVIGATION BAR (NATIVE STYLE)
          ══════════════════════════════════════════════ */}
      {isMobile && (
        <nav className="mobile-bottom-nav" role="navigation" aria-label="Main navigation">
          {/* Home */}
          <button
            className={`mobile-nav-tab ${activeMenu === 'dashboard' ? 'active' : ''}`}
            onClick={() => mobileNavNavigate('dashboard')}
            aria-label="Dashboard"
          >
            <div className="mobile-nav-tab__icon-wrap">
              <Home size={26} strokeWidth={activeMenu === 'dashboard' ? 2.5 : 2} color={activeMenu === 'dashboard' ? 'var(--blue)' : '#8E8E93'} />
            </div>
            <span className="mobile-nav-tab__label" style={{ color: activeMenu === 'dashboard' ? 'var(--blue)' : '#8E8E93' }}>Home</span>
          </button>

          {/* Tasks / EvoBoard */}
          <button
            className={`mobile-nav-tab ${activeMenu === 'instant' || activeMenu === 'evoboard' ? 'active' : ''}`}
            onClick={() => { setIsTasksMenuOpen(prev => !prev); setIsMobileMoreOpen(false); }}
            aria-label="Tasks"
          >
            <div className={`mobile-nav-tab__icon-wrap ${(badges?.evoboard > 0 || badges?.instant > 0) ? 'animate-icon-ring' : ''}`}>
              <CheckSquare size={26} strokeWidth={activeMenu === 'instant' || activeMenu === 'evoboard' ? 2.5 : 2} color={activeMenu === 'instant' || activeMenu === 'evoboard' ? 'var(--blue)' : '#8E8E93'} />
              {badges?.evoboard > 0 && <span className="mobile-nav-badge" style={{ right: 'auto', left: '-2px', background: 'var(--color-deep-orange)' }}>{badges.evoboard > 9 ? '9+' : badges.evoboard}</span>}
              {badges?.instant > 0 && <span className="mobile-nav-badge" style={{ right: '-2px', background: '#007AFF' }}>{badges.instant > 9 ? '9+' : badges.instant}</span>}
            </div>
            <span className="mobile-nav-tab__label" style={{ color: activeMenu === 'instant' || activeMenu === 'evoboard' ? 'var(--blue)' : '#8E8E93' }}>Tasks</span>
          </button>

          {/* Chat */}
          <button
            className={`mobile-nav-tab ${activeMenu === 'whatsapp' || activeMenu === 'mailbox' ? 'active' : ''}`}
            onClick={() => mobileNavNavigate('whatsapp')}
            aria-label="Chat"
          >
            <div className={`mobile-nav-tab__icon-wrap ${badges?.whatsapp > 0 || badges?.mailbox > 0 ? 'animate-icon-ring' : ''}`}>
              <MessageCircle size={26} strokeWidth={activeMenu === 'whatsapp' || activeMenu === 'mailbox' ? 2.5 : 2} color={activeMenu === 'whatsapp' || activeMenu === 'mailbox' ? 'var(--blue)' : '#8E8E93'} />
              {(badges?.whatsapp > 0 || badges?.mailbox > 0) && <span className="mobile-nav-badge">{(badges?.whatsapp || 0) + (badges?.mailbox || 0) > 9 ? '9+' : (badges?.whatsapp || 0) + (badges?.mailbox || 0)}</span>}
            </div>
            <span className="mobile-nav-tab__label" style={{ color: activeMenu === 'whatsapp' || activeMenu === 'mailbox' ? 'var(--blue)' : '#8E8E93' }}>Chat</span>
          </button>

          {/* My Day */}
          <button
            className={`mobile-nav-tab ${activeMenu === 'myday' ? 'active' : ''}`}
            onClick={() => mobileNavNavigate('myday')}
            aria-label="My Day"
          >
            <div className={`mobile-nav-tab__icon-wrap ${badges?.myday > 0 ? 'animate-icon-ring' : ''}`}>
              <Target size={26} strokeWidth={activeMenu === 'myday' ? 2.5 : 2} color={activeMenu === 'myday' ? 'var(--blue)' : '#8E8E93'} />
              {badges?.myday > 0 && <span className="mobile-nav-badge">{badges.myday > 9 ? '9+' : badges.myday}</span>}
            </div>
            <span className="mobile-nav-tab__label" style={{ color: activeMenu === 'myday' ? 'var(--blue)' : '#8E8E93' }}>My Day</span>
          </button>

          {/* More */}
          <button
            className={`mobile-nav-tab ${isMobileMoreOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMoreOpen(prev => !prev)}
            aria-label="More"
          >
            <div className="mobile-nav-tab__icon-wrap">
              <MoreHorizontal size={26} strokeWidth={isMobileMoreOpen ? 2.5 : 2} color={isMobileMoreOpen ? 'var(--blue)' : '#8E8E93'} />
              {unreadCount > 0 && <span className="mobile-nav-badge" style={{ background: 'var(--color-deep-orange)' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </div>
            <span className="mobile-nav-tab__label" style={{ color: isMobileMoreOpen ? 'var(--blue)' : '#8E8E93' }}>More</span>
          </button>
        </nav>
      )}

      {/* ══════════════════════════════════════════════
           MOBILE "MORE" SHEET
          ══════════════════════════════════════════════ */}
      {isMobile && isMobileMoreOpen && createPortal(
        <>
          <div className="mobile-more-overlay" onClick={() => setIsMobileMoreOpen(false)} />
          <div className="mobile-more-sheet">
            <div className="mobile-more-sheet__handle" />
            <div className="mobile-more-sheet__header">Menu</div>

            {/* Workspace Section */}
            <div className="mobile-more-section">
              <div className="mobile-more-section-title">Workspace</div>
              {isAdmin && (
                <MobileMoreItem id="more-nova" isActive={activeMenu === 'nova'} icon={<Zap size={18} />} iconBg="linear-gradient(135deg, var(--color-ocean-blue), #818cf8)" iconColor="white" label="Nova AI Assistant" onClick={() => { setIsMobileMoreOpen(false); window.dispatchEvent(new CustomEvent('open-nova')); }} />
              )}
              {isAdmin && (
                <MobileMoreItem id="more-clients" isActive={activeMenu === 'clients'} icon={<Building2 size={18} />} iconBg="rgba(0,96,223,0.12)" iconColor="var(--blue)" label="Clients & Services" onClick={() => mobileNavNavigate('clients')} />
              )}
              {isAdmin && (
                <MobileMoreItem id="more-evoboard" isActive={activeMenu === 'evoboard'} icon={<Briefcase size={18} />} iconBg="rgba(42,159,175,0.12)" iconColor="var(--teal)" label="EvoBoard" onClick={() => mobileNavNavigate('evoboard')} />
              )}
              <MobileMoreItem id="more-linkhub" isActive={activeMenu === 'linkhub'} icon={<Notebook size={18} />} iconBg="rgba(0,150,136,0.12)" iconColor="#009688" label="Link Hub" onClick={() => mobileNavNavigate('linkhub')} />
              <MobileMoreItem id="more-evonotes" isActive={activeMenu === 'evonotes'} icon={<FileText size={18} />} iconBg="rgba(240,115,32,0.12)" iconColor="var(--orange)" label="Evo Notes" onClick={() => mobileNavNavigate('evonotes')} />
            </div>

            {/* Communication Section */}
            <div className="mobile-more-section">
              <div className="mobile-more-section-title">Communication</div>
              <MobileMoreItem id="more-team" isActive={activeMenu === 'team'} icon={<Users size={18} />} iconBg="rgba(42,159,175,0.12)" iconColor="var(--teal)" label="Team Directory" onClick={() => mobileNavNavigate('team')} />
              <MobileMoreItem id="more-calendar" isActive={activeMenu === 'calendar'} icon={<Calendar size={18} />} iconBg="rgba(0,96,223,0.12)" iconColor="var(--blue)" label="Calendar" onClick={() => mobileNavNavigate('calendar')} />
              <MobileMoreItem id="more-meetings" isActive={activeMenu === 'meetings'} icon={<Video size={18} />} iconBg="rgba(139,92,246,0.12)" iconColor="#8b5cf6" label="Meetings" onClick={() => mobileNavNavigate('meetings')} />
              <MobileMoreItem id="more-mailbox" isActive={activeMenu === 'mailbox'} icon={<Mail size={18} />} iconBg="rgba(240,115,32,0.12)" iconColor="var(--orange)" label="Evorise Mail" onClick={() => mobileNavNavigate('mailbox')} />
            </div>

            {/* Tracking Section */}
            <div className="mobile-more-section">
              <div className="mobile-more-section-title">Tracking</div>
              <MobileMoreItem id="more-notifications" isActive={activeMenu === 'notifications'} icon={<Bell size={18} />} iconBg="rgba(240,115,32,0.12)" iconColor="var(--orange)" label="Notifications" badge={unreadCount > 0 ? unreadCount : null} onClick={() => mobileNavNavigate('notifications')} />
              <MobileMoreItem id="more-noticeboard" isActive={activeMenu === 'noticeboard'} icon={<AlertOctagon size={18} />} iconBg="rgba(200,32,32,0.12)" iconColor="var(--red)" label="Notice Board" onClick={() => mobileNavNavigate('noticeboard')} />
              {isAdmin && <MobileMoreItem id="more-sessionlogs" isActive={activeMenu === 'sessionlogs'} icon={<Activity size={18} />} iconBg="rgba(42,159,175,0.12)" iconColor="var(--teal)" label="System Audits" onClick={() => mobileNavNavigate('sessionlogs')} />}
              {isAdmin && <MobileMoreItem id="more-performance" isActive={activeMenu === 'performance'} icon={<Trophy size={18} />} iconBg="rgba(245,158,11,0.12)" iconColor="#f59e0b" label="Performance Logs" onClick={() => mobileNavNavigate('performance')} />}
            </div>

            {/* Admin Section */}
            {isAdmin && (
              <div className="mobile-more-section">
                <div className="mobile-more-section-title">Admin</div>
                <MobileMoreItem id="more-reports" isActive={activeMenu === 'reports'} icon={<BarChart2 size={18} />} iconBg="rgba(0,96,223,0.12)" iconColor="var(--blue)" label="Reports" onClick={() => mobileNavNavigate('reports')} />
                <MobileMoreItem id="more-analytics" isActive={activeMenu === 'analytics'} icon={<Activity size={18} />} iconBg="rgba(42,159,175,0.12)" iconColor="var(--teal)" label="Deep Analytics" onClick={() => mobileNavNavigate('analytics')} />
                <MobileMoreItem id="more-database" isActive={activeMenu === 'database'} icon={<Database size={18} />} iconBg="rgba(139,92,246,0.12)" iconColor="#8b5cf6" label="Database" onClick={() => mobileNavNavigate('database')} />
                <MobileMoreItem id="more-archive" isActive={activeMenu === 'archive'} icon={<Archive size={18} />} iconBg="rgba(100,100,100,0.12)" iconColor="var(--text-secondary)" label="Data Archive" onClick={() => mobileNavNavigate('archive')} />
                <MobileMoreItem id="more-errorlogs" isActive={activeMenu === 'errorlogs'} icon={<AlertOctagon size={18} />} iconBg="rgba(200,32,32,0.12)" iconColor="var(--red)" label="Error Logs" onClick={() => mobileNavNavigate('errorlogs')} />
                <MobileMoreItem id="more-settings" isActive={activeMenu === 'settings'} icon={<Settings size={18} />} iconBg="rgba(0,96,223,0.10)" iconColor="var(--blue)" label="Settings" onClick={() => mobileNavNavigate('settings')} />
              </div>
            )}

            {/* Account */}
            <div className="mobile-more-section">
              <div className="mobile-more-section-title">Account</div>
              <MobileMoreItem id="more-lock" isActive={false} icon={<Lock size={18} />} iconBg="rgba(240,115,32,0.12)" iconColor="var(--orange)" label="Lock Workspace" onClick={() => { lockSystem(); setIsMobileMoreOpen(false); }} />
              <MobileMoreItem id="more-signout" isActive={false} icon={<LogOut size={18} />} iconBg="rgba(200,32,32,0.10)" iconColor="var(--red)" label="Sign Out" onClick={() => { logout(); setIsMobileMoreOpen(false); }} />
            </div>

            <div style={{ height: '20px' }} />
          </div>
        </>, document.body
      )}

      {/* ══════════════════════════════════════════════
           MOBILE "TASKS" MENU
          ══════════════════════════════════════════════ */}
      {isMobile && isTasksMenuOpen && createPortal(
        <>
          <div className="mobile-more-overlay" onClick={() => setIsTasksMenuOpen(false)} />
          <div className="mobile-more-sheet">
            <div className="mobile-more-sheet__handle" />
            <div className="mobile-more-sheet__header">Select Task Module</div>

            <div className="mobile-more-section">
              <MobileMoreItem 
                id="tasks-evoboard" 
                isActive={activeMenu === 'evoboard'} 
                icon={<Briefcase size={18} />} 
                iconBg="rgba(42,159,175,0.12)" 
                iconColor="var(--teal)" 
                label="EvoBoard" 
                badge={badges?.evoboard > 0 ? badges.evoboard : null}
                onClick={() => mobileNavNavigate('evoboard')} 
              />
              <MobileMoreItem 
                id="tasks-instant" 
                isActive={activeMenu === 'instant'} 
                icon={<CheckSquare size={18} />} 
                iconBg="rgba(0,102,204,0.12)" 
                iconColor="var(--color-ocean-blue)" 
                label="Quick Tasks" 
                badge={badges?.instant > 0 ? badges.instant : null}
                onClick={() => mobileNavNavigate('instant')} 
              />
            </div>
            
            <div style={{ height: '20px' }} />
          </div>
        </>, document.body
      )}

      <GlobalToastOverlay />
      {isProfileModalOpen && (
        <UserProfileModal userData={userData} onClose={() => setIsProfileModalOpen(false)} />
      )}
      {!activeWebRTCCall && <GlobalCallOverlay />}
      {activeWebRTCCall && (
        <WebRTCCallRoom 
          roomId={activeWebRTCCall.roomId} 
          callType={activeWebRTCCall.type} 
          onLeave={() => setActiveWebRTCCall(null)} 
        />
      )}
      <GlobalCommandPalette />
      {isAdmin && <NovaAssistant />}
      <GlobalDataInspector />
      <TaskReminderService />
      <DynamicIsland />
      <GlobalHotkeys />
      <InstallAppPrompt />
    </div>
  );
};

const MenuButton = ({ icon, label, isActive, onClick, badge, isCollapsed }) => {
  return (
    <button 
      className="menu-button"
      onClick={onClick}
      title={isCollapsed ? label : ""}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        width: '100%',
        padding: isCollapsed ? 'var(--menu-padding-collapsed, 10px 0)' : 'var(--menu-padding, 9px 12px)',
        border: '1px solid transparent',
        borderRadius: '10px',
        background: isActive
          ? 'rgba(0, 96, 223, 0.10)'
          : 'transparent',
        color: isActive ? 'var(--blue)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        fontWeight: isActive ? 700 : 500,
        borderColor: isActive ? 'rgba(0, 96, 223, 0.18)' : 'transparent',
        textAlign: 'left',
        fontFamily: 'Inter, sans-serif'
      }}
      onMouseOver={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseOut={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isCollapsed ? 'center' : 'flex-start', width: isCollapsed ? '100%' : 'auto' }}>
        <span className={badge != null && Number(badge) > 0 ? "island-bell-ring" : ""} style={{
          color: (badge != null && Number(badge) > 0) ? 'var(--orange)' : (isActive ? 'var(--blue)' : 'var(--text-hint)'),
          display: 'flex',
          flexShrink: 0,
          transition: 'color 0.18s'
        }}>{icon}</span>
        {!isCollapsed && <span style={{ fontSize: '13px', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{label}</span>}
      </div>
      {!isCollapsed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {badge != null && (
            <span style={{
              minWidth: '18px', height: '18px',
              background: 'var(--grad-orange)',
              color: 'white', borderRadius: '9px',
              fontSize: '10px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 2px 6px var(--orange-glow)'
            }}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
          {isActive && <ChevronRight size={14} style={{ color: 'var(--blue)', opacity: 0.6 }} />}
        </div>
      )}
    </button>
  );
};

// ─── MobileMoreItem: used in the "More" bottom sheet ───────────────────────
const MobileMoreItem = ({ id, icon, iconBg, iconColor, label, badge, onClick, isActive }) => (
  <button id={id} className={`mobile-more-item ${isActive ? 'active' : ''}`} onClick={onClick} style={{ background: isActive ? 'rgba(0,122,255,0.08)' : 'transparent', position: 'relative' }}>
    {isActive && <div style={{ position: 'absolute', left: 0, top: '10%', bottom: '10%', width: '4px', background: '#007aff', borderRadius: '0 4px 4px 0' }} />}
    <div className="mobile-more-item__icon" style={{ background: iconBg, color: iconColor }}>
      {icon}
    </div>
    <span className="mobile-more-item__label" style={{ fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--blue)' : 'inherit' }}>{label}</span>
    {badge != null && (
      <span className="mobile-more-item__badge">{badge > 99 ? '99+' : badge}</span>
    )}
    <ChevronRight size={16} className="mobile-more-item__chevron" style={{ color: isActive ? 'var(--blue)' : '#C6C6C8' }} />
  </button>
);

export default App;
