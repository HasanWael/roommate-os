import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, CheckSquare, ShoppingCart, CalendarDays, Megaphone, Users, Tv, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Bills', path: '/expenses', icon: Receipt },
    { name: 'Chores', path: '/chores', icon: CheckSquare },
    { name: 'Groceries', path: '/groceries', icon: ShoppingCart },
    { name: 'Calendar', path: '/calendar', icon: CalendarDays },
  ];

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-gray-200 flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Apartment 4B</h2>
          <p className="text-sm font-medium text-text-primary">The Living Blueprint</p>
        </div>
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-gray-200 text-text-primary'
                  : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'
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
          to="/tv" 
          target="_blank" 
          onClick={onClose}
          className="flex items-center px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg"
        >
          <Tv className="mr-3 h-5 w-5" />
          TV Mode
        </NavLink>
      </div>
    </aside>
  );
}
