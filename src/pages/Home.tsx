import { useState, useEffect } from 'react';
import { Search, MapPin, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Input } from '../components/Input';
import { Card, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Layout } from '../components/Layout';
import type { Database } from '../lib/database.types';

type BusinessProfile = Database['public']['Tables']['business_profiles']['Row'];
type Review = Database['public']['Tables']['reviews']['Row'];

interface BusinessWithStats extends BusinessProfile {
  averageRating: number;
  reviewCount: number;
  services: { name: string; price: number }[];
}

export function Home() {
  const [businesses, setBusinesses] = useState<BusinessWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    document.title = 'Home — BookEase';
  }, []);

  const loadBusinesses = async () => {
    try {
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (businessError) throw businessError;

      const businessesWithStats = await Promise.all(
        (businessData || []).map(async (business) => {
          const { data: reviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('business_id', business.id);

          const { data: services } = await supabase
            .from('services')
            .select('name, price')
            .eq('business_id', business.id)
            .eq('is_active', true)
            .limit(3);

          const averageRating = reviews && reviews.length > 0
            ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
            : 0;

          return {
            ...business,
            averageRating,
            reviewCount: reviews?.length || 0,
            services: services || [],
          };
        })
      );

      setBusinesses(businessesWithStats);
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBusinesses = businesses.filter((business) => {
    const matchesSearch = !searchQuery ||
      business.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.services.some(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCity = !cityFilter ||
      business.city.toLowerCase().includes(cityFilter.toLowerCase());

    return matchesSearch && matchesCity;
  });

  return (
    <Layout>
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl p-8 md:p-12 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Find Your Perfect Service Provider
          </h1>
          <p className="text-xl text-slate-200 mb-8">
            Book appointments with top-rated salons, barbershops, and spas in your area
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for services or businesses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Enter city..."
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'Business' : 'Businesses'} Found
          </h2>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-slate-200 rounded-t-xl" />
                  <CardBody>
                    <div className="h-6 bg-slate-200 rounded mb-2" />
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No businesses found</h3>
                <p className="text-slate-600">Try adjusting your search or filters</p>
              </CardBody>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBusinesses.map((business) => (
                <Card key={business.id} hover className="overflow-hidden cursor-pointer">
                  <div
                    className="h-48 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center"
                    style={business.cover_photo_url ? {
                      backgroundImage: `url(${business.cover_photo_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    } : {}}
                  >
                    {!business.cover_photo_url && (
                      <span className="text-4xl font-bold text-slate-400">
                        {business.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <CardBody>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{business.name}</h3>

                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">{business.city}</span>
                    </div>

                    {business.reviewCount > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="ml-1 text-sm font-medium text-slate-900">
                            {business.averageRating.toFixed(1)}
                          </span>
                        </div>
                        <span className="text-sm text-slate-500">
                          ({business.reviewCount} {business.reviewCount === 1 ? 'review' : 'reviews'})
                        </span>
                      </div>
                    )}

                    {business.description && (
                      <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                        {business.description}
                      </p>
                    )}

                    {business.services.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-slate-500 uppercase mb-2">Popular Services</p>
                        <div className="space-y-1">
                          {business.services.slice(0, 2).map((service, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                              <span className="text-slate-700">{service.name}</span>
                              <span className="font-medium text-slate-900">GHS {service.price}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      fullWidth
                      variant="primary"
                      onClick={() => window.location.href = `/business/${business.id}`}
                    >
                      View Details
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
