import React from 'react';

const Linkify = ({ text, style }) => {
  if (!text) return null;
  if (typeof text !== 'string') return text;
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return (
    <span style={style}>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a 
              key={i} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: 'var(--color-ocean-blue)', textDecoration: 'underline', fontWeight: 600 }}
              onClick={(e) => e.stopPropagation()} // Prevent triggering parent clicks
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export default Linkify;
