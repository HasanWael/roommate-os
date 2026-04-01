import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, CheckSquare, ShoppingCart, CalendarDays, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { isPast, isToday, isTomorrow, format, parseISO } from 'date-fns';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import LoadingScreen from '../components/LoadingScreen';
import DashboardShowerWidget from '../components/DashboardShowerWidget';
import EmptyState from '../components/EmptyState';
import { formatCurrency } from '../lib/format';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { user, apartmentId, apartment } = useAuth();
  const { members } = useMembers();
  const { t, i18n } = useTranslation();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [chores, setChores] = useState<any[]>([]);
  const [completingChores, setCompletingChores] = useState<Set<string>>(new Set());
  const [groceries, setGroceries] = useState<any[]>([]);
  const [completingGroceries, setCompletingGroceries] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<any[]>([]);
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
    const qChores = query(collection(db, 'chores'), where('apartmentId', '==', apartmentId));
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
      setLoading(prev => prev ? false : prev);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'calendarEvents');
    });

    return () => {
      unsubExpenses();
      unsubChores();
      unsubGroceries();
      unsubEvents();
    };
  }, [apartmentId]);

  const getMemberInitials = (userId: string) => {
    const member = members.find(m => m.userId === userId);
    if (member && member.user && member.user.fullName) {
      return member.user.fullName.charAt(0).toUpperCase();
    }
    return '?';
  };

  const toggleChoreStatus = async (choreId: string) => {
    if (completingChores.has(choreId)) return;
    
    // Start animation
    setCompletingChores(prev => new Set(prev).add(choreId));
    
    // Wait for animation to play
    setTimeout(async () => {
      try {
        await deleteDoc(doc(db, 'chores', choreId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `chores/${choreId}`);
      } finally {
        setCompletingChores(prev => {
          const next = new Set(prev);
          next.delete(choreId);
          return next;
        });
      }
    }, 600);
  };

  const toggleGroceryStatus = async (itemId: string) => {
    if (completingGroceries.has(itemId)) return;
    
    // Start animation
    setCompletingGroceries(prev => new Set(prev).add(itemId));
    
    // Wait for animation to play
    setTimeout(async () => {
      try {
        await deleteDoc(doc(db, 'groceries', itemId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `groceries/${itemId}`);
      } finally {
        setCompletingGroceries(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    }, 600);
  };

  const pendingChores = chores.filter(c => c.status === 'pending')
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  const myNextChore = pendingChores.find(c => c.assignedToUserId === user?.uid);
  const nextUpText = myNextChore ? myNextChore.title : (pendingChores[0]?.title || t('dashboard.allCaughtUp'));

  const totalChores = chores.length;
  const completedChores = chores.filter(c => c.status === 'completed').length;
  const choreProgress = totalChores === 0 ? 100 : Math.round((completedChores / totalChores) * 100);

  const neededGroceries = groceries.filter(g => g.status !== 'purchased');

  if (loading) return <LoadingScreen message={t('dashboard.loading')} />;

  return (
    <div className="page-container space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-text-primary tracking-tight">
            {t('dashboard.greeting')}, <span className="text-primary">{(() => {
              const currentUserMember = members.find(m => m.userId === user?.uid);
              return currentUserMember?.user?.fullName || user?.displayName || t('dashboard.roommate');
            })()}</span>.
          </h1>
          <p className="subheading mt-2 md:mt-3 max-w-2xl">
            {t('dashboard.statusText1')} <span className="font-semibold text-text-primary">{apartment?.name || t('dashboard.yourApartment')}</span> {t('dashboard.statusText2')}
          </p>
        </div>
        <div className="flex gap-3 rtl:flex-row-reverse">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Bills Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col transform transition-transform hover:scale-[1.01]">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-warning-light rounded-2xl border border-warning-light">
              <Receipt className="h-6 w-6 md:h-8 md:w-8 text-warning-dark" />
            </div>
            <span className="badge bg-warning-light text-warning-dark text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full uppercase tracking-widest">
              {expenses.length} {t('dashboard.pending')}
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-semibold mb-1 text-text-primary">{t('dashboard.billsTitle')}</h3>
          <p className="text-text-secondary text-xs md:text-sm mb-6 md:mb-8">{t('dashboard.totalOutstanding')}: <span className="font-bold text-text-primary">EGP {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0), 2)}</span></p>
          
          <div className="mt-auto space-y-4">
            {expenses.slice(0, 2).map(expense => (
              <div key={expense.id} className="flex justify-between items-center text-sm bg-warning-light/30 p-3 rounded-xl border border-warning-light/50">
                <span className="font-medium text-text-primary">{expense.title}</span>
                <span className="font-bold text-warning-dark">EGP {formatCurrency(expense.amount, 2)}</span>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-sm text-success font-bold">{t('dashboard.allBillsPaid')}</p>}
          </div>

          <Link to="/expenses" className="w-full block text-center bg-gray-50 text-text-primary hover:bg-gray-100 font-bold py-3 rounded-2xl text-sm transition-all shadow-sm active:scale-95 mt-6 uppercase">
            {t('dashboard.viewExpenses')}
          </Link>
        </div>

        {/* Chores Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col transform transition-transform hover:scale-[1.01]">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-info-light rounded-2xl border border-info-light">
              <CheckSquare className="h-6 w-6 md:h-8 md:w-8 text-info-dark" />
            </div>
            <span className="badge bg-info-light text-info-dark text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full uppercase tracking-widest">
              {pendingChores.length} {t('dashboard.active')}
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-semibold mb-1 text-text-primary">{t('dashboard.choresTitle')}</h3>
          <p className="text-text-secondary text-xs md:text-sm mb-4 md:mb-6">{t('dashboard.nextUp')}: <span className="font-bold text-text-primary">{nextUpText}</span></p>
          
          <div className="space-y-3 mb-6 flex-1">
            {pendingChores.slice(0, 3).map(chore => {
              const dueDate = chore.dueDate ? parseISO(chore.dueDate) : null;
              const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
              const assignedMember = members.find(m => m.userId === chore.assignedToUserId);
              const isCompleting = completingChores.has(chore.id);

              return (
                <div 
                  key={chore.id} 
                  onClick={() => toggleChoreStatus(chore.id)}
                  className={`flex justify-between items-center text-sm p-3 rounded-xl border cursor-pointer transition-all duration-500 ${
                    isCompleting
                      ? 'bg-gray-100 border-gray-200 opacity-60 scale-95'
                      : isOverdue 
                        ? 'bg-red-50 border-red-100 hover:bg-red-100/80 hover:shadow-sm' 
                        : 'bg-info-light/30 border-info-light/50 hover:bg-info-light/60 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {isCompleting ? (
                      <CheckCircle2 className="flex-shrink-0 h-6 w-6 text-info-dark transition-all duration-500 scale-110" />
                    ) : (
                      <Circle className={`flex-shrink-0 h-6 w-6 transition-colors opacity-40 hover:opacity-100 ${isOverdue ? 'text-red-500' : 'text-info-dark'}`} />
                    )}
                    <div className="truncate">
                      <p className={`font-medium truncate transition-all duration-500 ${isCompleting ? 'text-gray-400 line-through' : 'text-text-primary'}`}>{chore.title}</p>
                      <p className={`text-xs transition-all duration-500 ${isCompleting ? 'text-gray-400' : isOverdue ? 'text-red-600 font-bold' : 'text-text-secondary'}`}>
                        {dueDate ? (isToday(dueDate) ? t('dashboard.today') : isTomorrow(dueDate) ? t('dashboard.tomorrow') : format(dueDate, 'MMM d')) : t('dashboard.noDate')}
                      </p>
                    </div>
                  </div>
                  {assignedMember && (
                    <div className={`flex-shrink-0 h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold overflow-hidden ${i18n.language === 'ar' ? 'mr-2' : 'ml-2'} transition-opacity duration-500 ${isCompleting ? 'opacity-40' : 'opacity-100'}`} title={assignedMember.user?.fullName}>
                      {assignedMember.user?.avatarUrl ? (
                        <img src={assignedMember.user.avatarUrl} alt={assignedMember.user.fullName} className="h-full w-full object-cover" />
                      ) : (
                        getMemberInitials(assignedMember.userId)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {pendingChores.length === 0 && (
              <div className="text-sm text-success font-bold text-center py-4">{t('dashboard.allCaughtUp')}</div>
            )}
          </div>

          <Link to="/chores" className="w-full block text-center bg-gray-50 text-text-primary hover:bg-gray-100 font-bold py-3 rounded-2xl text-sm transition-all shadow-sm active:scale-95 mt-auto uppercase">
            {t('dashboard.viewChores')}
          </Link>
        </div>

        {/* Groceries Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col transform transition-transform hover:scale-[1.01]">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-success-light rounded-2xl border border-success-light">
              <ShoppingCart className="h-6 w-6 md:h-8 md:w-8 text-success-dark" />
            </div>
            <span className="badge bg-success-light text-success-dark text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full uppercase tracking-widest">
              {neededGroceries.length} {t('dashboard.items')}
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-semibold mb-1 text-text-primary">{t('dashboard.groceriesTitle')}</h3>
          <p className="text-text-secondary text-xs md:text-sm mb-4 md:mb-6">{neededGroceries.length} {t('dashboard.itemsNeeded')}</p>
          
          <ul className="space-y-3 mb-6 flex-1">
            {neededGroceries.slice(0, 3).map(item => {
              const isCompleting = completingGroceries.has(item.id);
              const addedByMember = members.find(m => m.userId === item.addedByUserId);
              return (
                <li 
                  key={item.id} 
                  onClick={() => toggleGroceryStatus(item.id)}
                  className={`flex justify-between items-center text-sm p-3 rounded-xl border cursor-pointer transition-all duration-500 ${
                    isCompleting 
                      ? 'bg-gray-100 border-gray-200 opacity-60 scale-95' 
                      : 'bg-success-light/30 border-success-light/50 hover:bg-success-light/60 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {isCompleting ? (
                      <CheckCircle2 className="flex-shrink-0 h-6 w-6 text-success-dark transition-all duration-500 scale-110" />
                    ) : (
                      <Circle className="flex-shrink-0 h-6 w-6 text-success-dark opacity-40 hover:opacity-100 transition-opacity" />
                    )}
                    <div className="truncate">
                      <p className={`font-medium truncate transition-all duration-500 ${isCompleting ? 'text-gray-400 line-through' : 'text-text-primary'}`}>
                        {item.name}
                      </p>
                      <p className={`text-xs transition-all duration-500 ${isCompleting ? 'text-gray-400' : 'text-text-secondary'}`}>
                        {t('dashboard.qty')}: {item.quantity || 1}
                      </p>
                    </div>
                  </div>
                  {addedByMember && (
                    <div className={`flex-shrink-0 h-6 w-6 rounded-full bg-success text-white flex items-center justify-center text-[10px] font-bold overflow-hidden ${i18n.language === 'ar' ? 'mr-2' : 'ml-2'} transition-opacity duration-500 ${isCompleting ? 'opacity-40' : 'opacity-100'}`} title={addedByMember.user?.fullName}>
                      {addedByMember.user?.avatarUrl ? (
                        <img src={addedByMember.user.avatarUrl} alt={addedByMember.user.fullName} className="h-full w-full object-cover" />
                      ) : (
                        getMemberInitials(addedByMember.userId)
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {neededGroceries.length === 0 && (
              <li className="text-sm text-success-dark font-medium italic">{t('dashboard.fridgeFull')}</li>
            )}
          </ul>
          <Link to="/groceries" className="w-full block text-center bg-primary text-white hover:bg-primary-dark font-bold py-3 rounded-2xl text-sm transition-all shadow-lg active:scale-95 uppercase">
            {t('dashboard.addItems')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Schedule */}
        <div className="md:col-span-2 lg:col-span-3 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <h3 className="text-lg md:text-xl font-semibold text-text-primary">{t('dashboard.upcomingEvents')}</h3>
            <button className="text-[10px] md:text-sm font-bold text-primary hover:text-primary-dark transition-colors flex items-center uppercase">
              {t('dashboard.fullCalendar')}
              <CalendarDays className={`${i18n.language === 'ar' ? 'mr-2' : 'ml-2'} h-4 w-4`} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.slice(0, 3).map(event => (
              <div key={event.id} className="group cursor-pointer">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2 bg-primary/10 inline-block px-2 py-1 rounded">
                  {new Date(event.startDatetime).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <h4 className="font-semibold text-text-primary text-base group-hover:text-primary transition-colors">{event.title}</h4>
                <p className="text-sm text-text-secondary flex items-center mt-1">
                  <span className={`w-2 h-2 rounded-full bg-primary ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`}></span>
                  {new Date(event.startDatetime).toLocaleTimeString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            {events.length === 0 && (
              <div className="col-span-3 py-12">
                <EmptyState 
                  icon={CalendarDays} 
                  title={t('dashboard.noEvents')} 
                  description={t('dashboard.noEventsDesc')} 
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
