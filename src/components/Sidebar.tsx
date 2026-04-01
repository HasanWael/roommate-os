import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Receipt, CheckSquare, ShoppingCart, CalendarDays, Megaphone, Users, Tv, X, LogOut, Repeat, Settings, Droplets, Trash2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { apartment, setApartmentId } = useAuth();
  const { t, i18n } = useTranslation();
  
  const navItems = [
    { name: t('nav.home', 'Home'), path: '/dashboard', icon: Home },
    { name: t('nav.showerQueue'), path: '/shower-queue', icon: Droplets },
    { name: t('nav.trashTurn'), path: '/trash-turn', icon: Trash2 },
    { name: t('nav.bills'), path: '/expenses', icon: Receipt },
    { name: t('nav.chores'), path: '/chores', icon: CheckSquare },
    { name: t('nav.groceries'), path: '/groceries', icon: ShoppingCart },
    { name: t('nav.calendar'), path: '/calendar', icon: CalendarDays },
  ];

  const handleSwitchApartment = () => {
    setApartmentId(null);
    onClose();
    navigate('/auth');
  };

  return (
    <aside className={`
      fixed inset-y-0 left-0 rtl:right-0 rtl:left-auto z-50 w-64 bg-background border-r rtl:border-l rtl:border-r-0 border-gray-200 flex-col transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex
      ${isOpen ? 'translate-x-0' : (i18n.language === 'ar' ? 'translate-x-full' : '-translate-x-full')}
      hidden lg:flex
    `}>
      <div className="p-6 flex justify-between items-center">
        <div>
          <p className="text-xl font-black text-text-primary tracking-tighter">{t('app.name')}</p>
        </div>
        <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-primary transition-colors">
          <X className="h-6 w-6" />
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]'
                  : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-1">
        <NavLink 
          to="/members" 
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg"
        >
          <Users className="h-5 w-5" />
          {t('nav.members')}
        </NavLink>
        <NavLink 
          to="/settings" 
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg"
        >
          <Settings className="h-5 w-5" />
          {t('nav.settings')}
        </NavLink>
        <NavLink 
          to="/tv" 
          target="_blank" 
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg"
        >
          <Tv className="h-5 w-5" />
          {t('nav.tvMode')}
        </NavLink>
        <button 
          onClick={handleSwitchApartment}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Repeat className="h-5 w-5" />
          {t('nav.switchApartment')}
        </button>
        <div className="md:hidden pt-2">
          <LanguageSwitcher className="w-full justify-start px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg" />
        </div>
      </div>
    </aside>
  );
}
