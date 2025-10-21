import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { MapPin, Star, Clock, DollarSign, User } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Service = Database['public']['Tables']['services']['Row'];
type StaffMember = Database['public']['Tables']['staff_members']['Row'] & {
  profile: { profile_picture_url: string | null; phone_number: string | null };
};
type Review = Database['public']['Tables']['reviews']['Row'] & {
  client: { profile_picture_url: string | null };
};

interface BusinessDetailsProps {
  businessId: string;
}

export function BusinessDetails({ businessId }: BusinessDetailsProps) {
  const { user, profile } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusinessData();
  }, [businessId]);

  useEffect(() => {
    document.title = business ? `Business — ${business.name}` : 'Business — BookEase';
  }, [business]);
  const loadBusinessData = async () => {
    try {
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('id', businessId)
        .maybeSingle();

      if (businessError) throw businessError;
      setBusiness(businessData);

      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name');

      setServices(servicesData || []);

      const { data: staffData } = await supabase
        .from('staff_members')
        .select(`
          *,
          profile:profiles(profile_picture_url, phone_number)
        `)
        .eq('business_id', businessId)
        .eq('is_active', true);

      setStaff(staffData as any || []);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select(`
          *,
          client:profiles(profile_picture_url)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(10);

      setReviews(reviewsData as any || []);
    } catch (error) {
      console.error('Error loading business:', error);
    } finally {
      setLoading(false);
    }
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;

  const handleBookAppointment = () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (selectedService && selectedStaff) {
      window.location.href = `/book?business=${businessId}&service=${selectedService.id}&staff=${selectedStaff.id}`;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!business) {
    return (
      <Layout>
        <Card>
          <CardBody className="text-center py-12">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Business not found</h2>
            <Button onClick={() => window.location.href = '/'}>Go Back</Button>
          </CardBody>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div
          className="h-64 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl flex items-center justify-center relative overflow-hidden"
          style={business.cover_photo_url ? {
            backgroundImage: `url(${business.cover_photo_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : {}}
        >
          {!business.cover_photo_url && (
            <span className="text-8xl font-bold text-slate-400">
              {business.name.charAt(0)}
            </span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-6 text-white">
            <h1 className="text-4xl font-bold mb-2">{business.name}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <MapPin className="w-5 h-5" />
                <span>{business.address}, {business.city}</span>
              </div>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{averageRating.toFixed(1)}</span>
                  <span className="text-slate-200">({reviews.length})</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {business.description && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold text-slate-900">About</h2>
            </CardHeader>
            <CardBody>
              <p className="text-slate-700 leading-relaxed">{business.description}</p>
            </CardBody>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold text-slate-900">Services</h2>
              </CardHeader>
              <CardBody>
                {services.length === 0 ? (
                  <p className="text-slate-600">No services available</p>
                ) : (
                  <div className="space-y-3">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        onClick={() => setSelectedService(service)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedService?.id === service.id
                            ? 'border-slate-900 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-slate-900">{service.name}</h3>
                          <span className="font-bold text-slate-900">GHS {service.price}</span>
                          </div>
                        {service.description && (
                          <p className="text-sm text-slate-600 mb-2">{service.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Clock className="w-4 h-4" />
                          <span>{service.duration_minutes} minutes</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold text-slate-900">Our Team</h2>
              </CardHeader>
              <CardBody>
                {staff.length === 0 ? (
                  <p className="text-slate-600">No staff members available</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {staff.map((member) => (
                      <div
                        key={member.id}
                        onClick={() => setSelectedStaff(member)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedStaff?.id === member.id
                            ? 'border-slate-900 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          {((member as any).photo_url || member.profile?.profile_picture_url) ? (
                            <img
                              src={(member as any).photo_url || member.profile?.profile_picture_url || ''}
                              alt={(member as any).name || 'Staff Member'}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                              <User className="w-6 h-6 text-slate-600" />
                            </div>
                          )}
                           <div>
                             <h3 className="font-semibold text-slate-900">{(member as any).name || 'Staff Member'}</h3>
                             {member.position && (
                               <p className="text-sm text-slate-600">{member.position}</p>
                             )}
                           </div>
                        </div>
                        {member.bio && (
                          <p className="text-sm text-slate-600">{member.bio}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold text-slate-900">Reviews ({reviews.length})</h2>
              </CardHeader>
              <CardBody>
                {reviews.length === 0 ? (
                  <p className="text-slate-600">No reviews yet</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0">
                        <div className="flex items-center gap-2 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                          <span className="text-sm text-slate-500 ml-2">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-slate-700">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <h2 className="text-xl font-bold text-slate-900">Book Appointment</h2>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {!selectedService ? (
                    <p className="text-sm text-slate-600">Select a service to continue</p>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm font-medium text-slate-700">Selected Service</p>
                      <p className="font-semibold text-slate-900">{selectedService.name}</p>
                      <p className="text-sm text-slate-600">GHS {selectedService.price} · {selectedService.duration_minutes} min</p>
                    </div>
                  )}

                  {!selectedStaff ? (
                    <p className="text-sm text-slate-600">Select a staff member to continue</p>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm font-medium text-slate-700">Selected Staff</p>
                      <p className="font-semibold text-slate-900">{(selectedStaff as any).name || 'Staff Member'}</p>
                    </div>
                  )}

                  <Button
                    fullWidth
                    disabled={!selectedService || !selectedStaff}
                    onClick={handleBookAppointment}
                  >
                    Continue to Booking
                  </Button>

                  {!user && (
                    <p className="text-xs text-slate-500 text-center">
                      You'll need to sign in to book an appointment
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
