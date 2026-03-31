import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { format, isBefore, isAfter, parseISO, differenceInSeconds, isToday, isTomorrow } from 'date-fns';
import { Droplets, Clock, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
}

export default function DashboardShowerWidget() {
  const { apartment } = useAuth();
  const [slots, setSlots] = useState<ShowerSlot[]>([]);
  const [nowTime, setNowTime] = useState<Date>(new Date());
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!apartment) return;

    const q = query(
      collection(db, 'showerSlots'),
      where('apartmentId', '==', apartment.id),
      where('status', 'in', ['active', 'scheduled']),
      orderBy('startTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSlots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShowerSlot[];
      setSlots(fetchedSlots);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'showerSlots');
    });

    return () => unsubscribe();
  }, [apartment]);

  const activeSlot = slots.find(s => {
    const start = parseISO(s.startTime);
    const end = parseISO(s.endTime);
    if (s.status === 'active' && isAfter(end, nowTime)) return true;
    return s.status === 'scheduled' && isBefore(start, nowTime) && isAfter(end, nowTime);
  });

  const upcomingSlots = slots
    .filter(s => {
      const start = parseISO(s.startTime);
      return s.id !== activeSlot?.id && isAfter(start, nowTime);
    })
    .slice(0, 3);

  if (!activeSlot && upcomingSlots.length === 0) return null;

  const renderActiveSlot = () => {
    if (!activeSlot) return null;

    const totalSeconds = activeSlot.duration * 60;
    const remainingSeconds = Math.max(0, differenceInSeconds(parseISO(activeSlot.endTime), nowTime));
    const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
    
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="flex items-center">
        <div className={`relative w-20 h-20 ${i18n.language === 'ar' ? 'ml-6' : 'mr-6'} flex-shrink-0`}>
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r={radius} fill="none" stroke="#10B981" strokeWidth="4"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-mono font-bold text-sm">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex-1">
          <div className="inline-flex items-center bg-emerald-500/20 rounded-full px-2 py-0.5 mb-2">
            <span className={`flex h-1.5 w-1.5 relative ${i18n.language === 'ar' ? 'ml-1.5' : 'mr-1.5'}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">{t('dashboard.nowShowering')}</span>
          </div>
          <h3 className="text-white text-xl font-bold leading-tight">{activeSlot.userName}</h3>
          <p className="text-gray-400 text-xs">{activeSlot.duration} {t('dashboard.minSlot')}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-text-primary text-white rounded-3xl p-6 flex flex-col relative overflow-hidden shadow-2xl mb-8">
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
        <Droplets className="h-24 w-24 rotate-12" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <Droplets className={`h-4 w-4 ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {t('dashboard.showerQueue')}
          </div>
          {!activeSlot && (
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded-lg">
              {t('showerQueue.bathroomFree')}
            </div>
          )}
        </div>

        <div className={`grid grid-cols-1 ${upcomingSlots.length > 0 ? 'md:grid-cols-2' : ''} gap-8 items-start`}>
          {activeSlot ? renderActiveSlot() : (
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center">
                <Droplets className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t('showerQueue.bathroomFree')}</h3>
                <p className="text-xs text-gray-400">{t('showerQueue.bathroomFreeDesc')}</p>
              </div>
            </div>
          )}

          {upcomingSlots.length > 0 && (
            <div className={`space-y-3 ${activeSlot ? (i18n.language === 'ar' ? 'md:border-r md:pr-8' : 'md:border-l md:pl-8') : ''} border-white/10`}>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                {t('showerQueue.upNext')}
              </div>
              {upcomingSlots.map((slot) => {
                const startTime = parseISO(slot.startTime);
                return (
                  <div key={slot.id} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl group hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px]">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{slot.userName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <Clock className="h-3 w-3" />
                          {isToday(startTime) ? t('showerQueue.today') : isTomorrow(startTime) ? t('showerQueue.tomorrow') : format(startTime, 'MMM d')}
                          {' '}{t('showerQueue.at')}{' '}
                          {format(startTime, 'h:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                      {slot.duration}m
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
