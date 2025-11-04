import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { RecommendedBadge } from '../components/RecommendedBadge';
import { MapPin, Star, Clock, DollarSign, User, Phone } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Service = Database['public']['Tables']['services']['Row'];
type StaffMember = Database['public']['Tables']['staff_members']['Row'] & {
  profile: { profile_picture_url: string | null; phone_number: string | null };
};
type Review = Database['public']['Tables']['reviews']['Row'];

interface BusinessDetailsProps {
  businessId: string;
}

export function BusinessDetails({ businessId }: BusinessDetailsProps) {
  const { user, profile } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [displayReviews, setDisplayReviews] = useState<{ id: string; rating: number; comment: string | null; created_at: string; display_name: string }[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const EMAIL_SERVER_URL = (import.meta as any).env?.VITE_EMAIL_SERVER_URL || 'http://localhost:4000';
  const [isRecommended, setIsRecommended] = useState(false);

  useEffect(() => {
    loadBusinessData();
  }, [businessId]);

  useEffect(() => {
    document.title = business ? `Business — ${business.name}` : 'Business — BookEase';
  }, [business]);

  // Public page: avoid joining restricted tables to keep reviews visible under RLS

  const loadBusinessData = async () => {
    try {
      // Support slug or raw id in route param
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

      const realBusinessId = businessData?.id || businessId;

      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', realBusinessId)
        .eq('is_active', true)
        .order('name');

      setServices(servicesData || []);

      const { data: staffData } = await supabase
        .from('staff_members')
        .select(`
          *,
          profile:profiles(profile_picture_url, phone_number)
        `)
        .eq('business_id', realBusinessId)
        .eq('is_active', true);

      setStaff(staffData as any || []);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('business_id', realBusinessId)
        .order('created_at', { ascending: false })
        .limit(10);

      setReviews((reviewsData as any) || []);

      // Fetch display names for reviews via backend (service role join); fallback to generic
      try {
        const resp = await fetch(`${EMAIL_SERVER_URL}/businesses/${realBusinessId}/reviews`);
        const json = await resp.json().catch(() => null);
        if (resp.ok && json?.ok && Array.isArray(json.reviews)) {
          setDisplayReviews(json.reviews);
        } else {
          setDisplayReviews((reviewsData || []).map((r: any) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            display_name: 'Client',
          })));
        }
      } catch (e) {
        setDisplayReviews((reviewsData || []).map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          display_name: 'Client',
        })));
      }

      // Fetch recommended flag from email server
      try {
        const r = await fetch(`${EMAIL_SERVER_URL}/businesses/${realBusinessId}/recommended`);
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok) setIsRecommended(Boolean(j.is_recommended));
      } catch {}
    } catch (error) {
      console.error('Error loading business:', error);
    } finally {
      setLoading(false);
    }
  };

  const averageRating = displayReviews.length > 0
    ? displayReviews.reduce((acc, r) => acc + r.rating, 0) / displayReviews.length
    : 0;

  const handleBookAppointment = () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (selectedService) {
      window.location.href = `/book?business=${businessId}&service=${selectedService.id}`;
    }
  };

  const getMapEmbedSrc = (): { src: string | null; link: string | null } => {
    if (!business) return { src: null, link: null };
    if (business.latitude && business.longitude) {
      const q = `${business.latitude},${business.longitude}`;
      return { src: `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`, link: null };
    }
    // Fallback: use address/city if available
    const addrParts = [business.address, business.city].filter(Boolean).join(', ');
    if (addrParts) {
      return { src: `https://www.google.com/maps?q=${encodeURIComponent(addrParts)}&z=15&output=embed`, link: null };
    }
    // Try to find a maps link in description
    const desc: string = business.description || '';
    const linkMatch = desc.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps)[^\s]+/i);
    if (linkMatch) {
      // Short or long links often cannot be embedded due to framing restrictions; expose as clickable
      return { src: null, link: linkMatch[0] };
    }
    return { src: null, link: null };
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

  const mapData = getMapEmbedSrc();

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
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold">{business.name}</h1>
              {isRecommended && <RecommendedBadge size="sm" />}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                <MapPin className="w-5 h-5" />
                <span>{business.address}, {business.city}</span>
              </div>
              {business.phone_number && (
                <div className="flex items-center gap-1">
                  <Phone className="w-5 h-5" />
                  <a href={`tel:${business.phone_number}`} className="underline">{business.phone_number}</a>
                </div>
              )}
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

        {mapData && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold text-slate-900">Location</h2>
            </CardHeader>
            <CardBody>
              {mapData.src ? (
                <div className="rounded-lg overflow-hidden border border-slate-200">
                  <iframe
                    title="Business Location"
                    src={mapData.src}
                    width="100%"
                    height="300"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-sm text-slate-700">Open the business location in Google Maps.</p>
                  <a href={mapData.link!} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 underline">Open Map</a>
                </div>
              )}
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

            {/* Removed Our Team section */}
            
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold text-slate-900">Reviews ({displayReviews.length})</h2>
              </CardHeader>
              <CardBody>
                {displayReviews.length === 0 ? (
                  <p className="text-slate-600">No reviews yet</p>
                ) : (
                  <div className="space-y-4">
                    {displayReviews.map((review) => {
                      return (
                        <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-500" />
                            </div>
                            <span className="text-sm font-medium text-slate-900">{review.display_name}</span>
                            <span className="text-sm text-slate-500 ml-2">
                              {new Date(review.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mb-2">
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
                          </div>
                          {review.comment && (
                            <p className="text-slate-700">{review.comment}</p>
                          )}
                        </div>
                      );
                    })}
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
                      {selectedService.photo_url && (
                        <img src={selectedService.photo_url} alt="Service" className="w-full h-40 object-cover rounded mb-2" />
                      )}
                      <p className="text-sm font-medium text-slate-700">Selected Service</p>
                      <p className="font-semibold text-slate-900">{selectedService.name}</p>
                      <p className="text-sm text-slate-600">GHS {selectedService.price} · {selectedService.duration_minutes} min</p>
                    </div>
                  )}

                  <Button
                    fullWidth
                    disabled={!selectedService}
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
