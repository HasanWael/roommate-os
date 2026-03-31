import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { format, addMinutes, isBefore, isAfter, parseISO, differenceInSeconds, isToday, isTomorrow, startOfDay, endOfDay, addDays } from 'date-fns';
import { Droplets, Clock, Calendar as CalendarIcon, X, Plus, Play, ChevronRight, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';
import LoadingScreen from '../components/LoadingScreen';
import EmptyState from '../components/EmptyState';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { ar, enUS } from 'date-fns/locale';

interface ShowerSlot {
  id: string;
  apartmentId: string;
  userId: string;
  userName: string;
  duration: number;
  startTime: string;
  endTime: string;
  status: 'active' | 'scheduled' | 'completed' | 'cancelled';
  mode: 'now' | 'advance';
  createdAt: string;
}

export default function ShowerQueue() {
  const { user, apartment } = useAuth();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ar' ? ar : enUS;
  const [slots, setSlots] = useState<ShowerSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<'now' | 'advance'>('now');
  const [duration, setDuration] = useState<number>(15);
  const [advanceTime, setAdvanceTime] = useState<string>(format(addMinutes(new Date(), 30), 'HH:mm'));
  const [advanceDate, setAdvanceDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [nowTime, setNowTime] = useState<Date>(new Date());
  const [pendingBufferConflict, setPendingBufferConflict] = useState<{startTime: Date, endTime: Date} | null>(null);

  const hotWaterBuffer = apartment?.hotWaterBuffer ?? 20;

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const updatingSlots = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    // Auto-complete past slots and auto-start scheduled slots based on current time
    slots.forEach(slot => {
      if (updatingSlots.current.has(slot.id)) return;

      if (slot.status === 'active' && isAfter(nowTime, parseISO(slot.endTime))) {
        updatingSlots.current.add(slot.id);
        updateDoc(doc(db, 'showerSlots', slot.id), { status: 'completed' })
          .catch(console.error)
          .finally(() => updatingSlots.current.delete(slot.id));
      } else if (slot.status === 'scheduled' && isAfter(nowTime, parseISO(slot.startTime))) {
        updatingSlots.current.add(slot.id);
        updateDoc(doc(db, 'showerSlots', slot.id), { status: 'active' })
          .catch(console.error)
          .finally(() => updatingSlots.current.delete(slot.id));
      }
    });
  }, [nowTime, slots]);

  useEffect(() => {
    if (!apartment) return;

    const q = query(
      collection(db, 'showerSlots'),
      where('apartmentId', '==', apartment.id),
      where('status', 'in', ['active', 'scheduled'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSlots = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ShowerSlot[];

      setSlots(fetchedSlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'showerSlots');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [apartment]);

  const activeSlot = slots.find(s => {
    const start = parseISO(s.startTime);
    const end = parseISO(s.endTime);
    if (s.status === 'active' && isAfter(end, nowTime)) return true;
    return s.status === 'scheduled' && isBefore(start, nowTime) && isAfter(end, nowTime);
  });
  const myActiveSlot = slots.find(s => s.userId === user?.uid && (s.status === 'active' || s.status === 'scheduled') && isAfter(parseISO(s.endTime), nowTime));
  
  const upNextSlots = slots.filter(s => s.status === 'scheduled' && s.mode === 'now' && (!activeSlot || s.id !== activeSlot.id));
  const scheduledSlots = slots.filter(s => s.status === 'scheduled' && s.mode === 'advance');

  if (loading) return <LoadingScreen message={t('dashboard.loading')} />;

  const executeBooking = async (startTime: Date, endTime: Date) => {
    if (!user || !apartment) return;
    try {
      await addDoc(collection(db, 'showerSlots'), {
        apartmentId: apartment.id,
        userId: user.uid,
        userName: user.displayName || 'Roommate',
        duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: isBefore(startTime, addMinutes(new Date(), 1)) ? 'active' : 'scheduled',
        mode,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setPendingBufferConflict(null);
      toast.success(t('showerQueue.bookSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'showerSlots');
      toast.error(t('showerQueue.bookError'));
    }
  };

  const handleJoinQueue = async () => {
    if (!user || !apartment) return;

    let startTime = new Date();
    let endTime = addMinutes(startTime, duration);
    
    if (mode === 'advance') {
      if (!advanceTime || !advanceDate) {
        toast.error(t('showerQueue.selectDateTime'));
        return;
      }
      const [year, month, day] = advanceDate.split('-').map(Number);
      const [hours, minutes] = advanceTime.split(':').map(Number);
      startTime = new Date(year, month - 1, day, hours, minutes);
      
      const now = new Date();
      if (isBefore(startTime, addMinutes(now, -1))) {
        toast.error(t('showerQueue.pastBookingError'));
        return;
      }
      endTime = addMinutes(startTime, duration);

      let directConflict = false;
      let bufferConflict = false;

      slots.forEach(s => {
        if (s.status !== 'active' && s.status !== 'scheduled') return;
        const sStart = parseISO(s.startTime);
        const sEnd = parseISO(s.endTime);
        const sBufferEnd = addMinutes(sEnd, hotWaterBuffer);

        if (isBefore(startTime, sEnd) && isAfter(endTime, sStart)) {
          directConflict = true;
        } else if (isBefore(startTime, sBufferEnd) && isAfter(endTime, sEnd)) {
          bufferConflict = true;
        }
      });

      if (directConflict) {
        toast.error(t('showerQueue.directConflictError'));
        return;
      }

      if (bufferConflict) {
        setPendingBufferConflict({ startTime, endTime });
        return;
      }
    } else {
      // Find the earliest available time slot for 'now' mode
      let potentialStartTime = new Date();
      
      // Sort all active and scheduled slots by start time
      const upcomingSlots = slots.filter(s => s.status === 'active' || s.status === 'scheduled')
                                 .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      for (const slot of upcomingSlots) {
        const slotStart = parseISO(slot.startTime);
        const slotEndWithBuffer = addMinutes(parseISO(slot.endTime), hotWaterBuffer);
        
        let potentialEndTime = addMinutes(potentialStartTime, duration);
        
        // If our potential slot overlaps with this existing slot
        if (isBefore(potentialStartTime, slotEndWithBuffer) && isAfter(potentialEndTime, slotStart)) {
          // Push our potential start time to after this slot's end time + buffer
          potentialStartTime = slotEndWithBuffer;
        }
      }
      
      startTime = potentialStartTime;
      endTime = addMinutes(startTime, duration);
    }

    await executeBooking(startTime, endTime);
  };

  const handleCancel = async (slotId: string) => {
    try {
      await updateDoc(doc(db, 'showerSlots', slotId), { status: 'cancelled' });
      toast.success(t('showerQueue.cancelSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `showerSlots/${slotId}`);
      toast.error(t('showerQueue.cancelError'));
    }
  };

  const renderActiveCard = () => {
    if (!activeSlot) {
      return (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <EmptyState 
            icon={Droplets} 
            title={t('showerQueue.bathroomFree')} 
            description={t('showerQueue.bathroomFreeDesc')} 
            compact
          />
        </div>
      );
    }

    const totalSeconds = activeSlot.duration * 60;
    const remainingSeconds = Math.max(0, differenceInSeconds(parseISO(activeSlot.endTime), nowTime));
    const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
    
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    return (
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className={`absolute top-0 ${i18n.language === 'ar' ? 'left-0' : 'right-0'} p-6 md:p-8 opacity-10`}>
          <Droplets className="w-32 h-32 md:w-48 md:h-48" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 rtl:space-x-reverse mb-4 md:mb-6">
            <span className="flex h-3 w-3 md:h-4 md:w-4 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 md:h-4 md:w-4 bg-white"></span>
            </span>
            <span className="font-medium tracking-wide uppercase text-xs md:text-sm">{t('showerQueue.nowShowering')}</span>
          </div>
          
          <div className="flex justify-between items-end mb-6 md:mb-8">
            <div>
              <h2 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">{activeSlot.userName}</h2>
              <p className="text-blue-100 text-sm md:text-lg">{activeSlot.duration} {t('showerQueue.minSlot')}</p>
            </div>
            <div className={`text-${i18n.language === 'ar' ? 'left' : 'right'}`}>
              <div className="text-4xl md:text-6xl font-mono font-bold" dir="ltr">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </div>
              <p className="text-blue-100 text-xs md:text-base">{t('showerQueue.remaining')}</p>
            </div>
          </div>

          <div className="w-full bg-blue-900/30 rounded-full h-2 md:h-3 mb-2 md:mb-3">
            <div 
              className="bg-white h-2 md:h-3 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 p-4 md:p-8 pb-32">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-3">
            <Droplets className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            {t('showerQueue.title')}
          </h1>
          <p className="text-text-secondary mt-1 text-sm md:text-base">
            {t('showerQueue.description')}
          </p>
        </div>
        {myActiveSlot ? (
          <button
            onClick={() => handleCancel(myActiveSlot.id)}
            className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium flex items-center justify-center transition-colors shadow-sm text-sm md:text-base"
          >
            <X className={`h-4 w-4 md:h-5 md:w-5 ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {t('showerQueue.cancelSlot')}
          </button>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center transition-colors shadow-sm text-sm md:text-base"
          >
            <Plus className={`h-4 w-4 md:h-5 md:w-5 ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {t('showerQueue.joinQueue')}
          </button>
        )}
      </header>

      <div className="space-y-6">
        {/* Now Section */}
        <section>
          <h3 className="text-base md:text-lg font-bold text-text-primary mb-2">{t('showerQueue.now')}</h3>
          {renderActiveCard()}
        </section>

        {/* Up Next Section */}
        {upNextSlots.length > 0 && (
          <section>
            <h3 className="text-base md:text-lg font-bold text-text-primary mb-2">{t('showerQueue.upNext')}</h3>
            <div className="space-y-3 md:space-y-4">
              {upNextSlots.map((slot, index) => (
                <div key={slot.id}>
                  {index > 0 && (
                    <div className="flex items-center justify-center py-1 md:py-2 text-xs md:text-sm text-orange-500 font-medium">
                      <Clock className={`w-3 h-3 md:w-4 md:h-4 ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                      {hotWaterBuffer} {t('showerQueue.hotWaterBuffer')}
                    </div>
                  )}
                  <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-bold text-text-primary text-sm md:text-base">{slot.userName}</p>
                      <p className="text-[10px] md:text-sm text-text-secondary">
                        {format(parseISO(slot.startTime), 'h:mm a', { locale: dateLocale })} • {slot.duration} {t('showerQueue.mins')}
                      </p>
                    </div>
                    {slot.userId === user?.uid && (
                      <button 
                        onClick={() => handleCancel(slot.id)}
                        className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Scheduled Section */}
        {scheduledSlots.length > 0 && (
          <section>
            <h3 className="text-base md:text-lg font-bold text-text-primary mb-2">{t('showerQueue.scheduled')}</h3>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {scheduledSlots.map((slot, index) => (
                <div key={slot.id} className={`p-3 md:p-4 flex justify-between items-center ${index !== scheduledSlots.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex items-center">
                    <div className={`w-8 h-8 md:w-10 md:h-10 bg-gray-50 rounded-full flex items-center justify-center ${i18n.language === 'ar' ? 'ml-3 md:ml-4' : 'mr-3 md:mr-4'}`}>
                      <CalendarIcon className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-bold text-text-primary text-sm md:text-base">{slot.userName}</p>
                      <p className="text-[10px] md:text-sm text-text-secondary">
                        {isToday(parseISO(slot.startTime)) ? t('showerQueue.today') : isTomorrow(parseISO(slot.startTime)) ? t('showerQueue.tomorrow') : format(parseISO(slot.startTime), 'MMM d', { locale: dateLocale })} {t('showerQueue.at')} {format(parseISO(slot.startTime), 'h:mm a', { locale: dateLocale })} • {slot.duration} {t('showerQueue.mins')}
                      </p>
                    </div>
                  </div>
                  {slot.userId === user?.uid && (
                    <button 
                      onClick={() => handleCancel(slot.id)}
                      className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-md rounded-t-[2rem] md:rounded-[2rem] overflow-hidden shadow-2xl relative z-10"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">{t('showerQueue.bookSlot')}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Mode Selection */}
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setMode('now')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'now' ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary'}`}
                  >
                    {t('showerQueue.joinQueue')}
                  </button>
                  <button
                    onClick={() => setMode('advance')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'advance' ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary'}`}
                  >
                    {t('showerQueue.advanceBooking')}
                  </button>
                </div>

                {/* Duration Selection */}
                <div>
                  <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-3">{t('showerQueue.duration')}</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 15, 30, 45].map(d => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`py-3 rounded-xl font-bold text-sm transition-colors ${duration === d ? 'bg-blue-100 text-blue-700 border-2 border-blue-500' : 'bg-gray-50 text-text-secondary border-2 border-transparent hover:bg-gray-100'}`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advance Booking Time */}
                {mode === 'advance' && (
                  <div className="space-y-6">
                    {/* Quick Date Selector */}
                    <div>
                      <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-3">{t('showerQueue.date')}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: t('showerQueue.today'), value: format(new Date(), 'yyyy-MM-dd') },
                          { label: t('showerQueue.tomorrow'), value: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
                          { label: t('common.other'), value: 'other' }
                        ].map(d => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setAdvanceDate(d.value === 'other' ? format(addDays(new Date(), 2), 'yyyy-MM-dd') : d.value)}
                            className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
                              (d.value === 'other' ? (advanceDate !== format(new Date(), 'yyyy-MM-dd') && advanceDate !== format(addDays(new Date(), 1), 'yyyy-MM-dd')) : advanceDate === d.value)
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-gray-50 text-text-secondary hover:bg-gray-100'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                      
                      {/* Custom Date Input (only if not today/tomorrow) */}
                      {(advanceDate !== format(new Date(), 'yyyy-MM-dd') && advanceDate !== format(addDays(new Date(), 1), 'yyyy-MM-dd')) && (
                        <div className="mt-3 relative">
                          <CalendarDays className={`absolute ${i18n.language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400`} />
                          <input
                            type="date"
                            value={advanceDate}
                            min={format(new Date(), 'yyyy-MM-dd')}
                            max={format(addDays(new Date(), 7), 'yyyy-MM-dd')}
                            onChange={(e) => setAdvanceDate(e.target.value)}
                            className={`w-full bg-gray-50 border border-gray-200 rounded-xl ${i18n.language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 text-sm focus:ring-2 focus:ring-primary outline-none`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Time Selector */}
                    <div>
                      <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-3">{t('showerQueue.time')}</label>
                      <div className="relative">
                        <Clock className={`absolute ${i18n.language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400`} />
                        <input
                          type="time"
                          value={advanceTime}
                          onChange={(e) => setAdvanceTime(e.target.value)}
                          className={`w-full bg-gray-50 border border-gray-200 rounded-xl ${i18n.language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-4 text-2xl font-mono font-bold focus:ring-2 focus:ring-primary outline-none text-center`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleJoinQueue}
                  className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors shadow-lg active:scale-[0.98] transition-all"
                >
                  {t('showerQueue.confirmBooking')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!pendingBufferConflict}
        title={t('showerQueue.hotWaterWarning')}
        message={t('showerQueue.hotWaterWarningMsg', { buffer: hotWaterBuffer })}
        confirmText={t('showerQueue.bookAnyway')}
        cancelText={t('showerQueue.cancel')}
        type="warning"
        onConfirm={() => {
          if (pendingBufferConflict) {
            executeBooking(pendingBufferConflict.startTime, pendingBufferConflict.endTime);
          }
        }}
        onCancel={() => setPendingBufferConflict(null)}
      />
    </div>
  );
}
