import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import ConfirmModal from '../components/ConfirmModal';

export default function Groceries() {
  const { user, apartmentId } = useAuth();
  const { members } = useMembers();
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
      toast.success('Item added to grocery list.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'groceries');
      toast.error('Failed to add item.');
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
        toast.success('Item purchased and removed.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `groceries/${itemId}`);
        toast.error('Failed to complete item.');
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
      toast.success('Item deleted.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groceries/${itemToDelete}`);
      toast.error('Failed to delete item.');
    } finally {
      setItemToDelete(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading groceries...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Grocery List</h1>
          <p className="text-text-secondary mt-1">Add items needed for the apartment.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          {isAdding ? 'Cancel' : 'Add Item'}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddItem} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-secondary mb-1">Item Name</label>
            <input 
              type="text" 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Milk, Eggs, Bread"
              required
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-text-secondary mb-1">Quantity</label>
            <input 
              type="number" 
              min="1"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors">
            Save
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-text-primary">Needed Items</h2>
          <div className="text-sm font-medium text-text-secondary">
            Total: <span className="text-text-primary font-bold">{groceries.filter(g => g.status === 'needed').length}</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {groceries.filter(g => g.status !== 'purchased').map((item) => {
            const isCompleting = completingItems.has(item.id);
            return (
            <div key={item.id} className={`p-6 flex items-center justify-between transition-all duration-500 ${isCompleting ? 'bg-gray-50 opacity-60 scale-[0.99]' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => toggleItemStatus(item.id)}
                  className="h-8 w-8 rounded-full border-2 border-gray-300 hover:border-primary flex items-center justify-center transition-colors"
                  disabled={isCompleting}
                >
                  {isCompleting || item.status === 'purchased' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500 transition-all duration-500 scale-110" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-transparent"></div>
                  )}
                </button>
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  {(() => {
                    const adder = members.find(m => m.userId === item.addedByUserId);
                    if (adder?.user?.avatarUrl) {
                      return <img src={adder.user.avatarUrl} alt={item.addedBy} className="h-full w-full object-cover" />;
                    }
                    return <ShoppingCart className="h-4 w-4 text-gray-400" />;
                  })()}
                </div>
                <div>
                  <h3 className={`font-bold text-lg transition-all duration-500 ${isCompleting || item.status === 'purchased' ? 'text-gray-400 line-through' : 'text-text-primary'}`}>
                    {item.name}
                  </h3>
                  <p className={`text-sm transition-all duration-500 ${isCompleting ? 'text-gray-400' : 'text-text-secondary'}`}>
                    Qty: {item.quantity} • Added by {(() => {
                      const adder = members.find(m => m.userId === item.addedByUserId);
                      return adder?.user?.fullName || item.addedBy;
                    })()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider transition-all duration-500 ${
                  isCompleting || item.status === 'purchased' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {isCompleting ? 'Purchasing...' : (item.status === 'purchased' ? 'Purchased' : 'Needed')}
                </span>
                <button 
                  onClick={() => confirmDelete(item.id)}
                  className={`text-gray-400 hover:text-red-500 transition-colors p-2 ${isCompleting ? 'opacity-0 pointer-events-none' : ''}`}
                  title="Delete item"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          )})}
          {groceries.filter(g => g.status !== 'purchased').length === 0 && (
            <div className="p-8 text-center text-text-secondary">No groceries needed.</div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!itemToDelete}
        title="Delete Grocery Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
