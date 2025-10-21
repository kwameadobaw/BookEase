# BookEase - Service Booking Platform

A comprehensive booking platform built with React, TypeScript, and Supabase, inspired by Booksy.com. BookEase connects clients with service providers in the health and beauty industry, enabling seamless appointment scheduling and management.

## Features

### Client Features
- **User Authentication**: Secure sign up and login with email/password
- **Business Search**: Search and filter businesses by service type and location
- **Business Profiles**: View detailed business information, services, staff, and reviews
- **Appointment Booking**: Select services, staff members, and available time slots
- **Appointment Management**: View, manage, and cancel upcoming appointments
- **Review System**: Leave ratings and reviews for completed appointments

### Business Owner Features
- **Business Profile Management**: Create and manage business information
- **Service Management**: Add, edit, and remove services with pricing and duration
- **Staff Management**: Add and manage staff members
- **Appointment Calendar**: View all appointments by date with filtering options
- **Booking Confirmation**: Accept or decline appointment requests
- **Dashboard Statistics**: Track appointments, revenue, and business metrics

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library

### Backend
- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Row Level Security (RLS)
  - Authentication
  - Edge Functions (serverless)

## Database Schema

### Core Tables
- **profiles** - Extended user information with user types (CLIENT, BUSINESS_OWNER, STAFF)
- **business_profiles** - Business information (name, address, location, description)
- **services** - Services offered by businesses (name, price, duration)
- **staff_members** - Links users to businesses as service providers
- **working_hours** - Staff availability by day of week
- **appointments** - Booking records with status tracking
- **reviews** - Client feedback with ratings and comments

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Supabase account and project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. The project is already configured with Supabase. The environment variables are set in `.env`:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   └── Layout.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state management
├── lib/               # Core utilities
│   ├── supabase.ts    # Supabase client setup
│   └── database.types.ts # TypeScript database types
├── pages/             # Application pages
│   ├── Home.tsx       # Business search and listing
│   ├── Login.tsx      # User login
│   ├── Signup.tsx     # User registration
│   ├── BusinessDetails.tsx    # Business profile view
│   ├── BookAppointment.tsx    # Booking flow
│   ├── MyAppointments.tsx     # Client appointments
│   ├── BusinessDashboard.tsx  # Business management
│   └── BusinessCalendar.tsx   # Appointment calendar
├── Router.tsx         # Client-side routing
├── App.tsx           # Root component
└── main.tsx          # Application entry point
```

## Key Features Implementation

### Authentication
- Supabase Auth with email/password
- Automatic profile creation on signup
- User type selection (Client/Business Owner)
- Protected routes based on user type

### Booking System
- Real-time availability calculation via Edge Function
- Time slot generation based on working hours
- Conflict detection to prevent double-booking
- Appointment status workflow (Pending → Confirmed → Completed)

### Business Management
- CRUD operations for business profiles and services
- Staff member management
- Calendar view with appointment filtering
- Quick action buttons for confirming/canceling appointments

### Reviews & Ratings
- 1-5 star rating system
- Optional text comments
- Displayed on business profiles
- Only available after appointment completion

## Security

The application implements comprehensive Row Level Security (RLS) policies:

- **Clients** can only view/manage their own appointments and reviews
- **Business Owners** can manage their business data and view related appointments
- **Public** can search and view business profiles (required for discovery)
- All mutations are protected by authentication and ownership checks

## Edge Functions

### get-availability
Calculates available time slots for booking appointments based on:
- Staff member working hours for the selected day
- Existing appointments (to avoid conflicts)
- Service duration requirements
- Returns available time slots in 30-minute increments

### send-booking-email
Sends a booking notification email to the business email listed on the profile.
- Environment secrets:
  - `RESEND_API_KEY` or `BOOKEASE_RESEND_API_KEY` must be set
  - `EMAIL_FROM` or `BOOKEASE_EMAIL_FROM` should be a verified sender (Resend)
- Behavior:
  - Includes client name and notes when provided
  - Sets `reply_to` to the client's email when available
- Deployment:
  - `supabase functions deploy send-booking-email`
  - `supabase secrets set RESEND_API_KEY=your_key EMAIL_FROM=verified@yourdomain.com`
    - Alternatively: `supabase secrets set BOOKEASE_RESEND_API_KEY=your_key BOOKEASE_EMAIL_FROM=verified@yourdomain.com`
- Local testing:
  - `supabase functions serve --env-file supabase/.env`
  - POST to `http://localhost:54321/functions/v1/send-booking-email` with the JSON payload used by the frontend

## API Endpoints

The application uses direct Supabase client calls and Edge Functions:

- **GET /functions/v1/get-availability** - Calculate available appointment slots
  - Query params: `staff_id`, `date`, `duration`
  - Returns: Array of available ISO timestamp strings
- **POST /functions/v1/send-booking-email** - Notify business of new booking
  - Body fields: `business_id`, `business_email`, `service_name`, `staff_member_id`, `staff_name`, `client_id`, `client_email`, `client_name`, `start_time`, `end_time`, `notes`
  - Returns: JSON with `status` and provider result

## Development

### Type Safety
The project uses TypeScript throughout with generated types from the Supabase schema, ensuring type safety for all database operations.

### Code Organization
- Components follow single responsibility principle
- Hooks for reusable logic (useAuth)
- Separation of concerns between UI and business logic

### Styling
- Tailwind CSS for consistent, utility-first styling
- Custom component variants (Button, Input, Card)
- Responsive design with mobile-first approach
- Neutral color palette for professional appearance

## Future Enhancements

Potential features for future development:
- Real-time notifications for appointment updates
- SMS/Email reminders
- Payment processing integration
- Multi-language support
- Advanced search with filters (price range, ratings, distance)
- Calendar integration (Google Calendar, iCal)
- Staff schedule management with time-off requests
- Analytics dashboard for business owners
- Client loyalty programs
- Photo galleries for services and results

## License

This project is for demonstration purposes.
