/**
 * Generates a URL slug from a string by:
 * - Converting to lowercase
 * - Replacing spaces with hyphens
 * - Removing special characters
 * - Collapsing multiple hyphens
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '')  // Remove leading/trailing hyphens
}

/**
 * Generates an attraction detail page URL in the format:
 * /{city}-{activity}-{slug}-{id}
 * 
 * @param params - Object containing city, activity (category_slug), title, and id
 * @returns URL path string
 */
export function generateAttractionUrl(params: {
  city: string
  activity?: string | null
  title: string
  id: string
}): string {
  const citySlug = slugify(params.city)
  const activitySlug = params.activity ? slugify(params.activity) : 'attraction'
  const titleSlug = slugify(params.title)
  
  return `/${citySlug}-${activitySlug}-${titleSlug}-${params.id}`
}
