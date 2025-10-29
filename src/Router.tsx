import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { MyAppointments } from './pages/MyAppointments';
import { BusinessDashboard } from './pages/BusinessDashboard';
import { BusinessCalendar } from './pages/BusinessCalendar';
import { BusinessDetails } from './pages/BusinessDetails';
import { BookAppointment } from './pages/BookAppointment';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import Developer from './pages/Developer';

export function Router() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [search, setSearch] = useState(window.location.search);

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname);
      setSearch(window.location.search);
    };

    window.addEventListener('popstate', handleLocationChange);

    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      // @ts-ignore
      originalPushState.apply(window.history, args);
      handleLocationChange();
    } as typeof window.history.pushState;

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
    };
  }, []);

  const getQueryParam = (name: string) => {
    const params = new URLSearchParams(search);
    return params.get(name);
  };

  if (pathname === '/login') {
    return <Login />;
  }

  if (pathname === '/signup') {
    return <Signup />;
  }

  if (pathname === '/forgot') {
    return <ForgotPassword />;
  }

  if (pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (pathname === '/developer') {
    return <Developer />;
  }

  if (pathname === '/my-appointments') {
    return <MyAppointments />;
  }

  if (pathname === '/business/dashboard') {
    return <BusinessDashboard />;
  }

  if (pathname === '/business/calendar') {
    return <BusinessCalendar />;
  }


  if (pathname.startsWith('/business/') && pathname !== '/business/dashboard' && pathname !== '/business/calendar') {
    const businessId = pathname.split('/')[2];
    return <BusinessDetails businessId={businessId} />;
  }

  if (pathname === '/book') {
    const businessId = getQueryParam('business');
    const serviceId = getQueryParam('service');

    if (businessId && serviceId) {
      return <BookAppointment businessId={businessId} serviceId={serviceId} />;
    }
  }

  return <Home />;
}
