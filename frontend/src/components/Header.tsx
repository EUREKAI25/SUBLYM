import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Sparkles, Images } from 'lucide-react';
import { useAuth, useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { API_ENDPOINTS, fetchWithAuth } from '@/lib/config';

interface HeaderProps {
  className?: string;
  transparent?: boolean;
}

const SEEN_RUNS_KEY = 'sublym_seen_runs';

export function Header({ className, transparent = false }: HeaderProps) {
  const { user, logout, token } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [unseenCount, setUnseenCount] = useState(0);

  // Fetch unseen runs count
  useEffect(() => {
    if (!token) return;

    const checkUnseen = async () => {
      try {
        const res = await fetchWithAuth(API_ENDPOINTS.runs);
        if (res.ok) {
          const data = await res.json();
          const completedRuns = (data.runs || []).filter((r: { status: string }) => r.status === 'completed');
          const seenIds = JSON.parse(localStorage.getItem(SEEN_RUNS_KEY) || '[]');
          const unseen = completedRuns.filter((r: { id: number }) => !seenIds.includes(r.id));
          setUnseenCount(unseen.length);
        }
      } catch {
        // Silently fail
      }
    };

    checkUnseen();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        transparent ? 'bg-transparent' : 'bg-white shadow-sm',
        className
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="SUBLYM" className="h-10 sm:h-[4.5rem] w-auto" />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-3 sm:gap-6">
            {user ? (
              <>
                <Link
                  to="/create"
                  className="flex items-center gap-2 text-teal-600 hover:text-teal-800 transition-colors font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('common.create')}</span>
                </Link>
                <Link
                  to="/gallery"
                  className="relative flex items-center gap-2 text-teal-600 hover:text-teal-800 transition-colors font-medium"
                >
                  <Images className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('common.myCreations')}</span>
                  {unseenCount > 0 && (
                    <span className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                      {unseenCount}
                    </span>
                  )}
                </Link>
                <div className="relative pl-3 sm:pl-4 border-l border-teal-200" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center text-teal-600 hover:text-teal-800 transition-colors"
                  >
                    <User className="w-4 h-4" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                      >
                        {t('common.profile')}
                      </Link>
                      <Link
                        to="/account"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                      >
                        {t('common.account')}
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                      >
                        {t('common.logout')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="text-teal-600 hover:text-teal-800 transition-colors font-medium"
              >
                {t('common.login')}
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
