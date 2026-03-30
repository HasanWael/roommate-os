import { useState, useEffect } from 'react';
import { Receipt, CheckSquare, ShoppingCart, CalendarDays, Megaphone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

export default function Dashboard() {
  const { user, apartmentId, apartment } = useAuth();
  const { members } = useMembers();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [chores, setChores] = useState<any[]>([]);
  const [groceries, setGroceries] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apartmentId) return;

    // Fetch Expenses
    const qExpenses = query(collection(db, 'expenses'), where('apartmentId', '==', apartmentId), orderBy('createdAt', 'desc'), limit(5));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'expenses');
    });

    // Fetch Chores
    const qChores = query(collection(db, 'chores'), where('apartmentId', '==', apartmentId), where('status', '==', 'pending'), limit(5));
    const unsubChores = onSnapshot(qChores, (snapshot) => {
      setChores(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chores');
    });

    // Fetch Groceries
    const qGroceries = query(collection(db, 'groceries'), where('apartmentId', '==', apartmentId), where('status', '==', 'needed'), limit(5));
    const unsubGroceries = onSnapshot(qGroceries, (snapshot) => {
      setGroceries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'groceries');
    });

    // Fetch Events
    const qEvents = query(collection(db, 'calendarEvents'), where('apartmentId', '==', apartmentId), orderBy('startDatetime', 'asc'), limit(5));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'calendarEvents');
    });

    // Fetch Announcements
    const qAnnouncements = query(collection(db, 'announcements'), where('apartmentId', '==', apartmentId), orderBy('createdAt', 'desc'), limit(3));
    const unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(prev => prev ? false : prev);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'announcements');
    });

    return () => {
      unsubExpenses();
      unsubChores();
      unsubGroceries();
      unsubEvents();
      unsubAnnouncements();
    };
  }, [apartmentId]);

  const getMemberInitials = (userId: string) => {
    const member = members.find(m => m.userId === userId);
    if (member && member.user && member.user.fullName) {
      return member.user.fullName.charAt(0).toUpperCase();
    }
    return '?';
  };

  if (loading) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-text-primary tracking-tight">Good morning, {user?.displayName?.split(' ')[0] || 'Roommate'}.</h1>
        <p className="text-text-secondary mt-2 text-lg">Everything in {apartment?.name || 'your apartment'} is running smoothly. Here's what requires your attention today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bills Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Receipt className="h-6 w-6 text-text-primary" />
            </div>
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
              {expenses.length} Pending
            </span>
          </div>
          <h3 className="text-xl font-bold text-text-primary">Bills & Expenses</h3>
          <p className="text-text-secondary text-sm mb-6">Pending: ${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</p>
          
          <div className="mt-auto">
            {expenses.slice(0, 1).map(expense => (
              <div key={expense.id} className="flex justify-between text-sm font-medium mb-2">
                <span>{expense.title}</span>
                <span className="font-bold">${expense.amount.toFixed(2)}</span>
              </div>
            ))}
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div className="bg-text-primary h-1.5 rounded-full" style={{ width: '70%' }}></div>
            </div>
          </div>
        </div>

        {/* Chores Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CheckSquare className="h-6 w-6 text-text-primary" />
            </div>
            <span className="bg-gray-200 text-text-primary text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
              {chores.length} Pending
            </span>
          </div>
          <h3 className="text-xl font-bold text-text-primary">Assigned Chores</h3>
          <p className="text-text-secondary text-sm mb-6">Next: {chores[0]?.title || 'None'}</p>
          
          <div className="mt-auto flex -space-x-2">
            {chores.slice(0, 3).map((chore, i) => (
              <div key={chore.id} className={`h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-green-500' : 'bg-purple-500'}`} title={chore.title}>
                {getMemberInitials(chore.assignedToUserId)}
              </div>
            ))}
            {chores.length > 3 && (
              <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-text-secondary text-xs font-bold">+{chores.length - 3}</div>
            )}
          </div>
        </div>

        {/* Groceries Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Groceries Needs</h3>
          <ul className="space-y-3 mb-6 flex-1">
            {groceries.slice(0, 3).map(item => (
              <li key={item.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center">
                  <span className="h-2 w-2 rounded-full bg-gray-300 mr-3"></span>
                  <span className="font-medium">{item.name}</span>
                </div>
                <span className="text-xs text-text-secondary">Needed</span>
              </li>
            ))}
            {groceries.length === 0 && (
              <li className="text-sm text-text-secondary">No groceries needed.</li>
            )}
          </ul>
          <button className="w-full bg-gray-100 hover:bg-gray-200 text-text-primary font-bold py-2 rounded-lg text-sm transition-colors">
            ADD TO LIST
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule */}
        <div className="lg:col-span-2 bg-gray-100 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-text-primary">Upcoming Schedule</h3>
            <button className="text-sm font-bold text-text-primary uppercase tracking-wider border-b-2 border-text-primary pb-0.5">View Full Calendar</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {events.slice(0, 3).map(event => (
              <div key={event.id}>
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">
                  {new Date(event.startDatetime).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <h4 className="font-bold text-text-primary">{event.title}</h4>
                <p className="text-sm text-text-secondary">
                  {new Date(event.startDatetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  {event.location ? ` • ${event.location}` : ''}
                </p>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-sm text-text-secondary col-span-3">No upcoming events.</p>
            )}
          </div>
        </div>

        {/* Announcements */}
        <div className="bg-text-primary text-white rounded-2xl p-6 flex flex-col justify-center">
          <div className="flex items-center text-xs font-bold uppercase tracking-wider mb-4 opacity-80">
            <Megaphone className="h-4 w-4 mr-2" />
            Latest Announcement
          </div>
          {announcements.length > 0 ? (
            <>
              <p className="text-lg font-medium leading-tight mb-4">
                "{announcements[0].content}"
              </p>
              <p className="text-sm opacity-60">— Posted by {announcements[0].authorId}, {announcements[0].createdAt ? announcements[0].createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
            </>
          ) : (
            <p className="text-lg font-medium leading-tight mb-4">No recent announcements.</p>
          )}
        </div>
      </div>

    </div>
  );
}
