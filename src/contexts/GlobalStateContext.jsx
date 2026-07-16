import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const GlobalStateContext = createContext();

export const useGlobalState = () => useContext(GlobalStateContext);

export const GlobalStateProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initial State structure matching legacy HTML file
  const initialState = {
    companyInfo: { name: 'EVORISE SOLUTIONS', activeTheme: 'marketing-pro' },
    users: [],
    clients: [],
    services: [],
    tasks: [],
    notifications: [],
    workLog: [],
    undoRequests: [],
    calendarEvents: [],
    passwordResetRequests: [],
    auditLog: [],
    agencies: [],
    onboardingWorkflows: [],
    sessionLogs: [],
    messages: [],
    instantWork: [],
    settings: {}
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const appStateRef = doc(db, "app_data", "main_app_state");
    
    const unsubscribe = onSnapshot(appStateRef, (docSnap) => {
      if (docSnap.exists()) {
        setState(docSnap.data());
      } else {
        // If document doesn't exist, initialize it
        console.log("No main_app_state found. Using empty/initial state.");
        setState(initialState);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching main_app_state:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Debounce save function to mimic the old system
  const saveState = useCallback(async (newStateFragment) => {
    if (!currentUser) return;
    
    try {
      // Optimistic local update
      const updatedState = { ...state, ...newStateFragment };
      setState(updatedState);

      // Clean up massive logs to prevent bloat (matching legacy logic)
      if (updatedState.auditLog && updatedState.auditLog.length > 500) {
        updatedState.auditLog = updatedState.auditLog.slice(-500);
      }
      
      await setDoc(doc(db, "app_data", "main_app_state"), updatedState);
      console.log("State successfully persisted to main_app_state.");
    } catch (err) {
      console.error("Error saving state to Firestore:", err);
    }
  }, [state, currentUser]);

  const value = {
    state,
    saveState,
    loading
  };

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
};
