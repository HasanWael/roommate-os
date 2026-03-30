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

  if (loading) return <div className="tv-mode min-h-screen flex items-center justify-center text-2xl font-display font-black tracking-tighter">INITIALIZING COMMAND CENTER...</div>;

  if (!apartmentId) {
    return (
      <div className="tv-mode min-h-screen flex flex-col items-center justify-center p-12 text-center">
        <h1 className="text-6xl font-black tracking-tighter mb-8 opacity-20">NO COMMAND CENTER ACTIVE</h1>
        <p className="text-2xl font-bold text-white/40 uppercase tracking-widest">Please select an apartment to view TV Mode</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tv-dark text-white p-8 font-sans overflow-hidden">
      <div className="max-w-[1600px] mx-auto scale-[0.98] origin-top transition-transform duration-700">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-6xl font-display font-black tracking-tighter text-white">
              {apartment?.name || 'Apartment'}
            </h1>
            <p className="text-text-muted text-2xl mt-2 font-medium">
              {format(time, 'EEEE, MMMM do')}
            </p>
          </div>
          <div className="text-right">
            <div className="text-8xl font-display font-bold tracking-tight text-white leading-none">
              {format(time, 'HH:mm')}
            </div>
            <div className="text-text-muted text-xl font-medium uppercase tracking-[0.3em] mt-2">
              {format(time, 'ss')} SECONDS
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-10">
          {/* Left Column: Announcements & Chores */}
          <div className="col-span-2 space-y-10">
            {/* Announcements */}
            <div className="bg-white/5 backdrop-blur-2xl rounded-[3rem] p-12 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 opacity-5">
                <Megaphone className="h-64 w-64 rotate-12" />
              </div>
              <div className="flex items-center space-x-6 mb-10 relative z-10">
                <div className="p-4 bg-primary/20 rounded-3xl">
                  <Megaphone className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-4xl font-display font-bold tracking-tight">Announcements</h2>
              </div>
              <div className="space-y-8 relative z-10">
                {announcements.length > 0 ? (
                  announcements.map(announcement => (
                    <div key={announcement.id} className="bg-white/5 p-10 rounded-[2.5rem] border border-white/5 hover:bg-white/10 transition-all">
                      <h3 className="text-3xl font-bold mb-4 text-white">{announcement.title}</h3>
                      <p className="text-gray-300 text-2xl leading-relaxed font-medium">{announcement.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-text-muted text-2xl italic font-medium">No recent announcements</p>
                )}
              </div>
            </div>

            {/* Chores Grid */}
            <div className="bg-white/5 backdrop-blur-2xl rounded-[3rem] p-12 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center space-x-6">
                  <div className="p-4 bg-info/20 rounded-3xl">
                    <CheckSquare className="h-10 w-10 text-info" />
                  </div>
                  <h2 className="text-4xl font-display font-bold tracking-tight">Active Chores</h2>
                </div>
                <div className="text-2xl font-bold text-success flex items-center bg-success/10 px-6 py-2 rounded-full border border-success/20">
                  {Math.round((1 - (chores.length / 10)) * 100)}% COMPLETE
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                {chores.map(chore => (
                  <div key={chore.id} className="bg-white/5 p-8 rounded-[2rem] border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all">
                    <div>
                      <h3 className="text-2xl font-bold text-white">{chore.title}</h3>
                      <p className="text-text-muted text-lg mt-1 font-bold uppercase tracking-widest">
                        {chore.assignedToName || 'Anyone'}
                      </p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-info/20 flex items-center justify-center text-info text-xl font-black border border-info/30">
                      {getMemberInitials(chore.assignedToUserId)}
                    </div>
                  </div>
                ))}
                {chores.length === 0 && <p className="col-span-2 text-center text-success text-2xl font-bold py-10">All chores completed! 🎉</p>}
              </div>
            </div>
          </div>

          {/* Right Column: Bills & Groceries */}
          <div className="space-y-10">
            {/* Bills */}
            <div className="bg-white/5 backdrop-blur-2xl rounded-[3rem] p-12 border border-white/10 shadow-2xl">
              <div className="flex items-center space-x-6 mb-10">
                <div className="p-4 bg-warning/20 rounded-3xl">
                  <Receipt className="h-10 w-10 text-warning" />
                </div>
                <h2 className="text-4xl font-display font-bold tracking-tight">Pending Bills</h2>
              </div>
              <div className="space-y-6">
                {expenses.map(expense => (
                  <div key={expense.id} className="flex justify-between items-center p-8 bg-warning/10 rounded-[2.5rem] border border-warning/20 shadow-lg">
                    <span className="text-2xl font-bold text-white">{expense.title}</span>
                    <span className="text-3xl font-display font-black text-warning">${expense.amount.toFixed(2)}</span>
                  </div>
                ))}
                {expenses.length === 0 && <p className="text-success text-2xl font-bold text-center py-6">All bills paid! 💸</p>}
              </div>
            </div>

            {/* Groceries */}
            <div className="bg-white/5 backdrop-blur-2xl rounded-[3rem] p-12 border border-white/10 shadow-2xl flex-1">
              <div className="flex items-center space-x-6 mb-10">
                <div className="p-4 bg-success/20 rounded-3xl">
                  <ShoppingCart className="h-10 w-10 text-success" />
                </div>
                <h2 className="text-4xl font-display font-bold tracking-tight">Grocery List</h2>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {groceries.map(item => (
                  <div key={item.id} className="flex items-center space-x-6 p-6 bg-white/5 rounded-[1.5rem] border border-white/5 hover:bg-white/10 transition-all">
                    <div className="h-4 w-4 rounded-full bg-success shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-2xl font-medium text-white">{item.name}</span>
                  </div>
                ))}
                {groceries.length === 0 && <p className="text-text-muted text-2xl italic text-center py-6">List is empty</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
