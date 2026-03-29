import { useState, useEffect } from 'react';
import { CheckSquare, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { toast } from 'sonner';

export default function Chores() {
  const { user, apartmentId } = useAuth();
  const { members } = useMembers();
  const [chores, setChores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newChoreTitle, setNewChoreTitle] = useState('');
  const [newChoreDueDate, setNewChoreDueDate] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');

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
      toast.success('Chore added successfully.');
    } catch (error) {
      console.error("Error adding chore: ", error);
      toast.error('Failed to add chore.');
    }
  };

  const toggleChoreStatus = async (choreId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await updateDoc(doc(db, 'chores', choreId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Chore marked as ${newStatus}.`);
    } catch (error) {
      console.error("Error updating chore: ", error);
      toast.error('Failed to update chore status.');
    }
  };

  const deleteChore = async (choreId: string) => {
    if (!window.confirm('Are you sure you want to delete this chore?')) return;
    try {
      await deleteDoc(doc(db, 'chores', choreId));
      toast.success('Chore deleted.');
    } catch (error) {
      console.error("Error deleting chore: ", error);
      toast.error('Failed to delete chore.');
    }
  };

  const getAssignedUserName = (userId: string) => {
    const member = members.find(m => m.userId === userId);
    return member?.user?.fullName || 'Unknown';
  };

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading chores...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Chores Board</h1>
          <p className="text-text-secondary mt-1">Keep the apartment clean and organized.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          {isAdding ? 'Cancel' : 'Add Chore'}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddChore} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-text-secondary mb-1">Chore Title</label>
            <input 
              type="text" 
              value={newChoreTitle}
              onChange={(e) => setNewChoreTitle(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Clean the kitchen"
              required
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-text-secondary mb-1">Assign To</label>
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="" disabled>Select Roommate</option>
              {members.map(member => (
                <option key={member.userId} value={member.userId}>
                  {member.user?.fullName || 'Unknown'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Due Date</label>
            <input 
              type="date" 
              value={newChoreDueDate}
              onChange={(e) => setNewChoreDueDate(e.target.value)}
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
          <h2 className="font-bold text-text-primary">Assigned Chores</h2>
          <div className="text-sm font-medium text-text-secondary">
            Pending: <span className="text-text-primary font-bold">{chores.filter(c => c.status === 'pending').length}</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {chores.map((chore) => (
            <div key={chore.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => toggleChoreStatus(chore.id, chore.status)}
                  className="h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  {chore.status === 'completed' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-400" />
                  )}
                </button>
                <div>
                  <h3 className={`font-bold text-lg ${chore.status === 'completed' ? 'text-gray-400 line-through' : 'text-text-primary'}`}>
                    {chore.title}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Due: {chore.dueDate ? format(new Date(chore.dueDate), 'MMM d, yyyy') : 'No date'} • Assigned to: {getAssignedUserName(chore.assignedToUserId)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  chore.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-text-primary'
                }`}>
                  {chore.status}
                </span>
                <button 
                  onClick={() => deleteChore(chore.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-2"
                  title="Delete chore"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          {chores.length === 0 && (
            <div className="p-8 text-center text-text-secondary">No chores found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
