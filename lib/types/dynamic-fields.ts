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
  created_at: string;
}

export interface CategoryWithFields extends Category {
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
  created_at: string;
  updated_at: string;
}

export interface PropertyWithFieldValues extends Property {
  field_values: ObjectFieldValue[];
  category?: CategoryWithFields;
}
