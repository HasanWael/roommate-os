import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Receipt, CheckSquare, ShoppingCart, Megaphone, CalendarDays, LayoutDashboard, Droplets } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db, loginWithGoogle, logout } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import TVShowerQueueWidget from '../components/TVShowerQueueWidget';

export default function TVMode() {
  const { user, apartmentId, apartment, memberships, setApartmentId } = useAuth();
  const { members } = useMembers();
  const [time, setTime] = useState(new Date());
  const [expenses, setExpenses] = useState<any[]>([]);
  const [chores, setChores] = useState<any[]>([]);
  const [groceries, setGroceries] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!apartmentId) {
      setLoading(false);
      return;
    }

    // Fetch Expenses
    const qExpenses = query(collection(db, 'expenses'), where('apartmentId', '==', apartmentId), orderBy('createdAt', 'desc'), limit(5));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error fetching expenses:', error);
    });

    // Fetch Chores
    const qChores = query(collection(db, 'chores'), where('apartmentId', '==', apartmentId), where('status', '==', 'pending'), limit(5));
    const unsubChores = onSnapshot(qChores, (snapshot) => {
      setChores(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error fetching chores:', error);
    });

    // Fetch Groceries
    const qGroceries = query(collection(db, 'groceries'), where('apartmentId', '==', apartmentId), where('status', '==', 'needed'), limit(5));
    const unsubGroceries = onSnapshot(qGroceries, (snapshot) => {
      setGroceries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error fetching groceries:', error);
    });

    // Fetch Events
    const qEvents = query(collection(db, 'calendarEvents'), where('apartmentId', '==', apartmentId), orderBy('startDatetime', 'asc'), limit(5));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error fetching events:', error);
    });

    // Fetch Announcements
    const qAnnouncements = query(collection(db, 'announcements'), where('apartmentId', '==', apartmentId), orderBy('createdAt', 'desc'), limit(1));
    const unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching announcements:', error);
      setLoading(false);
    });

    // Safety timeout to ensure loading screen doesn't get stuck
    const timeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubExpenses();
      unsubChores();
      unsubGroceries();
      unsubEvents();
      unsubAnnouncements();
      clearTimeout(timeout);
    };
  }, [apartmentId]);

  const getMemberInitials = (userId: string) => {
    const member = members.find(m => m.userId === userId);
    if (member && member.user && member.user.fullName) {
      return member.user.fullName.charAt(0).toUpperCase();
    }
    return '?';
  };

  if (loading) return <div className="tv-mode min-h-screen flex items-center justify-center text-2xl font-bold">Loading Command Screen...</div>;

  if (!apartmentId) {
    return (
      <div className="tv-mode min-h-screen w-screen flex flex-col items-center justify-center text-center bg-tv-dark">
        <div className="max-w-2xl w-full p-8">
          <h1 className="text-7xl font-bold tracking-tighter mb-4 opacity-20">COMMAND CENTER</h1>
          <div className="h-1.5 w-32 bg-primary rounded-full mx-auto mb-12"></div>
          
          {!user ? (
            <div className="space-y-8">
              <p className="text-3xl font-bold text-white/40 uppercase tracking-widest mb-12">Authentication Required</p>
              <button 
                onClick={() => loginWithGoogle()}
                className="bg-white text-black font-bold py-6 px-12 rounded-3xl text-2xl transition-all hover:scale-105 active:scale-95 shadow-2xl flex items-center justify-center space-x-4 mx-auto"
              >
                <img src="https://www.google.com/favicon.ico" className="h-8 w-8" alt="Google" />
                <span>Login to Roommate OS</span>
              </button>
            </div>
          ) : (
            <div className="space-y-12">
              <p className="text-3xl font-bold text-white/40 uppercase tracking-widest">Select an Active Space</p>
              
              {memberships.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {memberships.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setApartmentId(m.apartmentId)}
                      className="bg-[#2A2A2A] border border-gray-800 p-8 rounded-[2.5rem] hover:bg-[#333333] transition-all text-left group flex justify-between items-center"
                    >
                      <div>
                        <h3 className="text-4xl font-bold tracking-tighter group-hover:text-primary transition-colors">
                          {m.apartmentName || 'Unnamed Apartment'}
                        </h3>
                        <p className="text-xl text-gray-400 font-bold uppercase tracking-widest mt-2">
                          {m.role} • Joined {format(new Date(m.joinedAt), 'MMM yyyy')}
                        </p>
                      </div>
                      <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <LayoutDashboard className="h-8 w-8" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  <p className="text-2xl text-gray-500 font-bold uppercase tracking-widest italic">No apartments found for this account.</p>
                  <button 
                    onClick={() => window.location.href = '/auth'}
                    className="bg-primary text-white font-bold py-6 px-12 rounded-3xl text-2xl transition-all hover:scale-105 active:scale-95 shadow-2xl"
                  >
                    Setup New Space
                  </button>
                </div>
              )}
              
              <div className="pt-12 border-t border-gray-800">
                <div className="flex items-center justify-center space-x-4">
                  <img src={user.photoURL || ''} className="h-12 w-12 rounded-full border-2 border-primary/30" alt="User" />
                  <span className="text-xl font-bold text-gray-400">{user.displayName}</span>
                  <button onClick={() => logout()} className="text-danger text-lg font-bold uppercase tracking-widest ml-4 hover:underline">Logout</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tv-mode min-h-screen w-screen flex flex-col overflow-hidden">
      <div className="flex flex-col flex-1 scale-[0.98] origin-top">
        {/* Header */}
        <header className="flex justify-between items-center mb-12 px-8 pt-8">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight mb-2 text-white">{apartment?.name || 'Your Apartment'}</h1>
            <p className="text-xl text-slate-400 font-medium">Roommate OS</p>
          </div>
          <div className="text-right">
            <h2 className="text-6xl font-extrabold tracking-tighter text-white">{format(time, 'HH:mm')}</h2>
            <p className="text-2xl text-slate-400 font-medium">{format(time, 'EEEE, MMMM do')}</p>
          </div>
        </header>

        <div className="grid grid-cols-5 gap-8 flex-1 px-8 pb-8">
          {/* Shower Queue */}
          <TVShowerQueueWidget apartmentId={apartmentId || ''} />

          {/* Chores */}
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-400 uppercase tracking-wider">Pending Chores</h3>
              <CheckSquare className="h-8 w-8 text-white" />
            </div>
            <ul className="space-y-6">
              {chores.slice(0, 10).map((chore: any) => (
                <li key={chore.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-white text-xs font-bold mr-3">
                      {getMemberInitials(chore.assignedToUserId)}
                    </div>
                    <span className="text-2xl font-semibold text-white">{chore.title}</span>
                  </div>
                  <span className="text-lg text-slate-400 font-medium">{chore.dueDate ? format(new Date(chore.dueDate), 'MMM d') : 'No date'}</span>
                </li>
              ))}
              {chores.length === 0 && <li className="text-xl text-slate-500 font-medium">No pending chores!</li>}
            </ul>
          </div>

          {/* Groceries */}
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-400 uppercase tracking-wider">Grocery List</h3>
              <ShoppingCart className="h-8 w-8 text-white" />
            </div>
            <ul className="space-y-6">
              {groceries.slice(0, 10).map((item: any) => (
                <li key={item.id} className="flex items-center">
                  <span className="h-3 w-3 rounded-full bg-secondary mr-4"></span>
                  <span className="text-2xl font-semibold text-white">{item.name}</span>
                </li>
              ))}
              {groceries.length === 0 && <li className="text-xl text-slate-500 font-medium">List is empty</li>}
            </ul>
          </div>

          {/* Bills */}
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-400 uppercase tracking-wider">Upcoming Bills</h3>
              <Receipt className="h-8 w-8 text-white" />
            </div>
            <ul className="space-y-6">
              {expenses.slice(0, 8).map((exp: any) => (
                <li key={exp.id} className="bg-slate-950 p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xl font-semibold text-white">{exp.title || 'No Title'}</span>
                    <span className="text-2xl font-extrabold text-white">${exp.amount?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="text-slate-400 text-lg font-medium">Added: {exp.createdAt ? format(exp.createdAt.toDate(), 'MMM d') : 'Just now'}</div>
                </li>
              ))}
              {expenses.length === 0 && <li className="text-xl text-slate-500 font-medium">No upcoming bills!</li>}
            </ul>
          </div>

          {/* Announcements + Schedule */}
          <div className="space-y-8 flex flex-col">
            {/* Announcements */}
            <div className="bg-primary text-white rounded-3xl p-8 flex-1 flex flex-col justify-center">
              <div className="flex items-center text-sm font-bold uppercase tracking-wider mb-6 opacity-80">
                <Megaphone className="h-6 w-6 mr-3" />
                Latest Announcement
              </div>
              {announcements.length > 0 ? (
                <>
                  <p className="text-3xl font-semibold leading-tight mb-6">
                    "{announcements[0].content}"
                  </p>
                  <p className="text-lg opacity-80 font-medium">— Posted by Roommate</p>
                </>
              ) : (
                <p className="text-3xl font-semibold leading-tight mb-6">No recent announcements.</p>
              )}
            </div>

            {/* Schedule */}
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex-1">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-slate-400 uppercase tracking-wider">Schedule</h3>
                <CalendarDays className="h-8 w-8 text-white" />
              </div>
              <ul className="space-y-6">
                {events.slice(0, 5).map((event: any) => (
                  <li key={event.id} className="flex flex-col">
                    <span className="text-slate-400 text-lg font-medium mb-1">{event.startDatetime ? format(new Date(event.startDatetime), 'MMM d, h:mm a') : 'No date'}</span>
                    <span className="text-2xl font-semibold text-white">{event.title}</span>
                  </li>
                ))}
                {events.length === 0 && <li className="text-xl text-slate-500 font-medium">No upcoming events!</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
