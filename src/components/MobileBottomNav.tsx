import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Droplets, Trash2, ShoppingCart, Receipt, CalendarDays, CheckSquare, Users, Settings, Repeat, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';

export default function MobileBottomNav() {
  const { t, i18n } = useTranslation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { setApartmentId } = useAuth();
  const navigate = useNavigate();

  const mainTabs = [
    { name: t('nav.home', 'Home'), path: '/dashboard', icon: Home },
    { name: t('nav.showerQueue', 'Shower Queue'), path: '/shower-queue', icon: Droplets },
    { name: t('nav.trashTurn', 'Trash Turn'), path: '/trash-turn', icon: Trash2 },
    { name: t('nav.groceries', 'Groceries'), path: '/groceries', icon: ShoppingCart },
    { name: t('nav.bills', 'Bills'), path: '/expenses', icon: Receipt },
  ];

  const handleSwitchApartment = () => {
    setApartmentId(null);
    setIsDrawerOpen(false);
    navigate('/auth');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <div className="lg:hidden">
      {/* Drag Handle (More Button) */}
      <div 
        className="fixed left-0 right-0 flex justify-center z-40 pointer-events-none"
        style={{ bottom: 'calc(65px + env(safe-area-inset-bottom))' }}
      >
        <button 
          onClick={() => setIsDrawerOpen(true)}
          className="pointer-events-auto flex flex-col items-center justify-center bg-white/80 backdrop-blur-md shadow-sm border border-gray-200/50 text-slate-500 hover:text-primary transition-colors"
          style={{ borderRadius: '1rem', padding: '0.5rem 1.5rem' }}
        >
          <div className="w-8 h-1 bg-slate-300 rounded-full mb-1" />
          <span className="text-[0.7rem] font-bold uppercase tracking-wider">{t('common.more', 'More')}</span>
        </button>
      </div>

      {/* Bottom Navbar */}
      <nav 
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex justify-around items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))', paddingTop: '0.5rem' }}
      >
        {mainTabs.map((tab) => (
          <NavLink
            key={tab.name}
            to={tab.path}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center w-full space-y-1 transition-colors ${
                isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
              }`
            }
          >
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.85 }}
                className="flex flex-col items-center justify-center w-full"
              >
                <motion.div
                  animate={{ 
                    y: isActive ? -2 : 0,
                    scale: isActive ? 1.1 : 1
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <tab.icon className="w-6 h-6" />
                </motion.div>
                <span className="text-[0.7rem] font-semibold text-center leading-none mt-1">{tab.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute -top-2 w-8 h-1 bg-primary rounded-b-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Swipe-Up Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setIsDrawerOpen(false);
                }
              }}
              className="fixed bottom-0 left-0 right-0 bg-white z-[70] rounded-t-[1.5rem] shadow-2xl flex flex-col"
              style={{ maxHeight: '60vh' }}
            >
              <div className="flex justify-center p-4 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>
              
              <div 
                className="overflow-y-auto scrollbar-hide px-6 space-y-6"
                style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
              >
                {/* Navigation */}
                <div>
                  <h3 className="text-[0.75rem] uppercase text-slate-400 font-bold tracking-wider mb-3">{t('nav.navigation', 'Navigation')}</h3>
                  <div className="space-y-2">
                    <NavLink to="/calendar" onClick={() => setIsDrawerOpen(false)} className="flex items-center p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mr-4 rtl:ml-4 rtl:mr-0 text-primary">
                        <CalendarDays className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{t('nav.calendar', 'Calendar')}</div>
                        <div className="text-xs text-slate-500">{t('calendar.description', 'Manage events')}</div>
                      </div>
                    </NavLink>
                    <NavLink to="/chores" onClick={() => setIsDrawerOpen(false)} className="flex items-center p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mr-4 rtl:ml-4 rtl:mr-0 text-primary">
                        <CheckSquare className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{t('nav.chores', 'Chores')}</div>
                        <div className="text-xs text-slate-500">{t('chores.description', 'Manage chores')}</div>
                      </div>
                    </NavLink>
                  </div>
                </div>

                <div className="h-px bg-slate-200 w-full" />

                {/* Settings */}
                <div>
                  <h3 className="text-[0.75rem] uppercase text-slate-400 font-bold tracking-wider mb-3">{t('nav.settings', 'Settings')}</h3>
                  <div className="space-y-2">
                    <NavLink to="/members" onClick={() => setIsDrawerOpen(false)} className="flex items-center p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mr-4 rtl:ml-4 rtl:mr-0 text-slate-600">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{t('nav.members', 'Members')}</div>
                        <div className="text-xs text-slate-500">{t('members.description', 'Manage roommates')}</div>
                      </div>
                    </NavLink>
                    <NavLink to="/settings" onClick={() => setIsDrawerOpen(false)} className="flex items-center p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mr-4 rtl:ml-4 rtl:mr-0 text-slate-600">
                        <Settings className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{t('nav.settings', 'Settings')}</div>
                        <div className="text-xs text-slate-500">{t('settings.description', 'App settings')}</div>
                      </div>
                    </NavLink>
                    <button onClick={handleSwitchApartment} className="w-full flex items-center p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors text-left rtl:text-right">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mr-4 rtl:ml-4 rtl:mr-0 text-slate-600">
                        <Repeat className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{t('nav.switchApartment', 'Switch Apartment')}</div>
                        <div className="text-xs text-slate-500">{t('nav.switchApartmentDesc', 'Change active space')}</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-200 w-full" />

                {/* Language */}
                <div>
                  <button onClick={toggleLanguage} className="w-full flex items-center p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors text-left rtl:text-right">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mr-4 rtl:ml-4 rtl:mr-0 text-primary">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{t('settings.appLanguage', 'Language')}</div>
                      <div className="text-xs text-slate-500">{i18n.language === 'en' ? 'English' : 'العربية'}</div>
                    </div>
                    <div className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                      {i18n.language === 'en' ? 'AR' : 'EN'}
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
