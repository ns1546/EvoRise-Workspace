import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, CheckSquare, Users, CheckCircle, Activity, BarChart2, PieChart, TrendingUp, Search, X, ArrowRight, Clock, Zap, Target, MessageSquare } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import useIsMobile from '../hooks/useIsMobile';
import '../index.css';

const Dashboard = () => {
  const { currentUser, userData } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('overview');
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [team, setTeam] = useState([]);

  const userRole = userData?.role || 'Employee';
  const isAdmin = userRole === 'Admin' || userRole === 'Administrator' || userRole === 'Partner';

  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, 'tasks'), snap => {
      const data = []; snap.forEach(d => data.push({ id: d.id, ...d.data() })); setTasks(data);
    });
    const unsubClients = onSnapshot(collection(db, 'clients'), snap => {
      const data = []; snap.forEach(d => data.push({ id: d.id, ...d.data() })); setClients(data);
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      const data = []; snap.forEach(d => data.push({ id: d.id, ...d.data() })); setTeam(data);
    });
    return () => { unsubTasks(); unsubClients(); unsubUsers(); };
  }, []);

  const handleInspect = (data) => window.dispatchEvent(new CustomEvent('open-data-inspector', { detail: data }));

  // ── MOBILE RENDER ──────────────────────────────────────────
  if (isMobile) {
    const myTasks = isAdmin ? tasks : tasks.filter(t => t.assigneeId === currentUser?.uid);
    const pending = myTasks.filter(t => t.status !== 'Done');
    const done    = myTasks.filter(t => t.status === 'Done');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDone = done.filter(t => {
      try { return t.completedAt && new Date(typeof t.completedAt === 'object' && t.completedAt.toDate ? t.completedAt.toDate() : t.completedAt).toISOString().split('T')[0] === todayStr; }
      catch(e) { return false; }
    }).length;
    const recentTasks = [...myTasks].sort((a,b) => (b.createdAt||0)-(a.createdAt||0)).slice(0,10);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = (userData?.name || '').split(' ')[0] || 'there';
    const pColor = p => p==='High'?'#FF3B30':p==='Medium'?'#FF9500':p==='Low'?'#34C759':'#8E8E93';
    const memberColors = ['#AF52DE','#0066CC','#34C759','#FF9500','#FF3B30','#5AC8FA'];

    const statCards = [
      { label: 'Pending',   value: pending.length,   bg: '#FF9500', icon: <Clock size={18} color="white"/>,       onClick: () => handleInspect({ title:'Pending Tasks',   type:'tasks',   data: pending }) },
      { label: 'Completed', value: done.length,       bg: '#34C759', icon: <CheckCircle size={18} color="white"/>, onClick: () => handleInspect({ title:'Completed Tasks', type:'tasks',   data: done }) },
      { label: isAdmin ? 'Clients' : 'My Tasks', value: isAdmin ? clients.length : myTasks.length, bg: '#0066CC', icon: <Briefcase size={18} color="white"/>, onClick: () => handleInspect({ title: isAdmin?'Clients':'My Tasks', type: isAdmin?'clients':'tasks', data: isAdmin?clients:myTasks }) },
      { label: 'Team',      value: team.length,       bg: '#AF52DE', icon: <Users size={18} color="white"/>,       onClick: () => window.dispatchEvent(new CustomEvent('navigate',{detail:{menu:'team'}})) },
    ];

    const quickActions = [
      { label: 'My Day',   icon: <Target size={22} color="white"/>,       bg: 'linear-gradient(135deg,#0066CC,#0044AA)', nav: 'myday'    },
      { label: 'Tasks',    icon: <CheckSquare size={22} color="white"/>,  bg: 'linear-gradient(135deg,#34C759,#248A3D)', nav: 'instant'  },
      { label: 'Chat',     icon: <MessageSquare size={22} color="white"/>,bg: 'linear-gradient(135deg,#5AC8FA,#0066CC)', nav: 'whatsapp' },
      { label: 'Calendar', icon: <Activity size={22} color="white"/>,     bg: 'linear-gradient(135deg,#FF3B30,#FF6B6B)', nav: 'calendar' },
    ];

    return (
      <div className="mob-page">

        {/* ── Greeting ─────────────────────────────────── */}
        <div className="mob-greeting">
          <p className="mob-greeting__eyebrow">{greeting}</p>
          <h1 className="mob-greeting__name">{firstName} 👋</h1>
        </div>

        {/* ── Stat Strip ───────────────────────────────── */}
        <div className="mob-stat-strip">
          {statCards.map((s, i) => (
            <div key={i} className="mob-stat-card" onClick={s.onClick}>
              <div className="mob-stat-card__icon" style={{ background: s.bg }}>{s.icon}</div>
              <div>
                <div className="mob-stat-card__label">{s.label}</div>
                <div className="mob-stat-card__value">{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Quick Actions ─────────────────────────────── */}
        <p className="mob-sec-hdr">Quick Actions</p>
        <div className="mob-quick-grid">
          {quickActions.map((a, i) => (
            <button key={i} className="mob-quick-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('navigate',{detail:{menu:a.nav}}))}>
              <div className="mob-quick-btn__icon" style={{ background: a.bg }}>{a.icon}</div>
              <span className="mob-quick-btn__label">{a.label}</span>
            </button>
          ))}
        </div>

        {/* ── Today's Progress ──────────────────────────── */}
        {myTasks.length > 0 && (
          <>
            <p className="mob-sec-hdr">Today's Progress</p>
            <div style={{ margin:'0 16px', background:'#FFF', borderRadius:14, padding:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:15, fontWeight:600, color:'#000' }}>{todayDone} done today</span>
                <span style={{ fontSize:20, fontWeight:800, color:'#34C759' }}>
                  {myTasks.length > 0 ? Math.round((done.length / myTasks.length)*100) : 0}%
                </span>
              </div>
              <div className="mob-progress">
                <div className="mob-progress__fill" style={{
                  width: `${myTasks.length > 0 ? Math.round((done.length/myTasks.length)*100) : 0}%`,
                  background: '#34C759'
                }}/>
              </div>
              <div style={{ marginTop:6, fontSize:13, color:'#8E8E93' }}>{pending.length} pending · {myTasks.length} total</div>
            </div>
          </>
        )}

        {/* ── Recent Tasks ──────────────────────────────── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 16px 8px' }}>
          <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#6D6D72', textTransform:'uppercase', letterSpacing:'0.07em' }}>Recent Tasks</p>
          <button onClick={() => window.dispatchEvent(new CustomEvent('navigate',{detail:{menu: isAdmin?'evoboard':'myday'}}))}
            style={{ background:'none', border:'none', fontSize:15, color:'#0066CC', padding:0, fontWeight:500, cursor:'pointer' }}>
            See All
          </button>
        </div>
        <div className="mob-group">
          {recentTasks.length === 0 ? (
            <div className="mob-empty">
              <div className="mob-empty__icon"><CheckSquare size={32} color="#8E8E93" /></div>
              <p className="mob-empty__title">No Tasks Yet</p>
              <p className="mob-empty__sub">Tasks assigned to you appear here.</p>
            </div>
          ) : recentTasks.map((t) => {
            const isDone = t.status === 'Done';
            return (
              <div key={t.id} className="mob-task-row"
                onClick={() => handleInspect({ title: t.customName || t.taskName || 'Task', type:'tasks', data:[t] })}>
                <div className={`mob-task-row__check ${isDone ? 'done' : ''}`}>
                  {isDone && <CheckCircle size={14} color="white" />}
                </div>
                <div className="mob-task-row__body">
                  <div className={`mob-task-row__name ${isDone ? 'done' : ''}`}>
                    {t.customName || t.taskName || t.title || 'Untitled'}
                  </div>
                  {t.priority && !isDone && (
                    <div className="mob-task-row__meta" style={{ color: pColor(t.priority) }}>{t.priority} Priority</div>
                  )}
                </div>
                <div className="mob-task-row__trailing">
                  {isDone
                    ? <span className="mob-pill mob-pill--green">Done</span>
                    : <span style={{ color:'#C7C7CC', fontSize:20 }}>›</span>
                  }
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Team Overview (Admin only) ────────────────── */}
        {isAdmin && team.length > 0 && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 16px 8px' }}>
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#6D6D72', textTransform:'uppercase', letterSpacing:'0.07em' }}>Team Overview</p>
              <button onClick={() => window.dispatchEvent(new CustomEvent('navigate',{detail:{menu:'team'}}))}
                style={{ background:'none', border:'none', fontSize:15, color:'#0066CC', padding:0, cursor:'pointer' }}>
                Manage
              </button>
            </div>
            <div className="mob-group">
              {team.slice(0, 5).map((u, idx) => {
                const ut  = tasks.filter(t => t.assigneeId === u.id);
                const ud  = ut.filter(t => t.status === 'Done').length;
                const pct = ut.length > 0 ? Math.round(ud / ut.length * 100) : 0;
                return (
                  <div key={u.id} className="mob-cell">
                    <div className="mob-cell__avatar" style={{ background: memberColors[idx % memberColors.length] }}>
                      {(u.name||'?').charAt(0).toUpperCase()}
                    </div>
                    <div className="mob-cell__body">
                      <div className="mob-cell__title mob-cell__title--bold">{u.name || 'Unnamed'}</div>
                      <div className="mob-cell__subtitle">{ut.length} tasks · {pct}% done</div>
                    </div>
                    <div className="mob-cell__trailing">
                      <span style={{ fontSize:15, fontWeight:700, color: pct>75?'#34C759':pct>40?'#FF9500':'#FF3B30' }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mob-spacer-lg" />
      </div>
    );
  }

  // ── DESKTOP RENDER (unchanged) ─────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', position: 'relative' }}>
       <div className="glass-panel" style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '20px', background: 'white' }}>
          <button onClick={() => setActiveTab('overview')} style={{ padding: '12px 24px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === 'overview' ? 'linear-gradient(135deg, #0b57d0, #1a73e8)' : 'transparent', color: activeTab === 'overview' ? 'white' : 'var(--text-secondary)', boxShadow: activeTab === 'overview' ? '0 4px 12px rgba(11,87,208,0.3)' : 'none' }}>
            <Activity size={18}/> System Overview
          </button>
          {isAdmin && (<button onClick={() => setActiveTab('team')} style={{ padding: '12px 24px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === 'team' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'transparent', color: activeTab === 'team' ? 'white' : 'var(--text-secondary)', boxShadow: activeTab === 'team' ? '0 4px 12px rgba(139,92,246,0.3)' : 'none' }}><Users size={18}/> Team Analytics</button>)}
          {isAdmin && (<button onClick={() => setActiveTab('clients')} style={{ padding: '12px 24px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === 'clients' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent', color: activeTab === 'clients' ? 'white' : 'var(--text-secondary)', boxShadow: activeTab === 'clients' ? '0 4px 12px rgba(245,158,11,0.3)' : 'none' }}><Briefcase size={18}/> Client Insights</button>)}
       </div>
       <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
         {activeTab === 'overview' && <OverviewTab tasks={tasks} clients={clients} team={team} isAdmin={isAdmin} currentUser={currentUser} onInspect={handleInspect} />}
         {activeTab === 'team' && isAdmin && <TeamAnalyticsTab tasks={tasks} team={team} onInspect={handleInspect} />}
         {activeTab === 'clients' && isAdmin && <ClientInsightsTab tasks={tasks} clients={clients} onInspect={handleInspect} />}
       </div>
    </div>
  );
};

const PremiumDashboardWidgets = ({ tasks, clients, team, isAdmin, currentUser, onInspect }) => {
  const relevantTasks = isAdmin ? tasks : tasks.filter(t => t.assigneeId === currentUser?.uid);
  const pending = relevantTasks.filter(t => t.status !== 'Done');
  const done = relevantTasks.filter(t => t.status === 'Done');

  const cards = [
    {
       title: 'Pending Workload',
       val: pending.length,
       icon: <CheckSquare size={28}/>,
       color: '#f59e0b',
       bg: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.05))',
       iconBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
       desc: 'Active tasks requiring attention',
       data: pending, type: 'tasks'
    },
    {
       title: isAdmin ? 'Active Clients' : 'Total Tasks',
       val: isAdmin ? clients.length : relevantTasks.length,
       icon: <Briefcase size={28}/>,
       color: 'var(--color-ocean-blue)',
       bg: 'linear-gradient(135deg, rgba(11,87,208,0.2), rgba(26,115,232,0.05))',
       iconBg: 'linear-gradient(135deg, #0b57d0, #1a73e8)',
       desc: isAdmin ? 'Total registered clients' : 'All assigned tasks',
       data: isAdmin ? clients : relevantTasks, type: isAdmin ? 'clients' : 'tasks'
    },
    {
       title: 'Completed Work',
       val: done.length,
       icon: <CheckCircle size={28}/>,
       color: '#10b981',
       bg: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.05))',
       iconBg: 'linear-gradient(135deg, #10b981, #059669)',
       desc: 'Successfully finished tasks',
       data: done, type: 'tasks'
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
      {cards.map((card, i) => (
        <div 
          key={i}
          className="premium-widget-card"
          onClick={() => onInspect({ title: card.title, type: card.type, data: card.data })}
          style={{
            position: 'relative',
            background: 'white',
            borderRadius: '24px',
            padding: '24px',
            cursor: 'pointer',
            border: '1px solid rgba(0,0,0,0.04)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            transition: 'all 0.3s ease-out'
          }}
        >
          {/* Subtle Background Glow */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: card.bg, filter: 'blur(40px)', borderRadius: '50%', transform: 'translate(30%, -30%)', pointerEvents: 'none' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 8px 16px rgba(0,0,0,0.1)` }}>
              {card.icon}
            </div>
            <div style={{ background: 'var(--bg-matte)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Inspect
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: '1' }}>{card.val}</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '8px' }}>{card.title}</div>
            <div style={{ fontSize: '13px', color: card.color, fontWeight: 600, marginTop: '4px' }}>{card.desc}</div>
          </div>
        </div>
      ))}
      <style>{`
        .premium-widget-card:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 12px 30px rgba(0,0,0,0.08);
          border-color: rgba(0,0,0,0.08);
        }
      `}</style>
    </div>
  );
};

/* ========================================================
   1. OVERVIEW TAB
   ======================================================== */
const OverviewTab = ({ tasks, clients, team, isAdmin, currentUser, onInspect }) => {
  const relevantTasks = isAdmin ? tasks : tasks.filter(t => t.assigneeId === currentUser?.uid);
  
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const chartData = last7Days.map(dateStr => {
    const completed = relevantTasks.filter(t => {
       if (t.status !== 'Done' || !t.completedAt) return false;
       return new Date(t.completedAt).toISOString().split('T')[0] === dateStr;
    }).length;
    
    const added = relevantTasks.filter(t => {
       if (!t.createdAt) return false;
       return new Date(t.createdAt).toISOString().split('T')[0] === dateStr;
    }).length;

    return { name: dateStr.split('-').slice(1).join('/'), Completed: completed, Assigned: added };
  });

  const total = relevantTasks.length;
  const completed = relevantTasks.filter(t => t.status === 'Done').length;
  const pending = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <PremiumDashboardWidgets tasks={tasks} clients={clients} team={team} isAdmin={isAdmin} currentUser={currentUser} onInspect={onInspect} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        
        {/* Work Volume Chart */}
        <div className="glass-panel" style={{ background: 'white', padding: '30px', borderRadius: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <TrendingUp size={20} color="var(--color-ocean-blue)" />
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700 }}>Work Volume (Last 7 Days)</h3>
          </div>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAssigned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-ocean-blue)" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="var(--color-ocean-blue)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: 'var(--text-secondary)', fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: 'var(--text-secondary)', fontWeight: 500 }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', fontWeight: 600 }} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '14px', fontWeight: 600, paddingBottom: '20px' }} />
                <Area type="monotone" dataKey="Assigned" stroke="var(--color-ocean-blue)" strokeWidth={3} fillOpacity={1} fill="url(#colorAssigned)" />
                <Area type="monotone" dataKey="Completed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Health & Workload */}
        <div className="glass-panel" style={{ background: 'white', padding: '30px', borderRadius: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <Target size={20} color="#8b5cf6" />
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700 }}>System Health & Workload</h3>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
            {/* Circular Progress */}
            <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="80" cy="80" r="64" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="12" />
                <circle cx="80" cy="80" r="64" fill="none" stroke={completionRate > 70 ? '#10b981' : completionRate > 40 ? '#f59e0b' : '#ef4444'} strokeWidth="12" strokeLinecap="round" strokeDasharray={2 * Math.PI * 64} strokeDashoffset={(2 * Math.PI * 64) - (completionRate / 100) * (2 * Math.PI * 64)} style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease' }} />
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: '1' }}>{completionRate}%</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>COMPLETED</span>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div style={{ display: 'flex', width: '100%', gap: '12px' }}>
              <div style={{ flex: 1, background: 'var(--bg-matte)', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>TOTAL WORK</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{total}</span>
              </div>
              <div style={{ flex: 1, background: 'rgba(245,158,11,0.05)', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(245,158,11,0.1)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706' }}>REMAINING</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>{pending}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
};

/* ========================================================
   2. TEAM ANALYTICS TAB
   ======================================================== */
const TeamAnalyticsTab = ({ tasks, team, onInspect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  const userStats = team.map(u => {
     const userTasks = tasks.filter(t => t.assigneeId === u.id);
     const done = userTasks.filter(t => t.status === 'Done').length;
     const pending = userTasks.filter(t => t.status !== 'Done').length;
     const total = userTasks.length;
     const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
     return { ...u, done, pending, total, completionRate, userTasks };
  }).filter(u => (u.total > 0 || u.role === 'Employee') && u.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Sort by highest completion rate first
  userStats.sort((a, b) => b.completionRate - a.completionRate);

  const handleContextMenu = (e, user) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ user, rect });
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
      
      {/* ── HAPTIC TOUCH CONTEXT MENU ── */}
      {contextMenu && (
        <div 
          onClick={closeContextMenu}
          onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(255,255,255,0.4)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            zIndex: 999999,
            animation: 'fadeIn 0.2s cubic-bezier(0.32, 0.72, 0, 1) forwards'
          }}
        >
          {/* Card Clone (Scaled Up) */}
          <div style={{
            position: 'absolute',
            top: contextMenu.rect.top,
            left: contextMenu.rect.left,
            width: contextMenu.rect.width,
            height: contextMenu.rect.height,
            background: 'white',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 30px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
            transform: 'scale(1.05)',
            transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
            display: 'flex', flexDirection: 'column', gap: '20px',
            pointerEvents: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
                {contextMenu.user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{contextMenu.user.name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>{contextMenu.user.role || 'Member'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>{contextMenu.user.done}</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>{contextMenu.user.pending}</div>
              </div>
            </div>
          </div>

          {/* Context Actions Menu */}
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: contextMenu.rect.top,
              left: contextMenu.rect.right + 20 > window.innerWidth - 220 ? contextMenu.rect.left - 220 : contextMenu.rect.right + 20,
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              padding: '8px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
              display: 'flex', flexDirection: 'column', gap: '4px',
              minWidth: '200px',
              animation: 'scaleIn 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards',
              transformOrigin: contextMenu.rect.right + 20 > window.innerWidth - 220 ? 'right center' : 'left center'
            }}
          >
            <button onClick={() => { onInspect({ title: `Tasks for ${contextMenu.user.name}`, type: 'tasks', data: contextMenu.user.userTasks }); closeContextMenu(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Inspect Tasks</button>
            <button onClick={() => { window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: 'team' } })); closeContextMenu(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Manage Member Profile</button>
            <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 8px' }} />
            <button onClick={() => { window.dispatchEvent(new CustomEvent('navigate', { detail: { menu: 'instant' } })); closeContextMenu(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--color-ocean-blue)' }}>Assign New Task</button>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ background: 'white', padding: '24px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Team Performance Breakdown</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Analyze individual workload and completion rates.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.03)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search team member..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', paddingLeft: '12px', fontSize: '14px', width: '200px' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {userStats.map(user => (
          <div 
            key={user.id} 
            className="glass-panel clickable-card" 
            onClick={() => onInspect({ title: `Tasks for ${user.name}`, type: 'tasks', data: user.userTasks })}
            onContextMenu={(e) => handleContextMenu(e, user)}
            style={{ background: 'white', padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px', cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-4px)' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{user.name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>{user.role || 'Member'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>{user.done}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Completed</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>{user.pending}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending</div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Completion Rate</span>
                <span style={{ color: user.completionRate > 75 ? '#10b981' : user.completionRate > 40 ? '#f59e0b' : '#ef4444' }}>{user.completionRate}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${user.completionRate}%`, height: '100%', background: user.completionRate > 75 ? '#10b981' : user.completionRate > 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.5s' }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

/* ========================================================
   3. CLIENT INSIGHTS TAB
   ======================================================== */
const ClientInsightsTab = ({ tasks, clients, onInspect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const isMobile = useIsMobile();

  const clientStats = clients.map(c => {
     const clientTasks = tasks.filter(t => t.clientId === c.id || t.clientName === c.name);
     const done = clientTasks.filter(t => t.status === 'Done').length;
     const pending = clientTasks.filter(t => t.status !== 'Done').length;
     const total = clientTasks.length;
     return { ...c, done, pending, total, clientTasks };
  }).filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  // Sort by highest pending workload
  clientStats.sort((a, b) => b.pending - a.pending);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ background: 'white', padding: '24px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Client Insights</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Track pending and completed services per client.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.03)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search client..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', paddingLeft: '12px', fontSize: '14px', width: '200px' }}
          />
        </div>
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 4px' }}>
          {clientStats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No clients found.</div>
          ) : (
            clientStats.map(c => {
              const health = c.pending > 10 ? 'High Volume' : c.pending > 0 ? 'Active' : 'Idle';
              const healthColor = health === 'High Volume' ? '#ef4444' : health === 'Active' ? '#10b981' : 'var(--text-secondary)';
              const healthBg = health === 'High Volume' ? 'rgba(239,68,68,0.1)' : health === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.05)';
              
              return (
                <div 
                  key={c.id} 
                  onClick={() => onInspect({ title: `Tasks for ${c.name}`, type: 'tasks', data: c.clientTasks })}
                  style={{ cursor: 'pointer', background: 'white', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '16px' }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{c.phone || c.email || 'N/A'}</div>
                      </div>
                    </div>
                    <span style={{ background: healthBg, color: healthColor, padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {health}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: 'var(--bg-matte)', padding: '12px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL</span>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '15px' }}>{c.total}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderLeft: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>DONE</span>
                      <span style={{ fontWeight: 800, color: '#10b981', fontSize: '15px' }}>{c.done}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>PENDING</span>
                      <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '15px' }}>{c.pending}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="table-wrapper glass-panel" style={{ background: 'white', borderRadius: '24px', overflow: 'hidden' }}>
          <table className="evo-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Contact Info</th>
                <th>Total Tasks</th>
                <th>Completed</th>
                <th>Pending (Active)</th>
                <th>Health Status</th>
              </tr>
            </thead>
            <tbody>
              {clientStats.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No clients found.</td></tr>
              ) : (
                clientStats.map(c => {
                  const health = c.pending > 10 ? 'High Volume' : c.pending > 0 ? 'Active' : 'Idle';
                  const healthColor = health === 'High Volume' ? '#ef4444' : health === 'Active' ? '#10b981' : 'var(--text-secondary)';
                  const healthBg = health === 'High Volume' ? 'rgba(239,68,68,0.1)' : health === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.05)';
                  
                  return (
                    <tr 
                      key={c.id} 
                      onClick={() => onInspect({ title: `Tasks for ${c.name}`, type: 'tasks', data: c.clientTasks })}
                      style={{ cursor: 'pointer' }}
                      className="clickable-row"
                    >
                      <td data-label="Client Name" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px' }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          {c.name}
                        </div>
                      </td>
                      <td data-label="Contact Info" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{c.phone || c.email || 'N/A'}</td>
                      <td data-label="Total Tasks" style={{ fontWeight: 600 }}>{c.total}</td>
                      <td data-label="Completed" style={{ color: '#10b981', fontWeight: 600 }}>{c.done}</td>
                      <td data-label="Pending" style={{ color: '#f59e0b', fontWeight: 600 }}>{c.pending}</td>
                      <td data-label="Health Status">
                        <span style={{ background: healthBg, color: healthColor, padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                          {health}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
