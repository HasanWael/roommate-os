import { useState, useEffect } from 'react';
import { Megaphone, Plus, Pin, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';

export default function Announcements() {
  const { user, apartmentId } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!apartmentId) return;

    const q = query(
      collection(db, 'announcements'),
      where('apartmentId', '==', apartmentId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(prev => prev ? false : prev);
    });

    return () => unsubscribe();
  }, [apartmentId]);

  const handleAddAnnouncement = async (e: any) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !apartmentId || !user) return;

    try {
      await addDoc(collection(db, 'announcements'), {
        apartmentId,
        title: newTitle,
        content: newContent,
        isUrgent,
        authorId: user.displayName?.split(' ')[0] || 'Roommate',
        authorUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewTitle('');
      setNewContent('');
      setIsUrgent(false);
      setIsAdding(false);
      toast.success('Announcement posted.');
    } catch (error) {
      console.error("Error adding announcement: ", error);
      toast.error('Failed to post announcement.');
    }
  };

  const deleteAnnouncement = async (announcementId: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', announcementId));
      toast.success('Announcement deleted.');
    } catch (error) {
      console.error("Error deleting announcement: ", error);
      toast.error('Failed to delete announcement.');
    }
  };

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading announcements...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Announcements</h1>
          <p className="text-text-secondary mt-1">Important updates for the apartment.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          {isAdding ? 'Cancel' : 'Create'}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddAnnouncement} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Title</label>
            <input 
              type="text" 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Maintenance on Friday"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Message</label>
            <textarea 
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[100px]"
              placeholder="Enter your announcement details..."
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="isUrgent"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="isUrgent" className="text-sm font-medium text-text-secondary">Mark as urgent</label>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors">
              Post Announcement
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {announcements.map((announcement) => (
          <div key={announcement.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${announcement.isUrgent ? 'border-red-200' : 'border-gray-100'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${announcement.isUrgent ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center">
                <Megaphone className={`h-4 w-4 mr-2 ${announcement.isUrgent ? 'text-red-500' : 'text-text-secondary'}`} />
                <h2 className="font-bold text-text-primary">{announcement.title}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs font-medium text-text-secondary">
                  {announcement.createdAt ? format(announcement.createdAt.toDate(), 'MMM d, yyyy h:mm a') : 'Just now'}
                </div>
                <button 
                  onClick={() => deleteAnnouncement(announcement.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Delete announcement"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-text-primary leading-relaxed whitespace-pre-wrap">
                {announcement.content}
              </p>
              
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                    {announcement.authorId ? announcement.authorId.charAt(0).toUpperCase() : '?'}
                  </div>
                  <span className="text-sm text-text-secondary">Posted by {announcement.authorId}</span>
                </div>
                {announcement.isUrgent && (
                  <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-700 rounded-full uppercase tracking-wider">
                    Urgent
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {announcements.length === 0 && (
          <div className="p-8 text-center text-text-secondary bg-white rounded-2xl border border-gray-100">No announcements found.</div>
        )}
      </div>
    </div>
  );
}
