import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const ActivityContext = createContext();
export const useActivity = () => useContext(ActivityContext);

export const ActivityProvider = ({ children }) => {
  const { currentUser, userData } = useAuth();
  const sessionIdRef = useRef(null);
  const sessionStartRef = useRef(null);
  const locationRef = useRef(null);

  // ─── Capture Geolocation once on mount ───────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      },
      () => { locationRef.current = null; }
    );
  }, []);

  // ─── Session Start & Heartbeat ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return;

    const startSession = async () => {
      sessionStartRef.current = Date.now();
      try {
        const sessionRef = await addDoc(collection(db, 'session_logs'), {
          uid: currentUser.uid,
          userName: userData?.name || currentUser.email,
          userRole: userData?.role || 'Employee',
          loginAt: serverTimestamp(),
          logoutAt: null,
          activeMinutes: 0,
          location: locationRef.current,
          ipInfo: null,
          device: navigator.userAgent,
          sessionStatus: 'active'
        });
        sessionIdRef.current = sessionRef.id;
      } catch (e) {
        console.warn('Session log failed:', e);
      }
    };

    startSession();

    // ─── Heartbeat every 2 minutes to keep active time ───────────────────────
    const heartbeatInterval = setInterval(async () => {
      if (!sessionIdRef.current) return;
      const activeMinutes = Math.floor((Date.now() - sessionStartRef.current) / 60000);
      try {
        await updateDoc(doc(db, 'session_logs', sessionIdRef.current), {
          activeMinutes,
          lastHeartbeat: serverTimestamp()
        });
      } catch {}
    }, 120000); // every 2 min

    // ─── Catch tab close / refresh (beforeunload) ─────────────────────────────
    const handleUnload = () => {
      if (!sessionIdRef.current) return;
      const activeMinutes = Math.floor((Date.now() - sessionStartRef.current) / 60000);
      // Use Firestore directly to update session on unload
      try {
        updateDoc(doc(db, 'session_logs', sessionIdRef.current), {
          logoutAt: serverTimestamp(),
          activeMinutes,
          sessionStatus: 'completed'
        });
      } catch {}
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [currentUser?.uid]);

  // ─── Global Activity Log Writer ───────────────────────────────────────────────
  // Call this from any module to log user actions
  const logActivity = useCallback(async ({ action, module, detail = '', targetId = null, targetCollection = null, oldData = null }) => {
    if (!currentUser?.uid) return;
    try {
      await addDoc(collection(db, 'activity_logs'), {
        uid: currentUser.uid,
        userName: userData?.name || currentUser.email,
        userRole: userData?.role || 'Employee',
        action,        // e.g. 'CREATE_TASK', 'DELETE_CLIENT', 'SEND_EMAIL'
        module,        // e.g. 'evoboard', 'mailbox', 'clients'
        detail,        // human-readable: 'Created task "Design Logo" for Client X'
        targetId,      // optional: ID of affected document
        targetCollection, // optional: Firestore collection name
        oldData,       // optional: The previous state object before the edit
        location: locationRef.current,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.warn('Activity log failed silently:', e);
    }
  }, [currentUser?.uid, userData]);

  return (
    <ActivityContext.Provider value={{ logActivity }}>
      {children}
    </ActivityContext.Provider>
  );
};
