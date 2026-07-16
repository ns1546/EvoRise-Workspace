import { collection, addDoc, getDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const safeDelete = async (collectionName, docId, deletedBy) => {
    try {
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            console.warn(`Document ${docId} in ${collectionName} does not exist. It may have already been deleted.`);
            return; 
        }
        
        const data = docSnap.data();

        // Save to archive_trash
        await setDoc(doc(db, 'archive_trash', docId), {
            originalCollection: collectionName,
            originalId: docId,
            data: data,
            deletedBy: deletedBy?.name || deletedBy || 'System / Admin',
            deletedAt: new Date().toISOString()
        });
        
        // Delete from original collection
        await deleteDoc(docRef);
    } catch (err) {
        console.error("Error in safeDelete:", err);
        throw err;
    }
};

export const restoreFromTrash = async (trashId) => {
    try {
        const trashRef = doc(db, 'archive_trash', trashId);
        const trashSnap = await getDoc(trashRef);
        
        if (!trashSnap.exists()) return;
        
        const trashData = trashSnap.data();
        
        // Restore to original collection
        await setDoc(doc(db, trashData.originalCollection, trashData.originalId), trashData.data);
        
        // Delete from trash
        await deleteDoc(trashRef);
    } catch (err) {
        console.error("Error restoring from trash:", err);
        throw err;
    }
};

export const permanentDelete = async (trashId) => {
    try {
        await deleteDoc(doc(db, 'archive_trash', trashId));
    } catch (err) {
        console.error("Error permanently deleting:", err);
        throw err;
    }
};

export const autoCleanTrash = async (docs) => {
    // Pass in the docs from the onSnapshot listener in the UI
    const now = new Date().getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    
    for (const d of docs) {
        const deletedAt = new Date(d.deletedAt).getTime();
        if (now - deletedAt > thirtyDaysMs) {
            await permanentDelete(d.id);
        }
    }
};
