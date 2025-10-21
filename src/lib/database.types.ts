export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserType = 'CLIENT' | 'BUSINESS_OWNER' | 'STAFF';
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_type: UserType;
          phone_number: string | null;
          profile_picture_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_type?: UserType;
          phone_number?: string | null;
          profile_picture_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_type?: UserType;
          phone_number?: string | null;
          profile_picture_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      business_profiles: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          address: string;
          city: string;
          latitude: number | null;
          longitude: number | null;
          description: string | null;
          cover_photo_url: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          address: string;
          city: string;
          latitude?: number | null;
          longitude?: number | null;
          description?: string | null;
          cover_photo_url?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          address?: string;
          city?: string;
          latitude?: number | null;
          longitude?: number | null;
          description?: string | null;
          cover_photo_url?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          price: number;
          duration_minutes: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          price: number;
          duration_minutes: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          duration_minutes?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      staff_members: {
        Row: {
          id: string;
          user_id: string | null;
          business_id: string;
          name: string | null;
          position: string | null;
          bio: string | null;
          photo_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          business_id: string;
          name?: string | null;
          position?: string | null;
          bio?: string | null;
          photo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          business_id?: string;
          name?: string | null;
          position?: string | null;
          bio?: string | null;
          photo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      working_hours: {
        Row: {
          id: string;
          staff_member_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_member_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_member_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          created_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          client_id: string;
          staff_member_id: string;
          service_id: string;
          business_id: string;
          start_time: string;
          end_time: string;
          status: AppointmentStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          staff_member_id: string;
          service_id: string;
          business_id: string;
          start_time: string;
          end_time: string;
          status?: AppointmentStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          staff_member_id?: string;
          service_id?: string;
          business_id?: string;
          start_time?: string;
          end_time?: string;
          status?: AppointmentStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          appointment_id: string;
          client_id: string;
          business_id: string;
          staff_member_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          client_id: string;
          business_id: string;
          staff_member_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          client_id?: string;
          business_id?: string;
          staff_member_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_type: UserType;
      appointment_status: AppointmentStatus;
    };
  };
}
