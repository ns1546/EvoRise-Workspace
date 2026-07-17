import React, { useState } from 'react';
import { ArrowLeft, Search, Check } from 'lucide-react';

const AddParticipantModal = ({ onClose, team, onAdd }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const toggleSelect = (id) => {
    if (selected.includes(id)) setSelected(selected.filter(x => x !== id));
    else setSelected([...selected, id]);
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111b21', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 20px', background: '#202c33', display: 'flex', alignItems: 'center', gap: '24px', height: '59px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d1d7db', padding: 0 }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#e9edef' }}>Add participants</h2>
      </div>

      <div style={{ padding: '12px 20px', background: '#111b21' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#202c33', borderRadius: '8px', padding: '0 12px', height: '36px' }}>
          <Search size={18} color="#8696a0" />
          <input 
            type="text" 
            placeholder="Search contacts" 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: '#e9edef', width: '100%', marginLeft: '12px' }} 
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#111b21' }}>
        {team.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).map(t => (
          <div key={t.id} onClick={() => toggleSelect(t.id)} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #202c33' }} onMouseOver={e=>e.currentTarget.style.background='#202c33'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#607d8b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: '16px' }}>
              {(t.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#e9edef', fontSize: '16px' }}>{t.name}</div>
              <div style={{ color: '#8696a0', fontSize: '13px', marginTop: '2px' }}>{t.role || 'Employee'}</div>
            </div>
            <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: selected.includes(t.id) ? 'none' : '2px solid #8696a0', background: selected.includes(t.id) ? '#00a884' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selected.includes(t.id) && <Check size={14} color="white" />}
            </div>
          </div>
        ))}
      </div>
      
      {selected.length > 0 && (
        <div style={{ padding: '16px', background: '#202c33', display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => { onAdd?.(selected); onClose(); }} style={{ background: '#00a884', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            <Check size={24} color="#111b21" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AddParticipantModal;
