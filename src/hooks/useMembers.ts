import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';

import { handleFirestoreError, OperationType } from '../lib/firestore-error';

export function useMembers() {
  const { apartmentId } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    if (!apartmentId) return;

    const q = query(collection(db, 'apartmentMembers'), where('apartmentId', '==', apartmentId));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const memberDocs = snapshot.docs;
      const memberData = await Promise.all(memberDocs.map(async (memberDoc) => {
        const data = memberDoc.data();
        try {
          const userDoc = await getDoc(doc(db, 'users', data.userId));
          return {
            id: memberDoc.id,
            ...data,
            user: userDoc.exists() ? userDoc.data() : { fullName: 'Unknown User', avatarUrl: null }
          };
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${data.userId}`);
          return { 
            id: memberDoc.id, 
            ...data, 
            user: { fullName: 'Unknown User', avatarUrl: null } 
          };
        }
      }));
      
      setMembers(prev => {
        const prevStr = JSON.stringify(prev);
        const nextStr = JSON.stringify(memberData);
        return prevStr === nextStr ? prev : memberData;
      });
      setLoadingMembers(prev => prev ? false : prev);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'apartmentMembers');
    });

    return () => unsubscribe();
  }, [apartmentId]);

  return useMemo(() => ({ members, loadingMembers }), [members, loadingMembers]);
}
