import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin only once
if (getApps().length === 0) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    if (getApps().length === 0) {
      return { 
        statusCode: 500, 
        headers,
        body: JSON.stringify({ error: 'Firebase Admin not initialized. Check FIREBASE_SERVICE_ACCOUNT env var.' }) 
      };
    }

    const { title, body, targetUid, data } = JSON.parse(event.body);
    console.log(`Received push request for targetUid: ${targetUid}`);
    const db = getFirestore();
    const messaging = getMessaging();
    
    let tokens = [];
    
    if (targetUid === 'all') {
      const usersSnap = await db.collection('users').get();
      usersSnap.forEach(doc => {
        const userData = doc.data();
        if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
          tokens.push(...userData.fcmTokens);
        }
      });
    } else if (targetUid === 'admin') {
      const usersSnap = await db.collection('users').where('role', 'in', ['Admin', 'Administrator', 'Partner']).get();
      usersSnap.forEach(doc => {
        const userData = doc.data();
        if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
          tokens.push(...userData.fcmTokens);
        }
      });
    } else if (targetUid) {
      const userDoc = await db.collection('users').doc(targetUid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
          tokens.push(...userData.fcmTokens);
        }
      }
    }

    // Deduplicate tokens
    tokens = [...new Set(tokens)];
    console.log(`Found ${tokens.length} unique tokens for target: ${targetUid}`);

    if (tokens.length === 0) {
      console.log('No tokens found, skipping push.');
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No tokens found for target, skipping push.' }) };
    }

    // Ensure all data payload values are strings (FCM requirement)
    const sanitizedData = {};
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
          sanitizedData[key] = String(value);
        }
      }
    }

    const message = {
      notification: {
        title: title || 'New Notification',
        body: body || ''
      },
      data: sanitizedData,
      tokens: tokens,
      webpush: {
        notification: {
          icon: '/ev_logo.png', // Or whichever logo is best, matching the PWA manifest
          badge: '/icons.svg'
        }
      },
      apns: {
        payload: {
          aps: {
            badge: 1, // Optional: You can implement dynamic badge count based on unseen notifications if needed
            sound: 'default'
          }
        }
      }
    };

    const response = await messaging.sendEachForMulticast(message);
    console.log(`Push completed. Success: ${response.successCount}, Failures: ${response.failureCount}`);
    
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Token failed [${idx}]:`, resp.error);
        }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount
      }),
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send push notification', details: error.message }),
    };
  }
};
