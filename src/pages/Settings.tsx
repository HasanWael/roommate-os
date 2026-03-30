import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { user, apartment, setApartmentId, memberships } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');

  const currentMembership = memberships.find(m => m.apartmentId === apartment?.id);
  const isAdmin = apartment?.createdBy === user?.uid || currentMembership?.role === 'admin' || user?.email === 'hwmk2004@gmail.com';

  const handleDeleteApartment = async () => {
    if (!isAdmin || !apartment || !user) return;
    if (confirmName !== apartment.name) {
      setError('Apartment name does not match.');
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      // 1. Delete all sub-collections EXCEPT apartmentMembers in chunks
      const collections = ['expenses', 'chores', 'groceries', 'calendarEvents', 'announcements', 'inviteCodes'];
      
      for (const collName of collections) {
        const q = query(collection(db, collName), where('apartmentId', '==', apartment.id));
        const snap = await getDocs(q);
        
        // Split into chunks of 500
        for (let i = 0; i < snap.docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = snap.docs.slice(i, i + 500);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }

      // 2. Delete apartment itself
      await deleteDoc(doc(db, 'apartments', apartment.id));

      // 3. Delete apartmentMembers
      const membersQuery = query(collection(db, 'apartmentMembers'), where('apartmentId', '==', apartment.id));
      const membersSnap = await getDocs(membersQuery);
      for (let i = 0; i < membersSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = membersSnap.docs.slice(i, i + 500);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      
      setApartmentId(null);
      navigate('/auth');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `apartments/${apartment.id}`);
      setError('Failed to delete apartment. Please try again.');
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-6">Settings</h1>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-text-secondary">Only the creator or administrators of this apartment can access these settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-text-primary mb-2">Settings</h1>
      <p className="text-text-secondary mb-8">Manage your apartment configuration and data.</p>

      <div className="space-y-8">
        {/* Danger Zone */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-bold text-text-primary">Invitation</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-2">
                Invite Code
              </label>
              <div className="flex items-center space-x-2">
                <code className="bg-gray-100 px-4 py-2 rounded-lg font-mono text-lg">{apartment.inviteCode}</code>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/auth?inviteCode=${apartment.inviteCode}`;
                    navigator.clipboard.writeText(link);
                    alert('Invite link copied to clipboard!');
                  }}
                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  Copy Invite Link
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="p-6 bg-red-50 border-b border-red-100 flex items-center">
            <AlertTriangle className="text-red-600 mr-3 h-5 w-5" />
            <h2 className="font-bold text-red-900">Danger Zone</h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Delete Apartment</h3>
              <p className="text-sm text-text-secondary mb-4">
                This action is permanent and cannot be undone. All data associated with <strong>{apartment.name}</strong> will be permanently deleted, including bills, chores, and member history.
              </p>
              
              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-primary uppercase tracking-wider mb-2">
                    Type "{apartment.name}" to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={apartment.name}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                
                <button
                  onClick={handleDeleteApartment}
                  disabled={isDeleting || confirmName !== apartment.name}
                  className={`w-full flex items-center justify-center px-4 py-3 rounded-lg font-bold text-sm transition-all ${
                    confirmName === apartment.name 
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? 'Deleting...' : 'Permanently Delete Apartment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
