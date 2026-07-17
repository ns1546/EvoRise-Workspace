import React, { useState, useEffect } from 'react';
import { Bell, CloudRain, Sun, Wind, CheckCircle, X, ChevronRight, Play, Clock, LayoutDashboard, Plus, Sparkles, Timer, Square, Bot } from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';
import { useSettings } from '../contexts/SettingsContext';

const DynamicIsland = () => {
  const isMobile = useIsMobile();
  const { settings } = useSettings();
  const [islandState, setIslandState] = useState('idle'); // 'idle', 'notification', 'weather', 'task', 'quick-actions', 'nova-announcement', 'stopwatch'
  const [notificationData, setNotificationData] = useState(null);
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [notificationCache, setNotificationCache] = useState([]); // Stores missed notifications
  const [activities, setActivities] = useState([]); // [{ id, type: 'task', title, startTime }]
  const [weather, setWeather] = useState({ temp: 32, location: 'Dhaka, BD', rain: '10%', wind: '12 km/h' });
  const [now, setNow] = useState(Date.now());

  // Timer tick for active tasks/calls
  useEffect(() => {
    if (activities.length > 0) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [activities.length]);

  // Weather updater (Every 30 minutes)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
            const data = await res.json();
            if (data.current_weather) {
              setWeather({
                temp: Math.round(data.current_weather.temperature),
                wind: `${Math.round(data.current_weather.windspeed)} km/h`,
                rain: '0%', // Simplified
                location: 'Local',
              });
            }
          });
        }
      } catch (e) {}
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Global Event Listener for Island Triggers
  useEffect(() => {
    const handleTrigger = (e) => {
      const { type, data, action } = e.detail || {};
      
      if (type === 'notification' || type === 'nova-announcement' || type === 'nova-voice-announcement') {
        setIslandState(current => {
          if (current === 'notification' || current === 'nova-announcement' || current === 'nova-voice-announcement') {
            setNotificationQueue(prev => [...prev, { type, data }]);
            return current;
          } else {
            setNotificationData(data);
            return type;
          }
        });
      } else if (type === 'task' || type === 'stopwatch') {
        if (action === 'remove') {
          setActivities(prev => prev.filter(a => a.id !== data?.id && a.type !== 'stopwatch'));
        } else {
          setActivities(prev => {
            const newId = data?.id || type;
            if (prev.find(a => a.id === newId)) return prev;
            return [...prev, { id: newId, type, title: data?.title || 'Stopwatch', startTime: Date.now() }];
          });
        }
        setIslandState(type === 'stopwatch' && action !== 'remove' ? 'stopwatch' : 'idle');
      } else if (type) {
        setIslandState(type);
      } else {
        setIslandState('idle');
      }
    };
    window.addEventListener('TRIGGER_DYNAMIC_ISLAND', handleTrigger);
    return () => window.removeEventListener('TRIGGER_DYNAMIC_ISLAND', handleTrigger);
  }, []);

  // Auto-close expanded states and process queue
  useEffect(() => {
    let timer;
    if (islandState === 'weather' || islandState === 'nova-announcement' || islandState === 'nova-voice-announcement' || islandState === 'notification') {
      const delay = islandState === 'notification' ? 5000 : 8000;
      timer = setTimeout(() => {
        // Cache the notification before it closes
        if (islandState !== 'weather' && notificationData) {
          setNotificationCache(prev => {
            if(prev.find(n => n.id === notificationData.id && n.body === notificationData.body)) return prev;
            return [{...notificationData, type: islandState, time: Date.now()}, ...prev].slice(0, 10);
          });
        }

        setNotificationQueue(prevQueue => {
          if (prevQueue.length > 0) {
            const next = prevQueue[0];
            setNotificationData(next.data);
            setIslandState(next.type);
            return prevQueue.slice(1);
          } else {
            setIslandState('idle');
            return prevQueue;
          }
        });
      }, delay);
    }
    return () => clearTimeout(timer);
  }, [islandState, notificationData]);

  // Unlock Audio & Speech Synthesis on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
      }
      try {
         const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
         audioCtx.resume();
      } catch (e) {}
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    return () => window.removeEventListener('click', unlockAudio);
  }, []);

  const [isSpeaking, setIsSpeaking] = useState(false);

  // Voice Announcement (TTS)
  useEffect(() => {
    if (islandState === 'nova-voice-announcement' && notificationData) {
      let rawText = notificationData.body || "You have a new announcement from Nova";
      rawText = rawText.replace(/[*#_`]/g, ''); // Strip markdown
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        // Find the sweetest female voices
        const voices = window.speechSynthesis.getVoices();
        const sweetVoice = voices.find(v => 
           v.name.includes('Google UK English Female') || 
           v.name.includes('Google US English') ||
           v.name.includes('Samantha') || 
           v.name.includes('Zira') || 
           v.name.includes('Female')
        );

        // Chunk by sentences to bypass Chrome's silent cut-off limit
        const chunks = rawText.match(/[^.!?\n]+[.!?\n]+/g) || [rawText];
        let currentIndex = 0;
        setIsSpeaking(true);

        const speakNextChunk = () => {
          if (currentIndex >= chunks.length || islandState !== 'nova-voice-announcement') {
            setIsSpeaking(false);
            return;
          }
          const msg = new SpeechSynthesisUtterance(chunks[currentIndex].trim());
          if (sweetVoice) msg.voice = sweetVoice;
          msg.rate = 0.95;
          msg.pitch = 1.15;
          
          msg.onend = () => {
            currentIndex++;
            speakNextChunk();
          };
          msg.onerror = () => setIsSpeaking(false);
          
          window.speechSynthesis.speak(msg);
        };

        speakNextChunk();
      }
    } else {
       setIsSpeaking(false);
       if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  }, [islandState, notificationData]);

  const isEnabled = settings?.general?.dynamicIsland !== false;
  if (isMobile || !isEnabled) return null; // Only for PC and when enabled

  // Format Duration
  const formatDuration = (start) => {
    const diff = Math.floor((now - start) / 1000);
    const m = Math.floor(diff / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Dimensions based on state and activities
  let idleDim = { width: 140, height: 36, borderRadius: 18 };
  const hasCache = notificationCache.length > 0;
  
  if (activities.length === 1 || hasCache) idleDim = { width: 220, height: 36, borderRadius: 18 };
  if (activities.length >= 2 || (activities.length === 1 && hasCache)) idleDim = { width: 340, height: 36, borderRadius: 18 };

  const dimensions = {
    idle: idleDim,
    notification: { width: 340, height: 80, borderRadius: 24 },
    'nova-announcement': { width: 380, height: 100, borderRadius: 24 },
    'nova-voice-announcement': { width: 380, height: 100, borderRadius: 24 },
    hub: { width: 380, height: Math.min(420, 100 + (activities.length * 60) + (notificationCache.length * 60)), borderRadius: 32 },
    weather: { width: 320, height: 160, borderRadius: 32 },
    stopwatch: { width: 300, height: 140, borderRadius: 32 }
  };

  const currentDim = dimensions[islandState] || dimensions.idle;

  return (
    <>
      <div 
        id="dynamic-island"
        data-enabled={isEnabled}
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          width: currentDim.width,
          height: currentDim.height,
          borderRadius: currentDim.borderRadius,
          transition: 'all 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex',
          overflow: 'hidden',
          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.25), 0 5px 15px rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          cursor: islandState === 'idle' ? 'pointer' : 'default',
          color: 'white',
          background: 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)'
        }}
        onClick={() => {
          if (islandState === 'idle') {
            if (notificationCache.length > 0 || activities.length > 0) {
              setIslandState('hub');
            } else {
              setIslandState('weather');
            }
          }
        }}
      >
        {/* Content Container (Fades based on state) */}
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          
          {/* IDLE / ACTIVITIES STATE */}
          <div style={{
            position: 'absolute', inset: 0, 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px',
            opacity: islandState === 'idle' ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: islandState === 'idle' ? 'auto' : 'none'
          }}>
            {/* Left Side: Activities or Equalizer */}
            {activities.length === 0 ? (
               <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg, #0066cc, #818cf8)', boxShadow: '0 0 10px rgba(0, 102, 204, 0.6)', animation: 'pulse-dot 2s infinite' }} />
                  {!hasCache && (
                    <div style={{ display: 'flex', gap: 4 }}>
                       <div style={{ width: 4, height: 12, background: 'linear-gradient(to top, #ff5722, #f97316)', borderRadius: 2, animation: 'pulse-bar 1s infinite alternate', boxShadow: '0 0 8px rgba(255, 87, 34, 0.6)' }} />
                       <div style={{ width: 4, height: 8, background: 'linear-gradient(to top, #0066cc, #3b82f6)', borderRadius: 2, animation: 'pulse-bar 1s infinite alternate-reverse', boxShadow: '0 0 8px rgba(0, 102, 204, 0.6)' }} />
                       <div style={{ width: 4, height: 10, background: 'linear-gradient(to top, #ff5722, #f97316)', borderRadius: 2, animation: 'pulse-bar 0.8s infinite alternate', boxShadow: '0 0 8px rgba(255, 87, 34, 0.6)' }} />
                    </div>
                  )}
               </div>
            ) : (
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: activities[0].type === 'stopwatch' ? '#ff5722' : '#0066cc' }}>
                    {activities[0].type === 'stopwatch' ? <Timer size={12} fill="none" color="white" strokeWidth={3} /> : <Play size={10} fill="white" style={{marginLeft: 2}} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: activities[0].type === 'stopwatch' ? '#ff5722' : '#0066cc', fontFamily: 'monospace' }}>
                    {formatDuration(activities[0].startTime)}
                  </div>
               </div>
            )}

            {/* Right Side: Missed Notifications Badge or 2nd Activity */}
            {hasCache ? (
               <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 12 }}>
                  <Bell size={12} color="#e4e4e7" className="island-bell-ring" style={{ animationDuration: '2s' }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'white' }}>{notificationCache.length}</span>
               </div>
            ) : activities.length > 1 ? (
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: activities[1].type === 'stopwatch' ? '#ff5722' : '#0066cc' }}>
                    {activities[1].type === 'stopwatch' ? <Timer size={12} fill="none" color="white" strokeWidth={3} /> : <Play size={10} fill="white" style={{marginLeft: 2}} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: activities[1].type === 'stopwatch' ? '#ff5722' : '#0066cc', fontFamily: 'monospace' }}>
                    {formatDuration(activities[1].startTime)}
                  </div>
               </div>
            ) : null}
          </div>

          {/* HUB STATE (Apple-like Notification Center) */}
          <div style={{
            position: 'absolute', inset: 0, 
            display: 'flex', flexDirection: 'column', padding: '20px',
            opacity: islandState === 'hub' ? 1 : 0, transition: 'opacity 0.3s delay 0.1s', pointerEvents: islandState === 'hub' ? 'auto' : 'none'
          }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                   Island Hub
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                   {hasCache && (
                      <button onClick={(e) => { e.stopPropagation(); setNotificationCache([]); setIslandState('idle'); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e4e4e7', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s' }}>Clear</button>
                   )}
                   <button onClick={(e) => { e.stopPropagation(); setIslandState('idle'); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e4e4e7', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}><X size={12} /></button>
                </div>
             </div>

             <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {/* Active Activities */}
                {activities.map(act => (
                   <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: act.type === 'stopwatch' ? '#ff5722' : '#0066cc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         {act.type === 'stopwatch' ? <Timer size={18} color="white" /> : <Play size={16} fill="white" />}
                      </div>
                      <div style={{ flex: 1 }}>
                         <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{act.title || 'Stopwatch'}</div>
                         <div style={{ fontSize: 13, color: act.type === 'stopwatch' ? '#ff5722' : '#0066cc', fontWeight: 700, fontFamily: 'monospace' }}>{formatDuration(act.startTime)}</div>
                      </div>
                      {act.type === 'stopwatch' && (
                         <button onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('TRIGGER_DYNAMIC_ISLAND', { detail: { type: 'stopwatch', action: 'remove' } })); }} style={{ background: 'transparent', border: 'none', color: '#ff3b30', cursor: 'pointer' }}><Square size={16} fill="currentColor" /></button>
                      )}
                   </div>
                ))}
                
                {/* Cached Notifications */}
                {notificationCache.map((notif, idx) => (
                   <div key={idx} onClick={() => { if(notif.actionUrl) window.location.href = notif.actionUrl; }} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: 16, cursor: notif.actionUrl ? 'pointer' : 'default' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: notif.type.includes('nova') ? 'linear-gradient(135deg, #0066cc, #ff5722)' : 'var(--grad-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, boxShadow: notif.type.includes('nova') ? 'inset 0 2px 4px rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.4)' : 'none', border: notif.type.includes('nova') ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                         {notif.type.includes('nova') ? <Sparkles size={16} color="white" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }} /> : <Bell size={18} color="white" className="island-bell-ring" style={{ animationDuration: '2.5s' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                         <div style={{ fontSize: 14, fontWeight: 700, color: 'white', lineHeight: '1.3', marginBottom: 2 }}>{notif.title}</div>
                         <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: '1.4' }}>{notif.body}</div>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          {/* NOVA ANNOUNCEMENT STATE */}
          <div 
            onClick={() => {
              if (notificationData?.actionUrl) window.location.href = notificationData.actionUrl;
              setIslandState('idle'); 
            }}
            style={{
              position: 'absolute', inset: 0, padding: '16px', display: 'flex', alignItems: 'center', gap: '16px',
              opacity: (islandState === 'nova-announcement' || islandState === 'nova-voice-announcement') ? 1 : 0, 
              pointerEvents: (islandState === 'nova-announcement' || islandState === 'nova-voice-announcement') ? 'auto' : 'none', 
              transition: 'opacity 0.3s'
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #0066cc, #ff5722)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), 0 0 15px rgba(0,102,204,0.5)',
              border: '1px solid rgba(255,255,255,0.2)',
              animation: (islandState === 'nova-announcement' || islandState === 'nova-voice-announcement') ? 'pulse-dot 2s infinite' : 'none'
            }}>
              <Sparkles size={22} color="white" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }} />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ff5722', marginBottom: 2 }}>{notificationData?.title || 'Nova AI'}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {notificationData?.body}
              </div>
            </div>
            {islandState === 'nova-voice-announcement' && (
               <div style={{ display: 'flex', gap: 3, opacity: isSpeaking ? 1 : 0.3, transition: 'opacity 0.3s' }}>
                 <div style={{ width: 3, height: 12, background: 'white', borderRadius: 2, animation: isSpeaking ? 'pulse-bar 0.8s infinite alternate' : 'none' }} />
                 <div style={{ width: 3, height: 16, background: 'white', borderRadius: 2, animation: isSpeaking ? 'pulse-bar 0.8s infinite alternate-reverse' : 'none' }} />
                 <div style={{ width: 3, height: 10, background: 'white', borderRadius: 2, animation: isSpeaking ? 'pulse-bar 0.6s infinite alternate' : 'none' }} />
               </div>
            )}
          </div>

          {/* NOTIFICATION STATE */}
          <div 
            onClick={() => {
              if (notificationData?.actionUrl) {
                 window.location.href = notificationData.actionUrl;
              }
              setIslandState('idle'); 
            }}
            style={{
              position: 'absolute', inset: 0, 
              display: 'flex', alignItems: 'center', padding: '0 20px', gap: '16px',
              opacity: islandState === 'notification' ? 1 : 0, transition: 'opacity 0.3s delay 0.2s', 
              pointerEvents: islandState === 'notification' ? 'auto' : 'none',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'var(--grad-blue)', boxShadow: '0 4px 12px rgba(0, 96, 223, 0.4)' }}>
              <Bell size={20} color="white" className="island-bell-ring" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {notificationData?.title || 'System Notification'}
              </div>
              <div style={{ fontSize: 13, color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {notificationData?.body || 'New background activity registered.'}
              </div>
            </div>
            <ChevronRight size={20} color="#a1a1aa" style={{ opacity: notificationData?.actionUrl ? 1 : 0 }} />
          </div>

          {/* WEATHER STATE */}
          <div style={{
            position: 'absolute', inset: 0, 
            display: 'flex', flexDirection: 'column', padding: '20px',
            opacity: islandState === 'weather' ? 1 : 0, transition: 'opacity 0.3s delay 0.2s', pointerEvents: islandState === 'weather' ? 'auto' : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                  <div style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Location</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'white', marginTop: 4, letterSpacing: '-0.5px' }}>{weather.location}</div>
               </div>
               <button 
                 onClick={(e) => { e.stopPropagation(); setIslandState('idle'); }} 
                 style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e4e7', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                 onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                 onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
               >
                 <ChevronRight size={16} />
               </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Sun size={36} color="#ff5722" style={{ filter: 'drop-shadow(0 4px 8px rgba(255, 87, 34, 0.4))' }} />
                  <div style={{ fontSize: 36, fontWeight: 300, color: 'white', lineHeight: 1 }}>{weather.temp}°</div>
               </div>
               <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                     <CloudRain size={16} color="#0066cc" />
                     <span style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>{weather.rain}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                     <Wind size={16} color="var(--teal)" />
                     <span style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>{weather.wind}</span>
                  </div>
               </div>
            </div>
          </div>

          {/* TASK STATE */}
          <div style={{
            position: 'absolute', inset: 0, 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
            opacity: islandState === 'task' ? 1 : 0, transition: 'opacity 0.2s delay 0.1s', pointerEvents: islandState === 'task' ? 'auto' : 'none'
          }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#0066cc', color: 'white', boxShadow: '0 4px 12px rgba(0, 102, 204, 0.3)' }}>
                 <Play size={12} fill="white" style={{ marginLeft: 2 }} />
               </div>
               <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{activities.find(a => a.type === 'task')?.title || 'Active Task'}</div>
             </div>
             <div style={{ fontSize: 15, fontWeight: 700, color: '#0066cc', fontFamily: 'monospace', letterSpacing: '1px' }}>
               {activities.find(a => a.type === 'task') ? formatDuration(activities.find(a => a.type === 'task').startTime) : '00:00'}
             </div>
          </div>

          {/* STOPWATCH STATE */}
          <div style={{
            position: 'absolute', inset: 0, 
            display: 'flex', flexDirection: 'column', padding: '20px',
            opacity: islandState === 'stopwatch' ? 1 : 0, transition: 'opacity 0.3s delay 0.2s', pointerEvents: islandState === 'stopwatch' ? 'auto' : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                  <div style={{ fontSize: 13, color: '#ff5722', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Stopwatch</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: 'white', marginTop: 4, letterSpacing: '-1px', fontFamily: 'monospace' }}>
                    {activities.find(a => a.type === 'stopwatch') ? formatDuration(activities.find(a => a.type === 'stopwatch').startTime) : '00:00'}
                  </div>
               </div>
               <button 
                 onClick={(e) => { e.stopPropagation(); setIslandState('idle'); }} 
                 style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e4e7', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                 onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                 onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
               >
                 <X size={16} />
               </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
               <button 
                 onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('TRIGGER_DYNAMIC_ISLAND', { detail: { type: 'stopwatch', action: 'remove' } })); }}
                 style={{ background: 'rgba(255, 59, 48, 0.2)', color: '#ff3b30', border: 'none', borderRadius: '16px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                 onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.3)'}
                 onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.2)'}
               >
                 <Square size={14} fill="currentColor" /> Stop Timer
               </button>
            </div>
          </div>

        </div>

      </div>

      <style>{`
        @keyframes pulse-bar {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1.5); }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default DynamicIsland;
