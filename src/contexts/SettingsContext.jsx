import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

const DEFAULT_SETTINGS = {
  general: {
    autoLockTimeout: 'never',
    timeFormat: '12h'
  },
  security: {
    locationStrictness: 'audit', // 'strict' (blocks login) or 'audit' (tracks but does not block)
  },
  automation: {
    autoArchiveDays: 30,
    logRetentionDays: 90
  },
  ui: {
    hiddenModules: []
  }
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Failsafe: never block the app for more than 4 seconds waiting for settings
    const failsafe = setTimeout(() => setLoading(false), 4000);

    const settingsRef = doc(db, 'system_config', 'global_settings');
    const unsubscribe = onSnapshot(settingsRef, async (docSnap) => {
      clearTimeout(failsafe);
      if (docSnap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() });
      } else {
        // Initialize default settings if they don't exist
        try {
          await setDoc(settingsRef, DEFAULT_SETTINGS);
          setSettings(DEFAULT_SETTINGS);
        } catch (e) {
          console.warn('Could not initialize global settings — using defaults', e);
          setSettings(DEFAULT_SETTINGS);
        }
      }
      setLoading(false);
    }, (err) => {
      // Firestore permission error or offline — use defaults and don't block
      clearTimeout(failsafe);
      console.warn('Settings load failed — using defaults', err);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
    });

    return () => { clearTimeout(failsafe); unsubscribe(); };
  }, []);

  const updateSettings = async (newSettingsPayload) => {
    try {
      const settingsRef = doc(db, 'system_config', 'global_settings');
      await updateDoc(settingsRef, newSettingsPayload);
    } catch (e) {
      console.error("Failed to update settings", e);
      throw e;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};
