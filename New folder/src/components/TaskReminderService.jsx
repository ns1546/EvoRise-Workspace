import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useNotifications } from '../contexts/NotificationContext';

const TaskReminderService = () => {
  const [tasks, setTasks] = useState([]);
  const { sendNotification } = useNotifications();

  useEffect(() => {
    // We only need to track tasks that are not done
    const unsub = onSnapshot(collection(db, 'tasks'), snap => {
      const data = [];
      snap.forEach(d => {
        const t = d.data();
        if (t.status !== 'Done' && t.reminderDateTime && !t.reminderSent) {
          data.push({ id: d.id, ...t });
        }
      });
      setTasks(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      tasks.forEach(async (task) => {
        const reminderTime = new Date(task.reminderDateTime);
        if (now >= reminderTime) {
          // Trigger Notification
          sendNotification({
            title: `Deadline Approaching`,
            body: `Task "${task.taskName || task.customName || 'Untitled'}" is due soon.`,
            module: 'evoboard',
            targetUid: task.assigneeId || 'admin',
            type: 'reminder',
            actionUrl: task.id,
            reminderFor: task.id
          });
          
          // Mark as sent
          try {
            await updateDoc(doc(db, 'tasks', task.id), { reminderSent: true });
          } catch (err) {
            console.error('Failed to update reminderSent', err);
          }
        }
      });
    }, 15000); // check every 15 seconds

    return () => clearInterval(interval);
  }, [tasks, sendNotification]);

  return null; // Silent service
};

export default TaskReminderService;
