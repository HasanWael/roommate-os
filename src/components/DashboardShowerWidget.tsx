import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { format, isBefore, isAfter, parseISO, differenceInSeconds } from 'date-fns';
import { Droplets } from 'lucide-react';

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
  const [activeSlot, setActiveSlot] = useState<ShowerSlot | null>(null);
  const [nowTime, setNowTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!apartment) return;

    const q = query(
      collection(db, 'showerSlots'),
      where('apartmentId', '==', apartment.id),
      where('status', 'in', ['active', 'scheduled'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShowerSlot[];
      const current = slots.find(s => s.status === 'active' || (s.status === 'scheduled' && isBefore(parseISO(s.startTime), new Date()) && isAfter(parseISO(s.endTime), new Date())));
      setActiveSlot(current || null);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'showerSlots');
    });

    return () => unsubscribe();
  }, [apartment]);

  if (!activeSlot) return null;

  const totalSeconds = activeSlot.duration * 60;
  const remainingSeconds = Math.max(0, differenceInSeconds(parseISO(activeSlot.endTime), nowTime));
  const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;

  // Calculate SVG circle properties
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="bg-text-primary text-white rounded-3xl p-8 flex flex-col relative overflow-hidden shadow-2xl mb-6">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <Droplets className="h-32 w-32 rotate-12" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center text-xs font-bold uppercase tracking-widest mb-6 text-primary">
          <Droplets className="h-5 w-5 mr-3" />
          Shower Queue
        </div>
        
        <div className="flex items-center">
          {/* Circular Timer */}
          <div className="relative w-24 h-24 mr-8 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
              {/* Background circle */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="4"
              />
              {/* Progress circle */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="#10B981"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-mono font-bold text-lg">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="inline-flex items-center bg-white rounded-full px-3 py-1 mb-3">
              <span className="flex h-2 w-2 relative mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-700 text-xs font-bold uppercase tracking-wider">Now showering</span>
            </div>
            
            <h3 className="text-white text-3xl font-bold mb-1">{activeSlot.userName}</h3>
            <p className="text-gray-400 text-sm mb-4">{activeSlot.duration} min slot</p>
            
            {/* Linear Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-[#10B981] h-2 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
