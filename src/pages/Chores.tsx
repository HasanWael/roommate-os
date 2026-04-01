import { useState, useEffect } from 'react';
import { CheckSquare, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, ar } from 'date-fns/locale';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/LoadingScreen';
import { useTranslation } from 'react-i18next';

export default function Chores() {
  const { user, apartmentId } = useAuth();
  const { members } = useMembers();
  const { t, i18n } = useTranslation();
  const [chores, setChores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [completingChores, setCompletingChores] = useState<Set<string>>(new Set());
  const [newChoreTitle, setNewChoreTitle] = useState('');
  const [newChoreDueDate, setNewChoreDueDate] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid && !assignedToUserId) {
      setAssignedToUserId(user.uid);
    }
  }, [user?.uid, assignedToUserId]);

  useEffect(() => {
    if (!apartmentId) return;

    const q = query(
      collection(db, 'chores'),
      where('apartmentId', '==', apartmentId),
      orderBy('dueDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(prev => prev ? false : prev);
    });

    return () => unsubscribe();
  }, [apartmentId]);

  const handleAddChore = async (e: any) => {
    e.preventDefault();
    if (!newChoreTitle.trim() || !newChoreDueDate || !apartmentId || !user) return;

    try {
      await addDoc(collection(db, 'chores'), {
        apartmentId,
        title: newChoreTitle,
        description: '',
        assignedToUserId: assignedToUserId || user.uid,
        dueDate: new Date(newChoreDueDate).toISOString(),
        status: 'pending',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewChoreTitle('');
      setNewChoreDueDate('');
      setIsAdding(false);
      toast.success(t('chores.addSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chores');
      toast.error(t('chores.addError'));
    }
  };

  const toggleChoreStatus = async (choreId: string) => {
    if (completingChores.has(choreId)) return;
    
    // Start animation
    setCompletingChores(prev => new Set(prev).add(choreId));
    
    // Wait for animation to play
    setTimeout(async () => {
      try {
        await deleteDoc(doc(db, 'chores', choreId));
        toast.success(t('chores.completeSuccess'));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `chores/${choreId}`);
        toast.error(t('chores.completeError'));
      } finally {
        setCompletingChores(prev => {
          const next = new Set(prev);
          next.delete(choreId);
          return next;
        });
      }
    }, 600);
  };

  const confirmDelete = (choreId: string) => {
    setItemToDelete(choreId);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'chores', itemToDelete));
      toast.success(t('chores.deleteSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chores/${itemToDelete}`);
      toast.error(t('chores.deleteError'));
    } finally {
      setItemToDelete(null);
    }
  };

  const getAssignedUserName = (userId: string) => {
    const member = members.find(m => m.userId === userId);
    return member?.user?.fullName || 'Unknown';
  };

  if (loading) return <LoadingScreen message={t('dashboard.loading')} />;

  const dateLocale = i18n.language === 'ar' ? ar : enUS;

  return (
    <div className="page-container space-y-6 md:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight flex items-center gap-2">
            <CheckSquare className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <span className="pt-1">{t('chores.title')}</span>
          </h1>
          <p className="subheading mt-1 text-sm md:text-base">
            {t('chores.description')}
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="w-full sm:w-auto bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm md:text-base"
        >
          <Plus className="h-4 w-4 md:h-5 md:w-5" />
          {isAdding ? t('chores.cancel') : t('chores.addChore')}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddChore} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('chores.choreTitle')}</label>
            <input 
              type="text" 
              value={newChoreTitle}
              onChange={(e) => setNewChoreTitle(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder={t('chores.choreTitlePlaceholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('chores.assignTo')}</label>
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="" disabled>{t('chores.selectRoommate')}</option>
              {members.map(member => (
                <option key={member.userId} value={member.userId}>
                  {member.user?.fullName || 'Unknown'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('chores.dueDate')}</label>
            <input 
              type="date" 
              value={newChoreDueDate}
              onChange={(e) => setNewChoreDueDate(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <div className="md:col-span-2 lg:col-span-4 flex justify-end mt-2">
            <button type="submit" className="w-full md:w-auto bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors">
              {t('chores.save')}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-semibold text-text-primary text-xs md:text-sm">{t('chores.assignedChores')}</h2>
          <div className="text-xs md:text-sm font-medium text-text-secondary">
            {t('chores.pending')}: <span className="text-text-primary font-bold">{chores.filter(c => c.status === 'pending').length}</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {chores.filter(c => c.status !== 'completed').map((chore) => {
            const isCompleting = completingChores.has(chore.id);
            return (
            <div key={chore.id} className={`p-4 md:p-6 flex items-center justify-between transition-all duration-500 ${isCompleting ? 'bg-gray-50 opacity-60 scale-[0.99]' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center space-x-3 md:space-x-4 rtl:space-x-reverse min-w-0">
                <button 
                  onClick={() => toggleChoreStatus(chore.id)}
                  className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
                  disabled={isCompleting}
                >
                  {isCompleting || chore.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-green-500 transition-all duration-500 scale-110" />
                  ) : (
                    <Circle className="h-5 w-5 md:h-6 md:w-6 text-gray-400" />
                  )}
                </button>
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {(() => {
                    const assigned = members.find(m => m.userId === chore.assignedToUserId);
                    if (assigned?.user?.avatarUrl) {
                      return <img src={assigned.user.avatarUrl} alt={getAssignedUserName(chore.assignedToUserId)} className="h-full w-full object-cover" />;
                    }
                    return <CheckSquare className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <h3 className={`font-semibold text-sm md:text-base truncate transition-all duration-500 ${isCompleting || chore.status === 'completed' ? 'text-gray-400 line-through' : 'text-text-primary'}`}>
                    {chore.title}
                  </h3>
                  <p className={`text-xs md:text-sm truncate transition-all duration-500 ${isCompleting ? 'text-gray-400' : 'text-text-secondary'}`}>
                    {t('chores.due')} {chore.dueDate ? format(new Date(chore.dueDate), 'MMM d, yyyy', { locale: dateLocale }) : t('chores.noDate')} • {t('chores.assignedTo')} {getAssignedUserName(chore.assignedToUserId)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-4 ml-2 rtl:ml-0 rtl:mr-2">
                <span className={`badge text-[10px] md:text-xs font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-full uppercase tracking-wider transition-all duration-500 flex-shrink-0 ${
                  isCompleting || chore.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-text-primary'
                }`}>
                  {isCompleting ? (t('chores.completing') as string) : (t(`chores.${chore.status}`, chore.status) as string)}
                </span>
                <button 
                  onClick={() => confirmDelete(chore.id)}
                  className={`text-gray-400 hover:text-red-500 transition-colors p-1 md:p-2 flex-shrink-0 ${isCompleting ? 'opacity-0 pointer-events-none' : ''}`}
                  title={t('chores.deleteChore')}
                >
                  <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </div>
            </div>
          )})}
          {chores.filter(c => c.status !== 'completed').length === 0 && (
            <div className="p-8">
              <EmptyState 
                icon={CheckSquare} 
                title={t('chores.allCaughtUp')} 
                description={t('chores.allCaughtUpDesc')} 
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!itemToDelete}
        title={t('chores.deleteTitle')}
        message={t('chores.deleteMessage')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
