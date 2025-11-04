import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { RecommendedBadge } from '../components/RecommendedBadge';
import { 
  Eye, 
  EyeOff, 
  Building2, 
  DollarSign, 
  Calendar, 
  Users, 
  TrendingUp,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Clock,
  Award
} from 'lucide-react';

interface Business {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  is_listed: boolean;
  is_recommended: boolean;
  created_at: string;
  users: { email: string };
  analytics: {
    totalBookings: number;
    confirmedBookings: number;
    totalRevenue: number;
  };
}

interface DailyStat {
  date: string;
  totalBookings: number;
  confirmedBookings: number;
  revenue: number;
  appointments: any[];
}

interface BusinessAnalytics {
  appointments: any[];
  dailyStats: DailyStat[];
}

const EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:4000';

export default function Developer() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminEnabled, setAdminEnabled] = useState(false);
  
  // Business management state
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businessAnalytics, setBusinessAnalytics] = useState<BusinessAnalytics | null>(null);
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Ensure businesses load whenever authenticated state becomes true
  useEffect(() => {
    if (isAuthenticated) {
      loadBusinesses();
    }
  }, [isAuthenticated]);

  // Auto-expand and load analytics when there is a single business
  useEffect(() => {
    if (isAuthenticated && businesses.length === 1) {
      const b = businesses[0];
      setSelectedBusiness(b);
      setExpandedBusiness(b.id);
      loadBusinessAnalytics(b.id);
    }
  }, [isAuthenticated, businesses]);

  // Authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    try {
      const response = await fetch(`${EMAIL_SERVER_URL}/developer/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();
      
      if (data.ok && data.authenticated) {
        setIsAuthenticated(true);
        // Check admin/server health to know if write operations are available
        try {
          const healthResp = await fetch(`${EMAIL_SERVER_URL}/health`);
          const health = await healthResp.json();
          setAdminEnabled(Boolean(health?.serviceRole));
        } catch {}
        loadBusinesses();
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (error) {
      setAuthError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  // Load all businesses
  const loadBusinesses = async () => {
    try {
      const response = await fetch(`${EMAIL_SERVER_URL}/developer/businesses`);
      const data = await response.json();
      
      if (data.ok) {
        setBusinesses(data.businesses);
      }
    } catch (error) {
      console.error('Failed to load businesses:', error);
    }
  };

  // Load detailed analytics for a business
  const loadBusinessAnalytics = async (businessId: string) => {
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      
      const response = await fetch(
        `${EMAIL_SERVER_URL}/developer/businesses/${businessId}/analytics?${params}`
      );
      const data = await response.json();
      
      if (data.ok) {
        setBusinessAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to load business analytics:', error);
    }
  };

  // Toggle business listing status
  const toggleBusinessListing = async (businessId: string) => {
    if (!adminEnabled) {
      alert('Admin mode is disabled. Configure SUPABASE_SERVICE_ROLE_KEY on the backend to enable listing toggles.');
      return;
    }
    try {
      const response = await fetch(
        `${EMAIL_SERVER_URL}/developer/businesses/${businessId}/toggle-listing`,
        { method: 'POST' }
      );
      const data = await response.json();
      
      if (data.ok) {
        setBusinesses(prev => 
          prev.map(business => 
            business.id === businessId 
              ? { ...business, is_listed: data.is_listed }
              : business
          )
        );
        // Refresh from server to ensure counts and state are in sync
        loadBusinesses();
        // Reflect in selected business panel if currently open
        setSelectedBusiness(prev => prev && prev.id === businessId ? { ...prev, is_listed: data.is_listed } as Business : prev);
      } else {
        alert(data.error || 'Failed to toggle listing status');
      }
    } catch (error) {
      console.error('Failed to toggle listing:', error);
      alert('Failed to toggle listing. Check server logs and configuration.');
    }
  };
  
  // Toggle business recommended status
  const toggleBusinessRecommended = async (businessId: string) => {
    if (!adminEnabled) {
      alert('Admin mode is disabled. Configure SUPABASE_SERVICE_ROLE_KEY on the backend to enable recommended badge toggles.');
      return;
    }
    try {
      const response = await fetch(
        `${EMAIL_SERVER_URL}/developer/businesses/${businessId}/toggle-recommended`,
        { method: 'POST' }
      );
      const data = await response.json();
      
      if (data.ok) {
        setBusinesses(prev => 
          prev.map(business => 
            business.id === businessId 
              ? { ...business, is_recommended: data.is_recommended }
              : business
          )
        );
        // Refresh from server to ensure counts and state are in sync
        loadBusinesses();
        // Reflect in selected business panel if currently open
        setSelectedBusiness(prev => prev && prev.id === businessId ? { ...prev, is_recommended: data.is_recommended } as Business : prev);
      } else {
        alert(data.error || 'Failed to toggle recommended status');
      }
    } catch (error) {
      console.error('Failed to toggle recommended status:', error);
      alert('Failed to toggle recommended status.');
    }
  };

  // Handle business selection
  const handleBusinessSelect = (business: Business) => {
    setSelectedBusiness(business);
    setExpandedBusiness(expandedBusiness === business.id ? null : business.id);
    if (expandedBusiness !== business.id) {
      loadBusinessAnalytics(business.id);
    }
  };

  // Filter daily stats by selected date
  const selectedDateStats = businessAnalytics?.dailyStats.find(
    stat => stat.date === selectedDate
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="p-6">
            <div className="text-center mb-6">
              <Building2 className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900">Developer Access</h1>
              <p className="text-gray-600 mt-2">Enter password to access business management</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Developer Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {authError && (
                <div className="text-red-600 text-sm text-center">{authError}</div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Authenticating...' : 'Access Dashboard'}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Developer Dashboard</h1>
              <p className="text-gray-600 mt-2">Manage all businesses and view analytics</p>
            </div>
            <Button
              onClick={() => setIsAuthenticated(false)}
              variant="outline"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Businesses</p>
                <p className="text-2xl font-bold text-gray-900">{businesses.length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center">
              <ToggleRight className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Listed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {businesses.filter(b => b.is_listed).length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {businesses.reduce((sum, b) => sum + b.analytics.totalBookings, 0)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  GHS {businesses.reduce((sum, b) => sum + b.analytics.totalRevenue, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Date Range Filter */}
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Analytics Date Range</h3>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <Button
              onClick={() => selectedBusiness && loadBusinessAnalytics(selectedBusiness.id)}
              disabled={!selectedBusiness}
            >
              Apply Filter
            </Button>
          </div>
        </Card>

        {/* Business List */}
        {!adminEnabled && (
          <Card className="p-4 mb-6 bg-yellow-50 border border-yellow-200">
            <p className="text-sm text-yellow-800">
              Admin mode is disabled. Write operations (like list/unlist) are unavailable until the backend is configured with a valid `SUPABASE_SERVICE_ROLE_KEY`.
            </p>
          </Card>
        )}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">All Businesses</h2>
          
          <div className="space-y-4">
            {businesses.map((business) => (
              <div key={business.id} className="border rounded-lg p-4">
                {/* Business Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleBusinessSelect(business)}
                      className="flex items-center space-x-2 text-left"
                    >
                      {expandedBusiness === business.id ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">{business.name}</h3>
                        <p className="text-sm text-gray-600">{business.users.email}</p>
                      </div>
                    </button>
                    {business.is_recommended && (
                      <RecommendedBadge size="sm" className="ml-2" />
                    )}
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Quick Stats */}
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {business.analytics.confirmedBookings} bookings
                      </span>
                      <span className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        GHS {business.analytics.totalRevenue.toFixed(2)}
                      </span>
                    </div>

                    {/* Recommended Toggle */}
                    <button
                      onClick={() => toggleBusinessRecommended(business.id)}
                      disabled={!adminEnabled}
                      title={!adminEnabled ? 'Enable admin mode to toggle recommended badge' : ''}
                      className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                        business.is_recommended
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      } ${!adminEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Award className="h-4 w-4" />
                      {business.is_recommended ? 'Recommended' : 'Recommend'}
                    </button>

                    {/* Listing Toggle */}
                    <button
                      onClick={() => toggleBusinessListing(business.id)}
                      disabled={!adminEnabled}
                      title={!adminEnabled ? 'Enable admin mode to toggle listing' : ''}
                      className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                        business.is_listed
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      } ${!adminEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {business.is_listed ? (
                        <ToggleRight className="h-4 w-4" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                      {business.is_listed ? 'Listed' : 'Unlisted'}
                    </button>
                  </div>
                </div>

                {/* Expanded Business Details */}
                {expandedBusiness === business.id && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Business Info */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4">Business Information</h4>
                        <div className="space-y-3">
                          <div className="flex items-start space-x-2">
                            <Building2 className="h-4 w-4 text-gray-400 mt-1" />
                            <div>
                              <p className="font-medium">{business.name}</p>
                              <p className="text-sm text-gray-600">{business.description}</p>
                            </div>
                          </div>
                          
                          {business.address && (
                            <div className="flex items-start space-x-2">
                              <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                              <p className="text-sm text-gray-600">{business.address}</p>
                            </div>
                          )}
                          
                          {(business as any).phone_number || business.phone ? (
                            <div className="flex items-center space-x-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <p className="text-sm text-gray-600">{(business as any).phone_number || business.phone}</p>
                            </div>
                          ) : null}
                          
                          {(business as any).email || business.users.email ? (
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <p className="text-sm text-gray-600">{(business as any).email || business.users.email}</p>
                            </div>
                          ) : null}
                          
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <p className="text-sm text-gray-600">
                              Created: {new Date(business.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Analytics */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4">Analytics Overview</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm text-blue-600 font-medium">Total Bookings</p>
                            <p className="text-2xl font-bold text-blue-900">
                              {business.analytics.totalBookings}
                            </p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-sm text-green-600 font-medium">Confirmed</p>
                            <p className="text-2xl font-bold text-green-900">
                              {business.analytics.confirmedBookings}
                            </p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg col-span-2">
                            <p className="text-sm text-purple-600 font-medium">Total Revenue</p>
                            <p className="text-3xl font-bold text-purple-900">
                              GHS {business.analytics.totalRevenue.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Daily Analytics */}
                    {businessAnalytics && selectedBusiness?.id === business.id && (
                      <div className="mt-6 pt-6 border-t">
                        <h4 className="font-semibold text-gray-900 mb-4">Daily Analytics</h4>
                        
                        {/* Date Selector */}
                        <div className="mb-4">
                          <select
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2"
                          >
                            <option value="">Select a date</option>
                            {businessAnalytics.dailyStats.map((stat) => (
                              <option key={stat.date} value={stat.date}>
                                {new Date(stat.date).toLocaleDateString()} - {stat.confirmedBookings} bookings
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Selected Date Details */}
                        {selectedDateStats && (
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h5 className="font-medium text-gray-900 mb-3">
                              {new Date(selectedDateStats.date).toLocaleDateString()}
                            </h5>
                            
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="text-center">
                                <p className="text-sm text-gray-600">Total Bookings</p>
                                <p className="text-xl font-bold">{selectedDateStats.totalBookings}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-sm text-gray-600">Confirmed</p>
                                <p className="text-xl font-bold text-green-600">{selectedDateStats.confirmedBookings}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-sm text-gray-600">Revenue</p>
                                <p className="text-xl font-bold text-green-600">GHS {selectedDateStats.revenue.toFixed(2)}</p>
                              </div>
                            </div>

                            {/* Appointments List */}
                            {selectedDateStats.appointments.length > 0 && (
                              <div>
                                <h6 className="font-medium text-gray-900 mb-2">Appointments</h6>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {selectedDateStats.appointments.map((appointment, index) => (
                                    <div key={index} className="bg-white p-3 rounded border text-sm">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="font-medium">{appointment.services?.name || 'Service'}</p>
                                          <p className="text-gray-600">{appointment.users?.email}</p>
                                          {appointment.staff?.name && (
                                            <p className="text-gray-600">Staff: {appointment.staff.name}</p>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <p className={`font-medium ${
                                            appointment.status === 'confirmed' ? 'text-green-600' : 'text-yellow-600'
                                          }`}>
                                            {appointment.status}
                                          </p>
                                          <p className="text-gray-600">
                                            GHS {appointment.services?.price?.toFixed(2) || '0.00'}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {new Date(appointment.start_time).toLocaleTimeString()}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {businesses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No businesses found
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}