import { Bell, Settings, Search, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { logout } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-background border-b border-gray-200">
      <div className="flex items-center">
        <button className="md:hidden mr-4 text-gray-500 hover:text-gray-700">
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Roommate OS</h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none w-64 transition-all"
          />
        </div>
        
        <button className="text-gray-500 hover:text-gray-700 relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 bg-danger rounded-full ring-2 ring-background"></span>
        </button>
        
        <button className="text-gray-500 hover:text-gray-700">
          <Settings className="h-5 w-5" />
        </button>
        
        {user?.photoURL ? (
          <img src={user.photoURL} alt="Avatar" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-sm">
            {user?.displayName?.charAt(0) || 'U'}
          </div>
        )}

        <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 ml-2" title="Logout">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
