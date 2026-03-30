import { Bell, Settings, Search, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { logout } from '../firebase';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, apartment } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-background border-b border-gray-200">
      <div className="flex items-center">
        <button 
          onClick={onMenuClick}
          className="md:hidden mr-4 text-gray-500 hover:text-gray-700"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-black text-primary tracking-tighter">{apartment?.name || 'Roommate OS'}</h1>
      </div>

      <div className="flex items-center space-x-6">
        <div className="relative hidden md:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search anything..."
            className="pl-12 pr-6 py-2.5 bg-gray-100 border-transparent rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-80 transition-all"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-all relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-danger rounded-full ring-2 ring-white"></span>
          </button>
        </div>
        
        <div className="h-10 w-[1px] bg-gray-200 mx-2 hidden md:block"></div>

        <div className="flex items-center space-x-3">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" className="h-10 w-10 rounded-full ring-2 ring-primary/10" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-primary/20">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
          )}
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-text-primary leading-none">{user?.displayName || 'User'}</p>
            <p className="text-xs text-text-secondary mt-1">Admin</p>
          </div>
        </div>

        <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-danger hover:bg-danger/5 rounded-xl transition-all" title="Logout">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
