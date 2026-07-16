import React from 'react';

const ChatMenu = ({ onClose, onSelect }) => {
  return (
    <>
      <div 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }} 
        onClick={onClose}
      />
      <div style={{ position: 'absolute', top: '55px', right: '16px', background: '#233138', borderRadius: '3px', padding: '9px 0', minWidth: '180px', boxShadow: '0 2px 5px rgba(0,0,0,0.26), 0 8px 20px rgba(0,0,0,0.30)', zIndex: 10000 }}>
        <div onClick={() => { onSelect('contact_info'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Group info</div>
        <div onClick={() => { onSelect('select_messages'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Select messages</div>
        <div onClick={() => { onSelect('mute_notifications'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Mute notifications</div>
        <div onClick={() => { onSelect('export_chat'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Export chat</div>
        <div onClick={() => { onSelect('restore_chat'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Restore chat</div>
        <div onClick={() => { onSelect('clear_messages'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Clear messages</div>
        <div onClick={() => { onSelect('exit_group'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Exit group</div>
      </div>
    </>
  );
};

export default ChatMenu;
