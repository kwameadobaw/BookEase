import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Calendar, Clock, User, Check, X } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Appointment = Database['public']['Tables']['appointments']['Row'] & {
  client: { phone_number: string | null };
  service: { name: string; price: number; duration_minutes: number };
  staff: { position: string | null };
};

export function BusinessCalendar() {
  const { user, profile, loading: authLoading } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');

  useEffect(() => {
    document.title = 'Business Calendar — BookEase';
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    loadBusinessData();
  }, [user, authLoading]);

  useEffect(() => {
    if (business) {
      loadAppointments();
    }
  }, [business, selectedDate, filter]);

  const loadBusinessData = async () => {
    if (!user) return;

    try {
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      setBusiness(businessData);

      const today = new Date().toISOString().split('T')[0];
      setSelectedDate(today);
    } catch (error) {
      console.error('Error loading business:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async () => {
    if (!business) return;

    try {
      const startOfDay = `${selectedDate}T00:00:00Z`;
      const endOfDay = `${selectedDate}T23:59:59Z`;

      let query = supabase
        .from('appointments')
        .select(`
          *,
          client:profiles!appointments_client_id_fkey(phone_number),
          service:services(name, price, duration_minutes),
          staff:staff_members(position)
        `)
        .eq('business_id', business.id)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time');

      if (filter === 'pending') {
        query = query.eq('status', 'PENDING');
      } else if (filter === 'confirmed') {
        query = query.eq('status', 'CONFIRMED');
      } else {
        query = query.in('status', ['PENDING', 'CONFIRMED', 'COMPLETED']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data as any || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  };

  const handleUpdateStatus = async (appointmentId: string, status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);

      if (error) throw error;
      loadAppointments();

      // Send confirmation email to client when status becomes CONFIRMED
      if (status === 'CONFIRMED') {
        try {
          const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL;
          if (emailServerUrl) {
            const resp = await fetch(`${emailServerUrl}/send-confirmation-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ appointment_id: appointmentId }),
            });
            const json = await resp.json().catch(() => null);
            console.debug('Confirmation email (nodemailer) response:', { status: resp.status, ok: resp.ok, json });
          } else {
            console.warn('Email server URL not set; skipping confirmation email.');
          }
        } catch (notifyErr) {
          console.warn('Confirmation email notification failed or skipped:', notifyErr);
        }
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Failed to update appointment');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getTodayStats = () => {
    const total = appointments.length;
    const pending = appointments.filter(a => a.status === 'PENDING').length;
    const confirmed = appointments.filter(a => a.status === 'CONFIRMED').length;
    const completed = appointments.filter(a => a.status === 'COMPLETED').length;
    const revenue = appointments
      .filter(a => a.status === 'COMPLETED' || a.status === 'CONFIRMED')
      .reduce((sum, a) => sum + a.service.price, 0);

    return { total, pending, confirmed, completed, revenue };
  };

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-64 bg-slate-200 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!business) {
    return (
      <Layout>
        <Card>
          <CardBody className="text-center py-12">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No business profile</h2>
            <p className="text-slate-600 mb-6">Create a business profile to view your calendar</p>
            <Button onClick={() => window.location.href = '/business/dashboard'}>
              Go to Dashboard
            </Button>
          </CardBody>
        </Card>
      </Layout>
    );
  }

  const stats = getTodayStats();

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Appointment Calendar</h1>
          <p className="text-slate-600">View and manage your bookings</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardBody className="text-center">
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-600">Total</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-sm text-slate-600">Pending</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
              <p className="text-sm text-slate-600">Confirmed</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <p className="text-2xl font-bold text-slate-900">GHS {stats.revenue}</p>
              <p className="text-sm text-slate-600">Revenue</p>
            </CardBody>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">Appointments</h2>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={filter === 'all' ? 'primary' : 'outline'}
                    onClick={() => setFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === 'pending' ? 'primary' : 'outline'}
                    onClick={() => setFilter('pending')}
                  >
                    Pending
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === 'confirmed' ? 'primary' : 'outline'}
                    onClick={() => setFilter('confirmed')}
                  >
                    Confirmed
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {appointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No appointments</h3>
                <p className="text-slate-600">No appointments scheduled for this date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <span className="font-semibold text-slate-900">
                                {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                              </span>
                            </div>
                            <h4 className="font-semibold text-slate-900">{appointment.service.name}</h4>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              appointment.status
                            )}`}
                          >
                            {appointment.status}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-slate-600">
                          <p>Duration: {appointment.service.duration_minutes} minutes</p>
                          <p>Price: GHS {appointment.service.price}</p>
                          {appointment.staff.position && (
                            <p>Staff: {appointment.staff.position}</p>
                          )}
                          {appointment.notes && (
                            <p className="text-slate-700 mt-2">
                              <span className="font-medium">Note:</span> {appointment.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {appointment.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleUpdateStatus(appointment.id, 'CONFIRMED')}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleUpdateStatus(appointment.id, 'CANCELLED')}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      )}
                      {appointment.status === 'CONFIRMED' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleUpdateStatus(appointment.id, 'COMPLETED')}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Mark Completed
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleUpdateStatus(appointment.id, 'CANCELLED')}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
}
