import { ReactNode, useEffect, useState } from 'react';
import { Calendar, LogOut, Menu, Search, User, Briefcase, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, profile, signOut } = useAuth();
  const [hasPendingForBusiness, setHasPendingForBusiness] = useState(false);
  const [hasConfirmedForClient, setHasConfirmedForClient] = useState(false);

  useEffect(() => {
    const loadIndicators = async () => {
      setHasPendingForBusiness(false);
      setHasConfirmedForClient(false);
      if (!user || !profile) return;

      const nowIso = new Date().toISOString();

      if (profile.user_type === 'BUSINESS_OWNER') {
        const { data: biz } = await supabase
          .from('business_profiles')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();
        const businessId = (biz as any)?.id;
        if (businessId) {
          const { count } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('status', 'PENDING')
            .gte('start_time', nowIso);
          setHasPendingForBusiness((count || 0) > 0);
        }
      }

      if (profile.user_type === 'CLIENT') {
        const { count } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', user.id)
          .eq('status', 'CONFIRMED')
          .gte('start_time', nowIso);
        setHasConfirmedForClient((count || 0) > 0);
      }
    };
    loadIndicators();
  }, [user, profile]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 md:pb-0">
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
                      <a href="/my-appointments" className="relative text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                        <Calendar className="w-4 h-4 inline mr-1.5" />
                        My Appointments
                        {hasConfirmedForClient && (
                          <span className="absolute -top-1 -right-2 inline-block w-2 h-2 rounded-full bg-green-500" aria-label="confirmed appointment" />
                        )}
                      </a>
                    </>
                  )}
                  {profile?.user_type === 'BUSINESS_OWNER' && (
                    <>
                      <a href="/business/dashboard" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                        <Briefcase className="w-4 h-4 inline mr-1.5" />
                        Dashboard
                      </a>
                      <a href="/business/calendar" className="relative text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                        <Calendar className="w-4 h-4 inline mr-1.5" />
                        Calendar
                        {hasPendingForBusiness && (
                          <span className="absolute -top-1 -right-2 inline-block w-2 h-2 rounded-full bg-red-500" aria-label="pending booking" />
                        )}
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

        {/* Mobile nav in header */}
        {user && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-4 overflow-x-auto">
              {profile?.user_type === 'CLIENT' && (
                <>
                  <a href="/" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Search className="w-4 h-4" />
                    <span>Explore</span>
                  </a>
                  <a href="/my-appointments" className="relative flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Calendar className="w-4 h-4" />
                    <span>My Appointments</span>
                    {hasConfirmedForClient && (
                      <span className="absolute -top-1 -right-2 inline-block w-2 h-2 rounded-full bg-green-500" aria-label="confirmed appointment" />
                    )}
                  </a>
                </>
              )}

              {profile?.user_type === 'BUSINESS_OWNER' && (
                <>
                  <a href="/business/dashboard" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Briefcase className="w-4 h-4" />
                    <span>Dashboard</span>
                  </a>
                  <a href="/business/calendar" className="relative flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Calendar className="w-4 h-4" />
                    <span>Calendar</span>
                    {hasPendingForBusiness && (
                      <span className="absolute -top-1 -right-2 inline-block w-2 h-2 rounded-full bg-red-500" aria-label="pending booking" />
                    )}
                  </a>
                </>
              )}
            </div>
          </div>
        )}
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

      {/* Fixed bottom mobile nav for better visibility */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden">
          <div className="max-w-7xl mx-auto px-4 py-2 grid grid-cols-2 gap-4">
            {profile?.user_type === 'CLIENT' ? (
              <>
                <a href="/" className="flex flex-col items-center text-xs font-medium text-slate-700">
                  <Search className="w-5 h-5 mb-1" />
                  Explore
                </a>
                <a href="/my-appointments" className="flex flex-col items-center text-xs font-medium text-slate-700 relative">
                  <Calendar className="w-5 h-5 mb-1" />
                  My Appointments
                  {hasConfirmedForClient && (
                    <span className="absolute top-0 right-6 inline-block w-2 h-2 rounded-full bg-green-500" aria-label="confirmed appointment" />
                  )}
                </a>
              </>
            ) : (
              <>
                <a href="/business/dashboard" className="flex flex-col items-center text-xs font-medium text-slate-700">
                  <Briefcase className="w-5 h-5 mb-1" />
                  Dashboard
                </a>
                <a href="/business/calendar" className="flex flex-col items-center text-xs font-medium text-slate-700 relative">
                  <Calendar className="w-5 h-5 mb-1" />
                  Calendar
                  {hasPendingForBusiness && (
                    <span className="absolute top-0 right-6 inline-block w-2 h-2 rounded-full bg-red-500" aria-label="pending booking" />
                  )}
                </a>
              </>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
