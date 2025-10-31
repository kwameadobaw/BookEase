import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export function Profile() {
  const { user, profile, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const { error } = await updateProfile({ first_name: firstName, last_name: lastName });
      if (error) {
        setError('Failed to update profile');
      } else {
        setMessage('Profile updated');
      }
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="max-w-md mx-auto">
          <Card>
            <CardBody>
              <p className="text-slate-700">You need to sign in to edit your profile.</p>
              <div className="mt-4">
                <Button onClick={() => (window.location.href = '/login')}>Go to Sign In</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold text-slate-900">Edit Profile</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSave} className="space-y-4">
              {message && (
                <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{message}</div>
              )}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
              )}
              <Input
                type="text"
                label="First Name"
                placeholder="Enter first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                type="text"
                label="Last Name"
                placeholder="Enter last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <Button type="submit" fullWidth disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
}