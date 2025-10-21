import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Plus, CreditCard as Edit2, Trash2, DollarSign, Clock, Users, Image as ImageIcon, Calendar as CalendarIcon } from 'lucide-react';
import type { Database } from '../lib/database.types';

type BusinessProfile = Database['public']['Tables']['business_profiles']['Row'];
type Service = Database['public']['Tables']['services']['Row'];
type StaffMember = Database['public']['Tables']['staff_members']['Row'];
type WorkingHour = Database['public']['Tables']['working_hours']['Row'];

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
  const [managingHoursFor, setManagingHoursFor] = useState<StaffMember | null>(null);
  const [hours, setHours] = useState<Record<number, { start: string; end: string } | null>>({
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  });

  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  const [businessForm, setBusinessForm] = useState({
    name: '',
    address: '',
    city: '',
    description: '',
    email: '',
  });

  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    price: '',
    duration_minutes: '',
  });

  const [staffForm, setStaffForm] = useState({
    name: '',
    position: '',
    bio: '',
    photoFile: null as File | null,
    photoUrlInput: '',
  });

  const coverInputRef = useRef<HTMLInputElement>(null);
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

    try {
      if (business) {
        const { error } = await supabase
          .from('business_profiles')
          .update(businessForm)
          .eq('id', business.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('business_profiles')
          .insert({
            owner_id: user.id,
            ...businessForm,
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
      const serviceData = {
        business_id: business.id,
        name: serviceForm.name,
        description: serviceForm.description || null,
        price: parseFloat(serviceForm.price),
        duration_minutes: parseInt(serviceForm.duration_minutes),
      };

      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('services')
          .insert(serviceData);

        if (error) throw error;
      }

      setShowServiceForm(false);
      setEditingService(null);
      setServiceForm({ name: '', description: '', price: '', duration_minutes: '' });
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

  const openManageHours = async (staff: StaffMember) => {
    setManagingHoursFor(staff);
    const { data } = await supabase
      .from('working_hours')
      .select('*')
      .eq('staff_member_id', staff.id);
    const map: Record<number, { start: string; end: string } | null> = { 0: null,1:null,2:null,3:null,4:null,5:null,6:null };
    (data || []).forEach((h: WorkingHour) => {
      map[h.day_of_week] = { start: h.start_time, end: h.end_time };
    });
    setHours(map);
  };

  const handleSaveHours = async () => {
    if (!managingHoursFor) return;
    const payload: Partial<WorkingHour>[] = [];
    for (let d = 0; d <= 6; d++) {
      const slot = hours[d];
      if (slot && slot.start && slot.end) {
        payload.push({ staff_member_id: managingHoursFor.id, day_of_week: d, start_time: slot.start, end_time: slot.end });
      }
    }
    try {
      if (payload.length) {
        const { error } = await supabase
          .from('working_hours')
          .upsert(payload, { onConflict: 'staff_member_id,day_of_week' });
        if (error) throw error;
      }
      setManagingHoursFor(null);
      loadBusinessData();
    } catch (error) {
      console.error('Error saving working hours:', error);
      alert('Failed to save working hours');
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
    setServiceForm({
      name: service.name,
      description: service.description || '',
      price: service.price.toString(),
      duration_minutes: service.duration_minutes.toString(),
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
            {!business && !showBusinessForm ? (
              <div className="text-center py-8">
                <p className="text-slate-600 mb-4">You haven't created a business profile yet</p>
                <Button onClick={() => setShowBusinessForm(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create Business Profile
                </Button>
              </div>
            ) : showBusinessForm ? (
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
                <div className="flex gap-3">
                  <Button onClick={handleSaveBusiness}>Save Business</Button>
                  <Button variant="outline" onClick={() => setShowBusinessForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
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
                <Button size="sm" onClick={() => {
                  setEditingService(null);
                  setServiceForm({ name: '', description: '', price: '', duration_minutes: '' });
                  setShowServiceForm(true);
                }}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Service
                </Button>
              </CardHeader>
              <CardBody>
                {showServiceForm && (
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
                )}

                {services.length === 0 ? (
                  <p className="text-slate-600">No services added yet</p>
                ) : (
                  <div className="space-y-3">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      >
                        <div className="flex-1">
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
                          <Button variant="ghost" size="sm" onClick={() => openManageHours(m)}>
                            <CalendarIcon className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteStaff(m.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {managingHoursFor && (
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                    <h3 className="font-semibold text-slate-900 mb-3">Working Hours</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[0,1,2,3,4,5,6].map((d) => (
                        <div key={d} className="flex items-center gap-3">
                          <span className="w-24 text-slate-700">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]}</span>
                          <input type="time" className="px-3 py-2 border border-slate-300 rounded-lg" value={hours[d]?.start || ''} onChange={(e) => setHours({ ...hours, [d]: { start: e.target.value, end: hours[d]?.end || '' } })} />
                          <span className="text-slate-500">-</span>
                          <input type="time" className="px-3 py-2 border border-slate-300 rounded-lg" value={hours[d]?.end || ''} onChange={(e) => setHours({ ...hours, [d]: { start: hours[d]?.start || '', end: e.target.value } })} />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-4">
                      <Button onClick={handleSaveHours}>Save Hours</Button>
                      <Button variant="outline" onClick={() => setManagingHoursFor(null)}>Cancel</Button>
                    </div>
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
