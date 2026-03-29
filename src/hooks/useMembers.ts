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
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memberData = snapshot.docs.map((memberDoc) => {
        const data = memberDoc.data();
        return {
          id: memberDoc.id,
          ...data,
          user: {
            fullName: data.fullName || 'Unknown User',
            avatarUrl: data.avatarUrl || null
          }
        };
      });
      
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
