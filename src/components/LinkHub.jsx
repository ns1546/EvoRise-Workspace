import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit2, Trash2, ExternalLink, MoreVertical, Link as LinkIcon, Search, AlertTriangle, X } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { GlobalErrorBoundary } from './ErrorLogsPage';
import './LinkHub.css';

const DEFAULT_LINKS = [
  { name: 'Evorise Link Hub', url: 'https://evorise-link-hub.netlify.app/' },
  { name: 'EvoRise Workspace', url: 'https://evorise-system.web.app/' },
  { name: 'EvoRise Reports', url: 'https://evorise-papers-generators.netlify.app/' },
  { name: 'Meeting Link', url: 'https://meeting-link-evorise.netlify.app/' },
  { name: 'Payment Receipt', url: 'https://evorise-payment.web.app/' },
  { name: 'Evorise All Links', url: 'https://evorise-all-links.netlify.app/' },
  { name: 'Monthly Report', url: 'https://gemini.google.com/gem/1wysMJJrIbgMG4jl1-1O68HN5x-xUUwY0?usp=sharing' },
  { name: 'Calendar', url: 'https://docs.google.com/spreadsheets/d/1k5BsAcwQLLqBvOmbj-Djhy8LPkuA5ztGtwjWXhK1EzY/edit?usp=drivesdk' },
  { name: 'Invoice', url: 'https://invoice-evorise.netlify.app/' },
  { name: 'Appointment Generator', url: 'https://evorise-appointment-letter-generator.netlify.app/' }
];

