import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { AlertTriangle, Trash2, Save, Home, Globe } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '../components/EmptyState';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const navigate = useNavigate();
  const { user, apartment, setApartmentId, memberships } = useAuth();
  const { t, i18n } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');
  const [hotWaterBuffer, setHotWaterBuffer] = useState<number>(20);
  const [isSavingBuffer, setIsSavingBuffer] = useState(false);

  useEffect(() => {
    if (apartment?.hotWaterBuffer !== undefined) {
      setHotWaterBuffer(apartment.hotWaterBuffer);
    }
  }, [apartment]);

  const currentMembership = memberships.find(m => m.apartmentId === apartment?.id);
  const isAdmin = apartment && (apartment.createdBy === user?.uid || currentMembership?.role === 'admin' || user?.email === 'hwmk2004@gmail.com');

  const handleSaveBuffer = async () => {
    if (!isAdmin || !apartment) return;
    setIsSavingBuffer(true);
    try {
      await updateDoc(doc(db, 'apartments', apartment.id), {
        hotWaterBuffer: Number(hotWaterBuffer)
      });
      toast.success(t('settings.bufferSuccess'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `apartments/${apartment.id}`);
      toast.error(t('settings.bufferError'));
    } finally {
      setIsSavingBuffer(false);
    }
  };

  const handleDeleteApartment = async () => {
    if (!isAdmin || !apartment || !user) return;
    if (confirmName !== apartment.name) {
      setError(t('settings.deleteMatchError'));
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
      setError(t('settings.deleteError'));
      setIsDeleting(false);
    }
  };

  if (!apartment || !user) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-text-primary mb-6 tracking-tight">{t('settings.title')}</h1>
        <EmptyState 
          icon={Home} 
          title={t('settings.noApartment')} 
          description={t('settings.noApartmentDesc')} 
          actionLabel={t('settings.goToDashboard')}
          onAction={() => navigate('/')}
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-text-primary mb-6 tracking-tight">{t('settings.title')}</h1>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-text-secondary">{t('settings.adminOnly')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto pb-32">
      <h1 className="text-2xl md:text-3xl font-black text-text-primary mb-2 tracking-tight">{t('settings.title')}</h1>
      <p className="subheading mb-6 md:mb-8 text-sm md:text-base">{t('settings.description')}</p>

      <div className="space-y-6 md:space-y-8">
        {/* Language Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-gray-100 flex items-center">
            <Globe className={`w-5 h-5 ${i18n.language === 'ar' ? 'ml-3' : 'mr-3'} text-primary`} />
            <h2 className="font-bold text-text-primary text-sm md:text-base">{t('settings.languageSettings')}</h2>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            <div>
              <label className="block text-[10px] md:text-xs font-bold text-text-primary uppercase tracking-wider mb-2">
                {t('settings.appLanguage')}
              </label>
              <div className="flex items-center gap-2">
                <LanguageSwitcher className="bg-gray-50 border border-gray-200 px-3 md:px-4 py-2 text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Invitation */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-gray-100">
            <h2 className="font-bold text-text-primary text-sm md:text-base">{t('settings.invitation')}</h2>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            <div>
              <label className="block text-[10px] md:text-xs font-bold text-text-primary uppercase tracking-wider mb-2">
                {t('settings.inviteCode')}
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2">
                <code className="w-full sm:w-auto bg-gray-100 px-4 py-2 rounded-lg font-mono text-base md:text-lg text-center sm:text-left">{apartment.inviteCode}</code>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/auth?inviteCode=${apartment.inviteCode}`;
                    navigator.clipboard.writeText(link);
                    toast.success(t('settings.inviteCopied'));
                  }}
                  className="w-full sm:w-auto bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  {t('settings.copyInviteLink')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-gray-100">
            <h2 className="font-bold text-text-primary text-sm md:text-base">{t('settings.showerQueueSettings')}</h2>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            <div>
              <label className="block text-[10px] md:text-xs font-bold text-text-primary uppercase tracking-wider mb-2">
                {t('settings.hotWaterBuffer')}
              </label>
              <p className="text-xs md:text-sm text-text-secondary mb-4">
                {t('settings.hotWaterBufferDesc')}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={hotWaterBuffer}
                  onChange={(e) => setHotWaterBuffer(Number(e.target.value))}
                  className="w-24 md:w-32 bg-gray-50 border border-gray-200 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                />
                <button
                  onClick={handleSaveBuffer}
                  disabled={isSavingBuffer || hotWaterBuffer === apartment.hotWaterBuffer || (hotWaterBuffer === 20 && apartment.hotWaterBuffer === undefined)}
                  className="flex-1 sm:flex-none bg-primary text-white px-4 py-2.5 md:py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Save className={`w-4 h-4 ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                  {isSavingBuffer ? t('settings.saving') : t('settings.save')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="p-4 md:p-6 bg-red-50 border-b border-red-100 flex items-center">
            <AlertTriangle className={`text-red-600 ${i18n.language === 'ar' ? 'ml-3' : 'mr-3'} h-5 w-5`} />
            <h2 className="font-bold text-red-900 text-sm md:text-base">{t('settings.dangerZone')}</h2>
          </div>
          <div className="p-4 md:p-6 space-y-6">
            <div>
              <h3 className="text-base md:text-lg font-bold text-text-primary mb-2">{t('settings.deleteApartment')}</h3>
              <p className="text-xs md:text-sm text-text-secondary mb-4">
                {t('settings.deleteWarning1')} <strong>{apartment.name}</strong> {t('settings.deleteWarning2')}
              </p>
              
              {error && <p className="text-red-500 text-xs md:text-sm mb-4">{error}</p>}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] md:text-xs font-bold text-text-primary uppercase tracking-wider mb-2">
                    {t('settings.typeToConfirm')} "{apartment.name}"
                  </label>
                  <input
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={apartment.name}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 md:py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>
                
                <button
                  onClick={handleDeleteApartment}
                  disabled={isDeleting || confirmName !== apartment.name}
                  className={`w-full flex items-center justify-center px-4 py-2.5 md:py-3 rounded-lg font-bold text-sm transition-all ${
                    confirmName === apartment.name 
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className={`h-4 w-4 ${i18n.language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                  {isDeleting ? t('settings.deleting') : t('settings.permanentlyDelete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
