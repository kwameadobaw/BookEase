import React from 'react';
import { Button } from '../components/Button';
import { Calendar, Clock, Award, Users, MapPin, ArrowRight, Mail, Phone } from 'lucide-react';

export function LandingPage() {
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <header className="container mx-auto px-4 pt-8 pb-16 md:pt-16 md:pb-24">
        <nav className="flex justify-between items-center mb-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-blue-600">BookEase</h1>
          </div>
          <div className="space-x-4">
            <Button variant="ghost" onClick={() => navigateTo('/login')}>Login</Button>
            <Button onClick={() => navigateTo('/signup')}>Sign Up</Button>
          </div>
        </nav>

        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-8 md:mb-0">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-800">
              Simplify Your Booking Experience
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              BookEase helps businesses manage appointments and customers book services with ease.
              No more scheduling headaches, just smooth bookings.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" onClick={() => navigateTo('/signup')}>
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigateTo('/business/dashboard')}>
                For Businesses
              </Button>
            </div>
          </div>
          <div className="md:w-1/2 md:pl-12">
            <div className="bg-white rounded-lg shadow-xl p-6 border border-gray-100">
              <img 
                src="/hero-illustration.svg" 
                alt="Booking Calendar" 
                className="w-full h-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/500x300?text=BookEase+Calendar';
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Why Choose BookEase?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-blue-50 rounded-lg p-6 text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Easy Scheduling</h3>
              <p className="text-gray-600">
                Manage your calendar with our intuitive interface. Set your availability and let customers book when it works for you.
              </p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6 text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Save Time</h3>
              <p className="text-gray-600">
                Automated reminders and confirmations reduce no-shows and keep your schedule running smoothly.
              </p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6 text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Happy Customers</h3>
              <p className="text-gray-600">
                Give your customers the convenience of booking anytime, anywhere, from any device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {/* <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Trusted by Businesses</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-bold">SC</span>
                </div>
                <div>
                  <h4 className="font-semibold">Sarah's Salon</h4>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-600">
                "BookEase has transformed how we manage appointments. Our clients love the easy booking process!"
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-bold">MT</span>
                </div>
                <div>
                  <h4 className="font-semibold">Metro Therapy</h4>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-600">
                "Since using BookEase, we've reduced no-shows by 60% and increased our bookings by 25%."
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-bold">FD</span>
                </div>
                <div>
                  <h4 className="font-semibold">Fitness Direct</h4>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-600">
                "The calendar management is intuitive and our trainers can focus on clients instead of admin work."
              </p>
            </div>
          </div>
        </div>
      </section> */}

      {/* CTA Section */}
      {/* <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to simplify your booking process?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of businesses that trust BookEase for their scheduling needs.
          </p>
          <Button 
            size="lg" 
            className="bg-white text-blue-600 hover:bg-gray-100"
            onClick={() => navigateTo('/signup')}
          >
            Get Started Today
          </Button>
        </div>
      </section> */}

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">BookEase</h3>
              <p className="text-gray-400">
                Making appointment scheduling simple and efficient for businesses and customers.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white">Home</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Features</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">For Businesses</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white">Dashboard</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Calendar</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Analytics</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-400">
                  <Mail className="h-4 w-4 mr-2" /> info@bookease.com
                </li>
                <li className="flex items-center text-gray-400">
                  <Phone className="h-4 w-4 mr-2" /> +1 (555) 123-4567
                </li>
                <li className="flex items-center text-gray-400">
                  <MapPin className="h-4 w-4 mr-2" /> 123 Booking St, Suite 101
                </li>
              </ul>
            </div>
          </div> */}
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} BookEase. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}