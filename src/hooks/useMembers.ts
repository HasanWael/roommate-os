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
      console.log('useMembers snapshot received, docs:', snapshot.docs.length);
      const memberDocs = snapshot.docs;
      try {
        const memberData = await Promise.all(memberDocs.map(async (memberDoc) => {
          const data = memberDoc.data();
          try {
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            if (!userDoc.exists()) {
              console.warn(`User document not found for userId: ${data.userId}`);
            }
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
      } catch (err) {
        console.error('Error processing member data in useMembers:', err);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'apartmentMembers');
    });

    return () => unsubscribe();
  }, [apartmentId]);

  return useMemo(() => ({ members, loadingMembers }), [members, loadingMembers]);
}
