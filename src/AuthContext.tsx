import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestore-error';

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

interface AuthContextType {
  user: User | null;
  loading: boolean;
  apartmentId: string | null;
  apartment: any | null;
  setApartmentId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  apartmentId: null,
  apartment: null,
  setApartmentId: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  const [apartment, setApartment] = useState<any | null>(null);
  const membershipUnsubscribeRef = React.useRef<(() => void) | null>(null);
  const apartmentUnsubscribeRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    if (apartmentId) {
      const aptRef = doc(db, 'apartments', apartmentId);
      apartmentUnsubscribeRef.current = onSnapshot(aptRef, (snapshot) => {
        if (snapshot.exists()) {
          setApartment({ id: snapshot.id, ...snapshot.data() });
        } else {
          setApartment(null);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `apartments/${apartmentId}`);
      });
    } else {
      setApartment(null);
      if (apartmentUnsubscribeRef.current) {
        apartmentUnsubscribeRef.current();
        apartmentUnsubscribeRef.current = null;
      }
    }
    return () => {
      if (apartmentUnsubscribeRef.current) {
        apartmentUnsubscribeRef.current();
      }
    };
  }, [apartmentId]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(prevUser => {
        if (!prevUser && !currentUser) return null;
        if (prevUser && currentUser && prevUser.uid === currentUser.uid && prevUser.email === currentUser.email) {
          return prevUser;
        }
        return currentUser;
      });
      
      if (currentUser) {
        // Check if user exists in Firestore, if not create them
        const userRef = doc(db, 'users', currentUser.uid);
        let userSnap;
        try {
          userSnap = await getDoc(userRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          return;
        }
        
        if (!userSnap.exists()) {
          try {
            await setDoc(userRef, {
              uid: currentUser.uid,
              fullName: currentUser.displayName || 'New User',
              email: currentUser.email,
              avatarUrl: currentUser.photoURL,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
          }
        }
        
        // Listen to their apartment membership
        const membersRef = collection(db, 'apartmentMembers');
        const q = query(membersRef, where('userId', '==', currentUser.uid), where('status', '==', 'active'));
        
        // Unsubscribe from previous membership listener if it exists
        if (membershipUnsubscribeRef.current) {
          membershipUnsubscribeRef.current();
        }

        membershipUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
          console.log('Membership snapshot received, empty:', snapshot.empty, 'hasPendingWrites:', snapshot.metadata.hasPendingWrites, 'docs:', snapshot.docs.length);
          
          if (!snapshot.empty) {
            // If we have multiple memberships, try to find one that matches current apartmentId
            // or just pick the most recent one (joinedAt)
            const memberships = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            memberships.sort((a: any, b: any) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
            
            const newAptId = memberships[0].apartmentId;
            console.log('Found apartmentId in snapshot:', newAptId);
            
            setApartmentId(prev => {
              if (prev === newAptId) return prev;
              console.log('Updating apartmentId from snapshot:', newAptId);
              return newAptId;
            });
          } else {
            console.log('No membership found in snapshot');
            // Only set to null if there are no pending writes. 
            // If there are pending writes, it means a local write is in progress 
            // and we should trust the manual setApartmentId or wait for the next snapshot.
            if (!snapshot.metadata.hasPendingWrites) {
              setApartmentId(prev => {
                if (prev === null) return null;
                // If we just manually set it (e.g. in Auth.tsx), we might want to wait a bit
                // before clearing it if the snapshot is empty but we expect a doc.
                console.log('Setting apartmentId to null from snapshot (no pending writes)');
                return null;
              });
            } else {
              console.log('Snapshot is empty but has pending writes, ignoring null update');
            }
          }
          setLoading(prev => {
            if (!prev) return false;
            console.log('Setting loading to false');
            return false;
          });
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'apartmentMembers');
        });
      } else {
        setApartmentId(prev => prev !== null ? null : prev);
        setLoading(prev => prev ? false : prev);
        if (membershipUnsubscribeRef.current) {
          membershipUnsubscribeRef.current();
          membershipUnsubscribeRef.current = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (membershipUnsubscribeRef.current) {
        membershipUnsubscribeRef.current();
      }
    };
  }, []);

  const contextValue = useMemo(() => ({
    user,
    loading,
    apartmentId,
    apartment,
    setApartmentId
  }), [user, loading, apartmentId, apartment]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
