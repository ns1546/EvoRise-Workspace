import React, { useState } from 'react';
import { Users, Bell, Lock, LogOut, AlertTriangle, ChevronRight, X, Search, Star } from 'lucide-react';
import MuteSettingsModal from './modals/MuteSettingsModal';
import EncryptionModal from './modals/EncryptionModal';
import AddParticipantModal from './modals/AddParticipantModal';

const GroupInfoPanel = ({ team, currentUserId, onClose, onShowStarred, onShowToast }) => {
  const [activeInfoModal, setActiveInfoModal] = useState(null); // 'mute', 'encryption', 'add_participant'

  if (activeInfoModal === 'mute') return <MuteSettingsModal onClose={() => setActiveInfoModal(null)} onSave={(val) => onShowToast(`Muted for ${val}`)} />;
  if (activeInfoModal === 'encryption') return <EncryptionModal onClose={() => setActiveInfoModal(null)} />;
  if (activeInfoModal === 'add_participant') return <AddParticipantModal onClose={() => setActiveInfoModal(null)} team={team} onAdd={(ids) => onShowToast(`${ids.length} participant(s) added successfully`)} />;

  return (
  <div style={{ width: '400px', background: '#f0f2f5', borderLeft: '1px solid #d1d7db', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
    {/* Header */}
    <div style={{ padding: '0 20px', background: '#008069', display: 'flex', alignItems: 'center', gap: '24px', height: '59px', flexShrink: 0 }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'white', padding: 0 }}>
        <X size={24} />
      </button>
      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: 'white' }}>Group info</h2>
    </div>

    <div style={{ flex: 1, overflowY: 'auto' }}>

      {/* Cover/Avatar */}
      <div style={{ background: 'white', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '8px solid #f0f2f5' }}>
        <div style={{ width: '200px', height: '200px', borderRadius: '50%', background: '#00a884', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', cursor: 'pointer', position: 'relative' }}>
          <Users size={80} />
          <div style={{ position: 'absolute', bottom: 8, right: 8, width: 36, height: 36, background: '#008069', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M12 15.2l-4.243-4.243 1.415-1.414L12 12.37l2.828-2.828 1.415 1.414L12 15.2zm-5-6.15L8.414 7.636A3.986 3.986 0 0112 6.2a3.986 3.986 0 013.586 1.436L17 6.22A5.98 5.98 0 0012 4.2a5.98 5.98 0 00-5 2.022L8.414 7.636z"/></svg>
          </div>
        </div>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 400, color: '#111b21' }}>Evorise Global Team</h2>
        <p style={{ margin: '6px 0 0 0', color: '#667781', fontSize: '15px' }}>Group · {team.length} participants</p>
      </div>

      {/* Description */}
      <div style={{ background: 'white', padding: '20px 32px', borderBottom: '8px solid #f0f2f5' }}>
        <div style={{ color: '#008069', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Description</div>
        <div style={{ color: '#111b21', fontSize: '15px' }}>Evorise Agency — Official Team Group</div>
        <div style={{ color: '#667781', fontSize: '13px', marginTop: '8px' }}>Created by Admin, {new Date().toLocaleDateString()}</div>
      </div>

      {/* Action Buttons Row */}
      <div style={{ background: 'white', padding: '16px 24px', borderBottom: '8px solid #f0f2f5', display: 'flex', justifyContent: 'space-around' }}>
        {[
          { icon: <Bell size={24}/>, label: 'Mute', msg: 'Mute settings coming soon' },
          { icon: <Search size={24}/>, label: 'Search', msg: 'Search in group coming soon' },
          { icon: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>, label: 'Settings', msg: 'Group settings coming soon' },
        ].map(btn => (
          <div key={btn.label} onClick={() => onShowToast(btn.msg)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#54656f' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {btn.icon}
            </div>
            <span style={{ fontSize: '12px' }}>{btn.label}</span>
          </div>
        ))}
      </div>

      {/* Settings Items */}
      <div style={{ background: 'white', borderBottom: '8px solid #f0f2f5' }}>
        <div
          onClick={onShowStarred}
          style={{ display: 'flex', alignItems: 'center', padding: '16px 32px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5' }}
          onMouseOver={e=>e.currentTarget.style.background='#f5f6f6'}
          onMouseOut={e=>e.currentTarget.style.background='white'}
        >
          <div style={{ marginRight: '24px', display: 'flex', alignItems: 'center' }}><Star size={20} color="#54656f"/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', color: '#008069' }}>Starred messages</div>
            <div style={{ fontSize: '14px', color: '#667781', marginTop: '2px' }}>View all starred messages</div>
          </div>
          <ChevronRight size={20} color="#d1d7db" />
        </div>
        <div onClick={() => setActiveInfoModal('mute')} style={{ display: 'flex', alignItems: 'center', padding: '16px 32px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5' }}>
          <div style={{ marginRight: '24px', display: 'flex', alignItems: 'center' }}><Bell size={20} color="#54656f"/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', color: '#111b21' }}>Mute notifications</div>
            <div style={{ fontSize: '14px', color: '#667781', marginTop: '2px' }}>Unmuted</div>
          </div>
          <ChevronRight size={20} color="#d1d7db" />
        </div>
        <div onClick={() => setActiveInfoModal('encryption')} style={{ display: 'flex', alignItems: 'center', padding: '16px 32px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5' }}>
          <div style={{ marginRight: '24px', display: 'flex', alignItems: 'center' }}><Lock size={20} color="#54656f"/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', color: '#111b21' }}>Encryption</div>
            <div style={{ fontSize: '14px', color: '#667781', marginTop: '2px' }}>Messages are end-to-end encrypted.</div>
          </div>
          <ChevronRight size={20} color="#d1d7db" />
        </div>
      </div>


      {/* Members */}
      <div style={{ background: 'white', borderBottom: '8px solid #f0f2f5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px 8px 32px' }}>
          <span style={{ fontSize: '15px', color: '#667781' }}>{team.length} participants</span>
          <Search onClick={() => onShowToast('Participant search coming soon')} size={20} color="#54656f" style={{ cursor: 'pointer' }}/>
        </div>

        {/* Add participant */}
        <div onClick={() => setActiveInfoModal('add_participant')} style={{ display: 'flex', alignItems: 'center', padding: '12px 32px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#f5f6f6'} onMouseOut={e=>e.currentTarget.style.background='white'}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00a884', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M19 12.5h-6.5V19h-1v-6.5H5v-1h6.5V5h1v6.5H19v1z"/></svg>
          </div>
          <span style={{ fontSize: '16px', color: '#00a884' }}>Add participants</span>
        </div>

        {/* Invite link */}
        <div onClick={() => onShowToast('Invite link generated and copied!')} style={{ display: 'flex', alignItems: 'center', padding: '12px 32px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5' }} onMouseOver={e=>e.currentTarget.style.background='#f5f6f6'} onMouseOut={e=>e.currentTarget.style.background='white'}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00a884', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M11 17H7c-2.76 0-5-2.24-5-5s2.24-5 5-5h4v2H7c-1.65 0-3 1.35-3 3s1.35 3 3 3h4v2zm6 0h-4v-2h4c1.65 0 3-1.35 3-3s-1.35-3-3-3h-4V7h4c2.76 0 5 2.24 5 5s-2.24 5-5 5zM8 11h8v2H8v-2z"/></svg>
          </div>
          <span style={{ fontSize: '16px', color: '#00a884' }}>Invite via link</span>
        </div>

        {/* Members list */}
        {team.map(t => {
          const isAdmin = t.role === 'Admin';
          const isYou = t.id === currentUserId;
          return (
            <div key={t.id} onClick={() => onShowToast(isYou ? 'This is you!' : `View ${t.name}'s profile`)} style={{ display: 'flex', alignItems: 'center', padding: '12px 32px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5' }} onMouseOver={e=>e.currentTarget.style.background='#f5f6f6'} onMouseOut={e=>e.currentTarget.style.background='white'}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isAdmin ? '#008069' : '#607d8b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: '16px', fontSize: '16px' }}>
                {(t.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', color: '#111b21' }}>{isYou ? 'You' : t.name}</div>
                <div style={{ fontSize: '13px', color: '#667781', marginTop: '2px' }}>{t.role || 'Employee'}</div>
              </div>
              {(isAdmin || isYou) && (
                <div style={{ fontSize: '12px', color: '#00a884', border: '1px solid #00a884', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>
                  Group admin
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Danger Actions */}
      <div style={{ background: 'white', marginBottom: '16px' }}>
        <div onClick={() => { if (window.confirm('Are you sure you want to exit the group?')) onShowToast('Admin cannot exit main group'); }} style={{ display: 'flex', alignItems: 'center', padding: '16px 32px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5' }} onMouseOver={e=>e.currentTarget.style.background='#f5f6f6'} onMouseOut={e=>e.currentTarget.style.background='white'}>
          <LogOut size={22} color="#ea4335" style={{ marginRight: '24px' }}/>
          <span style={{ fontSize: '16px', color: '#ea4335' }}>Exit group</span>
        </div>
        <div onClick={() => { if (window.confirm('Report this group to admin?')) onShowToast('Report submitted'); }} style={{ display: 'flex', alignItems: 'center', padding: '16px 32px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#f5f6f6'} onMouseOut={e=>e.currentTarget.style.background='white'}>
          <AlertTriangle size={22} color="#ea4335" style={{ marginRight: '24px' }}/>
          <span style={{ fontSize: '16px', color: '#ea4335' }}>Report group</span>
        </div>
      </div>

    </div>
  </div>
);
};

export default GroupInfoPanel;
