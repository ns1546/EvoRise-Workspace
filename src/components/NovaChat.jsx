import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageSquare } from 'lucide-react';
import '../index.css';

const NovaChat = () => {
  const [messages, setMessages] = useState([
    { id: 1, role: 'nova', content: 'Greetings. I am Nova, your AI assistant and God Mode operator for this workspace. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    // Simulate AI Response (In reality, this would hit the Groq/OpenAI endpoint from the legacy app)
    setTimeout(() => {
      let novaResponse = "I have noted your request. As I am currently migrating my God Mode capabilities to this new architecture, I cannot execute system commands right this second, but I am online.";
      
      if (input.toLowerCase().includes('task')) {
        novaResponse = "I can analyze your tasks. You currently have several pending items on the Kanban board. Would you like me to prioritize them?";
      } else if (input.toLowerCase().includes('hello') || input.toLowerCase().includes('hi')) {
        novaResponse = "Hello! I am operating optimally in this new Matte 3D environment.";
      }

      setMessages(prev => [...prev, { id: Date.now(), role: 'nova', content: novaResponse }]);
      setIsThinking(false);
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-ocean-blue), #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,102,204,0.3)' }}>
            <Sparkles size={24} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Nova AI Interface</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>God Mode Operator - Online</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="matte-3d-inset" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px' }}>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '12px' }}>
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              style={{ 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '75%',
                background: msg.role === 'user' ? 'linear-gradient(135deg, var(--color-ocean-blue) 0%, #004488 100%)' : '#ffffff',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                padding: '12px 16px',
                borderRadius: '16px',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: msg.role === 'nova' ? '4px' : '16px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                border: msg.role === 'nova' ? '1px solid #e0e0e0' : 'none',
                lineHeight: 1.5,
                fontSize: '14px'
              }}
            >
              {msg.content}
            </div>
          ))}
          
          {isThinking && (
            <div style={{ alignSelf: 'flex-start', background: '#ffffff', padding: '12px 16px', borderRadius: '16px', borderBottomLeftRadius: '4px', border: '1px solid #e0e0e0', display: 'flex', gap: '6px' }}>
              <div className="nova-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-ocean-blue)', animation: 'pulse 1s infinite alternate' }}></div>
              <div className="nova-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-ocean-blue)', animation: 'pulse 1s infinite alternate 0.2s' }}></div>
              <div className="nova-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-ocean-blue)', animation: 'pulse 1s infinite alternate 0.4s' }}></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <div className="matte-3d" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '8px 16px', background: 'white' }}>
            <MessageSquare size={18} color="var(--text-secondary)" />
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nova to create a task, check workload, or summarize..." 
              style={{ border: 'none', background: 'transparent', outline: 'none', paddingLeft: '12px', width: '100%', fontSize: '14px' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={!input.trim() || isThinking}
            style={{ 
              padding: '12px', 
              borderRadius: '16px', 
              border: 'none', 
              background: input.trim() && !isThinking ? 'var(--color-deep-orange)' : 'var(--text-secondary)', 
              color: 'white', 
              cursor: input.trim() && !isThinking ? 'pointer' : 'not-allowed', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: input.trim() && !isThinking ? '0 4px 15px rgba(255,87,34,0.4)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Send size={18} />
          </button>
        </form>

      </div>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default NovaChat;
