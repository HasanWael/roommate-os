import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestore-error';
import { useTranslation } from 'react-i18next';

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
  memberships: any[];
  setApartmentId: (id: string | null) => void;
  language: string;
  changeLanguage: (lang: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  apartmentId: null,
  apartment: null,
  memberships: [],
  setApartmentId: () => {},
  language: 'ar',
  changeLanguage: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  const [apartment, setApartment] = useState<any | null>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [language, setLanguage] = useState<string>(i18n.language || 'ar');
  const membershipUnsubscribeRef = React.useRef<(() => void) | null>(null);
  const apartmentUnsubscribeRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    document.documentElement.dir = i18n.dir();
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const changeLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    setLanguage(lang);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { language: lang });
      } catch (error) {
        console.error('Failed to save language preference:', error);
      }
    }
  };

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
              language: 'ar',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            i18n.changeLanguage('ar');
            setLanguage('ar');
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
          }
        } else {
          const userData = userSnap.data();
          if (userData.language && userData.language !== i18n.language) {
            i18n.changeLanguage(userData.language);
            setLanguage(userData.language);
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
          console.log('Membership snapshot received, empty:', snapshot.empty, 'docs:', snapshot.docs.length);
          
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          docs.sort((a: any, b: any) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
          setMemberships(docs);

          if (!snapshot.empty) {
            const newAptId = docs[0].apartmentId;
            
            setApartmentId(prev => {
              // If we already have an apartmentId set, and it's one of our active memberships, 
              // we should probably keep it instead of jumping to the "most recent" one
              // unless we don't have one yet.
              if (prev) {
                const exists = docs.some((m: any) => m.apartmentId === prev);
                if (exists) return prev;
              }
              
              console.log('Updating apartmentId from snapshot:', newAptId);
              return newAptId;
            });
          } else {
            if (!snapshot.metadata.hasPendingWrites) {
              setApartmentId(null);
            }
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'apartmentMembers');
          setLoading(false);
        });
      } else {
        setApartmentId(null);
        setMemberships([]);
        setLoading(false);
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
    memberships,
    setApartmentId,
    language,
    changeLanguage
  }), [user, loading, apartmentId, apartment, memberships, language]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
