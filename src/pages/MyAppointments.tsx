import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Calendar, Clock, MapPin, Star, X } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Appointment = Database['public']['Tables']['appointments']['Row'] & {
  business: { name: string; city: string };
  service: { name: string; price: number; duration_minutes: number };
  review: { id: string; rating: number; comment: string | null } | null;
};

export function MyAppointments() {
  const { user, profile, loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [reviewingAppointment, setReviewingAppointment] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    document.title = 'My Appointments — BookEase';
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    loadAppointments();
  }, [user, authLoading, filter]);

  const loadAppointments = async () => {
    if (!user) return;

    try {
      const now = new Date().toISOString();

      let query = supabase
        .from('appointments')
        .select(`
          *,
          business:business_profiles(name, city),
          service:services(name, price, duration_minutes),
          review:reviews(id, rating, comment)
        `)
        .eq('client_id', user.id)
        .order('start_time', { ascending: filter === 'upcoming' });

      if (filter === 'upcoming') {
        query = query.gte('start_time', now).in('status', ['PENDING', 'CONFIRMED']);
      } else {
        query = query.or(`status.eq.COMPLETED,status.eq.CANCELLED,status.eq.NO_SHOW`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data as any || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'CANCELLED' })
        .eq('id', appointmentId);

      if (error) throw error;
      loadAppointments();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment');
    }
  };

  const handleSubmitReview = async (appointment: Appointment) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          appointment_id: appointment.id,
          client_id: user.id,
          business_id: appointment.business_id,
          staff_member_id: appointment.staff_member_id,
          rating,
          comment: comment || null,
        });

      if (error) throw error;

      setReviewingAppointment(null);
      setRating(5);
      setComment('');
      loadAppointments();
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'NO_SHOW':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  // Treat nested review relation robustly: Supabase returns an array when joining
  const hasReview = (a: any) => {
    const r = a?.review;
    return Array.isArray(r) ? r.length > 0 : Boolean(r);
  };

  const getReview = (a: any) => {
    const r = a?.review;
    return Array.isArray(r) ? (r[0] ?? null) : (r ?? null);
  };

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Appointments</h1>
          <p className="text-slate-600">View and manage your bookings</p>
        </div>

        <div className="flex gap-3 mb-6">
          <Button
            variant={filter === 'upcoming' ? 'primary' : 'outline'}
            onClick={() => setFilter('upcoming')}
          >
            Upcoming
          </Button>
          <Button
            variant={filter === 'past' ? 'primary' : 'outline'}
            onClick={() => setFilter('past')}
          >
            Past
          </Button>
        </div>

        {appointments.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No appointments found</h3>
              <p className="text-slate-600 mb-6">
                {filter === 'upcoming'
                  ? 'You have no upcoming appointments'
                  : 'You have no past appointments'}
              </p>
              {filter === 'upcoming' && (
                <Button onClick={() => window.location.href = '/'}>
                  Book an Appointment
                </Button>
              )}
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardBody>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-1">
                            {appointment.business.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin className="w-4 h-4" />
                            <span>{appointment.business.city}</span>
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            appointment.status
                          )}`}
                        >
                          {appointment.status}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{formatDate(appointment.start_time)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>
                            {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg">
                         <p className="font-medium text-slate-900">{appointment.service.name}</p>
                         <p className="text-sm text-slate-600">GHS {appointment.service.price} · {appointment.service.duration_minutes} min</p>
                       </div>

                      {appointment.notes && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-900">
                            <span className="font-medium">Note:</span> {appointment.notes}
                          </p>
                        </div>
                      )}

                      {appointment.status === 'COMPLETED' && !hasReview(appointment) && (
                        <div className="mt-4">
                          {reviewingAppointment === appointment.id ? (
                            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  Rating
                                </label>
                                <div className="flex gap-2">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      onClick={() => setRating(star)}
                                      className="transition-colors"
                                    >
                                      <Star
                                        className={`w-8 h-8 ${
                                          star <= rating
                                            ? 'fill-yellow-400 text-yellow-400'
                                            : 'text-slate-300'
                                        }`}
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  Review
                                </label>
                                <textarea
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  placeholder="Share your experience..."
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                                  rows={3}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => handleSubmitReview(appointment)} size="sm">
                                  Submit Review
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReviewingAppointment(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReviewingAppointment(appointment.id)}
                            >
                              <Star className="w-4 h-4 mr-1" />
                              Leave a Review
                            </Button>
                          )}
                        </div>
                      )}

                      {hasReview(appointment) && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                          <p className="text-sm font-medium text-slate-700 mb-2">Your Review</p>
                          <div className="flex gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= (getReview(appointment)?.rating ?? 0)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                          {getReview(appointment)?.comment && (
                            <p className="text-sm text-slate-700">{getReview(appointment)?.comment}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {filter === 'upcoming' && appointment.status !== 'CANCELLED' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleCancelAppointment(appointment.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