const LinkHub = () => {
  const isMobile = useIsMobile();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [formData, setFormData] = useState({ name: '', url: '' });
  
  // Context Menu State
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.link-card__menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch Links
  useEffect(() => {
    const q = query(collection(db, 'links'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linksData = [];
      snapshot.forEach(doc => linksData.push({ id: doc.id, ...doc.data() }));
      
      // Auto-populate default links if collection is completely empty
      if (linksData.length === 0 && !loading) {
        populateDefaultLinks();
      } else {
        setLinks(linksData);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching links:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loading]);

  const populateDefaultLinks = async () => {
    setLoading(true);
    for (const link of DEFAULT_LINKS) {
      try {
        await addDoc(collection(db, 'links'), {
          ...link,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Error adding default link", e);
      }
    }
  };

  const openModal = (link = null) => {
    if (link) {
      setEditingLink(link);
      setFormData({ name: link.name, url: link.url });
    } else {
      setEditingLink(null);
      setFormData({ name: '', url: '' });
    }
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLink(null);
    setFormData({ name: '', url: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) return;

    let finalUrl = formData.url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    try {
      if (editingLink) {
        const linkRef = doc(db, 'links', editingLink.id);
        await updateDoc(linkRef, {
          name: formData.name.trim(),
          url: finalUrl
        });
      } else {
        await addDoc(collection(db, 'links'), {
          name: formData.name.trim(),
          url: finalUrl,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      console.error("Error saving link:", error);
      alert("Failed to save link.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this link?")) {
      try {
        await deleteDoc(doc(db, 'links', id));
        setActiveMenuId(null);
      } catch (error) {
        console.error("Error deleting link:", error);
        alert("Failed to delete link.");
      }
    }
  };

  // Smarter Favicon component that tests images before rendering to prevent 404 console spam
  const FaviconImage = ({ url, name }) => {
    const [imgSrc, setImgSrc] = useState(null);
    
    useEffect(() => {
      let isMounted = true;
      const hostname = (() => {
        try { return new URL(url).hostname; } 
        catch (e) { return ''; }
      })();

      if (!hostname) {
        if (isMounted) setImgSrc('fallback');
        return;
      }

      const fallbackName = encodeURIComponent(name || hostname || 'Link');
      const uiAvatarUrl = `https://ui-avatars.com/api/?name=${fallbackName}&background=0f52ba&color=fff&size=128&bold=true`;

      // Define sources to check in order
      const sources = [
        `https://www.google.com/s2/favicons?sz=128&domain_url=${hostname}`,
        `https://icons.duckduckgo.com/ip3/${hostname}.ico`
      ];

      const testImage = (index) => {
        if (index >= sources.length) {
          if (isMounted) setImgSrc(uiAvatarUrl);
          return;
        }

        const img = new Image();
        img.onload = () => {
          // If the image loaded but is a 1x1 pixel or very small, it might be a fake/empty icon.
          // Google sometimes returns a 16x16 default globe. We accept it if it loads.
          if (isMounted) setImgSrc(sources[index]);
        };
        img.onerror = () => {
          testImage(index + 1);
        };
        img.src = sources[index];
      };

      // For known development subdomains that lack icons, jump straight to beautiful avatars
      if (hostname.includes('netlify.app') || hostname.includes('web.app')) {
        setImgSrc(uiAvatarUrl);
      } else {
        testImage(0);
      }

      return () => { isMounted = false; };
    }, [url, name]);

    if (!imgSrc) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
          <LinkIcon size={20} color="#8E8E93" style={{ opacity: 0.5 }} />
        </div>
      );
    }

    if (imgSrc === 'fallback') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
          <LinkIcon size={20} color="#8E8E93" />
        </div>
      );
    }

    return (
      <img 
        src={imgSrc} 
        alt={name} 
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    );
  };

  // Get domain name for subtitle
  const getDomain = (url) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch (e) {
      return url;
    }
  };

  const filteredLinks = links.filter(link => 
    link.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    link.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`link-hub-container ${isMobile ? 'is-mobile' : ''}`}>
      {/* Header Area */}
      <div className="link-hub-header">
        <div className="link-hub-header__title-group">
          <div className="link-hub-header__icon">
            <LinkIcon size={24} color="var(--blue)" />
          </div>
          <div>
            <h1>Evorise Link Hub</h1>
            <p>Your centralized workspace shortcuts</p>
          </div>
        </div>

        <div className="link-hub-header__actions">
          <div className="link-hub-search">
            <Search size={18} color="#8E8E93" />
            <input 
              type="text" 
              placeholder="Search links..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {!isMobile && (
            <button className="btn-primary" onClick={() => openModal()}>
              <Plus size={18} />
              <span>Add Link</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="link-hub-loading">
          <div className="spinner"></div>
          <p>Loading links...</p>
        </div>
      ) : (
        /* Links Grid */
        <div className="links-grid">
          {filteredLinks.length === 0 ? (
            <div className="no-links-state">
              <div className="no-links-icon">
                <AlertTriangle size={40} color="#8E8E93" />
              </div>
              <h3>No links found</h3>
              <p>Try a different search or add a new link.</p>
            </div>
          ) : (
            filteredLinks.map((link) => (
              <div key={link.id} className="link-card">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-card__main">
                  <div className="link-card__icon-wrapper">
                    <FaviconImage url={link.url} name={link.name} />
                  </div>
                  <div className="link-card__info">
                    <h3 className="link-card__title" title={link.name}>{link.name}</h3>
                    <p className="link-card__url">{getDomain(link.url)}</p>
                  </div>
                </a>

                {/* Context Menu */}
                <div className="link-card__menu-container">
                  <button 
                    className="link-card__menu-btn" 
                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === link.id ? null : link.id); }}
                  >
                    <MoreVertical size={18} />
                  </button>

                  {activeMenuId === link.id && (
                    <div className="link-card__dropdown">
                      <button onClick={(e) => { e.stopPropagation(); openModal(link); }}>
                        <Edit2 size={16} /> Edit
                      </button>
                      <button className="danger" onClick={(e) => { e.stopPropagation(); handleDelete(link.id); }}>
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <button className="mobile-fab" onClick={() => openModal()}>
          <Plus size={26} />
        </button>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content link-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingLink ? 'Edit Link' : 'Add New Link'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-group">
                <label>Title Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Evorise Dashboard" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              
              <div className="form-group">
                <label>URL / Web Address</label>
                <input 
                  type="url" 
                  placeholder="https://example.com" 
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  required
                />
                <small>The icon will be automatically fetched from the URL.</small>
              </div>

              <div className="modal-footer" style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {editingLink ? 'Save Changes' : 'Add Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Explicit spacer for mobile bottom nav & FAB */}
      {isMobile && <div style={{ height: '140px', width: '100%', flexShrink: 0 }}></div>}
    </div>
  );
};

export default function LinkHubWrapper() {
  return (
    <GlobalErrorBoundary>
      <LinkHub />
    </GlobalErrorBoundary>
  );
}
