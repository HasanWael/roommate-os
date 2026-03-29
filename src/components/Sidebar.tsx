import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, CheckSquare, ShoppingCart, CalendarDays, Megaphone, Users, Tv } from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Bills', path: '/expenses', icon: Receipt },
    { name: 'Chores', path: '/chores', icon: CheckSquare },
    { name: 'Groceries', path: '/groceries', icon: ShoppingCart },
    { name: 'Calendar', path: '/calendar', icon: CalendarDays },
  ];

  return (
    <aside className="w-64 bg-background border-r border-gray-200 flex-col hidden md:flex">
      <div className="p-6">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Apartment 4B</h2>
        <p className="text-sm font-medium text-text-primary">The Living Blueprint</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
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
        <NavLink to="/announcements" className="flex items-center px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg">
          <Megaphone className="mr-3 h-5 w-5" />
          Announcements
        </NavLink>
        <NavLink to="/members" className="flex items-center px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg">
          <Users className="mr-3 h-5 w-5" />
          Members
        </NavLink>
        <NavLink to="/tv" target="_blank" className="flex items-center px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 rounded-lg">
          <Tv className="mr-3 h-5 w-5" />
          TV Mode
        </NavLink>
      </div>
    </aside>
  );
}
