import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card, CardBody, CardHeader } from '../components/Card';
import { Calendar, User, Briefcase } from 'lucide-react';
import type { UserType } from '../lib/database.types';

export function Signup() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('CLIENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  useEffect(() => {
    document.title = 'Sign Up — BookEase';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password, userType);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setShowVerifyModal(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Calendar className="w-10 h-10 text-slate-900" />
            <span className="text-3xl font-bold text-slate-900">BookEase</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Create your account</h1>
          <p className="text-slate-600">Join thousands of satisfied users</p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Sign Up</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  I want to...
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUserType('CLIENT')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      userType === 'CLIENT'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <User className="w-6 h-6 mx-auto mb-2 text-slate-700" />
                    <div className="text-sm font-medium text-slate-900">Book Services</div>
                    <div className="text-xs text-slate-500 mt-1">As a Client</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType('BUSINESS_OWNER')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      userType === 'BUSINESS_OWNER'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Briefcase className="w-6 h-6 mx-auto mb-2 text-slate-700" />
                    <div className="text-sm font-medium text-slate-900">Offer Services</div>
                    <div className="text-xs text-slate-500 mt-1">As a Business</div>
                  </button>
                </div>
              </div>

              <Input
                type="email"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                type="password"
                label="Password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Input
                type="password"
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Already have an account?{' '}
                <a href="/login" className="font-medium text-slate-900 hover:underline">
                  Sign in
                </a>
                 {' '}or go to{' '}
                <a href="/home" className="font-medium text-slate-900 hover:underline">
                  Home
                </a>
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="text-center">
              <Calendar className="w-10 h-10 text-slate-900 mx-auto mb-2" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Check your email</h3>
              <p className="text-slate-600 mb-4">
                We’ve sent a verification link to <span className="font-medium text-slate-900">{email}</span>.
                Please verify your email to activate your account.
              </p>
              <div className="space-y-3">
                <Button fullWidth onClick={() => (window.location.href = '/login')}>
                  Go to Sign In
                </Button>
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() => setShowVerifyModal(false)}
                >
                  I’ll verify later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
