import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Cloud, Droplets, Wind, Receipt, CheckSquare, ShoppingCart, Megaphone, CalendarDays } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';

export default function TVMode() {
  const { apartmentId, apartment } = useAuth();
  const { members } = useMembers();
  const [time, setTime] = useState(new Date());
  const [expenses, setExpenses] = useState<any[]>([]);
  const [chores, setChores] = useState<any[]>([]);
  const [groceries, setGroceries] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!apartmentId) return;

    // Fetch Expenses
    const qExpenses = query(collection(db, 'expenses'), where('apartmentId', '==', apartmentId), orderBy('createdAt', 'desc'), limit(5));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Chores
    const qChores = query(collection(db, 'chores'), where('apartmentId', '==', apartmentId), where('status', '==', 'pending'), limit(5));
    const unsubChores = onSnapshot(qChores, (snapshot) => {
      setChores(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Groceries
    const qGroceries = query(collection(db, 'groceries'), where('apartmentId', '==', apartmentId), where('status', '==', 'needed'), limit(5));
    const unsubGroceries = onSnapshot(qGroceries, (snapshot) => {
      setGroceries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Events
    const qEvents = query(collection(db, 'calendarEvents'), where('apartmentId', '==', apartmentId), orderBy('startDatetime', 'asc'), limit(5));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Announcements
    const qAnnouncements = query(collection(db, 'announcements'), where('apartmentId', '==', apartmentId), orderBy('createdAt', 'desc'), limit(1));
    const unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(prev => prev ? false : prev);
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

  if (loading) return <div className="tv-mode min-h-screen flex items-center justify-center text-2xl">Loading Command Screen...</div>;

  return (
    <div className="tv-mode min-h-screen p-8 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-5xl font-bold tracking-tight mb-2">{apartment?.name || 'Your Apartment'}</h1>
          <p className="text-xl text-gray-400">Roommate OS</p>
        </div>
        <div className="text-right">
          <h2 className="text-6xl font-bold tracking-tighter">{format(time, 'HH:mm')}</h2>
          <p className="text-2xl text-gray-400">{format(time, 'EEEE, MMMM do')}</p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-8 flex-1">
        {/* Left Column: Weather & Announcements */}
        <div className="space-y-8 flex flex-col">
          {/* Weather Widget */}
          <div className="bg-[#2A2A2A] rounded-3xl p-8 border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-400 uppercase tracking-wider">Weather</h3>
              <Cloud className="h-8 w-8 text-white" />
            </div>
            <div className="flex items-end space-x-4 mb-6">
              <span className="text-7xl font-bold tracking-tighter">72°</span>
              <span className="text-2xl text-gray-400 pb-2">Partly Cloudy</span>
            </div>
            <div className="flex space-x-6 text-gray-400">
              <div className="flex items-center"><Droplets className="h-5 w-5 mr-2" /> 12%</div>
              <div className="flex items-center"><Wind className="h-5 w-5 mr-2" /> 8 mph</div>
            </div>
          </div>

          {/* Announcements */}
          <div className="bg-primary text-white rounded-3xl p-8 flex-1 flex flex-col justify-center">
            <div className="flex items-center text-sm font-bold uppercase tracking-wider mb-6 opacity-80">
              <Megaphone className="h-6 w-6 mr-3" />
              Latest Announcement
            </div>
            {announcements.length > 0 ? (
              <>
                <p className="text-3xl font-medium leading-tight mb-6">
                  "{announcements[0].content}"
                </p>
                <p className="text-lg opacity-80">— Posted by {announcements[0].authorId}</p>
              </>
            ) : (
              <p className="text-3xl font-medium leading-tight mb-6">No recent announcements.</p>
            )}
          </div>
        </div>

        {/* Middle Column: Chores & Groceries */}
        <div className="space-y-8 flex flex-col">
          {/* Chores */}
          <div className="bg-[#2A2A2A] rounded-3xl p-8 border border-gray-800 flex-1">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-400 uppercase tracking-wider">Pending Chores</h3>
              <CheckSquare className="h-8 w-8 text-white" />
            </div>
            <ul className="space-y-6">
              {chores.slice(0, 4).map((chore: any) => (
                <li key={chore.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold mr-3">
                      {getMemberInitials(chore.assignedToUserId)}
                    </div>
                    <span className="text-2xl font-medium">{chore.title}</span>
                  </div>
                  <span className="text-lg text-gray-400">{chore.dueDate ? format(new Date(chore.dueDate), 'MMM d') : 'No date'}</span>
                </li>
              ))}
              {chores.length === 0 && <li className="text-xl text-gray-500">No pending chores!</li>}
            </ul>
          </div>

          {/* Groceries */}
          <div className="bg-[#2A2A2A] rounded-3xl p-8 border border-gray-800 flex-1">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-400 uppercase tracking-wider">Grocery List</h3>
              <ShoppingCart className="h-8 w-8 text-white" />
            </div>
            <ul className="space-y-6">
              {groceries.slice(0, 4).map((item: any) => (
                <li key={item.id} className="flex items-center">
                  <span className="h-3 w-3 rounded-full bg-secondary mr-4"></span>
                  <span className="text-2xl font-medium">{item.name}</span>
                </li>
              ))}
              {groceries.length === 0 && <li className="text-xl text-gray-500">List is empty</li>}
            </ul>
          </div>
        </div>

        {/* Right Column: Bills & Events */}
        <div className="space-y-8 flex flex-col">
          {/* Bills */}
          <div className="bg-[#2A2A2A] rounded-3xl p-8 border border-gray-800 flex-1">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-400 uppercase tracking-wider">Upcoming Bills</h3>
              <Receipt className="h-8 w-8 text-white" />
            </div>
            <ul className="space-y-6">
              {expenses.slice(0, 3).map((exp: any) => (
                <li key={exp.id} className="bg-[#1A1A1A] p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xl font-medium">{exp.title}</span>
                    <span className="text-2xl font-bold">${exp.amount.toFixed(2)}</span>
                  </div>
                  <div className="text-gray-400 text-lg">Added: {exp.createdAt ? format(exp.createdAt.toDate(), 'MMM d') : 'Just now'}</div>
                </li>
              ))}
              {expenses.length === 0 && <li className="text-xl text-gray-500">No upcoming bills!</li>}
            </ul>
          </div>

          {/* Events */}
          <div className="bg-[#2A2A2A] rounded-3xl p-8 border border-gray-800 flex-1">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-400 uppercase tracking-wider">Schedule</h3>
              <CalendarDays className="h-8 w-8 text-white" />
            </div>
            <ul className="space-y-6">
              {events.slice(0, 3).map((event: any) => (
                <li key={event.id} className="flex flex-col">
                  <span className="text-gray-400 text-lg mb-1">{event.startDatetime ? format(new Date(event.startDatetime), 'MMM d, h:mm a') : 'No date'}</span>
                  <span className="text-2xl font-medium">{event.title}</span>
                </li>
              ))}
              {events.length === 0 && <li className="text-xl text-gray-500">No upcoming events!</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
