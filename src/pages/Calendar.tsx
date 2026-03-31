import { useState, useEffect } from 'react';
import { CalendarDays, Plus, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useMembers } from '../hooks/useMembers';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import { useTranslation } from 'react-i18next';
import { ar, enUS } from 'date-fns/locale';

export default function Calendar() {
  const { user, apartmentId } = useAuth();
  const { members } = useMembers();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ar' ? ar : enUS;
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventType, setNewEventType] = useState('general');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!apartmentId) return;

    const q = query(
      collection(db, 'calendarEvents'),
      where('apartmentId', '==', apartmentId),
      orderBy('startDatetime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(prev => prev ? false : prev);
    });

    return () => unsubscribe();
  }, [apartmentId]);

  const handleAddEvent = async (e: any) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate || !apartmentId || !user) return;

    try {
      await addDoc(collection(db, 'calendarEvents'), {
        apartmentId,
        title: newEventTitle,
        description: '',
        startDatetime: new Date(newEventDate).toISOString(),
        endDatetime: new Date(newEventDate).toISOString(), // Simplified for MVP
        eventType: newEventType,
        assignedToUserId: assignedToUserId || null,
        createdBy: user.displayName || 'Roommate',
        createdByUserId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewEventTitle('');
      setNewEventDate('');
      setNewEventType('general');
      setAssignedToUserId('');
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding event: ", error);
    }
  };

  const confirmDelete = (eventId: string) => {
    setItemToDelete(eventId);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'calendarEvents', itemToDelete));
      toast.success(t('calendar.deleteSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `calendarEvents/${itemToDelete}`);
      toast.error(t('calendar.deleteError'));
    } finally {
      setItemToDelete(null);
    }
  };

  const getAssignedUserName = (userId: string) => {
    if (!userId) return t('calendar.everyone');
    const member = members.find(m => m.userId === userId);
    return member?.user?.fullName || 'Unknown';
  };

  if (loading) return <LoadingScreen message={t('dashboard.loading')} />;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" />
            {t('calendar.title')}
          </h1>
          <p className="text-text-secondary mt-1">
            {t('calendar.description')}
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
        >
          <Plus className={`h-5 w-5 ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`} />
          {isAdding ? t('calendar.cancel') : t('calendar.addEvent')}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddEvent} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('calendar.eventTitle')}</label>
            <input 
              type="text" 
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder={t('calendar.eventTitlePlaceholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('calendar.dateTime')}</label>
            <input 
              type="datetime-local" 
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('calendar.type')}</label>
            <select 
              value={newEventType}
              onChange={(e) => setNewEventType(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="general">{t('calendar.general')}</option>
              <option value="maintenance">{t('calendar.maintenance')}</option>
              <option value="social">{t('calendar.social')}</option>
              <option value="bill">{t('calendar.bill')}</option>
            </select>
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('calendar.assignTo')}</label>
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">{t('calendar.everyone')}</option>
              {members.map(member => (
                <option key={member.userId} value={member.userId}>
                  {member.user?.fullName || 'Unknown'}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors">
            {t('calendar.save')}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-text-primary">{t('calendar.upcomingEvents')}</h2>
          <div className="text-sm font-medium text-text-secondary">
            {t('calendar.total')} <span className="text-text-primary font-bold">{events.length}</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {events.map((event) => (
            <div key={event.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-6 rtl:space-x-reverse">
                <div className="text-center">
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">
                    {event.startDatetime ? format(new Date(event.startDatetime), 'MMM', { locale: dateLocale }) : ''}
                  </p>
                  <p className="text-3xl font-bold text-text-primary">
                    {event.startDatetime ? format(new Date(event.startDatetime), 'd', { locale: dateLocale }) : ''}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-lg">{event.title}</h3>
                  <div className="flex items-center mt-1 space-x-2 rtl:space-x-reverse">
                    <p className="text-sm text-text-secondary flex items-center">
                      <Clock className={`h-4 w-4 ${i18n.language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                      {event.startDatetime ? format(new Date(event.startDatetime), 'h:mm a', { locale: dateLocale }) : ''}
                    </p>
                    {event.assignedToUserId && (
                      <div className={`flex items-center space-x-1 rtl:space-x-reverse ${i18n.language === 'ar' ? 'border-r pr-2' : 'border-l pl-2'} border-gray-200`}>
                        <div className="h-4 w-4 rounded-full bg-primary text-white flex items-center justify-center text-[8px] font-bold overflow-hidden">
                          {(() => {
                            const assigned = members.find(m => m.userId === event.assignedToUserId);
                            if (assigned?.user?.avatarUrl) {
                              return <img src={assigned.user.avatarUrl} alt={getAssignedUserName(event.assignedToUserId)} className="h-full w-full object-cover" />;
                            }
                            return getAssignedUserName(event.assignedToUserId).charAt(0);
                          })()}
                        </div>
                        <span className="text-sm text-text-secondary">{t('calendar.for')} {getAssignedUserName(event.assignedToUserId)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold px-3 py-1 bg-gray-200 text-text-primary rounded-full uppercase tracking-wider">
                  {t(`calendar.${event.eventType}`)}
                </span>
                <button 
                  onClick={() => confirmDelete(event.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-2"
                  title={t('calendar.deleteEvent')}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="p-8">
              <EmptyState 
                icon={CalendarDays} 
                title={t('calendar.noEvents')} 
                description={t('calendar.noEventsDesc')} 
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!itemToDelete}
        title={t('calendar.deleteTitle')}
        message={t('calendar.deleteMessage')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
