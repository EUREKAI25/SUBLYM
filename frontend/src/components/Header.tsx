import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, Sparkles, Images } from 'lucide-react';
import { useAuth, useI18n, LocaleSwitcher } from '@/hooks';
import { cn } from '@/lib/utils';

interface HeaderProps {
  className?: string;
  transparent?: boolean;
}

export function Header({ className, transparent = false }: HeaderProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        transparent ? 'bg-white/95 backdrop-blur-sm' : 'bg-white shadow-sm',
        className
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="SUBLYM" className="h-8 w-auto" />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-3 sm:gap-6">
            {user ? (
              <>
                <Link
                  to="/create"
                  className="flex items-center gap-2 text-wine-700 hover:text-wine-900 transition-colors font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('common.create')}</span>
                </Link>
                <Link
                  to="/gallery"
                  className="flex items-center gap-2 text-wine-700 hover:text-wine-900 transition-colors font-medium"
                >
                  <Images className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('common.myCreations')}</span>
                </Link>
                <div className="flex items-center gap-2 sm:gap-3 pl-3 sm:pl-4 border-l border-wine-200">
                  <Link
                    to="/account"
                    className="flex items-center gap-2 text-charcoal-600 hover:text-wine-700 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden md:inline text-sm truncate max-w-[100px]">{user.email}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-charcoal-400 hover:text-wine-600 transition-colors"
                    title={t('common.logout')}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <LocaleSwitcher className="hidden sm:block px-2 py-1 rounded border border-wine-200 text-sm bg-white/80" />
                <Link 
                  to="/login" 
                  className="text-wine-700 hover:text-wine-900 transition-colors font-medium"
                >
                  {t('common.login')}
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
