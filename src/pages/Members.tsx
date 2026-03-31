import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, User, Trash2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import LoadingScreen from '../components/LoadingScreen';

export default function Members() {
  const { user, apartmentId } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    if (!apartmentId) return;

    // Fetch apartment invite code
    const fetchApartment = async () => {
      try {
        const aptDoc = await getDoc(doc(db, 'apartments', apartmentId));
        if (aptDoc.exists()) {
          setInviteCode(aptDoc.data().inviteCode);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `apartments/${apartmentId}`);
      }
    };
    fetchApartment();

    // Listen to apartment members
    const q = query(collection(db, 'apartmentMembers'), where('apartmentId', '==', apartmentId));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('Members snapshot received, docs:', snapshot.docs.length);
      const memberDocs = snapshot.docs;
      try {
        const memberData = await Promise.all(memberDocs.map(async (memberDoc) => {
          const data = memberDoc.data();
          try {
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            if (!userDoc.exists()) {
              console.warn(`User document not found for userId: ${data.userId}`);
            }
            return {
              id: memberDoc.id,
              ...data,
              user: userDoc.exists() ? userDoc.data() : null
            };
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${data.userId}`);
            return { id: memberDoc.id, ...data, user: null };
          }
        }));
        setMembers(memberData);
        setLoading(prev => prev ? false : prev);
      } catch (err) {
        console.error('Error processing member data:', err);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'apartmentMembers');
    });

    return () => unsubscribe();
  }, [apartmentId]);

  const currentUserMember = members.find(m => m.userId === user?.uid);
  const isAdmin = currentUserMember?.role === 'admin';

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from the apartment?`)) return;
    try {
      await deleteDoc(doc(db, 'apartmentMembers', memberId));
      toast.success(`${memberName} has been removed.`);
    } catch (err) {
      toast.error('Failed to remove member.');
      console.error(err);
    }
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'admin' ? 'member' : 'admin';
      await updateDoc(doc(db, 'apartmentMembers', memberId), {
        role: newRole
      });
      toast.success(`Role updated to ${newRole}.`);
    } catch (err) {
      toast.error('Failed to update member role.');
      console.error(err);
    }
  };

  if (loading) return <LoadingScreen message="Loading members..." />;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Apartment Members</h1>
          <p className="text-text-secondary mt-1">Manage roommates and permissions.</p>
        </div>
        {inviteCode && (
          <div className="bg-gray-100 px-4 py-2 rounded-lg font-medium flex items-center border border-gray-200">
            <span className="text-text-secondary mr-2 text-sm">Invite Code:</span>
            <span className="text-primary font-bold tracking-widest">{inviteCode}</span>
          </div>
        )}
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-text-primary">Current Roommates</h2>
          <div className="text-sm font-medium text-text-secondary">
            Total: <span className="text-text-primary font-bold">{members.length}</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {members.map((member) => (
            <div key={member.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                {member.user?.avatarUrl ? (
                  <img src={member.user.avatarUrl} alt="Avatar" className="h-12 w-12 rounded-full border border-gray-200" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl">
                    {member.user?.fullName?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-text-primary text-lg flex items-center">
                    {member.user?.fullName || 'Unknown User'}
                    {member.role === 'admin' && <Shield className="h-4 w-4 ml-2 text-accent" />}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Status: <span className="capitalize">{member.status}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  member.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-text-primary'
                }`}>
                  {member.role}
                </span>
                
                {isAdmin && member.userId !== user?.uid && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleRole(member.id, member.role)}
                      className="p-2 text-gray-400 hover:text-primary transition-colors rounded-lg hover:bg-gray-100"
                      title={member.role === 'admin' ? "Remove Admin" : "Make Admin"}
                    >
                      <ShieldAlert className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleRemoveMember(member.id, member.user?.fullName || 'Unknown User')}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      title="Remove Member"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="p-8 text-center text-text-secondary">No members found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
