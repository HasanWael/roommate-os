import { useState, useEffect } from 'react';
import { Receipt, CheckSquare, ShoppingCart, CalendarDays, Megaphone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import DashboardShowerWidget from '../components/DashboardShowerWidget';

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
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-extrabold text-text-primary tracking-tight">
            Good morning, <span className="text-primary">{(() => {
              const currentUserMember = members.find(m => m.userId === user?.uid);
              return currentUserMember?.user?.fullName || user?.displayName || 'Roommate';
            })()}</span>.
          </h1>
          <p className="text-text-secondary mt-3 text-xl max-w-2xl">
            Everything in <span className="font-semibold text-text-primary">{apartment?.name || 'your apartment'}</span> is running smoothly. 
            Here's what requires your attention today.
          </p>
        </div>
        <div className="flex -space-x-3">
          {members.slice(0, 5).map((member) => (
            <div 
              key={member.userId} 
              className="h-12 w-12 rounded-full border-4 border-background bg-primary text-white flex items-center justify-center font-bold text-lg shadow-sm overflow-hidden"
              title={member.user?.fullName}
            >
              {member.user?.avatarUrl ? (
                <img src={member.user.avatarUrl} alt={member.user.fullName} className="h-full w-full object-cover" />
              ) : (
                getMemberInitials(member.userId)
              )}
            </div>
          ))}
          {members.length > 5 && (
            <div className="h-12 w-12 rounded-full border-4 border-background bg-gray-200 text-text-secondary flex items-center justify-center font-bold shadow-sm">
              +{members.length - 5}
            </div>
          )}
        </div>
      </header>

      <DashboardShowerWidget />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Bills Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col transform transition-transform hover:scale-[1.01]">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-warning-light rounded-2xl border border-warning-light">
              <Receipt className="h-8 w-8 text-warning-dark" />
            </div>
            <span className="bg-warning-light text-warning-dark text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">
              {expenses.length} Pending
            </span>
          </div>
          <h3 className="text-2xl font-bold mb-1 text-text-primary">Bills & Expenses</h3>
          <p className="text-text-secondary text-sm mb-8">Total outstanding: <span className="font-bold text-text-primary">EGP {expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</span></p>
          
          <div className="mt-auto space-y-4">
            {expenses.slice(0, 2).map(expense => (
              <div key={expense.id} className="flex justify-between items-center text-sm bg-warning-light/30 p-3 rounded-xl border border-warning-light/50">
                <span className="font-medium text-text-primary">{expense.title}</span>
                <span className="font-bold text-warning-dark">EGP {expense.amount.toFixed(2)}</span>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-sm text-success font-bold">All bills paid! 🎉</p>}
          </div>
        </div>

        {/* Chores Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col transform transition-transform hover:scale-[1.01]">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-info-light rounded-2xl border border-info-light">
              <CheckSquare className="h-8 w-8 text-info-dark" />
            </div>
            <span className="bg-info-light text-info-dark text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">
              {chores.length} Active
            </span>
          </div>
          <h3 className="text-2xl font-bold mb-1 text-text-primary">Weekly Chores</h3>
          <p className="text-text-secondary text-sm mb-8">Next up: <span className="font-bold text-text-primary">{chores[0]?.title || 'All caught up'}</span></p>
          
          <div className="mt-auto">
            <div className="flex items-center justify-between mb-2 text-sm text-text-secondary">
              <span>Overall Progress</span>
              <span className="font-bold text-success-dark">{Math.round((1 - (chores.length / 10)) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="bg-success h-3 rounded-full shadow-sm transition-all duration-500" style={{ width: `${Math.max(10, (1 - (chores.length / 10)) * 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* Groceries Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col transform transition-transform hover:scale-[1.01]">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-success-light rounded-2xl border border-success-light">
              <ShoppingCart className="h-8 w-8 text-success-dark" />
            </div>
            <span className="bg-success-light text-success-dark text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">
              {groceries.length} Items
            </span>
          </div>
          <h3 className="text-2xl font-bold mb-1 text-text-primary">Grocery List</h3>
          <p className="text-text-secondary text-sm mb-6">{groceries.length} items needed this week</p>
          
          <ul className="space-y-3 mb-6 flex-1">
            {groceries.slice(0, 3).map(item => (
              <li key={item.id} className="flex justify-between items-center text-sm bg-success-light/30 p-2 px-3 rounded-lg border border-success-light/50">
                <span className="font-medium text-text-primary">{item.name}</span>
                <CheckCircle2 className="h-4 w-4 text-success-dark opacity-60" />
              </li>
            ))}
            {groceries.length === 0 && (
              <li className="text-sm text-success-dark font-medium italic">Fridge is full!</li>
            )}
          </ul>
          <button className="w-full bg-primary text-white hover:bg-primary-dark font-bold py-3 rounded-2xl text-sm transition-all shadow-lg active:scale-95">
            ADD ITEMS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Schedule */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-bold text-text-primary">Upcoming Events</h3>
            <button className="text-sm font-bold text-primary hover:text-primary-dark transition-colors flex items-center">
              FULL CALENDAR
              <CalendarDays className="ml-2 h-4 w-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.slice(0, 3).map(event => (
              <div key={event.id} className="group cursor-pointer">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2 bg-primary/10 inline-block px-2 py-1 rounded">
                  {new Date(event.startDatetime).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <h4 className="font-bold text-text-primary text-lg group-hover:text-primary transition-colors">{event.title}</h4>
                <p className="text-sm text-text-secondary flex items-center mt-1">
                  <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                  {new Date(event.startDatetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            {events.length === 0 && (
              <div className="col-span-3 py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-text-secondary font-medium">No upcoming events scheduled.</p>
              </div>
            )}
          </div>
        </div>

        {/* Announcements */}
        <div className="bg-text-primary text-white rounded-3xl p-8 flex flex-col relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Megaphone className="h-32 w-32 rotate-12" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center text-xs font-bold uppercase tracking-widest mb-6 text-primary">
              <Megaphone className="h-5 w-5 mr-3" />
              Latest Update
            </div>
            {announcements.length > 0 ? (
              <>
                <p className="text-2xl font-bold leading-tight mb-8">
                  "{announcements[0].content}"
                </p>
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-xs font-bold mr-3 overflow-hidden">
                    {(() => {
                      const author = members.find(m => m.userId === announcements[0].authorId);
                      if (author?.user?.avatarUrl) {
                        return <img src={author.user.avatarUrl} alt={author.user.fullName} className="h-full w-full object-cover" />;
                      }
                      return getMemberInitials(announcements[0].authorId);
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      Posted by {members.find(m => m.userId === announcements[0].authorId)?.user?.fullName || 'Roommate'}
                    </p>
                    <p className="text-xs opacity-50">{announcements[0].createdAt ? announcements[0].createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xl font-medium opacity-60">No recent announcements from the crew.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
