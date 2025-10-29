import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Check } from 'lucide-react';

interface BookAppointmentProps {
  businessId: string;
  serviceId: string;
}

export function BookAppointment({ businessId, serviceId }: BookAppointmentProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [availabilityMeta, setAvailabilityMeta] = useState<any>(null);
  const [resolvedBusinessId, setResolvedBusinessId] = useState<string>(businessId);

  const calculateSlotsFromWorkingHours = (
    workingHours: { start_time: string; end_time: string },
    dateStr: string,
    durationMinutes: number
  ): string[] => {
    const slots: string[] = [];
    const normalize = (t: string) => (t.length === 5 ? `${t}:00` : t);
    let currentTime = new Date(`${dateStr}T${normalize(workingHours.start_time)}`);
    const endTime = new Date(`${dateStr}T${normalize(workingHours.end_time)}`);
    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);
      if (slotEnd > endTime) break;
      slots.push(currentTime.toISOString());
      currentTime = new Date(currentTime.getTime() + durationMinutes * 60000);
    }
    return slots;
  };

  useEffect(() => {
    document.title = 'Book Appointment — BookEase';
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    loadBookingData();
  }, [user, authLoading]);

  useEffect(() => {
    if (selectedDate && service && resolvedBusinessId) {
      loadAvailableSlots();
    }
  }, [selectedDate, service, resolvedBusinessId]);

  const loadBookingData = async () => {
    try {
      // Resolve business by slug or id
      let businessData: any = null;
      let businessError: any = null;
      const bySlug = await supabase
        .from('business_profiles')
        .select('*')
        .eq('slug', businessId)
        .maybeSingle();
      if (bySlug.data) {
        businessData = bySlug.data;
        businessError = bySlug.error;
      } else {
        const byId = await supabase
          .from('business_profiles')
          .select('*')
          .eq('id', businessId)
          .maybeSingle();
        businessData = byId.data;
        businessError = byId.error;
      }

      if (businessError) throw businessError;
      setBusiness(businessData);
      setResolvedBusinessId(businessData?.id || businessId);

      const { data: serviceData } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .maybeSingle();

      setService(serviceData);

      const today = new Date();
      setSelectedDate(today.toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error loading booking data:', error);
      setError('Failed to load booking information');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-availability`;
      const params = new URLSearchParams({
        business_id: resolvedBusinessId,
        date: selectedDate,
        duration: service.duration_minutes.toString(),
      });
      params.append('debug', 'true');

      const response = await fetch(`${apiUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`availability_request_failed_${response.status}`);
      }

      const data = await response.json();
      setAvailableSlots(data.availableSlots || []);
      setAvailabilityMeta({ ...(data.meta || {}), source: 'edge' });
      setSelectedSlot('');
      if (data?.meta) {
        console.debug('Availability meta:', data.meta);
      }
    } catch (error) {
      console.warn('Edge availability failed; falling back to client-side hours.', error);
      // Fallback: generate slots from business_working_hours directly (does NOT consider existing bookings)
      try {
        const targetDate = new Date(selectedDate);
        const dayOfWeek = targetDate.getDay();
        const dateStr = targetDate.toISOString().split('T')[0];
        const { data: workingHours } = await supabase
          .from('business_working_hours')
          .select('start_time, end_time')
          .eq('business_id', resolvedBusinessId)
          .eq('day_of_week', dayOfWeek)
          .maybeSingle();

        if (!workingHours) {
          setAvailableSlots([]);
          setAvailabilityMeta({ reason: 'no_working_hours', dayOfWeek, date: selectedDate, workingHours: null, source: 'fallback' });
          return;
        }

        const slots = calculateSlotsFromWorkingHours(workingHours as any, dateStr, service.duration_minutes);
        setAvailableSlots(slots);
        setAvailabilityMeta({ dayOfWeek, date: selectedDate, workingHours, source: 'fallback' });
        setSelectedSlot('');
        console.debug('Availability meta (fallback):', { dayOfWeek, date: selectedDate, workingHours });
      } catch (fallbackErr) {
        console.error('Fallback slot generation failed:', fallbackErr);
        setAvailableSlots([]);
        setAvailabilityMeta({ reason: 'fallback_failed', error: (fallbackErr as any)?.message, source: 'fallback' });
      }
    }
  };

  const handleBooking = async () => {
    if (!selectedSlot || !user) return;

    setBookingLoading(true);
    setError('');

    try {
      // Pre-check: ensure selected slot is still available according to server availability
      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-availability`;
        const params = new URLSearchParams({
          business_id: resolvedBusinessId,
          date: selectedDate,
          duration: service.duration_minutes.toString(),
        });
        const resp = await fetch(`${apiUrl}?${params}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        });
        if (resp.ok) {
          const data = await resp.json();
          const slots: string[] = data.availableSlots || [];
          if (!slots.includes(selectedSlot)) {
            setError('Selected time is no longer available. Please choose another time.');
            setBookingLoading(false);
            return;
          }
        } else {
          console.warn('Availability pre-check failed; proceeding with booking attempt.');
        }
      } catch (precheckErr) {
        console.warn('Availability pre-check error; proceeding with booking attempt.', precheckErr);
      }

      const startTime = new Date(selectedSlot);
      const endTime = new Date(startTime.getTime() + service.duration_minutes * 60000);

      const { error: bookingError } = await supabase
        .from('appointments')
        .insert({
          client_id: user.id,
          service_id: serviceId,
          business_id: resolvedBusinessId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'PENDING',
          notes: (clientName?.trim() || notes?.trim())
            ? [`Client Name: ${clientName.trim()}`, notes?.trim()].filter(Boolean).join('\n')
            : null,
        });

      if (bookingError) throw bookingError;

      // Notify business via email if business email is available
      try {
        const emailServerUrl = import.meta.env.VITE_EMAIL_SERVER_URL;
        if (emailServerUrl) {
          const resp = await fetch(`${emailServerUrl}/send-booking-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              business_id: resolvedBusinessId,
              service_name: service?.name,
              client_id: user.id,
              client_email: user.email,
              client_name: clientName?.trim() || null,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              notes: notes || null,
            }),
          });
          const json = await resp.json().catch(() => null);
          console.debug('Booking email (nodemailer) response:', { status: resp.status, ok: resp.ok, json });
        } else {
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-email`;
          const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              business_id: resolvedBusinessId,
              business_email: (business as any)?.email || null,
              service_name: service?.name,
              client_id: user.id,
              client_email: user.email,
              client_name: clientName?.trim() || null,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              notes: notes || null,
            }),
          });
          const json = await resp.json().catch(() => null);
          console.debug('Booking email (edge fn) response:', { status: resp.status, ok: resp.ok, json });
        }
      } catch (notifyErr) {
        // Non-blocking: log and continue
        console.warn('Booking email notification failed or skipped:', notifyErr);
      }

      setSuccess(true);
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      setError(error.message || 'Failed to book appointment');
    } finally {
      setBookingLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);
    return maxDate.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-64 bg-slate-200 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (success) {
    const businessPhone = business?.phone_number;
    const mobileMoneyNumber = business?.mobile_money_number;
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardBody className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Submitted!</h2>
              <p className="text-slate-600 mb-6">
                Your appointment request has been sent. The business will assign a staff member and confirm.
              </p>
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
                <p className="text-amber-900 font-semibold mb-1">Action Required</p>
                {mobileMoneyNumber || businessPhone ? (
                  <p className="text-amber-800 text-sm">
                    Please make a 50% payment to Mobile Money number {mobileMoneyNumber ? (<span className="font-semibold">{mobileMoneyNumber}</span>) : 'provided by the business'} and call the business {businessPhone ? (<span className="font-semibold">{businessPhone}</span>) : 'phone number'} to confirm your booking.
                  </p>
                ) : (
                  <p className="text-amber-800 text-sm">
                    Please make a 50% payment to the business Mobile Money number and call the business phone number to confirm your booking.
                  </p>
                )}
              </div>
-              <p className="text-slate-600 mb-6">
-                You’ll be redirected to your appointments shortly.
-              </p>
+              {/* No auto-redirect; user stays on confirmation page */}
            </CardBody>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Book Your Appointment</h1>
          <p className="text-slate-600">Select a date and time that works for you</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold text-slate-900">Appointment Details</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Business</p>
                  <p className="font-semibold text-slate-900">{business?.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Service</p>
                  <p className="font-semibold text-slate-900">{service?.name}</p>
                  <p className="text-sm text-slate-600">GHS {service?.price} · {service?.duration_minutes} minutes</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold text-slate-900">Your Details</h2>
              </CardHeader>
              <CardBody>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="clientName">Name</label>
                <Input
                  id="clientName"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter your name"
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold text-slate-900">Select Date</h2>
              </CardHeader>
              <CardBody>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={getMinDate()}
                  max={getMaxDate()}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold text-slate-900">Available Times</h2>
              </CardHeader>
              <CardBody>
                {availabilityMeta?.source === 'fallback' && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    Showing business hours only. Existing bookings may not be reflected.
                  </div>
                )}
                {!selectedDate ? (
                  <p className="text-slate-600">Please select a date first</p>
                ) : availableSlots.length === 0 ? (
                  <div className="space-y-2 text-slate-600">
                    <p>No available slots for this date</p>
                    {availabilityMeta?.reason === 'no_working_hours' ? (
                      <p className="text-sm">No working hours set for this business on the selected day.</p>
                    ) : availabilityMeta?.workingHours ? (
                      <p className="text-sm">Business hours: {availabilityMeta.workingHours.start_time} – {availabilityMeta.workingHours.end_time}. Consider adjusting service duration or hours.</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          selectedSlot === slot
                            ? 'border-slate-300 bg-slate-200 text-slate-600'
                            : 'border-slate-200 hover:border-slate-300 text-slate-900'
                        }`}
                      >
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold text-slate-900">Additional Notes</h2>
              </CardHeader>
              <CardBody>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests or notes for the provider..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                  rows={4}
                />
              </CardBody>
            </Card>
          </div>

          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <h2 className="text-lg font-bold text-slate-900">Booking Summary</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                {selectedDate && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Date</p>
                    <p className="font-semibold text-slate-900">
                      {new Date(selectedDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}

                {selectedSlot && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Time</p>
                    <p className="font-semibold text-slate-900">{formatTime(selectedSlot)}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-700">Total</span>
                     <span className="text-2xl font-bold text-slate-900">GHS {service?.price}</span>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <Button
                    fullWidth
                    disabled={!selectedSlot || bookingLoading || !clientName.trim()}
                    onClick={handleBooking}
                  >
                    {bookingLoading ? 'Booking...' : 'Confirm Booking'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
