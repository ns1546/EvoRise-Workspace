import React from 'react';

const MainMenu = ({ onClose, onSelect }) => {
  return (
    <>
      <div 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }} 
        onClick={onClose}
      />
      <div style={{ position: 'absolute', top: '55px', left: '260px', background: '#233138', borderRadius: '3px', padding: '9px 0', minWidth: '180px', boxShadow: '0 2px 5px rgba(0,0,0,0.26), 0 8px 20px rgba(0,0,0,0.30)', zIndex: 10000 }}>
        <div onClick={() => { onSelect('new_group'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>New group</div>
        <div onClick={() => { onSelect('communities'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Communities</div>
        <div onClick={() => { onSelect('starred'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Starred messages</div>
        <div onClick={() => { onSelect('settings'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Settings</div>
        <div onClick={() => { onSelect('logout'); onClose(); }} style={{ padding: '13px 24px', color: '#e9edef', fontSize: '14.5px', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='#182229'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>Log out</div>
      </div>
    </>
  );
};

export default MainMenu;
