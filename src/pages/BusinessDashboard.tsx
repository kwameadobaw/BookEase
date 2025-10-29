import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Plus, CreditCard as Edit2, Trash2, DollarSign, Clock, Users, Image as ImageIcon } from 'lucide-react';
import { MapPicker } from '../components/MapPicker';
import type { Database } from '../lib/database.types';

type BusinessProfile = Database['public']['Tables']['business_profiles']['Row'];
type Service = Database['public']['Tables']['services']['Row'];
type StaffMember = Database['public']['Tables']['staff_members']['Row'];
type WorkingHour = Database['public']['Tables']['working_hours']['Row'];
type BusinessWorkingHour = Database['public']['Tables']['business_working_hours']['Row'];

export function BusinessDashboard() {
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [businessHours, setBusinessHours] = useState<Record<number, { start: string; end: string } | null>>({
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  });

  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  const [businessForm, setBusinessForm] = useState({
    name: '',
    address: '',
    city: '',
    description: '',
    email: '',
    phone_number: '',
    mobile_money_number: '',
    business_type: '',
    latitude: '' as unknown as number | null,
    longitude: '' as unknown as number | null,
  });

  const [locationDisplay, setLocationDisplay] = useState('');

  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    price: '',
    duration_minutes: '',
    photoFile: null as File | null,
    photoUrlInput: '',
  });

  const [staffForm, setStaffForm] = useState({
    name: '',
    position: '',
    bio: '',
    photoFile: null as File | null,
    photoUrlInput: '',
  });

  // Report date range
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');

  const coverInputRef = useRef<HTMLInputElement>(null);
  const servicePhotoInputRef = useRef<HTMLInputElement>(null);
  const staffPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Business Dashboard — BookEase';
  }, []);

  useEffect(() => {
    if (authLoading) return; // wait until auth/profile are loaded
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (profile?.user_type !== 'BUSINESS_OWNER') {
      // Not a business owner; show fallback UI and allow switching
      setLoading(false);
      return;
    }
    loadBusinessData();
  }, [user, profile, authLoading]);

  const loadBusinessData = async () => {
    if (!user) return;

    try {
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      setBusiness(businessData);

      if (businessData) {
        setBusinessForm({
          name: businessData.name,
          address: businessData.address,
          city: businessData.city,
          description: businessData.description || '',
          email: (businessData as any).email || '',
        });
        setBusinessForm({
          name: businessData.name,
          address: businessData.address,
          city: businessData.city,
          description: businessData.description || '',
          email: (businessData as any).email || '',
          phone_number: (businessData as any).phone_number || '',
          mobile_money_number: (businessData as any).mobile_money_number || '',
          business_type: (businessData as any).business_type || '',
          latitude: (businessData as any).latitude ?? null,
          longitude: (businessData as any).longitude ?? null,
        });

        const hasCoords = (businessData as any).latitude != null && (businessData as any).longitude != null;
        setLocationDisplay(
          hasCoords
            ? `Picked location (Lat ${Number((businessData as any).latitude).toFixed(5)}, Lng ${Number((businessData as any).longitude).toFixed(5)})`
            : [businessData.address, businessData.city].filter(Boolean).join(', ')
        );

        // Load business working hours
        const { data: hoursData } = await supabase
          .from('business_working_hours')
          .select('*')
          .eq('business_id', businessData.id);
        const map: Record<number, { start: string; end: string } | null> = { 0: null,1:null,2:null,3:null,4:null,5:null,6:null };
        (hoursData || []).forEach((h: any) => {
          map[h.day_of_week] = { start: h.start_time, end: h.end_time };
        });
        setBusinessHours(map);

        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .eq('business_id', businessData.id)
          .order('name');

        setServices(servicesData || []);

        const { data: staffData } = await supabase
          .from('staff_members')
          .select('*')
          .eq('business_id', businessData.id)
          .order('created_at', { ascending: true });

        setStaff(staffData || []);
      }
    } catch (error) {
      console.error('Error loading business:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setBusinessForm({ ...businessForm, latitude, longitude });
        setLocationDisplay(`Picked location (Lat ${Number(latitude).toFixed(5)}, Lng ${Number(longitude).toFixed(5)})`);
      },
      (err) => {
        alert(`Failed to get current location: ${err.message || 'Unknown error'}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSwitchToBusiness = async () => {
    const { error } = await updateProfile({ user_type: 'BUSINESS_OWNER' as any });
    if (error) {
      // Fallback: ensure profile exists and set user_type
      if (!user) {
        alert('Not signed in');
        return;
      }
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, user_type: 'BUSINESS_OWNER' as any }, { onConflict: 'id' });
      if (upsertError) {
        alert('Failed to switch account to Business Owner');
        return;
      }
    }
    // After switching, load data and open the create form
    await loadBusinessData();
    setShowBusinessForm(true);
  };

  const handleSaveBusiness = async () => {
    if (!user) return;

    const errors: {[key: string]: string} = {};
    if (!businessForm.name) errors.name = 'Business name is required';
    if (!businessForm.address) errors.address = 'Address is required';
    if (!businessForm.city) errors.city = 'City is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    const slugify = (name: string) =>
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    try {
      const baseSlug = slugify(businessForm.name);
      let slug = baseSlug || undefined;
      if (slug) {
        // Ensure uniqueness
        const { data: existing } = await supabase
          .from('business_profiles')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        if (existing && (!business || existing.id !== business.id)) {
          const suffix = Math.random().toString(36).slice(2, 6);
          slug = `${slug}-${suffix}`;
        }
      }

      if (business) {
        const { error } = await supabase
          .from('business_profiles')
          .update({ ...businessForm, slug: slug ?? null })
          .eq('id', business.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('business_profiles')
          .insert({
            owner_id: user.id,
            ...businessForm,
            slug: slug ?? null,
          });

        if (error) throw error;
      }

      setShowBusinessForm(false);
      loadBusinessData();
    } catch (error: any) {
      console.error('Error saving business:', error);
      const message = error?.message || error?.error?.message || 'Failed to save business profile';
      alert(message);
    }
  };

  const handleSaveService = async () => {
    if (!business) return;

    try {
      if (!serviceForm.name || !serviceForm.name.trim()) {
        alert('Service name is required');
        return;
      }
      const priceNum = parseFloat(serviceForm.price);
      const durationNum = parseInt(serviceForm.duration_minutes);
      if (Number.isNaN(priceNum) || priceNum <= 0) {
        alert('Please enter a valid price');
        return;
      }
      if (Number.isNaN(durationNum) || durationNum <= 0) {
        alert('Please enter a valid duration (minutes)');
        return;
      }

      const serviceData = {
        business_id: business.id,
        name: serviceForm.name.trim(),
        description: serviceForm.description || null,
        price: priceNum,
        duration_minutes: durationNum,
        photo_url: editingService ? (serviceForm.photoUrlInput || editingService.photo_url || null) : (serviceForm.photoUrlInput || null),
      };

      if (editingService) {
        const { data, error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id)
          .select('*')
          .maybeSingle();

        if (error) throw error;
        // If file provided, upload and update photo_url
        if (data && serviceForm.photoFile) {
          const ext = serviceForm.photoFile.name.split('.').pop() || 'jpg';
          const path = `services/${data.id}/photo.${ext}`;
          const publicUrl = await uploadImage(serviceForm.photoFile, path);
          const { error: updateError } = await supabase
            .from('services')
            .update({ photo_url: publicUrl })
            .eq('id', data.id);
          if (updateError) throw updateError;
        }
      } else {
        const { data, error } = await supabase
          .from('services')
          .insert(serviceData)
          .select('*')
          .maybeSingle();

        if (error) throw error;
        if (data && serviceForm.photoFile) {
          const ext = serviceForm.photoFile.name.split('.').pop() || 'jpg';
          const path = `services/${data.id}/photo.${ext}`;
          const publicUrl = await uploadImage(serviceForm.photoFile, path);
          const { error: updateError } = await supabase
            .from('services')
            .update({ photo_url: publicUrl })
            .eq('id', data.id);
          if (updateError) throw updateError;
        }
      }

      setShowServiceForm(false);
      setEditingService(null);
      setServiceForm({ name: '', description: '', price: '', duration_minutes: '', photoFile: null, photoUrlInput: '' });
      loadBusinessData();
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Failed to save service');
    }
  };

  const uploadImage = async (file: File, path: string) => {
    const { error: uploadError } = await supabase.storage.from('business-assets').upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('business-assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSaveStaff = async () => {
    if (!business) return;
    try {
      let inserted: StaffMember | null = null;
      if (editingStaff) {
        const { data, error } = await supabase
          .from('staff_members')
          .update({ name: staffForm.name || null, position: staffForm.position || null, bio: staffForm.bio || null, photo_url: staffForm.photoUrlInput || editingStaff.photo_url || null })
          .eq('id', editingStaff.id)
          .select('*')
          .maybeSingle();
        if (error) throw error;
        inserted = data;
      } else {
        const { data, error } = await supabase
          .from('staff_members')
          .insert({
            name: staffForm.name || null,
            business_id: business.id,
            position: staffForm.position || null,
            bio: staffForm.bio || null,
          } as any)
          .select('*')
          .maybeSingle();
        if (error) throw error;
        inserted = data;
      }

      if (inserted && staffForm.photoFile) {
        const ext = staffForm.photoFile.name.split('.').pop() || 'jpg';
        const path = `staff/${inserted.id}/photo.${ext}`;
        const publicUrl = await uploadImage(staffForm.photoFile, path);
        const { error: updateError } = await supabase
          .from('staff_members')
          .update({ photo_url: publicUrl })
          .eq('id', inserted.id);
        if (updateError) throw updateError;
      }

      setShowStaffForm(false);
      setEditingStaff(null);
      setStaffForm({ name: '', position: '', bio: '', photoFile: null, photoUrlInput: '' });
      loadBusinessData();
    } catch (error) {
      console.error('Error saving staff:', error);
      alert('Failed to save staff member');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      const { error } = await supabase.from('staff_members').delete().eq('id', staffId);
      if (error) throw error;
      loadBusinessData();
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert('Failed to delete staff');
    }
  };


  const handleSaveBusinessHours = async () => {
    if (!business) return;
    const payload: Partial<BusinessWorkingHour>[] = [];
    for (let d = 0; d <= 6; d++) {
      const slot = businessHours[d];
      if (slot && slot.start && slot.end) {
        payload.push({ business_id: business.id, day_of_week: d, start_time: slot.start, end_time: slot.end } as any);
      }
    }
    try {
      // Replace upsert with delete+insert to avoid unique constraint requirement
      await supabase
        .from('business_working_hours')
        .delete()
        .eq('business_id', business.id);
  
      if (payload.length) {
        const { error } = await supabase
          .from('business_working_hours')
          .insert(payload);
        if (error) throw error;
      }
      loadBusinessData();
    } catch (error) {
      console.error('Error saving business working hours:', error);
      alert('Failed to save working hours');
    }
  };

  const handleDownloadReport = async () => {
    if (!business) {
      alert('No business profile found');
      return;
    }
    try {
      const base = (import.meta as any).env?.VITE_EMAIL_SERVER_URL || 'http://localhost:4000';
      const params = new URLSearchParams();
      if (reportStartDate) params.set('startDate', reportStartDate);
      if (reportEndDate) params.set('endDate', reportEndDate);
      const url = `${base}/businesses/${business.id}/report?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to generate report');
      }
      const blob = await res.blob();
      const filename = `bookease-report-${business.slug || business.id}-${reportStartDate || 'start'}-${reportEndDate || 'end'}.pdf`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(link.href);
      link.remove();
    } catch (e: any) {
      const message = e?.message || 'Failed to download report';
      alert(message);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;
      loadBusinessData();
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Failed to delete service');
    }
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setShowServiceForm(true);
    setServiceForm({
      name: service.name || '',
      description: service.description || '',
      price: String(service.price || ''),
      duration_minutes: String(service.duration_minutes || ''),
      photoFile: null,
      photoUrlInput: service.photo_url || '',
    });
  };

  const startCreateService = () => {
    setEditingService(null);
    setServiceForm({
      name: '',
      description: '',
      price: '',
      duration_minutes: '',
      photoFile: null,
      photoUrlInput: '',
    });
    setShowServiceForm(true);
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

  // Fallback UI for non-business accounts
  if (profile && profile.user_type !== 'BUSINESS_OWNER') {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold text-slate-900">Switch to Business Account</h2>
            </CardHeader>
            <CardBody>
              <p className="text-slate-700 mb-4">
                Your account is currently set as a client. Switch to a Business Owner
                account to create and manage your business profile.
              </p>
              <div className="flex gap-3">
                <Button onClick={handleSwitchToBusiness}>Switch to Business Account</Button>
                <Button variant="outline" onClick={() => window.location.href = '/'}>
                  Go to Home
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Business Dashboard</h1>
          <p className="text-slate-600">Manage your business profile and services</p>
        </div>

        {/* Reports */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-xl font-bold text-slate-900">Reports</h2>
          </CardHeader>
          <CardBody>
            <div className="grid md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <Input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                <Input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
              </div>
              <div>
                <Button onClick={handleDownloadReport}>Download PDF Report</Button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Generates a PDF summary of appointments, revenue, and reviews for the selected period.</p>
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Business Profile</h2>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShowBusinessForm(!showBusinessForm)}>
                <Edit2 className="w-4 h-4 mr-1" />
                {business ? 'Edit' : 'Create'}
              </Button>
              {business && (
                <>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      if (!business) return;
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const ext = file.name.split('.').pop() || 'jpg';
                        const path = `business/${business.id}/cover.${ext}`;
                        const publicUrl = await uploadImage(file, path);
                        const { error } = await supabase
                          .from('business_profiles')
                          .update({ cover_photo_url: publicUrl })
                          .eq('id', business.id);
                        if (error) throw error;
                        loadBusinessData();
                      } catch (err) {
                        console.error('Error uploading cover photo', err);
                        alert('Failed to upload cover photo');
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={() => coverInputRef.current?.click()}>
                    <ImageIcon className="w-4 h-4 mr-1" />
                    Upload Cover Photo
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardBody>
            {(!business && !showBusinessForm) && (
              <div className="text-center py-8">
                <p className="text-slate-600 mb-4">You haven't created a business profile yet</p>
                <Button onClick={() => setShowBusinessForm(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create Business Profile
                </Button>
              </div>
            )}

            {showBusinessForm && (
              <div className="space-y-4">
                {business?.cover_photo_url && (
                  <img src={business.cover_photo_url} alt="Cover" className="w-full h-40 object-cover rounded-lg" />
                )}
                <Input
                  label="Business Email"
                  value={businessForm.email}
                  onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
                  placeholder="you@business.com"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Phone Number"
                    value={businessForm.phone_number}
                    onChange={(e) => setBusinessForm({ ...businessForm, phone_number: e.target.value })}
                    placeholder="e.g., +233 555 123 456"
                  />
                  <Input
                    label="Mobile Money Number"
                    value={businessForm.mobile_money_number}
                    onChange={(e) => setBusinessForm({ ...businessForm, mobile_money_number: e.target.value })}
                    placeholder="e.g., 0244 123 456"
                  />
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Business Type</label>
                    <select
                      value={businessForm.business_type || ''}
                      onChange={(e) => setBusinessForm({ ...businessForm, business_type: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="">Select type…</option>
                      <option value="Barbershop">Barbershop</option>
                      <option value="Salon">Salon</option>
                      <option value="Hair Salon">Hair Salon</option>
                      <option value="Nail Salon">Nail Salon</option>
                      <option value="Spa">Spa</option>
                      <option value="Beauty">Beauty</option>
                      <option value="Massage">Massage</option>
                    </select>
                  </div>
                </div>
                <Input
                  label="Business Name"
                  error={formErrors.name}
                  value={businessForm.name}
                  onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
                  required
                />
                <Input
                  label="Address"
                  error={formErrors.address}
                  value={businessForm.address}
                  onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                  required
                />
                <Input
                  label="City"
                  error={formErrors.city}
                  value={businessForm.city}
                  onChange={(e) => setBusinessForm({ ...businessForm, city: e.target.value })}
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <Input
                    label="Location"
                    value={locationDisplay}
                    onChange={(e) => setLocationDisplay(e.target.value)}
                    placeholder="Address, City or pick current location"
                  />
                  <Button variant="outline" onClick={handleUseCurrentLocation}>Use Current Location</Button>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Pick on Map</label>
                  <MapPicker
                    latitude={businessForm.latitude ?? null}
                    longitude={businessForm.longitude ?? null}
                    onChange={(lat, lng) => {
                      setBusinessForm({ ...businessForm, latitude: lat, longitude: lng });
                      setLocationDisplay(`Picked location (Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)})`);
                    }}
                    height={260}
                  />
                  <p className="text-xs text-slate-500 mt-2">Drag the pin or click on the map to set your location.</p>
                </div>
                <p className="text-xs text-slate-500">We’ll embed the map using your picked location or your address/city.</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={businessForm.description}
                    onChange={(e) => setBusinessForm({ ...businessForm, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                    rows={4}
                    placeholder="Tell clients about your business..."
                  />
                </div>
                
                {/* Business Working Hours */}
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-3">Business Working Hours</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[0,1,2,3,4,5,6].map((d) => (
                      <div key={d} className="flex items-center gap-3">
                        <span className="w-24 text-slate-700">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]}</span>
                        <input 
                          type="time" 
                          className="px-3 py-2 border border-slate-300 rounded-lg" 
                          value={businessHours[d]?.start || ''} 
                          onChange={(e) => setBusinessHours({ 
                            ...businessHours, 
                            [d]: e.target.value ? { start: e.target.value, end: businessHours[d]?.end || '' } : null 
                          })} 
                        />
                        <span className="text-slate-500">-</span>
                        <input 
                          type="time" 
                          className="px-3 py-2 border border-slate-300 rounded-lg" 
                          value={businessHours[d]?.end || ''} 
                          onChange={(e) => setBusinessHours({ 
                            ...businessHours, 
                            [d]: e.target.value ? { start: businessHours[d]?.start || '', end: e.target.value } : null 
                          })} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button onClick={handleSaveBusiness}>Save Business</Button>
                  <Button onClick={handleSaveBusinessHours}>Save Working Hours</Button>
                  <Button variant="outline" onClick={() => setShowBusinessForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {business && !showBusinessForm && (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{business?.name}</h3>
                <p className="text-slate-600 mb-1">{business?.address}</p>
                <p className="text-slate-600 mb-4">{business?.city}</p>
                {business?.description && (
                  <p className="text-slate-700">{business.description}</p>
                )}
              </div>
            )}
            </CardBody>
          </Card>

          {business && (
            <>
              <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">Services</h2>
                  <Button size="sm" onClick={startCreateService}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Service
                  </Button>
                </CardHeader>
                <CardBody>
                  {showServiceForm ? (
                    <div className="mb-6 p-4 bg-slate-50 rounded-lg space-y-4">
                      <h3 className="font-semibold text-slate-900">
                        {editingService ? 'Edit Service' : 'New Service'}
                      </h3>
                      <Input
                        label="Service Name"
                        value={serviceForm.name}
                        onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                        required
                      />
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Description
                        </label>
                        <textarea
                          value={serviceForm.description}
                          onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                          rows={3}
                          placeholder="Service description..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Price (GHS)"
                          type="number"
                          step="0.01"
                          value={serviceForm.price}
                          onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                          required
                        />
                        <Input
                          label="Duration (minutes)"
                          type="number"
                          value={serviceForm.duration_minutes}
                          onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })}
                          required
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          ref={servicePhotoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setServiceForm({ ...serviceForm, photoFile: e.target.files?.[0] || null })}
                        />
                        <Button variant="outline" size="sm" onClick={() => servicePhotoInputRef.current?.click()}>
                          <ImageIcon className="w-4 h-4 mr-1" />
                          Upload Service Image
                        </Button>
                        <Input
                          placeholder="Or paste image URL"
                          value={serviceForm.photoUrlInput}
                          onChange={(e) => setServiceForm({ ...serviceForm, photoUrlInput: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button onClick={handleSaveService}>
                          {editingService ? 'Update' : 'Create'} Service
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowServiceForm(false);
                          setEditingService(null);
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}

                {services.length === 0 ? (
                  <p className="text-slate-600">No services added yet</p>
                ) : (
                  <div className="space-y-3">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      >

                        <div className="flex-1 flex items-center gap-4">
                          {service.photo_url && (
                            <img src={service.photo_url} alt="Service" className="w-16 h-16 rounded object-cover" />
                          )}
                           <h4 className="font-semibold text-slate-900">{service.name}</h4>
                           {service.description && (
                             <p className="text-sm text-slate-600 mt-1">{service.description}</p>
                           )}
                           <div className="flex gap-4 mt-2">
                             <span className="text-sm text-slate-700">GHS {service.price}</span>
                             <span className="flex items-center text-sm text-slate-700">
                               <Clock className="w-4 h-4 mr-1 text-slate-400" />
                               {service.duration_minutes} min
                             </span>
                           </div>
                         </div>
                         <div className="flex gap-2">
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleEditService(service)}
                           >
                             <Edit2 className="w-4 h-4" />
                           </Button>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleDeleteService(service.id)}
                           >
                             <Trash2 className="w-4 h-4 text-red-600" />
                           </Button>
                         </div>
                       </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Staff Management */}
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Staff Members</h2>
                <Button size="sm" onClick={() => { setEditingStaff(null); setShowStaffForm(true); }}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Staff
                </Button>
              </CardHeader>
              <CardBody>
                {showStaffForm && (
                  <div className="mb-6 p-4 bg-slate-50 rounded-lg space-y-4">
                    <Input
                      label="Staff Name"
                      value={staffForm.name}
                      onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                      placeholder="e.g., Jane Doe"
                    />
                    <Input
                      label="Position"
                      value={staffForm.position}
                      onChange={(e) => setStaffForm({ ...staffForm, position: e.target.value })}
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Bio</label>
                      <textarea
                        value={staffForm.bio}
                        onChange={(e) => setStaffForm({ ...staffForm, bio: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                        rows={3}
                        placeholder="Short bio..."
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        ref={staffPhotoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setStaffForm({ ...staffForm, photoFile: e.target.files?.[0] || null })}
                      />
                      <Button variant="outline" size="sm" onClick={() => staffPhotoInputRef.current?.click()}>
                        <ImageIcon className="w-4 h-4 mr-1" />
                        Upload Photo
                      </Button>
                      <Input
                        placeholder="Or paste image URL"
                        value={staffForm.photoUrlInput}
                        onChange={(e) => setStaffForm({ ...staffForm, photoUrlInput: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleSaveStaff}>{editingStaff ? 'Update' : 'Add'} Staff</Button>
                      <Button variant="outline" onClick={() => { setShowStaffForm(false); setEditingStaff(null); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {staff.length === 0 ? (
                  <p className="text-slate-600">No staff added yet</p>
                ) : (
                  <div className="space-y-3">
                    {staff.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {m.photo_url ? (
                            <img src={m.photo_url} alt="Staff" className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                              <Users className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{m.name || 'Staff Member'}</p>
                            {m.position && <p className="text-sm text-slate-600">{m.position}</p>}
                            {m.bio && <p className="text-sm text-slate-600">{m.bio}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingStaff(m); setShowStaffForm(true); setStaffForm({ name: (m as any).name || '', position: m.position || '', bio: m.bio || '', photoFile: null, photoUrlInput: m.photo_url || '' }); }}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteStaff(m.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}


              </CardBody>
            </Card>

            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardBody className="text-center">
                  <DollarSign className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-slate-900">{services.length}</p>
                  <p className="text-sm text-slate-600">Services</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-slate-900">{staff.length}</p>
                  <p className="text-sm text-slate-600">Staff Members</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <Button
                    fullWidth
                    variant="outline"
                    onClick={() => window.location.href = '/business/calendar'}
                  >
                    View Calendar
                  </Button>
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
