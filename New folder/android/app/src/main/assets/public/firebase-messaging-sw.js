importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC1d5Bpm9_gU5-_Qg0reHTa4HPE9idf1bQ",
  authDomain: "evorise-workspace-600d4.firebaseapp.com",
  projectId: "evorise-workspace-600d4",
  storageBucket: "evorise-workspace-600d4.firebasestorage.app",
  messagingSenderId: "202925462987",
  appId: "1:202925462987:web:a1595398a508a96629524e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/evorise-logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
