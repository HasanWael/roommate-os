import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
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

export default function Groceries() {
  const { user, apartmentId } = useAuth();
  const { members } = useMembers();
  const { t, i18n } = useTranslation();
  const [groceries, setGroceries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [completingItems, setCompletingItems] = useState<Set<string>>(new Set());
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!apartmentId) return;

    const q = query(
      collection(db, 'groceries'),
      where('apartmentId', '==', apartmentId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGroceries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(prev => prev ? false : prev);
    });

    return () => unsubscribe();
  }, [apartmentId]);

  const handleAddItem = async (e: any) => {
    e.preventDefault();
    if (!newItemName.trim() || !apartmentId || !user) return;

    try {
      await addDoc(collection(db, 'groceries'), {
        apartmentId,
        name: newItemName,
        quantity: parseInt(newItemQuantity, 10) || 1,
        status: 'needed',
        addedBy: user.displayName || 'Roommate',
        addedByUserId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewItemName('');
      setNewItemQuantity('1');
      setIsAdding(false);
      toast.success(t('groceries.addSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'groceries');
      toast.error(t('groceries.addError'));
    }
  };

  const toggleItemStatus = async (itemId: string) => {
    if (completingItems.has(itemId)) return;
    
    // Start animation
    setCompletingItems(prev => new Set(prev).add(itemId));
    
    // Wait for animation to play
    setTimeout(async () => {
      try {
        await deleteDoc(doc(db, 'groceries', itemId));
        toast.success(t('groceries.completeSuccess'));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `groceries/${itemId}`);
        toast.error(t('groceries.completeError'));
      } finally {
        setCompletingItems(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    }, 600);
  };

  const confirmDelete = (itemId: string) => {
    setItemToDelete(itemId);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'groceries', itemToDelete));
      toast.success(t('groceries.deleteSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groceries/${itemToDelete}`);
      toast.error(t('groceries.deleteError'));
    } finally {
      setItemToDelete(null);
    }
  };

  if (loading) return <LoadingScreen message={t('dashboard.loading')} />;

  return (
    <div className="page-container space-y-6 md:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-lg md:text-3xl font-extrabold text-text-primary tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 md:h-8 md:w-8 text-primary" />
            <span className="">{t('groceries.title')}</span>
          </h1>
          <p className="subheading mt-1 text-[10px] md:text-base">
            {t('groceries.description')}
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="w-full sm:w-auto bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm md:text-base"
        >
          <Plus className="h-4 w-4 md:h-5 md:w-5" />
          {isAdding ? t('groceries.cancel') : t('groceries.addItem')}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddItem} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
          <div className="flex-1">
            <label className="block text-xs md:text-sm font-medium text-text-secondary mb-1">{t('groceries.itemName')}</label>
            <input 
              type="text" 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm md:text-base"
              placeholder={t('groceries.itemNamePlaceholder')}
              required
            />
          </div>
          <div className="w-full sm:w-24">
            <label className="block text-xs md:text-sm font-medium text-text-secondary mb-1">{t('groceries.quantity')}</label>
            <input 
              type="number" 
              min="1"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm md:text-base"
              required
            />
          </div>
          <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm md:text-base">
            {t('groceries.save')}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-text-primary text-sm md:text-base">{t('groceries.neededItems')}</h2>
        </div>
        
        <div className="divide-y divide-gray-100">
          {groceries.filter(g => g.status !== 'purchased').map((item) => {
            const isCompleting = completingItems.has(item.id);
            return (
            <div key={item.id} className={`p-4 md:p-6 flex items-center justify-between transition-all duration-500 ${isCompleting ? 'bg-gray-50 opacity-60 scale-[0.99]' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <button 
                  onClick={() => toggleItemStatus(item.id)}
                  className="h-6 w-6 md:h-8 md:w-8 rounded-full border-2 border-gray-300 hover:border-primary flex items-center justify-center transition-colors flex-shrink-0"
                  disabled={isCompleting}
                >
                  {isCompleting || item.status === 'purchased' ? (
                    <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-green-500 transition-all duration-500 scale-110" />
                  ) : (
                    <div className="h-3 w-3 md:h-4 md:w-4 rounded-full bg-transparent"></div>
                  )}
                </button>
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {(() => {
                    const adder = members.find(m => m.userId === item.addedByUserId);
                    if (adder?.user?.avatarUrl) {
                      return <img src={adder.user.avatarUrl} alt={item.addedBy} className="h-full w-full object-cover" />;
                    }
                    return <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className={`font-bold text-xs md:text-lg break-words transition-all duration-500 ${isCompleting || item.status === 'purchased' ? 'text-gray-400 line-through' : 'text-text-primary'}`}>
                    {item.name}
                  </h3>
                  <p className={`text-[10px] md:text-sm break-words transition-all duration-500 ${isCompleting ? 'text-gray-400' : 'text-text-secondary'}`}>
                    {t('groceries.qty')} {item.quantity} • {t('groceries.addedBy')} {(() => {
                      const adder = members.find(m => m.userId === item.addedByUserId);
                      return adder?.user?.fullName || item.addedBy;
                    })()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-4 ml-2 rtl:ml-0 rtl:mr-2">
                <span className={`badge text-[10px] md:text-xs font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-full uppercase tracking-wider transition-all duration-500 flex-shrink-0 ${
                  isCompleting || item.status === 'purchased' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {isCompleting ? t('groceries.purchasing') : (item.status === 'purchased' ? t('groceries.purchased') : t('groceries.needed'))}
                </span>
                <button 
                  onClick={() => confirmDelete(item.id)}
                  className={`text-gray-400 hover:text-red-500 transition-colors p-1 md:p-2 flex-shrink-0 ${isCompleting ? 'opacity-0 pointer-events-none' : ''}`}
                  title={t('groceries.deleteItem')}
                >
                  <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </div>
            </div>
          )})}
          {groceries.filter(g => g.status !== 'purchased').length === 0 && (
            <div className="p-8">
              <EmptyState 
                icon={ShoppingCart} 
                title={t('groceries.fridgeFull')} 
                description={t('groceries.fridgeFullDesc')} 
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!itemToDelete}
        title={t('groceries.deleteTitle')}
        message={t('groceries.deleteMessage')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
