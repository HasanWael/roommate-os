import { useState, useEffect } from 'react';
import { Receipt, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, ar } from 'date-fns/locale';
import { formatCurrency } from '../lib/format';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/LoadingScreen';
import { useTranslation } from 'react-i18next';

export default function Expenses() {
  const { user, apartmentId } = useAuth();
  const { members } = useMembers();
  const { t, i18n } = useTranslation();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [splitAmong, setSplitAmong] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (user && splitAmong.length === 0) {
      setSplitAmong([user.uid]);
    }
  }, [user?.uid, splitAmong.length]);

  useEffect(() => {
    if (!apartmentId) return;

    const q = query(
      collection(db, 'expenses'),
      where('apartmentId', '==', apartmentId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(prev => prev ? false : prev);
    });

    return () => unsubscribe();
  }, [apartmentId]);

  const handleAddExpense = async (e: any) => {
    e.preventDefault();
    if (!newExpenseTitle.trim() || !newExpenseAmount || !apartmentId || !user) return;

    try {
      await addDoc(collection(db, 'expenses'), {
        apartmentId,
        title: newExpenseTitle,
        amount: parseFloat(newExpenseAmount),
        paidBy: user.displayName || 'Roommate',
        paidByUserId: user.uid,
        splitAmong: splitAmong.length > 0 ? splitAmong : [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewExpenseTitle('');
      setNewExpenseAmount('');
      setSplitAmong([user.uid]);
      setIsAdding(false);
      toast.success(t('expenses.addSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
      toast.error(t('expenses.addError'));
    }
  };

  const confirmDelete = (expenseId: string) => {
    setItemToDelete(expenseId);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'expenses', itemToDelete));
      toast.success(t('expenses.deleteSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${itemToDelete}`);
      toast.error(t('expenses.deleteError'));
    } finally {
      setItemToDelete(null);
    }
  };

  const toggleSplitMember = (userId: string) => {
    setSplitAmong(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  if (loading) return <LoadingScreen message={t('dashboard.loading')} />;

  const totalPending = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const dateLocale = i18n.language === 'ar' ? ar : enUS;

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight flex items-center gap-3">
            <Receipt className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            {t('expenses.title')}
          </h1>
          <p className="subheading mt-1 text-sm md:text-base">
            {t('expenses.description')}
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="w-full sm:w-auto bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center transition-colors text-sm md:text-base"
        >
          <Plus className={`h-4 w-4 md:h-5 md:w-5 ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`} />
          {isAdding ? t('expenses.cancel') : t('expenses.addExpense')}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddExpense} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-1">{t('expenses.descriptionLabel')}</label>
              <input 
                type="text" 
                value={newExpenseTitle}
                onChange={(e) => setNewExpenseTitle(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder={t('expenses.descriptionPlaceholder')}
                required
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-text-secondary mb-1">{t('expenses.amountLabel')}</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">{t('expenses.splitAmong')}</label>
            <div className="flex flex-wrap gap-3">
              {members.map(member => (
                <label key={member.userId} className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">
                  <input 
                    type="checkbox" 
                    checked={splitAmong.includes(member.userId)}
                    onChange={() => toggleSplitMember(member.userId)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold overflow-hidden">
                    {member.user?.avatarUrl ? (
                      <img src={member.user.avatarUrl} alt={member.user.fullName} className="h-full w-full object-cover" />
                    ) : (
                      member.user?.fullName?.charAt(0) || '?'
                    )}
                  </div>
                  <span className="text-sm font-medium text-text-primary">{member.user?.fullName || t('common.unknown')}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors">
              {t('expenses.saveExpense')}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-text-primary text-sm md:text-base">{t('expenses.recentExpenses')}</h2>
          <div className="text-xs md:text-sm font-medium text-text-secondary">
            {t('expenses.totalPending')} <span className="text-danger font-bold">{i18n.language === 'ar' ? 'ج.م' : 'EGP'} {formatCurrency(totalPending, 2)}</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {expenses.map((expense) => (
            <div key={expense.id} className="p-4 md:p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3 md:space-x-4 rtl:space-x-reverse">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {(() => {
                    const payer = members.find(m => m.userId === expense.paidByUserId);
                    if (payer?.user?.avatarUrl) {
                      return <img src={payer.user.avatarUrl} alt={expense.paidBy === 'Roommate' ? t('common.roommate') : expense.paidBy} className="h-full w-full object-cover" />;
                    }
                    return <Receipt className="h-5 w-5 md:h-6 md:w-6 text-primary" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-text-primary text-base md:text-lg truncate">{expense.title}</h3>
                  <p className="text-xs md:text-sm text-text-secondary truncate">
                    {expense.createdAt ? format(expense.createdAt.toDate(), 'MMM d, yyyy', { locale: dateLocale }) : t('expenses.justNow')} • {t('expenses.paidBy')} {(() => {
                      const payer = members.find(m => m.userId === expense.paidByUserId);
                      if (payer?.user?.fullName) return payer.user.fullName;
                      return expense.paidBy === 'Roommate' ? t('common.roommate') : expense.paidBy;
                    })()}
                  </p>
                  <div className="text-[10px] md:text-xs text-text-secondary mt-1 flex items-center gap-1">
                    {t('expenses.splitAmongPeople', { count: expense.splitAmong?.length || 1 })}
                    <div className={`flex ${i18n.language === 'ar' ? '-space-x-reverse' : ''} -space-x-1.5 md:-space-x-2 mx-1`}>
                      {expense.splitAmong?.map((userId: string) => {
                        const member = members.find(m => m.userId === userId);
                        return (
                          <div key={userId} className="h-4 w-4 md:h-5 md:w-5 rounded-full border border-white bg-primary text-[6px] md:text-[8px] text-white flex items-center justify-center overflow-hidden" title={member?.user?.fullName || t('common.unknown')}>
                            {member?.user?.avatarUrl ? (
                              <img src={member.user.avatarUrl} alt={member.user.fullName || t('common.unknown')} className="h-full w-full object-cover" />
                            ) : (
                              member?.user?.fullName?.charAt(0) || '?'
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-6 ml-2 rtl:ml-0 rtl:mr-2">
                <div className={`text-${i18n.language === 'ar' ? 'left' : 'right'} flex-shrink-0`}>
                  <div className="font-bold text-lg md:text-xl text-text-primary">{i18n.language === 'ar' ? 'ج.م' : 'EGP'} {formatCurrency(expense.amount, 2)}</div>
                  <div className={`text-[10px] md:text-sm text-text-secondary mt-0.5 md:mt-1 flex items-center justify-${i18n.language === 'ar' ? 'start' : 'end'} space-x-1 rtl:space-x-reverse`}>
                    <Circle className="h-3 w-3 md:h-4 md:w-4 text-orange-500" /><span className="text-orange-600 font-medium">{t('expenses.pending')}</span>
                  </div>
                </div>
                <button 
                  onClick={() => confirmDelete(expense.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1 md:p-2"
                  title={t('expenses.deleteExpense')}
                >
                  <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="p-8">
              <EmptyState 
                icon={Receipt} 
                title={t('expenses.allSettled')} 
                description={t('expenses.allSettledDesc')} 
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!itemToDelete}
        title={t('expenses.deleteTitle')}
        message={t('expenses.deleteMessage')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
