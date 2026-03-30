import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { loginWithGoogle, db } from '../firebase';
import { collection, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

function ApartmentCard({ membership, onSelect }: { membership: any, onSelect: () => void }) {
  const [name, setName] = React.useState(membership.apartmentName || '');
  const [loading, setLoading] = React.useState(!membership.apartmentName);

  React.useEffect(() => {
    if (!membership.apartmentName) {
      const fetchName = async () => {
        try {
          const snap = await getDoc(doc(db, 'apartments', membership.apartmentId));
          if (snap.exists()) {
            setName(snap.data().name);
          } else {
            setName('Unknown Apartment');
          }
        } catch (err) {
          console.error('Error fetching apartment name:', err);
          setName('Apartment');
        } finally {
          setLoading(false);
        }
      };
      fetchName();
    }
  }, [membership]);

  return (
    <button
      onClick={onSelect}
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-primary transition-all text-left group"
    >
      <h3 className="font-bold text-text-primary group-hover:text-primary transition-colors">
        {loading ? (
          <span className="flex items-center space-x-2">
            <span className="h-4 w-24 bg-gray-100 animate-pulse rounded" />
          </span>
        ) : (
          name || 'Apartment'
        )}
      </h3>
      <p className="text-xs text-text-secondary mt-1">
        Joined {new Date(membership.joinedAt).toLocaleDateString()}
      </p>
    </button>
  );
}
export default function Auth() {
  const navigate = useNavigate();
  const { user, apartmentId, setApartmentId, memberships } = useAuth();
  const [apartmentName, setApartmentName] = useState('');
  const [address, setAddress] = useState('');
  const [inviteCode, setInviteCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      setError('Failed to log in with Google.');
    }
  };

  const handleSelectApartment = (id: string) => {
    setApartmentId(id);
    navigate('/dashboard');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    console.log('Creating apartment:', apartmentName);
    try {
      const batch = writeBatch(db);
      const newAptRef = doc(collection(db, 'apartments'));
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      console.log('Batch: Adding apartment doc...');
      batch.set(newAptRef, {
        name: apartmentName,
        inviteCode: code,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log('Batch: Adding invite code doc...');
      const inviteRef = doc(db, 'inviteCodes', code);
      batch.set(inviteRef, {
        apartmentId: newAptRef.id,
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      });

      console.log('Batch: Adding member doc...');
      const memberRef = doc(db, 'apartmentMembers', `${newAptRef.id}_${user.uid}`);
      batch.set(memberRef, {
        apartmentId: newAptRef.id,
        apartmentName: apartmentName,
        userId: user.uid,
        fullName: user.displayName || 'New User',
        avatarUrl: user.photoURL,
        role: 'admin',
        status: 'active',
        joinedAt: new Date().toISOString()
      });

      console.log('Committing batch...');
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'batch-create-apartment');
      }

      console.log('Setting apartmentId in context:', newAptRef.id);
      setApartmentId(newAptRef.id);
      console.log('Navigating to dashboard...');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error creating apartment:', err);
      setError('Failed to create apartment.');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const code = inviteCode.join('').trim().toUpperCase();
    if (code.length < 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    
    console.log('Joining apartment with code:', code);
    setError('');
    
    try {
      const inviteRef = doc(db, 'inviteCodes', code);
      let inviteSnap;
      try {
        inviteSnap = await getDoc(inviteRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `inviteCodes/${code}`);
        setError('Failed to verify invite code.');
        return;
      }
      
      if (!inviteSnap.exists()) {
        console.log('Invalid invite code');
        setError('Invalid invite code. Please check and try again.');
        return;
      }

      const aptId = inviteSnap.data().apartmentId;
      console.log('Found apartmentId:', aptId);
      
      // Check if already a member
      const memberRef = doc(db, 'apartmentMembers', `${aptId}_${user.uid}`);
      let memberSnap;
      try {
        memberSnap = await getDoc(memberRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `apartmentMembers/${aptId}_${user.uid}`);
        setError('Failed to check membership status.');
        return;
      }
      
      if (memberSnap.exists() && memberSnap.data().status === 'active') {
        console.log('User is already an active member of this apartment');
        setApartmentId(aptId);
        navigate('/dashboard');
        return;
      }

      try {
        const aptSnap = await getDoc(doc(db, 'apartments', aptId));
        const aptName = aptSnap.exists() ? aptSnap.data().name : 'Apartment';

        console.log('Creating/Updating membership record...');
        await setDoc(memberRef, {
          apartmentId: aptId,
          apartmentName: aptName,
          userId: user.uid,
          fullName: user.displayName || 'New User',
          avatarUrl: user.photoURL,
          role: memberSnap.exists() ? memberSnap.data().role : 'member',
          status: 'active',
          joinedAt: memberSnap.exists() ? memberSnap.data().joinedAt : new Date().toISOString()
        });
        console.log('Membership record created successfully');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `apartmentMembers/${aptId}_${user.uid}`);
        setError('Failed to join apartment. Please try again.');
        return;
      }

      console.log('Setting apartmentId in context:', aptId);
      setApartmentId(aptId);
      console.log('Navigating to dashboard...');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error joining apartment:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight mb-2">Roommate OS</h1>
          <p className="text-text-secondary mb-8">Sign in to manage your shared living space.</p>
          {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
          <button 
            onClick={handleLogin}
            className="w-full bg-text-primary hover:bg-black text-white font-bold py-3 rounded-lg transition-colors uppercase tracking-wider"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <header className="flex justify-between items-center mb-16">
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Roommate OS</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">{user.displayName}</span>
            <img src={user.photoURL || ''} alt="Avatar" className="h-8 w-8 rounded-full" />
          </div>
        </header>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-8 text-center">{error}</div>}

        {memberships.length > 0 && (
          <div className="mb-16">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Your Apartments</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {memberships.map((m) => (
                <ApartmentCard 
                  key={m.id} 
                  membership={m} 
                  onSelect={() => handleSelectApartment(m.apartmentId)} 
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
          {/* Create Apartment */}
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Option 01</p>
            <h2 className="text-4xl font-bold text-text-primary tracking-tight mb-4">Create Apartment</h2>
            <p className="text-text-secondary mb-8">Establish a new digital blueprint for your shared living space.</p>

            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-2">Apartment Name</label>
                <input
                  type="text"
                  placeholder="e.g. The Penthouse 4B"
                  value={apartmentName}
                  onChange={(e) => setApartmentName(e.target.value)}
                  className="w-full bg-gray-200 border-transparent rounded-lg px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-text-primary hover:bg-black text-white font-bold py-3 rounded-lg text-sm transition-colors uppercase tracking-wider">
                Initialize Space
              </button>
            </form>
          </div>

          {/* Join Existing */}
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Option 02</p>
            <h2 className="text-4xl font-bold text-text-primary tracking-tight mb-4">Join Existing</h2>
            <p className="text-text-secondary mb-8">Enter an invite code provided by your future roommates.</p>

            <div className="bg-gray-100 p-8 rounded-2xl">
              <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-4 text-center">Invitation Code</label>
              <div className="flex justify-center space-x-2 mb-8">
                {inviteCode.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const newCode = [...inviteCode];
                      newCode[idx] = e.target.value.toUpperCase();
                      setInviteCode(newCode);
                      if (e.target.value && idx < 5) {
                        const nextInput = document.getElementById(`code-${idx + 1}`);
                        nextInput?.focus();
                      }
                    }}
                    id={`code-${idx}`}
                    className="w-12 h-14 bg-white border-transparent rounded-lg text-center text-xl font-bold focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm"
                  />
                ))}
              </div>
              <button onClick={handleJoin} className="w-full bg-gray-200 hover:bg-gray-300 text-text-primary font-bold py-3 rounded-lg text-sm transition-colors uppercase tracking-wider">
                Connect to Hub
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
