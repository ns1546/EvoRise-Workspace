import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, setPersistence, browserSessionPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, limit, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from './SettingsContext';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { settings, loading: settingsLoading } = useSettings();
  
  // Use a ref for settings so closures (like onAuthStateChanged) can access the latest
  const settingsRef = React.useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    // Apply Auto-Logout Persistence
    if (settings?.security?.autoLogout === 'enabled') {
      setPersistence(auth, browserSessionPersistence).catch(console.error);
    } else {
      setPersistence(auth, browserLocalPersistence).catch(console.error);
    }
  }, [settings]);
  
  // Phase 1: Location & System Lock State
  const [locationError, setLocationError] = useState(false);
  const [systemLocked, setSystemLocked] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const requestLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({ code: 0, message: "Geolocation not supported" });
        return;
      }
      
      // Strict manual timeout because browser native timeout often hangs
      const timer = setTimeout(() => {
        reject({ code: 3, message: "Location request timed out" });
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timer);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // ── STEP 1: Load / create user profile in Firestore ──
        try {
          const userRef = doc(db, 'users', user.uid);
          
          // We fetch it once to decide if they are allowed
          const userDocSnap = await getDoc(userRef);
          
          let initialData = null;
          if (userDocSnap.exists()) {
            initialData = { id: user.uid, ...userDocSnap.data() };
          } else {
            // Check if they are the very first user in the database
            const usersRef = collection(db, 'users');
            const allUsersSnap = await getDocs(query(usersRef, limit(1)));
            
            if (allUsersSnap.empty) {
              // First user ever -> auto-create profile and make Admin
              initialData = {
                id: user.uid,
                name: user.displayName || user.email?.split('@')[0] || 'User',
                email: user.email || '',
                photoURL: user.photoURL || '',
                role: 'Admin',
                joiningDate: new Date().toISOString().split('T')[0],
                status: 'Active',
                provider: user.providerData?.[0]?.providerId || 'password'
              };
              await setDoc(userRef, initialData);
            } else {
              // Not the first user, and no profile exists. Reject access!
              await signOut(auth);
              setCurrentUser(null);
              setUserData(null);
              setLoading(false);
              alert("Access Denied: Your account is not registered in this workspace. Please contact the administrator.");
              return;
            }
          }

          // Now that they are authorized, set current user to trigger the router
          setCurrentUser(user);

          // ── STEP 2: Listen for live updates to their profile ──
          const unsubProfile = onSnapshot(userRef, async (userDoc) => {
            if (!userDoc.exists()) {
               // Profile deleted while they were logged in -> kick them out
               await signOut(auth);
               setCurrentUser(null);
               setUserData(null);
               setLoading(false);
               return;
            }
            let currentData = { id: user.uid, ...userDoc.data() };

            // ── Self-Healing: Upgrade first user / owner to Admin (if somehow they aren't) ──
            const usersRef = collection(db, 'users');
            const qAdmin = query(usersRef, where('role', 'in', ['Admin', 'Administrator', 'Partner']), limit(1));
            const adminSnap = await getDocs(qAdmin);

            if (
              (adminSnap.empty || user.email?.startsWith('nstasin81') || user.email === 'admin@evorise.com') &&
              currentData.role !== 'Admin'
            ) {
              currentData.role = 'Admin';
              await updateDoc(userRef, { role: 'Admin' });
            }

            setUserData(currentData);
          });
        } catch (dbError) {
          console.error('Profile load error:', dbError);
        }

        // ── STEP 3: Location check ──
        const strictness = settingsRef.current?.security?.locationStrictness || 'strict';
        
        if (strictness === 'strict') {
          // Explicitly require location via the lock screen EVERY time they login
          setSystemLocked(true);
          setLocationError(false);
          setPermissionDenied(false);
        } else {
          // Audit mode: run in background silently
          try {
            const loc = await requestLocation();
            setLocationData(loc);
            setLocationError(false);
            setSystemLocked(false);
            setPermissionDenied(false);

            try {
              await setDoc(doc(db, 'session_logs', user.uid + '_' + Date.now()), {
                userId: user.uid,
                loginTime: serverTimestamp(),
                location: loc,
                status: 'active'
              });
            } catch (e) {}

          } catch (error) {
            console.warn('Location access denied or error:', error);
            setLocationError(true);
            setPermissionDenied(false);
            setSystemLocked(false);
          }
        }

      } else {
        setCurrentUser(null);
        setUserData(null);
        setLocationData(null);
        setSystemLocked(false);
        setPermissionDenied(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let idleTimeout;
    const timeoutMinutes = settings?.general?.autoLockTimeout;

    const resetIdleTimer = () => {
      clearTimeout(idleTimeout);
      if (timeoutMinutes === 'never' || !timeoutMinutes) return;

      const timeoutMs = parseInt(timeoutMinutes, 10) * 60000;
      idleTimeout = setTimeout(() => {
        if (currentUser && !systemLocked) {
          console.log("System Auto-Locked due to inactivity.");
          setSystemLocked(true);
        }
      }, timeoutMs); 
    };

    if (currentUser && !systemLocked) {
      window.addEventListener('mousemove', resetIdleTimer);
      window.addEventListener('keypress', resetIdleTimer);
      window.addEventListener('click', resetIdleTimer);
      window.addEventListener('scroll', resetIdleTimer);
      resetIdleTimer();
    }

    return () => {
      clearTimeout(idleTimeout);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keypress', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      window.removeEventListener('scroll', resetIdleTimer);
    };
  }, [currentUser, systemLocked, settings?.general?.autoLockTimeout]);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const lockSystem = () => setSystemLocked(true);
  
  const unlockSystem = async () => {
    setIsUnlocking(true);
    try {
      const loc = await requestLocation();
      setLocationData(loc);
      setLocationError(false);
      setSystemLocked(false);
      setPermissionDenied(false);
      
      try {
        if (currentUser) {
           await setDoc(doc(db, 'session_logs', currentUser.uid + '_' + Date.now()), {
              userId: currentUser.uid,
              unlockTime: serverTimestamp(),
              location: loc,
              status: 'unlocked'
           });
        }
      } catch (dbError) {}
      
    } catch (err) {
      const strictness = settingsRef.current?.security?.locationStrictness || 'strict';
      setLocationError(true);

      if (strictness === 'strict') {
        if (err && err.code === 1) {
          setPermissionDenied(true);
        } else {
          setPermissionDenied(false);
        }
        // System remains locked since strictness requires a valid location
      } else {
        // Bypass for hardware/OS issues silently (Audit mode)
        console.warn("Location unavailable, but unlocking anyway due to Audit mode.");
        setPermissionDenied(false);
        setSystemLocked(false);
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const forceUnlock = () => {
    setLocationError(false);
    setSystemLocked(false);
    setPermissionDenied(false);
  };

  const value = {
    currentUser,
    userData,
    loading,
    login,
    logout,
    locationError,
    systemLocked,
    lockSystem,
    unlockSystem,
    locationData,
    permissionDenied,
    forceUnlock,
    isUnlocking
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
