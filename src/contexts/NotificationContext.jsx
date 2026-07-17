import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db, messaging } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, limit, serverTimestamp, writeBatch, arrayUnion } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { useAuth } from './AuthContext';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';

const NotificationContext = createContext();
export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { currentUser, userData } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);        // Visible toast queue (max 5)
  const [badges, setBadges] = useState({});         // { evoboard: 3, mailbox: 1, ... }
  const [taskBadges, setTaskBadges] = useState({ myday: 0, evoboard: 0 }); // Live task counts
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const toastQueue = useRef([]);                    // Internal buffer (crash-proof)
  const processingToast = useRef(false);
  const unsubRef = useRef(null);

  // ─── Real-time Firestore Tasks listener (for Badges) ─────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snap) => {
      let myDayCount = 0;
      let evoboardCount = 0;
      const today = new Date().toISOString().split('T')[0];
      
      snap.forEach(d => {
        const t = d.data();
        const isDone = t.status === 'Done' || t.status === 'pending_edit';
        
        if (!isDone) {
          // MyDay Logic: assigned to current user, created on or before today
          if (t.assigneeId === currentUser.uid) {
            let tDate = '';
            if (t.createdAt) {
               try {
                 const dateObj = typeof t.createdAt === 'number' ? new Date(t.createdAt) : (t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt));
                 if (!isNaN(dateObj.getTime())) tDate = dateObj.toISOString().split('T')[0];
               } catch(e){}
            }
            if (tDate <= today) myDayCount++;
          }
          
          // EvoBoard Logic: Unassigned tasks
          if (!t.assigneeId) {
            evoboardCount++;
          }
        }
      });
      setTaskBadges({ myday: myDayCount, evoboard: evoboardCount });
    });
    return () => unsubTasks();
  }, [currentUser?.uid]);

  // ─── Real-time Firestore listener ────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Register Push Notifications
    if (Capacitor.isNativePlatform()) {
      PushNotifications.requestPermissions().then(result => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });
      PushNotifications.addListener('registration', (token) => {
        console.log('Native Push Token:', token.value);
        updateDoc(doc(db, 'users', currentUser.uid), {
          fcmTokens: arrayUnion(token.value)
        }).catch(e => console.warn('Failed to save native token', e));
      });
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received in foreground:', notification);
      });
    } else if ('serviceWorker' in navigator) {
      // Web Service Worker (PWA) push notification fallback
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(registration => {
          if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted' && messaging) {
                getToken(messaging, { serviceWorkerRegistration: registration })
                  .then(token => {
                    if (token) {
                      console.log('Web FCM Token generated:', token);
                      updateDoc(doc(db, 'users', currentUser.uid), {
                        fcmTokens: arrayUnion(token)
                      }).catch(e => console.warn('Failed to save PWA token', e));
                    }
                  }).catch(err => console.warn('FCM token fetch failed', err));
              }
            });
          }
        })
        .catch(err => console.error('Service worker registration failed', err));
    }

    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    unsubRef.current = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach(d => {
        const notifData = d.data();
        const isAdmin = ['Admin', 'Partner', 'Administrator'].includes(userData?.role);
        if (notifData.targetUid === currentUser.uid || notifData.targetUid === 'all' || (isAdmin && notifData.targetUid === 'admin')) {
          data.push({ id: d.id, ...notifData });
        }
      });
      setNotifications(data);

      // Badge counts per module
      const unread = data.filter(n => !n.readBy?.includes(currentUser.uid));
      const newBadges = {};
      unread.forEach(n => {
        if (n.module) newBadges[n.module] = (newBadges[n.module] || 0) + 1;
      });
      setBadges(newBadges);

      // Detect new notifications (not yet seen) and push to toast queue
      const newOnes = data.filter(n => {
        if (n.readBy?.includes(currentUser.uid)) return false;
        // If createdAt is null (pending serverTimestamp), it's definitely brand new locally!
        if (!n.createdAt) return true;
        // If it's a Firestore Timestamp or JS Date, compare it
        const ts = n.createdAt.toMillis ? n.createdAt.toMillis() : (n.createdAt.getTime ? n.createdAt.getTime() : Date.now());
        return ts > (Date.now() - 8000);
      });
      newOnes.forEach(n => {
        enqueueToast(n);
        if (n.type === 'reminder' && n.reminderFor) {
          window.dispatchEvent(new CustomEvent('incoming-reminder', { detail: { taskId: n.reminderFor } }));
        }
      });
    });
    return () => unsubRef.current?.();
  }, [currentUser?.uid]);

  // ─── Toast Queue Processor (throttled, crash-proof) ──────────────────────────
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  };

  const enqueueToast = useCallback((notif) => {
    // Prevent duplicate toasts
    if (toastQueue.current.find(t => t.id === notif.id)) return;
    toastQueue.current.push(notif);
    
    // Play sound and vibrate for new incoming toasts
    playNotificationSound();
    
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } else if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]); // Vibrate 100ms, pause 50ms, vibrate 100ms
    }

    // Removed native System Notifications entirely so that all notifications
    // show up exactly like "real app notifications" (via our GlobalToastOverlay)
    // without the browser chrome branding on desktop.

    // Check if Dynamic Island is mounted and enabled
    const islandEl = document.getElementById('dynamic-island');
    if (islandEl && islandEl.dataset.enabled !== 'false') {
      window.dispatchEvent(new CustomEvent('TRIGGER_DYNAMIC_ISLAND', {
        detail: {
          type: notif.type === 'announcement' ? 'nova-announcement' : 
                notif.type === 'voice-announcement' ? 'nova-voice-announcement' : 'notification',
          data: {
            title: notif.title || (notif.type === 'announcement' ? 'Nova Announcement' : 'System Notification'),
            body: notif.body || 'You have a new message.',
            id: notif.id,
            actionUrl: notif.actionUrl
          }
        }
      }));
      // Remove from toast queue so we don't show double notifications
      toastQueue.current.pop();
      return;
    }

    if (!processingToast.current) processNextToast();
  }, []);

  const processNextToast = useCallback(() => {
    if (toastQueue.current.length === 0) {
      processingToast.current = false;
      return;
    }
    processingToast.current = true;
    const next = toastQueue.current.shift();
    setToasts(prev => {
      // Max 5 toasts at once
      const updated = [next, ...prev].slice(0, 5);
      return updated;
    });
    // Auto-remove after 5 seconds, then process next
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== next.id));
      setTimeout(processNextToast, 300);
    }, 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Mark as Read ─────────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id) => {
    if (!currentUser?.uid) return;
    await updateDoc(doc(db, 'notifications', id), {
      readBy: [...(notifications.find(n => n.id === id)?.readBy || []), currentUser.uid]
    });
  }, [notifications, currentUser?.uid]);

  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.uid) return;
    const unread = notifications.filter(n => !n.readBy?.includes(currentUser.uid));
    if (unread.length === 0) return;
    
    // Chunking to respect Firestore 500-operation limit
    for (let i = 0; i < unread.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = unread.slice(i, i + 400);
      chunk.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), {
          readBy: [...(n.readBy || []), currentUser.uid]
        });
      });
      await batch.commit();
    }
  }, [notifications, currentUser?.uid]);

  const markModuleAsRead = useCallback(async (moduleName) => {
    if (!currentUser?.uid) return;
    const unread = notifications.filter(n => !n.readBy?.includes(currentUser.uid) && n.module === moduleName);
    if (unread.length === 0) return;
    
    try {
      for (let i = 0; i < unread.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = unread.slice(i, i + 400);
        chunk.forEach(n => {
          batch.update(doc(db, 'notifications', n.id), {
            readBy: [...(n.readBy || []), currentUser.uid]
          });
        });
        await batch.commit();
      }
    } catch (e) {
      console.error(`Failed to mark ${moduleName} as read`, e);
    }
  }, [notifications, currentUser?.uid]);

  const deleteNotification = useCallback(async (id) => {
    try {
      // Rather than deleting for everyone, we add a deletedBy array similar to readBy
      const notif = notifications.find(n => n.id === id);
      if (notif) {
        await updateDoc(doc(db, 'notifications', id), {
          deletedBy: [...(notif.deletedBy || []), currentUser.uid]
        });
      }
    } catch (e) {
      console.error("Failed to delete notification", e);
    }
  }, [notifications, currentUser?.uid]);

  const deleteAllNotifications = useCallback(async () => {
    if (!currentUser?.uid) return;
    const toDelete = notifications.filter(n => !n.deletedBy?.includes(currentUser.uid));
    if (toDelete.length === 0) return;
    
    try {
      for (let i = 0; i < toDelete.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = toDelete.slice(i, i + 400);
        chunk.forEach(n => {
          batch.update(doc(db, 'notifications', n.id), {
            deletedBy: [...(n.deletedBy || []), currentUser.uid]
          });
        });
        await batch.commit();
      }
    } catch (e) {
      console.error("Failed to clear notifications", e);
    }
  }, [notifications, currentUser?.uid]);

  // ─── Send Notification (System API) ─────────────────────────────────────────
  const sendNotification = useCallback(async ({ title, body, module, targetUid = 'all', type = 'info', actionUrl = null, reminderFor = null }) => {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        title,
        body,
        module,
        targetUid,
        type,         // 'info' | 'success' | 'warning' | 'error' | 'reminder'
        actionUrl,
        reminderFor,
        readBy: [],
        deletedBy: [],
        reminderSentCount: reminderFor ? 1 : 0,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'system',
      });

      // Trigger Netlify Push Function for background mobile notifications
      const pushUrl = window.location.hostname === 'localhost' || window.location.protocol === 'file:' 
        ? 'https://evorise-workspace.netlify.app/.netlify/functions/sendPush'
        : '/.netlify/functions/sendPush';

      fetch(pushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          targetUid,
          data: { url: actionUrl, id: docRef.id, type }
        })
      }).catch(e => console.warn('Push notification trigger failed:', e));
    } catch (e) {
      console.error('Error adding notification:', e);
    }
  }, [currentUser?.uid]);

  // ─── Send Manual Reminder ────────────────────────────────────────────────────
  const sendReminder = useCallback(async (notifId) => {
    const n = notifications.find(x => x.id === notifId);
    if (!n) return;
    await updateDoc(doc(db, 'notifications', notifId), {
      reminderSentCount: (n.reminderSentCount || 0) + 1,
      lastReminderAt: serverTimestamp(),
      readBy: []   // re-surfaces as unread
    });
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.readBy?.includes(currentUser?.uid)).length;

  // ─── PWA App Badge Sync ──────────────────────────────────────────────────────
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      const mydayTasks = taskBadges.myday || 0;
      const evoboardTasks = (userData?.role === 'Admin' || userData?.role === 'Partner' || userData?.role === 'Administrator') ? (taskBadges.evoboard || 0) : 0;
      const totalCount = unreadCount + mydayTasks + evoboardTasks;
      
      try {
        if (totalCount > 0) {
          navigator.setAppBadge(totalCount).catch(e => console.warn('App badge set error', e));
        } else {
          navigator.clearAppBadge().catch(e => console.warn('App badge clear error', e));
        }
      } catch (e) {
        console.warn('App Badging API not supported or failed', e);
      }
    }
  }, [unreadCount, taskBadges, userData?.role]);

  return (
    <NotificationContext.Provider value={{
      notifications: notifications.filter(n => !n.deletedBy?.includes(currentUser?.uid)), 
      toasts, 
      badges: {
         ...badges,
         myday: (badges.myday || 0) + (taskBadges.myday || 0),
         evoboard: (badges.evoboard || 0) + ((userData?.role === 'Admin' || userData?.role === 'Partner' || userData?.role === 'Administrator') ? taskBadges.evoboard : 0)
      }, 
      unreadCount,
      isDrawerOpen, setIsDrawerOpen,
      markAsRead, markAllAsRead, markModuleAsRead,
      deleteNotification, deleteAllNotifications,
      sendNotification, sendReminder,
      dismissToast
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
