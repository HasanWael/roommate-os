import { useAuth } from '../AuthContext';
import { Languages } from 'lucide-react';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, changeLanguage } = useAuth();

  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar';
    changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`flex items-center justify-center p-2 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-all ${className}`}
      title={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
    >
      <Languages className="h-5 w-5" />
      <span className="ml-2 font-medium text-sm uppercase">{language === 'ar' ? 'EN' : 'عربي'}</span>
    </button>
  );
}
