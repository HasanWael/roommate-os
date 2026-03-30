import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { format, addMinutes, isBefore, isAfter, parseISO, differenceInSeconds, isToday, isTomorrow, startOfDay, endOfDay } from 'date-fns';
import { Droplets, Clock, Calendar as CalendarIcon, X, Plus, Play } from 'lucide-react';
import { toast } from 'sonner';

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
  const [slots, setSlots] = useState<ShowerSlot[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<'now' | 'advance'>('now');
  const [duration, setDuration] = useState<number>(15);
  const [advanceTime, setAdvanceTime] = useState<string>('');
  const [advanceDate, setAdvanceDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [nowTime, setNowTime] = useState<Date>(new Date());

  const hotWaterBuffer = apartment?.hotWaterBuffer ?? 20;

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
      const fetchedSlots = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ShowerSlot[];
      
      // Auto-complete past slots and auto-start scheduled slots
      fetchedSlots.forEach(slot => {
        if (slot.status === 'active' && isAfter(new Date(), parseISO(slot.endTime))) {
          updateDoc(doc(db, 'showerSlots', slot.id), { status: 'completed' }).catch(console.error);
        } else if (slot.status === 'scheduled' && isAfter(new Date(), parseISO(slot.startTime))) {
          updateDoc(doc(db, 'showerSlots', slot.id), { status: 'active' }).catch(console.error);
        }
      });

      setSlots(fetchedSlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'showerSlots');
    });

    return () => unsubscribe();
  }, [apartment]);

  const activeSlot = slots.find(s => s.status === 'active' || (s.status === 'scheduled' && isBefore(parseISO(s.startTime), nowTime) && isAfter(parseISO(s.endTime), nowTime)));
  const myActiveSlot = slots.find(s => s.userId === user?.uid && (s.status === 'active' || s.status === 'scheduled'));
  
  const upNextSlots = slots.filter(s => s.status === 'scheduled' && s.mode === 'now' && (!activeSlot || s.id !== activeSlot.id));
  const scheduledSlots = slots.filter(s => s.status === 'scheduled' && s.mode === 'advance');

  const handleJoinQueue = async () => {
    if (!user || !apartment) return;

    let startTime = new Date();
    let endTime = addMinutes(startTime, duration);
    
    if (mode === 'advance') {
      if (!advanceTime || !advanceDate) {
        toast.error('Please select date and time');
        return;
      }
      startTime = new Date(`${advanceDate}T${advanceTime}`);
      if (isBefore(startTime, new Date())) {
        toast.error('Cannot book in the past');
        return;
      }
      endTime = addMinutes(startTime, duration);

      // Check for conflicts for advance booking
      const hasConflict = slots.some(s => {
        if (s.status !== 'active' && s.status !== 'scheduled') return false;
        const sStart = parseISO(s.startTime);
        const sEnd = addMinutes(parseISO(s.endTime), hotWaterBuffer); // Include buffer
        return (isBefore(startTime, sEnd) && isAfter(endTime, sStart));
      });

      if (hasConflict) {
        toast.error('This time slot conflicts with an existing booking or buffer period.');
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
      toast.success('Shower slot booked!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'showerSlots');
      toast.error('Failed to book slot');
    }
  };

  const handleCancel = async (slotId: string) => {
    try {
      await updateDoc(doc(db, 'showerSlots', slotId), { status: 'cancelled' });
      toast.success('Slot cancelled');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `showerSlots/${slotId}`);
      toast.error('Failed to cancel slot');
    }
  };

  const renderActiveCard = () => {
    if (!activeSlot) {
      return (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Droplets className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Bathroom is free</h2>
          <p className="text-text-secondary">No one is currently showering.</p>
        </div>
      );
    }

    const totalSeconds = activeSlot.duration * 60;
    const remainingSeconds = Math.max(0, differenceInSeconds(parseISO(activeSlot.endTime), nowTime));
    const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
    
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    return (
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Droplets className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-6">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="font-medium tracking-wide uppercase text-xs">Now showering</span>
          </div>
          
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-1">{activeSlot.userName}</h2>
              <p className="text-blue-100">{activeSlot.duration} min slot</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-mono font-bold">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </div>
              <p className="text-blue-100 text-sm">remaining</p>
            </div>
          </div>

          <div className="w-full bg-blue-900/30 rounded-full h-2 mb-2">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-8 pb-32">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Shower Queue</h1>
          <p className="text-text-secondary mt-1">Manage bathroom time and hot water</p>
        </div>
        {myActiveSlot ? (
          <button
            onClick={() => handleCancel(myActiveSlot.id)}
            className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium flex items-center transition-colors shadow-sm"
          >
            <X className="h-5 w-5 mr-2" />
            Cancel Slot
          </button>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" />
            Join Queue
          </button>
        )}
      </header>

      <div className="space-y-8">
        {/* Now Section */}
        <section>
          <h3 className="text-lg font-bold text-text-primary mb-4">Now</h3>
          {renderActiveCard()}
        </section>

        {/* Up Next Section */}
        {upNextSlots.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-text-primary mb-4">Up Next</h3>
            <div className="space-y-4">
              {upNextSlots.map((slot, index) => (
                <div key={slot.id}>
                  {index > 0 && (
                    <div className="flex items-center justify-center py-2 text-sm text-orange-500 font-medium">
                      <Clock className="w-4 h-4 mr-2" />
                      {hotWaterBuffer} min hot water buffer
                    </div>
                  )}
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-bold text-text-primary">{slot.userName}</p>
                      <p className="text-sm text-text-secondary">
                        {format(parseISO(slot.startTime), 'h:mm a')} • {slot.duration} mins
                      </p>
                    </div>
                    {slot.userId === user?.uid && (
                      <button 
                        onClick={() => handleCancel(slot.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
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
            <h3 className="text-lg font-bold text-text-primary mb-4">Scheduled</h3>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {scheduledSlots.map((slot, index) => (
                <div key={slot.id} className={`p-4 flex justify-between items-center ${index !== scheduledSlots.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mr-4">
                      <CalendarIcon className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-bold text-text-primary">{slot.userName}</p>
                      <p className="text-sm text-text-secondary">
                        {isToday(parseISO(slot.startTime)) ? 'Today' : isTomorrow(parseISO(slot.startTime)) ? 'Tomorrow' : format(parseISO(slot.startTime), 'MMM d')} at {format(parseISO(slot.startTime), 'h:mm a')} • {slot.duration} mins
                      </p>
                    </div>
                  </div>
                  {slot.userId === user?.uid && (
                    <button 
                      onClick={() => handleCancel(slot.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-text-primary">Book a Slot</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
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
                  Join Queue
                </button>
                <button
                  onClick={() => setMode('advance')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'advance' ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary'}`}
                >
                  Advance Booking
                </button>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-3">Duration</label>
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
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-2">Date</label>
                    <input
                      type="date"
                      value={advanceDate}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      max={format(addMinutes(new Date(), 48 * 60), 'yyyy-MM-dd')}
                      onChange={(e) => setAdvanceDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-2">Time</label>
                    <input
                      type="time"
                      value={advanceTime}
                      onChange={(e) => setAdvanceTime(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleJoinQueue}
                className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
