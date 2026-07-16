import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check } from 'lucide-react';

const NewGroupModal = ({ onClose, team }) => {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState('');

  const toggleSelect = (id) => {
    if (selected.includes(id)) setSelected(selected.filter(x => x !== id));
    else setSelected([...selected, id]);
  };

  const handleCreate = () => {
    if (!name) return;
    alert(`Group "${name}" created with ${selected.length} members!`);
    onClose();
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111b21', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 20px', background: '#202c33', display: 'flex', alignItems: 'center', gap: '24px', height: '108px', flexShrink: 0, paddingTop: '49px' }}>
        <button onClick={() => step === 2 ? setStep(1) : onClose()} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d1d7db', padding: 0 }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 500, color: '#e9edef' }}>{step === 1 ? 'Add group members' : 'New group'}</h2>
      </div>

      {step === 1 ? (
        <>
          <div style={{ flex: 1, overflowY: 'auto', background: '#111b21' }}>
            {team.map(t => (
              <div key={t.id} onClick={() => toggleSelect(t.id)} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #202c33' }} onMouseOver={e=>e.currentTarget.style.background='#202c33'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#607d8b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: '16px' }}>
                  {(t.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, color: '#e9edef', fontSize: '16px' }}>{t.name}</div>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: selected.includes(t.id) ? 'none' : '2px solid #8696a0', background: selected.includes(t.id) ? '#00a884' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selected.includes(t.id) && <Check size={14} color="white" />}
                </div>
              </div>
            ))}
          </div>
          {selected.length > 0 && (
            <div style={{ padding: '24px', background: '#111b21', display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => setStep(2)} style={{ background: '#00a884', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>
                <ArrowRight size={24} color="#111b21" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
          <div style={{ width: '200px', height: '200px', borderRadius: '50%', background: '#202c33', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '32px' }}>
            <Camera size={40} color="#8696a0" style={{ marginBottom: '8px' }} />
            <span style={{ color: '#8696a0', fontSize: '14px', textAlign: 'center' }}>ADD GROUP ICON</span>
          </div>
          <div style={{ width: '100%', borderBottom: '2px solid #00a884', paddingBottom: '8px' }}>
            <input type="text" placeholder="Group subject" value={name} onChange={e => setName(e.target.value)} autoFocus style={{ width: '100%', background: 'transparent', border: 'none', color: '#e9edef', fontSize: '16px', outline: 'none' }} />
          </div>
          <button onClick={handleCreate} disabled={!name} style={{ position: 'absolute', bottom: '40px', right: '40px', background: name ? '#00a884' : '#202c33', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: name ? 'pointer' : 'default', transition: 'background 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>
            <Check size={24} color={name ? '#111b21' : '#8696a0'} />
          </button>
        </div>
      )}
    </div>
  );
};

export default NewGroupModal;
