import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a URL-friendly slug from text
 * Converts to lowercase, removes special characters, replaces spaces with hyphens
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Normalize to decomposed form for handling accents
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric characters except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
}

/**
 * Generates an attraction slug in format: city-category-title-id
 * Example: warsaw-escape-room-amazing-adventure-123e4567
 */
export function generateAttractionSlug(params: {
  city: string
  category: string | null
  title: string
  id: string
}): string {
  const { city, category, title, id } = params
  const citySlug = slugify(city)
  const categorySlug = category ? slugify(category) : 'other'
  const titleSlug = slugify(title)
  
  return `${citySlug}-${categorySlug}-${titleSlug}-${id}`
}

/**
 * Extracts the ID from an attraction slug
 * Handles both simple IDs and UUIDs (with hyphens)
 * For UUIDs: Matches the pattern xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * For simple IDs: Returns the last segment after the final hyphen
 */
export function extractIdFromSlug(slug: string): string {
  // Try to match a UUID pattern (8-4-4-4-12 hex characters)
  const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  const uuidMatch = slug.match(uuidRegex)
  
  if (uuidMatch) {
    return uuidMatch[1]
  }
  
  // Fallback: return the last segment after the final hyphen
  const parts = slug.split('-')
  return parts[parts.length - 1]
}

/**
 * Formats a date string from YYYY-MM-DD to DD.MM.YYYY
 * @param dateStr Date string in YYYY-MM-DD format
 * @returns Formatted date string in DD.MM.YYYY format
 */
export function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${day}.${month}.${year}`
}
