import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, CheckSquare, ShoppingCart, CalendarDays, Megaphone, Users, Tv, X, LogOut, Repeat, Settings } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { apartment, setApartmentId } = useAuth();
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Bills', path: '/expenses', icon: Receipt },
    { name: 'Chores', path: '/chores', icon: CheckSquare },
    { name: 'Groceries', path: '/groceries', icon: ShoppingCart },
    { name: 'Calendar', path: '/calendar', icon: CalendarDays },
  ];

  const handleSwitchApartment = () => {
    setApartmentId(null);
    onClose();
    navigate('/auth');
  };

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-gray-200 flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-6 flex justify-between items-center">
        <div>
          <p className="text-xl font-black text-text-primary tracking-tighter">Roommate OS</p>
        </div>
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-primary transition-colors">
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
              `flex items-center px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]'
                  : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
              }`
            }
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-1">
        <NavLink 
          to="/announcements" 
          onClick={onClose}
          className="flex items-center px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg"
        >
          <Megaphone className="mr-3 h-5 w-5" />
          Announcements
        </NavLink>
        <NavLink 
          to="/members" 
          onClick={onClose}
          className="flex items-center px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg"
        >
          <Users className="mr-3 h-5 w-5" />
          Members
        </NavLink>
        <NavLink 
          to="/settings" 
          onClick={onClose}
          className="flex items-center px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg"
        >
          <Settings className="mr-3 h-5 w-5" />
          Settings
        </NavLink>
        <NavLink 
          to="/tv" 
          target="_blank" 
          onClick={onClose}
          className="flex items-center px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg"
        >
          <Tv className="mr-3 h-5 w-5" />
          TV Mode
        </NavLink>
        <button 
          onClick={handleSwitchApartment}
          className="w-full flex items-center px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Repeat className="mr-3 h-5 w-5" />
          Switch Apartment
        </button>
      </div>
    </aside>
  );
}
