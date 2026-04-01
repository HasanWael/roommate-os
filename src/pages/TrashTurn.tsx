import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { useTranslation } from 'react-i18next';
import { format, isToday } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { History, UserMinus, UserCheck, CheckCircle2, Trash2 } from 'lucide-react';

export default function TrashTurn() {
  const { user, apartmentId, apartment } = useAuth();
  const { members } = useMembers();
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apartmentId) return;

    const q = query(
      collection(db, 'trashHistory'),
      where('apartmentId', '==', apartmentId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'trashHistory');
    });

    return () => unsubscribe();
  }, [apartmentId]);

  const rotationOrder = apartment?.trashRotationOrder || [];
  const currentIndex = apartment?.currentTrashTurnerIndex || 0;

  // Initialize rotation order if missing (Admins only)
  useEffect(() => {
    const isAdmin = members.find(m => m.userId === user?.uid)?.role === 'admin';
    if (apartmentId && isAdmin && rotationOrder.length === 0 && members.length > 0) {
      const initialOrder = [...members]
        .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
        .map(m => m.userId);
      
      updateDoc(doc(db, 'apartments', apartmentId), {
        trashRotationOrder: initialOrder,
        currentTrashTurnerIndex: 0
      }).catch(err => console.error('Failed to initialize trash rotation:', err));
    }
  }, [apartmentId, members, rotationOrder.length, user?.uid]);

  const getCurrentTurner = () => {
    if (rotationOrder.length === 0) return null;
    const currentId = rotationOrder[currentIndex];
    return members.find(m => m.userId === currentId);
  };

  const currentTurner = getCurrentTurner();

  const toggleAway = async (memberId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'apartmentMembers', memberId), {
        isAway: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `apartmentMembers/${memberId}`);
    }
  };

  const markAsDone = async () => {
    if (!apartmentId || !user || !currentTurner || currentTurner.userId !== user.uid) return;

    try {
      await addDoc(collection(db, 'trashHistory'), {
        apartmentId,
        userId: user.uid,
        userName: members.find(m => m.userId === user.uid)?.user?.fullName || user.displayName || 'Roommate',
        isOutOfTurn: false,
        createdAt: serverTimestamp()
      });

      let nextIndex = (currentIndex + 1) % rotationOrder.length;
      let attempts = 0;
      while (attempts < rotationOrder.length) {
        const nextId = rotationOrder[nextIndex];
        const nextMember = members.find(m => m.userId === nextId);
        if (nextMember && !nextMember.isAway) {
          break;
        }
        nextIndex = (nextIndex + 1) % rotationOrder.length;
        attempts++;
      }

      await updateDoc(doc(db, 'apartments', apartmentId), {
        currentTrashTurnerIndex: nextIndex
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'trashHistory/apartments');
    }
  };

  const iThrewIt = async () => {
    if (!apartmentId || !user) return;

    try {
      await addDoc(collection(db, 'trashHistory'), {
        apartmentId,
        userId: user.uid,
        userName: members.find(m => m.userId === user.uid)?.user?.fullName || user.displayName || 'Roommate',
        isOutOfTurn: true,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'trashHistory');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="page-container space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            <Trash2 className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            {t('trashTurn.trashTurnTitle')}
          </h1>
          <p className="text-text-secondary mt-1 text-sm md:text-base">
            {t('trashTurn.nextPersonNotified')}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Controls */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 pointer-events-none">
              <Trash2 className="h-16 w-16 md:h-24 md:w-24" />
            </div>
            
            <h3 className="font-bold text-text-primary mb-3 md:mb-4 relative z-10 text-sm md:text-base">
              {t('trashTurn.currentTurn')}
            </h3>

            <AnimatePresence mode="wait">
              {currentTurner ? (
                <motion.div 
                  key={currentTurner.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col md:flex-row items-center gap-3 md:gap-4 relative z-10"
                >
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-success text-white flex items-center justify-center font-bold text-base md:text-lg shadow-xl shadow-success/20 ring-4 ring-success/10 overflow-hidden">
                    {currentTurner.user?.avatarUrl ? (
                      <img src={currentTurner.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      getInitials(currentTurner.user?.fullName || '??')
                    )}
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <h2 className="text-base md:text-lg font-bold text-text-primary">
                      {currentTurner.user?.fullName}
                    </h2>
                    <p className="text-success-dark font-bold text-xs md:text-sm">
                      {t('trashTurn.trashTurnTitle')}
                    </p>
                  </div>
                  <div className="flex flex-row gap-2 w-full md:w-auto">
                    <button
                      disabled={currentTurner?.userId !== user?.uid}
                      onClick={markAsDone}
                      className={`flex-1 md:flex-none px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                        currentTurner?.userId === user?.uid
                          ? 'bg-primary text-white hover:bg-primary-dark active:scale-95'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      {t('trashTurn.markAsDone')}
                    </button>
                    <button
                      onClick={iThrewIt}
                      className="flex-1 md:flex-none px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all border border-gray-200 text-text-primary hover:bg-gray-50 active:scale-95 flex items-center justify-center gap-2"
                    >
                      {t('trashTurn.iThrewIt')}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="py-6 md:py-8 text-center text-text-secondary italic text-sm md:text-base">
                  {t('trashTurn.noRotation')}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Rotation List */}
          <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-text-primary mb-4 md:mb-6 text-sm md:text-base">
              {t('trashTurn.rotationOrder')}
            </h3>
            <div className="flex flex-col gap-2">
              {rotationOrder.map((uid, index) => {
                const member = members.find(m => m.userId === uid);
                if (!member) return null;
                const isUserAway = member.isAway;
                const isCurrent = index === currentIndex;
                const memberId = `${apartmentId}_${uid}`;

                return (
                  <div 
                    key={uid} 
                    className={`flex items-center justify-between p-2 md:p-3 rounded-xl border transition-all ${
                      isCurrent 
                        ? 'border-success bg-success/5 ring-1 ring-success/20' 
                        : 'border-gray-50 bg-gray-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-5 md:w-6 text-[10px] md:text-xs font-bold text-text-secondary opacity-50">
                        {(index + 1).toString().padStart(2, '0')}
                      </div>
                      <div className={`h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center font-bold text-[10px] md:text-xs overflow-hidden shadow-sm ${
                        isUserAway ? 'bg-gray-200 text-gray-400' : 'bg-white text-text-primary'
                      }`}>
                        {member.user?.avatarUrl ? (
                          <img src={member.user.avatarUrl} alt="" className={`h-full w-full object-cover ${isUserAway ? 'grayscale opacity-50' : ''}`} />
                        ) : (
                          getInitials(member.user?.fullName || '??')
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <p className={`font-bold text-xs md:text-sm ${isUserAway ? 'text-gray-400 line-through' : 'text-text-primary'}`}>
                            {member.user?.fullName}
                          </p>
                          {isCurrent && (
                            <span className="badge text-[8px] md:text-[10px] bg-success text-white px-1.5 py-0.5 rounded-md uppercase font-black tracking-tighter">
                              {t('dashboard.active')}
                            </span>
                          )}
                        </div>
                        {isUserAway && (
                          <span className="text-[8px] md:text-[9px] text-gray-500 uppercase font-bold">
                            {t('trashTurn.away')} — {t('trashTurn.outOfTurn')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAway(memberId, isUserAway)}
                      className={`p-1 md:p-1.5 rounded-lg transition-all ${
                        isUserAway 
                          ? 'bg-text-primary text-white hover:bg-black' 
                          : 'bg-white text-text-secondary border border-gray-100 hover:border-text-primary hover:text-text-primary'
                      }`}
                      title={isUserAway ? t('trashTurn.markAvailable') : t('trashTurn.markAway')}
                    >
                      {isUserAway ? <UserCheck className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <UserMinus className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6 md:space-y-8">
          {/* History */}
          <div className="bg-white rounded-3xl p-4 md:p-8 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-8">
              <History className="h-5 w-5 md:h-6 md:w-6 text-text-secondary" />
              <h3 className="font-bold text-text-primary text-sm md:text-base">
                {t('trashTurn.history')}
              </h3>
            </div>
            <div className="space-y-4 md:space-y-6">
              {history.map((item) => (
                <div key={item.id} className="flex items-start justify-between group">
                  <div className="min-w-0">
                    <p className="font-bold text-text-primary text-xs md:text-sm truncate">{item.userName}</p>
                    <p className="text-[10px] md:text-xs text-text-secondary mt-0.5 md:mt-1">
                      {item.createdAt ? format(item.createdAt.toDate(), 'MMM d, h:mm a') : '...'}
                    </p>
                  </div>
                  <span className={`badge px-2 md:px-3 py-0.5 md:py-1 rounded-full font-black text-[8px] md:text-[10px] uppercase tracking-tighter flex-shrink-0 ${
                    item.isOutOfTurn 
                      ? 'bg-gray-100 text-gray-500' 
                      : 'bg-success/10 text-success-dark'
                  }`}>
                    {item.isOutOfTurn ? t('trashTurn.outOfTurn') : t('trashTurn.inTurn')}
                  </span>
                </div>
              ))}
              {history.length === 0 && !loading && (
                <div className="text-center py-6 md:py-8">
                  <p className="text-xs md:text-sm text-text-secondary italic">{t('trashTurn.noHistory')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
