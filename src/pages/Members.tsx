import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, User, Trash2, ShieldAlert, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmModal from '../components/ConfirmModal';
import { useTranslation } from 'react-i18next';

export default function Members() {
  const { user, apartmentId } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string, name: string } | null>(null);
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

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

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    const { id, name } = memberToRemove;
    try {
      await deleteDoc(doc(db, 'apartmentMembers', id));
      toast.success(t('members.removeSuccess', { name }));
      setMemberToRemove(null);
    } catch (err) {
      toast.error(t('members.removeError'));
      console.error(err);
    }
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'admin' ? 'member' : 'admin';
      await updateDoc(doc(db, 'apartmentMembers', memberId), {
        role: newRole
      });
      toast.success(t('members.roleSuccess', { role: t(`members.role_${newRole}`) }));
    } catch (err) {
      toast.error(t('members.roleError'));
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success(type === 'code' ? t('members.codeCopied') : t('members.linkCopied'));
    setTimeout(() => setCopied(null), 2000);
  };

  const inviteLink = inviteCode ? `${window.location.origin}/auth?join=${inviteCode}` : '';

  if (loading) return <LoadingScreen message={t('common.loading')} />;

  return (
    <div className="page-container space-y-6 md:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">{t('members.title')}</h1>
          <p className="text-text-secondary mt-1 text-sm md:text-base">{t('members.description')}</p>
        </div>
      </header>

      {inviteCode && (
        <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest leading-none mb-1">{t('members.inviteCode')}</p>
              <p className="text-lg font-black text-text-primary tracking-widest leading-none">{inviteCode}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => copyToClipboard(inviteCode, 'code')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 text-text-primary text-sm font-bold hover:bg-gray-100 transition-all active:scale-95 border border-gray-200/50"
            >
              {copied === 'code' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-text-secondary" />}
              {t('members.copyCode')}
            </button>
            <button
              onClick={() => copyToClipboard(inviteLink, 'link')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-sm shadow-primary/20"
            >
              {copied === 'link' ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
              {t('members.copyLink')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-text-primary text-sm md:text-base">{t('members.currentRoommates')}</h2>
          <div className="text-xs md:text-sm font-medium text-text-secondary">
            {t('members.total')} <span className="text-text-primary font-bold">{members.length}</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {members.map((member) => (
            <div key={member.id} className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-colors gap-4">
              <div className="flex items-center space-x-3 md:space-x-4 rtl:space-x-reverse">
                {member.user?.avatarUrl ? (
                  <img src={member.user.avatarUrl} alt="Avatar" className="h-10 w-10 md:h-12 md:w-12 rounded-full border border-gray-200" />
                ) : (
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg md:text-xl">
                    {member.user?.fullName?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-text-primary text-base md:text-lg flex items-center">
                    {member.user?.fullName || t('members.unknownUser')}
                    {member.role === 'admin' && <Shield className={`h-3 w-3 md:h-4 md:w-4 text-accent ${isRTL ? 'mr-2' : 'ml-2'}`} />}
                  </h3>
                  <p className="text-xs md:text-sm text-text-secondary">
                    {t('members.status')} <span>{t(`members.status_${member.status}`)}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end space-x-4 rtl:space-x-reverse">
                <span className={`text-[10px] md:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  member.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-text-primary'
                }`}>
                  {t(`members.role_${member.role}`)}
                </span>
                
                {isAdmin && member.userId !== user?.uid && (
                  <div className="flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
                    <button
                      onClick={() => handleToggleRole(member.id, member.role)}
                      className="p-1.5 md:p-2 text-gray-400 hover:text-primary transition-colors rounded-lg hover:bg-gray-100"
                      title={member.role === 'admin' ? t('members.removeAdmin') : t('members.makeAdmin')}
                    >
                      <ShieldAlert className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                    <button
                      onClick={() => setMemberToRemove({ id: member.id, name: member.user?.fullName || t('members.unknownUser') })}
                      className="p-1.5 md:p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      title={t('members.removeMember')}
                    >
                      <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="p-8 text-center text-text-secondary">{t('members.noMembers')}</div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!memberToRemove}
        title={t('members.removeMember')}
        message={t('members.removeConfirm', { name: memberToRemove?.name })}
        onConfirm={handleRemoveMember}
        onCancel={() => setMemberToRemove(null)}
      />
    </div>
  );
}
