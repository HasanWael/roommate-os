import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, AlertCircle, LogOut, Home } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { loginWithGoogle, logout, db } from '../firebase';
import { collection, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import EmptyState from '../components/EmptyState';

function ApartmentCard({ membership, onSelect }: { membership: any, onSelect: () => void }) {
  const { user } = useAuth();
  const [apartmentData, setApartmentData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchApartment = async () => {
      try {
        const snap = await getDoc(doc(db, 'apartments', membership.apartmentId));
        if (snap.exists()) {
          setApartmentData(snap.data());
        }
      } catch (err) {
        console.error('Error fetching apartment:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchApartment();
  }, [membership]);

  const isCreator = apartmentData?.createdBy === user?.uid;

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
          apartmentData?.name || 'Apartment'
        )}
      </h3>
      <p className="text-xs text-text-secondary mt-1">
        {isCreator ? 'Created' : 'Joined'} {new Date(membership.joinedAt).toLocaleDateString()}
      </p>
    </button>
  );
}
export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, apartmentId, setApartmentId, memberships } = useAuth();
  const [apartmentName, setApartmentName] = useState('');
  const [address, setAddress] = useState('');
  const [inviteCode, setInviteCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('inviteCode');
    if (code) {
      const codeArray = code.toUpperCase().split('').slice(0, 6);
      const newCode = [...Array(6)].map((_, i) => codeArray[i] || '');
      setInviteCode(newCode);
    }
  }, [location]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      setError('Failed to log in with Google.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (err) {
      setError('Failed to log out.');
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px]"></div>

        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-primary/5 text-center relative z-10 border border-gray-100">
          <div className="h-20 w-20 bg-gradient-to-br from-primary to-indigo-600 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl shadow-primary/20 rotate-3">
            <LayoutDashboard className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-text-primary tracking-tighter mb-3">Roommate OS</h1>
          <p className="text-text-secondary mb-10 text-lg">The digital backbone for your shared living space.</p>
          
          {error && (
            <div className="bg-danger/10 text-danger p-4 rounded-2xl mb-6 text-sm font-medium flex items-center justify-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              {error}
            </div>
          )}
          
          <button 
            onClick={handleLogin}
            className="w-full bg-text-primary hover:bg-black text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center space-x-3 text-lg"
          >
            <img src="https://www.google.com/favicon.ico" className="h-5 w-5" alt="Google" />
            <span>Continue with Google</span>
          </button>
          
          <p className="mt-8 text-xs text-text-secondary uppercase tracking-widest font-bold opacity-50">
            Secure • Real-time • Collaborative
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl">
        <header className="flex justify-between items-center mb-16">
          <h1 className="text-3xl font-black text-primary tracking-tighter">Roommate OS</h1>
          <div className="flex items-center space-x-4 bg-white p-2 pr-4 rounded-full shadow-sm border border-gray-100">
            <img src={user.photoURL || ''} alt="Avatar" className="h-10 w-10 rounded-full ring-2 ring-primary/10" />
            <span className="text-sm font-bold text-text-primary">{user.displayName}</span>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-danger hover:bg-danger/5 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-danger/10 text-danger p-6 rounded-3xl mb-12 text-center font-bold shadow-sm flex items-center justify-center">
            <AlertCircle className="h-5 w-5 mr-3" />
            {error}
          </div>
        )}

        {memberships.length > 0 && (
          <div className="mb-20">
            <div className="flex items-center mb-6">
              <div className="h-1 w-8 bg-primary rounded-full mr-3"></div>
              <p className="text-xs font-black text-text-secondary uppercase tracking-widest">Your Active Spaces</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
          {/* Create Apartment */}
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <LayoutDashboard className="h-32 w-32 -rotate-12" />
            </div>
            <p className="text-xs font-black text-primary uppercase tracking-widest mb-4">Option 01</p>
            <h2 className="text-4xl font-black text-text-primary tracking-tighter mb-4">Create Space</h2>
            <p className="text-text-secondary mb-10 text-lg leading-relaxed">Establish a new digital blueprint for your apartment and invite your crew.</p>

            <form onSubmit={handleCreate} className="space-y-8">
              <div>
                <label className="block text-xs font-black text-text-primary uppercase tracking-widest mb-3">Apartment Name</label>
                <input
                  type="text"
                  placeholder="e.g. The Penthouse 4B"
                  value={apartmentName}
                  onChange={(e) => setApartmentName(e.target.value)}
                  className="w-full bg-gray-100 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl text-lg transition-all shadow-xl shadow-primary/20 active:scale-95">
                Initialize Space
              </button>
            </form>
          </div>

          {/* Join Existing */}
          <div className="bg-gray-900 p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <Users className="h-32 w-32 rotate-12" />
            </div>
            <p className="text-xs font-black text-secondary uppercase tracking-widest mb-4">Option 02</p>
            <h2 className="text-4xl font-black tracking-tighter mb-4">Join Crew</h2>
            <p className="text-white/60 mb-10 text-lg leading-relaxed">Enter a unique invite code provided by your future roommates to connect.</p>

            <div className="space-y-8">
              <div>
                <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-4 text-center">6-Digit Invitation Code</label>
                <div className="flex justify-center space-x-3 mb-10">
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
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !inviteCode[idx] && idx > 0) {
                          const prevInput = document.getElementById(`code-${idx - 1}`);
                          prevInput?.focus();
                        }
                      }}
                      id={`code-${idx}`}
                      className="w-12 h-16 bg-white/10 border-2 border-transparent rounded-2xl text-center text-2xl font-black focus:bg-white/20 focus:ring-4 focus:ring-secondary/20 focus:border-secondary outline-none transition-all text-white"
                    />
                  ))}
                </div>
                <button onClick={handleJoin} className="w-full bg-secondary hover:bg-secondary/90 text-white font-bold py-4 rounded-2xl text-lg transition-all shadow-xl shadow-secondary/20 active:scale-95">
                  Connect to Hub
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
