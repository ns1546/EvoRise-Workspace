import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      
      if (currentPage <= 3) {
        end = maxVisiblePages;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - maxVisiblePages + 1;
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const btnStyle = (disabled) => ({
    padding: '6px',
    borderRadius: '8px',
    border: '1px solid var(--glass-border)',
    background: disabled ? 'rgba(0,0,0,0.02)' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--text-secondary)' : 'var(--color-ocean-blue)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    opacity: disabled ? 0.5 : 1
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 12px', background: 'white', borderRadius: '16px', border: '1px solid var(--glass-border)', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
        </span>
        <select 
          value={itemsPerPage} 
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '13px', outline: 'none', background: 'var(--bg-matte)', fontWeight: 600, color: 'var(--text-primary)' }}
        >
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button disabled={currentPage === 1} onClick={() => onPageChange(1)} style={btnStyle(currentPage === 1)} title="First Page"><ChevronsLeft size={16}/></button>
        <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} style={btnStyle(currentPage === 1)} title="Previous"><ChevronLeft size={16}/></button>
        
        {getPageNumbers().map(num => (
          <button 
            key={num} 
            onClick={() => onPageChange(num)} 
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: num === currentPage ? 'none' : '1px solid var(--glass-border)',
              background: num === currentPage ? 'var(--color-ocean-blue)' : 'white',
              color: num === currentPage ? 'white' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '32px',
              boxShadow: num === currentPage ? '0 2px 8px rgba(0,102,204,0.3)' : 'none'
            }}
          >
            {num}
          </button>
        ))}

        <button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} style={btnStyle(currentPage === totalPages)} title="Next"><ChevronRight size={16}/></button>
        <button disabled={currentPage === totalPages} onClick={() => onPageChange(totalPages)} style={btnStyle(currentPage === totalPages)} title="Last Page"><ChevronsRight size={16}/></button>
        
        {/* Jump to page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', width: '100%', justifyContent: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Jump to:</span>
          <input 
            type="number" 
            min="1" 
            max={totalPages}
            placeholder="#"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= totalPages) {
                  onPageChange(val);
                  e.target.value = ''; // clear after jump
                }
              }
            }}
            style={{ width: '60px', padding: '6px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '13px', textAlign: 'center', outline: 'none', fontWeight: 600, background: 'var(--bg-matte)' }}
          />
        </div>
      </div>
    </div>
  );
};

export default Pagination;
