import { useState, useEffect } from 'react';
import { Receipt, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

export default function Expenses() {
  const { user, apartmentId } = useAuth();
  const { members } = useMembers();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [splitAmong, setSplitAmong] = useState<string[]>([]);

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
      toast.success('Expense added successfully.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
      toast.error('Failed to add expense.');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
      toast.success('Expense deleted.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${expenseId}`);
      toast.error('Failed to delete expense.');
    }
  };

  const toggleSplitMember = (userId: string) => {
    setSplitAmong(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading expenses...</div>;

  const totalPending = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Bills & Expenses</h1>
          <p className="text-text-secondary mt-1">Manage shared costs and track who owes what.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          {isAdding ? 'Cancel' : 'Add Expense'}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddExpense} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
              <input 
                type="text" 
                value={newExpenseTitle}
                onChange={(e) => setNewExpenseTitle(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Electric Bill, Groceries"
                required
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-text-secondary mb-1">Amount (EGP)</label>
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
            <label className="block text-sm font-medium text-text-secondary mb-2">Split Among</label>
            <div className="flex flex-wrap gap-3">
              {members.map(member => (
                <label key={member.userId} className="flex items-center space-x-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">
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
                  <span className="text-sm font-medium text-text-primary">{member.user?.fullName || 'Unknown'}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors">
              Save Expense
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-text-primary">Recent Expenses</h2>
          <div className="text-sm font-medium text-text-secondary">
            Total Pending: <span className="text-danger font-bold">EGP {totalPending.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {expenses.map((expense) => (
            <div key={expense.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden">
                  {(() => {
                    const payer = members.find(m => m.userId === expense.paidByUserId);
                    if (payer?.user?.avatarUrl) {
                      return <img src={payer.user.avatarUrl} alt={expense.paidBy} className="h-full w-full object-cover" />;
                    }
                    return <Receipt className="h-6 w-6 text-primary" />;
                  })()}
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-lg">{expense.title}</h3>
                  <p className="text-sm text-text-secondary">
                    {expense.createdAt ? format(expense.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'} • Paid by {(() => {
                      const payer = members.find(m => m.userId === expense.paidByUserId);
                      return payer?.user?.fullName || expense.paidBy;
                    })()}
                  </p>
                  <div className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                    Split among {expense.splitAmong?.length || 1} people:
                    <div className="flex -space-x-2 ml-1">
                      {expense.splitAmong?.map((userId: string) => {
                        const member = members.find(m => m.userId === userId);
                        return (
                          <div key={userId} className="h-5 w-5 rounded-full border border-white bg-primary text-[8px] text-white flex items-center justify-center overflow-hidden" title={member?.user?.fullName}>
                            {member?.user?.avatarUrl ? (
                              <img src={member.user.avatarUrl} alt={member.user.fullName} className="h-full w-full object-cover" />
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
              
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="font-bold text-xl text-text-primary">EGP {expense.amount.toFixed(2)}</div>
                  <div className="text-sm text-text-secondary mt-1 flex items-center justify-end space-x-1">
                    <Circle className="h-4 w-4 text-orange-500" /><span className="text-orange-600 font-medium">Pending</span>
                  </div>
                </div>
                <button 
                  onClick={() => deleteExpense(expense.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-2"
                  title="Delete expense"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="p-8 text-center text-text-secondary">No expenses found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
