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

const PUBLIC_ATTRACTION_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"

/**
 * Stable 10-character public code derived from the first 50 bits of a UUID.
 * Matches public.marketplace_property_public_code(uuid) in Supabase.
 */
export function getAttractionPublicCode(id: string): string {
  const hex = id.toLowerCase().replace(/-/g, "")
  if (!/^[0-9a-f]{32}$/.test(hex)) return ""

  // 13 hex chars = 52 bits, which still fits exactly within Number.MAX_SAFE_INTEGER.
  // Dropping the last 2 bits leaves the same stable 50-bit value as the DB function.
  let value = Math.floor(Number.parseInt(hex.slice(0, 13), 16) / 4)
  let code = ""

  for (let index = 0; index < 10; index += 1) {
    code = PUBLIC_ATTRACTION_ALPHABET[value % 32] + code
    value = Math.floor(value / 32)
  }

  return code
}

export function generatePublicAttractionSlug(params: {
  id: string
  title: string
  city: string
}): string {
  const titleSlug = slugify(params.title)
  const citySlug = slugify(params.city)
  const code = getAttractionPublicCode(params.id)
  const titleAlreadyContainsCity = Boolean(citySlug) && (
    titleSlug === citySlug
    || titleSlug.endsWith(`-${citySlug}`)
  )
  const descriptiveSlug = [titleSlug, titleAlreadyContainsCity ? null : citySlug]
    .filter(Boolean)
    .join("-")

  return [descriptiveSlug || "atrakcja", code].filter(Boolean).join("-")
}

export function extractPublicAttractionCode(slug: string): string {
  const match = slug.toLowerCase().match(/(?:^|-)([0-9a-hjkmnp-tv-z]{10})$/)
  return match?.[1] ?? ""
}

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
