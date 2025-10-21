import { ReactNode } from 'react';
import { Calendar, LogOut, Menu, Search, User, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Calendar className="w-8 h-8 text-slate-900" />
                <a href='/home'>
                <span className="text-xl font-bold text-slate-900">BookEase</span>
                </a>
              </div>

              {user && (
                <nav className="hidden md:flex items-center gap-6">
                  {profile?.user_type === 'CLIENT' && (
                    <>
                      <a href="/" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                        <Search className="w-4 h-4 inline mr-1.5" />
                        Explore
                      </a>
                      <a href="/my-appointments" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                        <Calendar className="w-4 h-4 inline mr-1.5" />
                        My Appointments
                      </a>
                    </>
                  )}
                  {profile?.user_type === 'BUSINESS_OWNER' && (
                    <>
                      <a href="/business/dashboard" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                        <Briefcase className="w-4 h-4 inline mr-1.5" />
                        Dashboard
                      </a>
                      <a href="/business/calendar" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                        <Calendar className="w-4 h-4 inline mr-1.5" />
                        Calendar
                      </a>
                    </>
                  )}
                </nav>
              )}
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{user.email}</p>
                      <p className="text-xs text-slate-500 capitalize">{profile?.user_type.toLowerCase().replace('_', ' ')}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={signOut}>
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm">
                    <a href="/login">Sign In</a>
                  </Button>
                  <Button variant="primary" size="sm">
                    <a href="/signup">Get Started</a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-slate-500">
            <p>&copy; 2025 BookEase. Connecting clients with service providers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
