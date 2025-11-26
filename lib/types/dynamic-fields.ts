// Type definitions for dynamic fields system

export type UserRole = 'user' | 'host' | 'super_admin';

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'file';

export interface ValidationRules {
  min?: number;
  max?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  fileTypes?: string[];
  maxFileSize?: number; // in MB
}

export interface CategoryField {
  id: string;
  category_id: string;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  field_order: number;
  is_required: boolean;
  validation_rules: ValidationRules;
  options: string[]; // For select field type
  placeholder?: string;
  help_text?: string;
  created_at: string;
  updated_at: string;
}

export interface ObjectFieldValue {
  id: string;
  property_id: string;
  field_id: string;
  value?: string;
  file_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  image_url?: string;
  image_public_id?: string;
  created_at: string;
}

export interface Subcategory {
  id: string;
  parent_category_id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  image_url?: string;
  image_public_id?: string;
  created_at: string;
}

export interface CategoryWithFields extends Category {
  fields: CategoryField[];
  subcategories?: Subcategory[];
}

export interface SubcategoryWithFields extends Subcategory {
  fields: CategoryField[];
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  is_host: boolean;
  role: UserRole;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  host_id: string;
  title: string;
  description?: string;
  property_type: string;
  address: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  price_per_night: number;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  amenities?: string[];
  images?: string[];
  is_active: boolean;
  category_id?: string;
  subcategory_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyWithFieldValues extends Property {
  field_values: ObjectFieldValue[];
  category?: CategoryWithFields;
}

// Time-based booking system types

// Status: tracks booking lifecycle
// - 'pending': newly created, awaiting confirmation
// - 'confirmed': booking confirmed (after payment or manual approval)
// - 'cancelled': booking cancelled by customer or venue
export type OfferBookingStatus = 'pending' | 'confirmed' | 'cancelled';

// Payment status: ready for future payment integration
// - 'not_required': free activity or payment handled offline
// - 'pending': payment required but not yet completed
// - 'paid': payment successfully processed
// - 'failed': payment attempt failed
export type OfferPaymentStatus = 'not_required' | 'pending' | 'paid' | 'failed';

// Source: tracks where booking originated
export type OfferBookingSource = 'online_enjoyhub' | 'phone' | 'walk_in';

export interface Offer {
  id: string;
  place_id: string; // FK to properties table
  title: string;
  description?: string;
  base_price: number; // stored in smallest currency unit (e.g., 100.00 PLN)
  currency: string; // e.g., 'PLN'
  duration_minutes: number; // activity duration (e.g., 60, 90, 120)
  min_participants?: number; // minimum number of people required
  max_participants?: number; // maximum capacity
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OfferAvailability {
  id: string;
  offer_id: string; // FK to offers table
  weekday: number; // 0 = Monday, 6 = Sunday
  start_time: string; // start of availability window (e.g., '10:00')
  end_time: string; // end of availability window (e.g., '20:00')
  slot_length_minutes: number; // length of each bookable slot (e.g., 60, 90)
  max_bookings_per_slot: number; // 1 for exclusive (birthday party), >1 for shared (open entry)
  created_at: string;
}

export interface OfferBooking {
  id: string;
  offer_id: string; // FK to offers table
  place_id: string; // FK to properties table (duplicated for easier querying)
  booking_date: string; // the date of the booking (ISO date string)
  start_time: string; // chosen slot start time
  end_time: string; // derived from start_time + duration_minutes
  persons: number; // number of participants
  status: OfferBookingStatus;
  payment_status: OfferPaymentStatus;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  user_id?: string; // optional link to registered user
  source: OfferBookingSource;
  created_at: string;
}
