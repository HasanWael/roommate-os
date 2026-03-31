import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { format, parseISO, differenceInSeconds, isToday, isTomorrow } from 'date-fns';
import { Droplets } from 'lucide-react';

interface ShowerSlot {
  id: string;
  userName: string;
  duration: number;
  startTime: string;
  endTime: string;
  status: 'active' | 'scheduled' | 'completed' | 'cancelled';
  mode: 'now' | 'advance';
}

export default function TVShowerQueueWidget({ apartmentId }: { apartmentId: string }) {
  const [slots, setSlots] = useState<ShowerSlot[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!apartmentId) return;

    const q = query(
      collection(db, 'showerSlots'),
      where('apartmentId', '==', apartmentId),
      where('status', 'in', ['active', 'scheduled'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSlots = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ShowerSlot[];

      // Filter for slots that are active, or scheduled for today/tomorrow
      const filteredSlots = fetchedSlots.filter(s => {
        if (s.status === 'active') return true;
        const startTime = parseISO(s.startTime);
        return isToday(startTime) || isTomorrow(startTime);
      });

      setSlots(filteredSlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    });

    return () => unsubscribe();
  }, [apartmentId]);

  // Find active slot: either explicitly active, or scheduled and currently happening
  const activeSlot = slots.find(s => {
    if (s.status === 'active') return true;
    const start = parseISO(s.startTime);
    const end = parseISO(s.endTime);
    return s.status === 'scheduled' && now >= start && now < end;
  });

  // Find upcoming slots: scheduled, not the active one, and ending in the future
  const upNext = slots.filter(s =>
    s.status === 'scheduled' &&
    (!activeSlot || s.id !== activeSlot.id) &&
    parseISO(s.endTime) > now
  );

  const nextPerson = upNext[0];
  const remainingQueue = upNext.slice(1);

  const formatSlotTime = (startTimeStr: string) => {
    const date = parseISO(startTimeStr);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isTomorrow(date)) {
      return `Tom ${format(date, 'HH:mm')}`;
    }
    return format(date, 'MMM d, HH:mm');
  };

  const renderNow = () => {
    if (!activeSlot) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <div className="w-32 h-32 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
            <Droplets className="h-16 w-16 text-slate-600" />
          </div>
          <h2 className="text-4xl font-bold text-slate-500">Bathroom is free</h2>
        </div>
      );
    }

    const totalSeconds = activeSlot.duration * 60;
    const remainingSeconds = Math.max(0, differenceInSeconds(parseISO(activeSlot.endTime), now));
    const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;

    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    // SVG circle properties
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = (progress / 100) * circumference;

    return (
      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <div className="flex items-center space-x-3 mb-6">
          <span className="flex h-4 w-4 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 text-xl font-bold uppercase tracking-widest">Now showering</span>
        </div>

        <h2 className="text-5xl font-black text-white mb-8 text-center tracking-tight">{activeSlot.userName}</h2>

        {/* Circular Timer */}
        <div className="relative w-56 h-56 mb-8">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            {/* Background circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#10B981"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-white font-mono font-bold text-5xl tracking-tighter">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-4 mb-2 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex flex-col h-full shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Shower Queue</h3>
        <Droplets className="h-8 w-8 text-white" />
      </div>

      {renderNow()}

      {/* Up Next */}
      {nextPerson && (
        <div className="mt-auto pt-6 border-t border-slate-800/50">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">Up Next</p>
          <div className="flex justify-between items-center bg-slate-800/30 p-5 rounded-2xl border border-slate-800">
            <span className="text-2xl font-bold text-white">{nextPerson.userName}</span>
            <span className="text-xl text-emerald-400 font-mono font-bold">
              {formatSlotTime(nextPerson.startTime)}
            </span>
          </div>
        </div>
      )}

      {/* Remaining Queue */}
      {remainingQueue.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800/30 flex-1 overflow-hidden flex flex-col">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3">Queue</p>
          <ul className="space-y-2 overflow-y-auto pr-2 flex-1">
            {remainingQueue.map(slot => (
              <li key={slot.id} className="flex justify-between items-center opacity-40">
                <span className="text-lg font-semibold text-white">{slot.userName}</span>
                <span className="text-base text-slate-400 font-mono">{formatSlotTime(slot.startTime)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
