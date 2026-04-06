import { useState, useEffect } from 'react';
import { Receipt, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, ar } from 'date-fns/locale';
import { formatCurrency } from '../lib/format';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy, updateDoc } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/LoadingScreen';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';

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
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'EXACT' | 'PERCENTAGE'>('EQUAL');
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [paidByMode, setPaidByMode] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE');
  const [paidByUserId, setPaidByUserId] = useState<string>('');
  const [paidByValues, setPaidByValues] = useState<Record<string, string>>({});
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [settleModalData, setSettleModalData] = useState<{from: string, to: string, amount: number} | null>(null);

  const getRawBalances = () => {
    const balances: Record<string, number> = {};
    members.forEach(m => balances[m.userId] = 0);

    expenses.forEach(exp => {
      const payers = exp.paidBy || (exp.paidByUserId ? { [exp.paidByUserId]: exp.amount } : {});
      
      Object.entries(payers).forEach(([uid, amt]) => {
        if (balances[uid] !== undefined) {
          balances[uid] += (amt as number);
        }
      });

      const settledBy = exp.settledBy || [];

      if (exp.splits && Object.keys(exp.splits).length > 0) {
        Object.entries(exp.splits).forEach(([userId, amount]) => {
          if (balances[userId] !== undefined) {
            balances[userId] -= (amount as number);
            if (settledBy.includes(userId)) {
              balances[userId] += (amount as number);
              Object.entries(payers).forEach(([payerUid, payerAmt]) => {
                if (balances[payerUid] !== undefined) {
                  balances[payerUid] -= (amount as number) * ((payerAmt as number) / exp.amount);
                }
              });
            }
          }
        });
      } else if (exp.splitAmong && exp.splitAmong.length > 0) {
        const splitAmount = exp.amount / exp.splitAmong.length;
        exp.splitAmong.forEach((userId: string) => {
          if (balances[userId] !== undefined) {
            balances[userId] -= splitAmount;
            if (settledBy.includes(userId)) {
              balances[userId] += splitAmount;
              Object.entries(payers).forEach(([payerUid, payerAmt]) => {
                if (balances[payerUid] !== undefined) {
                  balances[payerUid] -= splitAmount * ((payerAmt as number) / exp.amount);
                }
              });
            }
          }
        });
      }
    });
    return balances;
  };

  const calculateBalances = () => {
    const balances = getRawBalances();

    const debtors = Object.entries(balances)
      .filter(([_, b]) => b < -0.01)
      .map(([id, b]) => ({ id, amount: -b }))
      .sort((a, b) => b.amount - a.amount);
      
    const creditors = Object.entries(balances)
      .filter(([_, b]) => b > 0.01)
      .map(([id, b]) => ({ id, amount: b }))
      .sort((a, b) => b.amount - a.amount);

    const debts: { from: string, to: string, amount: number }[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(debtor.amount, creditor.amount);

      debts.push({ from: debtor.id, to: creditor.id, amount });

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return debts;
  };

  const handleSettleUp = async () => {
    if (!settleModalData || !apartmentId || !user) return;
    
    try {
      await addDoc(collection(db, 'expenses'), {
        apartmentId,
        title: t('expenses.settlement'),
        amount: settleModalData.amount,
        paidByUserId: settleModalData.from,
        paidBy: { [settleModalData.from]: settleModalData.amount },
        splitMode: 'EXACT',
        splits: { [settleModalData.to]: settleModalData.amount },
        splitAmong: [settleModalData.to],
        involvedUsers: [settleModalData.from, settleModalData.to],
        isSettlement: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success(t('expenses.settlementSuccess'));
      setSettleModalData(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
      toast.error(t('expenses.settlementError'));
    }
  };

  useEffect(() => {
    if (user && splitAmong.length === 0) {
      setSplitAmong([user.uid]);
    }
  }, [user?.uid, splitAmong.length]);

  useEffect(() => {
    if (user && !paidByUserId) {
      setPaidByUserId(user.uid);
    }
  }, [user?.uid, paidByUserId]);

  useEffect(() => {
    if (!apartmentId) return;

    const q = query(
      collection(db, 'expenses'),
      where('apartmentId', '==', apartmentId),
      where('involvedUsers', 'array-contains', user?.uid),
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

    const totalAmount = parseFloat(newExpenseAmount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      toast.error(t('expenses.invalidAmount'));
      return;
    }

    const finalSplits: Record<string, number> = {};
    const activeMembers = members.filter(m => splitAmong.includes(m.userId));

    let finalPaidBy: Record<string, number> = {};
    if (paidByMode === 'SINGLE') {
      finalPaidBy[paidByUserId || user.uid] = totalAmount;
    } else {
      let sumPaid = 0;
      Object.entries(paidByValues).forEach(([uid, val]) => {
        const numVal = parseFloat(val || '0');
        if (numVal > 0) {
          finalPaidBy[uid] = numVal;
          sumPaid += numVal;
        }
      });
      if (Math.abs(sumPaid - totalAmount) > 0.05) {
        toast.error(t('expenses.sumPaidMustMatch'));
        return;
      }
    }

    if (splitMode === 'EQUAL') {
      const splitAmount = totalAmount / activeMembers.length;
      activeMembers.forEach(member => {
        finalSplits[member.userId] = splitAmount;
      });
    } else if (splitMode === 'EXACT') {
      let sum = 0;
      activeMembers.forEach(member => {
        const val = parseFloat(splitValues[member.userId] || '0');
        finalSplits[member.userId] = val;
        sum += val;
      });
      if (Math.abs(sum - totalAmount) > 0.05) {
        toast.error(t('expenses.sumMustMatch'));
        return;
      }
    } else if (splitMode === 'PERCENTAGE') {
      let sum = 0;
      activeMembers.forEach(member => {
        const val = parseFloat(splitValues[member.userId] || '0');
        finalSplits[member.userId] = (val / 100) * totalAmount;
        sum += val;
      });
      if (Math.abs(sum - 100) > 0.05) {
        toast.error(t('expenses.percentageMustMatch'));
        return;
      }
    }

    try {
      const involvedUsers = Array.from(new Set([...Object.keys(finalPaidBy), ...activeMembers.map(m => m.userId)]));
      
      await addDoc(collection(db, 'expenses'), {
        apartmentId,
        title: newExpenseTitle,
        amount: totalAmount,
        paidByUserId: paidByMode === 'SINGLE' ? (paidByUserId || user.uid) : Object.keys(finalPaidBy)[0],
        paidBy: finalPaidBy,
        splitMode,
        splits: finalSplits,
        splitAmong: activeMembers.map(m => m.userId),
        involvedUsers,
        settledBy: [],
        isSettlement: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewExpenseTitle('');
      setNewExpenseAmount('');
      setSplitAmong(members.map(m => m.userId));
      setSplitValues({});
      setPaidByValues({});
      setPaidByMode('SINGLE');
      setSplitMode('EQUAL');
      setIsAdding(false);
      toast.success(t('expenses.addSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
      toast.error(t('expenses.addError'));
    }
  };

  const handleMarkAsPaid = async (expenseId: string) => {
    if (!user) return;
    try {
      const expenseRef = doc(db, 'expenses', expenseId);
      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) return;

      const settledBy = expense.settledBy || [];
      if (!settledBy.includes(user.uid)) {
        await updateDoc(expenseRef, {
          settledBy: [...settledBy, user.uid],
          updatedAt: serverTimestamp()
        });
        toast.success(t('expenses.markAsPaidSuccess'));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `expenses/${expenseId}`);
      toast.error(t('expenses.markAsPaidError'));
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

  const totalPending = calculateBalances().reduce((sum, debt) => sum + debt.amount, 0);

  const totalAmountNum = parseFloat(newExpenseAmount) || 0;
  const activeMembers = members.filter(m => splitAmong.includes(m.userId));

  let currentSum = 0;
  if (splitMode !== 'EQUAL') {
    activeMembers.forEach(m => {
      currentSum += parseFloat(splitValues[m.userId] || '0');
    });
  }

  const isSumValid = splitMode === 'EQUAL' ||
    (splitMode === 'EXACT' && Math.abs(currentSum - totalAmountNum) <= 0.05) ||
    (splitMode === 'PERCENTAGE' && Math.abs(currentSum - 100) <= 0.05);

  const dateLocale = i18n.language === 'ar' ? ar : enUS;

  return (
    <div className="page-container space-y-6 md:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <span className="">{t('expenses.title')}</span>
          </h1>
          <p className="subheading mt-1 text-sm md:text-base">
            {t('expenses.description')}
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="w-full sm:w-auto bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm md:text-base"
        >
          <Plus className="h-4 w-4 md:h-5 md:w-5" />
          {isAdding ? t('expenses.cancel') : t('expenses.addExpense')}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddExpense} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
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
          <div>
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
          
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{t('expenses.paidByLabel')}</label>
              <div className="flex flex-col gap-2">
                <div className="flex bg-gray-100 p-1 rounded-lg mb-2">
                  <button
                    type="button"
                    onClick={() => setPaidByMode('SINGLE')}
                    className={`flex-1 py-1 px-2 text-sm rounded-md transition-colors ${paidByMode === 'SINGLE' ? 'bg-white shadow-sm font-medium text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    {t('common.roommate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidByMode('MULTIPLE')}
                    className={`flex-1 py-1 px-2 text-sm rounded-md transition-colors ${paidByMode === 'MULTIPLE' ? 'bg-white shadow-sm font-medium text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    {t('expenses.multiplePeople')}
                  </button>
                </div>
                
                {paidByMode === 'SINGLE' ? (
                  <select
                    value={paidByUserId}
                    onChange={(e) => setPaidByUserId(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {members.map(member => (
                      <option key={member.userId} value={member.userId}>
                        {member.user?.fullName || t('common.unknown')} {member.userId === user?.uid ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                    {members.map(member => (
                      <div key={member.userId} className="flex items-center gap-2">
                        <span className="text-sm flex-1 truncate">{member.user?.fullName || t('common.unknown')}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={paidByValues[member.userId] || ''}
                          onChange={(e) => setPaidByValues(prev => ({ ...prev, [member.userId]: e.target.value }))}
                          placeholder="0.00"
                          className="w-24 p-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{t('expenses.splitMode')}</label>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSplitMode('EQUAL')}
                  className={`flex-1 py-1 px-2 text-sm rounded-md transition-colors ${splitMode === 'EQUAL' ? 'bg-white shadow-sm font-medium text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {t('expenses.splitEqual')}
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('EXACT')}
                  className={`flex-1 py-1 px-2 text-sm rounded-md transition-colors ${splitMode === 'EXACT' ? 'bg-white shadow-sm font-medium text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {t('expenses.splitExact')}
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('PERCENTAGE')}
                  className={`flex-1 py-1 px-2 text-sm rounded-md transition-colors ${splitMode === 'PERCENTAGE' ? 'bg-white shadow-sm font-medium text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {t('expenses.splitPercentage')}
                </button>
              </div>
            </div>
          </div>
          
          <div className="md:col-span-3 mt-2">
            <label className="block text-sm font-medium text-text-secondary mb-2">{t('expenses.splitAmong')}</label>
            <div className="flex flex-col gap-3">
              {members.map(member => {
                const isSelected = splitAmong.includes(member.userId);
                return (
                  <div 
                    key={member.userId} 
                    onClick={() => toggleSplitMember(member.userId)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${isSelected ? 'bg-primary text-white' : 'bg-gray-300 text-gray-600'}`}>
                        {member.user?.avatarUrl ? (
                          <img src={member.user.avatarUrl} alt={member.user.fullName} className="h-full w-full object-cover" />
                        ) : (
                          member.user?.fullName?.charAt(0) || '?'
                        )}
                      </div>
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-500'}`}>
                        {member.user?.fullName || t('common.unknown')}
                      </span>
                    </div>
                    
                    <AnimatePresence>
                      {isSelected && splitMode !== 'EQUAL' && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="flex items-center gap-2 overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={splitValues[member.userId] || ''}
                            onChange={(e) => setSplitValues(prev => ({ ...prev, [member.userId]: e.target.value }))}
                            placeholder="0.00"
                            className="w-24 p-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-right bg-white"
                            required={true}
                          />
                          <span className="text-sm font-medium text-blue-800">
                            {splitMode === 'PERCENTAGE' ? '%' : (i18n.language === 'ar' ? 'ج.م' : 'EGP')}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {isSelected && splitMode === 'EQUAL' && (
                      <div className="text-sm font-medium text-blue-800">
                        {i18n.language === 'ar' ? 'ج.م' : 'EGP'} {formatCurrency((parseFloat(newExpenseAmount) || 0) / (splitAmong.length || 1), 2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {splitMode !== 'EQUAL' && splitAmong.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-3 rounded-xl text-sm font-medium flex justify-between items-center border ${
                  isSumValid ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSumValid ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  <span>{splitMode === 'EXACT' ? t('expenses.allocatedAmount') : t('expenses.allocatedPercentage')}</span>
                </div>
                <span>
                  {splitMode === 'EXACT' 
                    ? `${formatCurrency(currentSum, 2)} / ${formatCurrency(totalAmountNum, 2)}` 
                    : `${currentSum}% / 100%`}
                </span>
              </motion.div>
            )}
          </div>

          <div className="md:col-span-3 flex justify-end mt-2">
            <button 
              type="submit" 
              disabled={!isSumValid || !newExpenseTitle || !newExpenseAmount}
              className="w-full md:w-auto bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('expenses.saveExpense')}
            </button>
          </div>
        </form>
      )}

      {calculateBalances().length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-text-primary text-sm md:text-base">{t('expenses.balances')}</h2>
          </div>
          <div className="p-4 md:p-6 flex flex-col gap-4">
            {calculateBalances().map((debt, idx) => {
              const fromMember = members.find(m => m.userId === debt.from);
              const toMember = members.find(m => m.userId === debt.to);
              if (!fromMember || !toMember) return null;
              
              return (
                <div key={idx} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      <div className="h-8 w-8 rounded-full border-2 border-white bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold z-10 overflow-hidden">
                        {fromMember.user?.avatarUrl ? <img src={fromMember.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (fromMember.user?.fullName?.charAt(0) || '?')}
                      </div>
                      <div className="h-8 w-8 rounded-full border-2 border-white bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold z-0 overflow-hidden">
                        {toMember.user?.avatarUrl ? <img src={toMember.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (toMember.user?.fullName?.charAt(0) || '?')}
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-text-primary">{fromMember.user?.fullName}</span>
                      <span className="text-text-secondary mx-1">{t('expenses.owes')}</span>
                      <span className="font-semibold text-text-primary">{toMember.user?.fullName}</span>
                      <div className="font-bold text-primary mt-0.5">
                        {i18n.language === 'ar' ? 'ج.م' : 'EGP'} {formatCurrency(debt.amount, 2)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettleModalData(debt)}
                    className="bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('expenses.settleUp')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-semibold text-text-primary text-xs md:text-sm">{t('expenses.recentExpenses')}</h2>
          <div className="text-xs md:text-sm font-medium text-text-secondary">
            {t('expenses.totalPending')} <span className="text-danger font-bold">{i18n.language === 'ar' ? 'ج.م' : 'EGP'} {formatCurrency(totalPending, 2)}</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {expenses.map((expense) => (
            <div key={expense.id} className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-gray-50 transition-colors gap-4">
              <div className="flex items-start gap-3 md:gap-4 w-full">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {(() => {
                    if (expense.isSettlement) {
                      return <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-green-500" />;
                    }
                    const payer = members.find(m => m.userId === expense.paidByUserId);
                    if (payer?.user?.avatarUrl) {
                      return <img src={payer.user.avatarUrl} alt={expense.paidBy === 'Roommate' ? t('common.roommate') : expense.paidBy} className="h-full w-full object-cover" />;
                    }
                    return <Receipt className="h-5 w-5 md:h-6 md:w-6 text-primary" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-text-primary text-sm md:text-base truncate">{expense.title}</h3>
                  <p className="text-xs md:text-sm text-text-secondary truncate">
                    {t('expenses.paidBy')} {(() => {
                      if (expense.paidBy && Object.keys(expense.paidBy).length > 1) {
                        return t('expenses.paidByMultiple');
                      }
                      const payerId = expense.paidByUserId || (expense.paidBy ? Object.keys(expense.paidBy)[0] : null);
                      const payer = members.find(m => m.userId === payerId);
                      if (payer?.user?.fullName) return payer.user.fullName;
                      return expense.paidBy === 'Roommate' ? t('common.roommate') : expense.paidByUserId;
                    })()} • {expense.createdAt ? format(expense.createdAt.toDate(), 'MMM d, yyyy', { locale: dateLocale }) : t('expenses.justNow')}
                  </p>
                  <div className="text-xs text-text-secondary mt-2">
                    {expense.isSettlement ? (
                      <span className="text-green-600 font-medium">{t('expenses.settlement')}</span>
                    ) : (
                      <>
                        {t('expenses.splitAmongPeople', { count: Object.keys(expense.splits || {}).length || expense.splitAmong?.length || 1 })}
                        <div className={`flex mt-1 ${i18n.language === 'ar' ? 'flex-row-reverse space-x-reverse' : ''} -space-x-1 md:-space-x-2`}>
                          {(Object.keys(expense.splits || {}).length > 0 ? Object.keys(expense.splits) : expense.splitAmong || []).map((userId: string) => {
                            const member = members.find(m => m.userId === userId);
                            const amount = expense.splits ? expense.splits[userId] : (expense.amount / (expense.splitAmong?.length || 1));
                            const isSettled = expense.settledBy?.includes(userId);
                            return (
                              <div key={userId} className={`h-5 w-5 md:h-6 md:w-6 rounded-full border border-white text-[8px] md:text-[10px] text-white flex items-center justify-center overflow-hidden ${isSettled ? 'bg-green-500' : 'bg-primary'}`} title={`${member?.user?.fullName || t('common.unknown')}: ${formatCurrency(amount, 2)} ${isSettled ? `(${t('expenses.paid')})` : ''}`}>
                                {member?.user?.avatarUrl ? (
                                  <img src={member.user.avatarUrl} alt={member.user.fullName || t('common.unknown')} className={`h-full w-full object-cover ${isSettled ? 'opacity-50' : ''}`} />
                                ) : (
                                  member?.user?.fullName?.charAt(0) || '?'
                                )}
                                {isSettled && <CheckCircle2 className="absolute h-3 w-3 text-white" />}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between w-full md:w-auto md:justify-end gap-4 md:border-t-0 md:pt-0">
                <div className="text-left md:text-right flex-shrink-0">
                  <div className="font-bold text-lg md:text-xl text-text-primary">
                    {i18n.language === 'ar' ? 'ج.م' : 'EGP'} {
                      expense.isSettlement 
                        ? formatCurrency(expense.amount, 2)
                        : formatCurrency(expense.splits ? (expense.splits[user?.uid || ''] || 0) : (expense.splitAmong?.includes(user?.uid) ? expense.amount / expense.splitAmong.length : 0), 2)
                    }
                  </div>
                  {expense.isSettlement ? (
                    <div className="badge text-xs text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /><span>{t('expenses.settlement')}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <div className="badge text-xs text-orange-600 font-medium flex items-center gap-1">
                        <Circle className="h-3 w-3" /><span>{t('expenses.pending')}</span>
                      </div>
                      {!expense.settledBy?.includes(user?.uid || '') && expense.splitAmong?.includes(user?.uid) && (!expense.paidBy || !Object.keys(expense.paidBy).includes(user?.uid || '')) && expense.paidByUserId !== user?.uid && (
                        <button
                          onClick={() => handleMarkAsPaid(expense.id)}
                          className="text-[10px] bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded-md font-medium transition-colors"
                        >
                          {t('expenses.markAsPaid')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => confirmDelete(expense.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-2"
                  title={t('expenses.deleteExpense')}
                >
                  <Trash2 className="h-5 w-5" />
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
      {/* Settlement Modal */}
      {settleModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-text-primary mb-4">{t('expenses.settlementConfirmTitle')}</h3>
            <p className="text-text-secondary mb-6 leading-relaxed">
              {t('expenses.settlementConfirmMessage', {
                amount: `${i18n.language === 'ar' ? 'ج.م' : 'EGP'} ${formatCurrency(settleModalData.amount, 2)}`,
                from: members.find(m => m.userId === settleModalData.from)?.user?.fullName || 'Unknown',
                to: members.find(m => m.userId === settleModalData.to)?.user?.fullName || 'Unknown'
              })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSettleModalData(null)}
                className="px-4 py-2 text-text-secondary hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSettleUp}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                {t('expenses.settleUp')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
