/**
 * Optimizes Cloudinary image URLs by adding transformation parameters
 * for better performance and loading speed
 */
export function optimizeCloudinaryUrl(
  url: string,
  options: {
    width?: number
    quality?: number | 'auto'
    format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png'
    crop?: 'fill' | 'fit' | 'scale' | 'crop'
  } = {}
): string {
  // If not a Cloudinary URL, return as-is
  if (!url.includes('res.cloudinary.com')) {
    return url
  }

  // Default options optimized for card images
  const {
    width = 800,
    quality = 'auto',
    format = 'auto',
    crop = 'fill',
  } = options

  try {
    // Parse the Cloudinary URL
    // Format: https://res.cloudinary.com/cloud-name/image/upload/v123/path/image.jpg
    const urlParts = url.split('/upload/')
    if (urlParts.length !== 2) {
      return url // Not a standard Cloudinary upload URL
    }

    const [baseUrl, imagePath] = urlParts

    // Build transformation string
    const transformations: string[] = []
    
    // Add format transformation (automatically chooses best format)
    if (format) {
      transformations.push(`f_${format}`)
    }
    
    // Add quality optimization
    if (quality) {
      transformations.push(`q_${quality}`)
    }
    
    // Add width constraint
    if (width) {
      transformations.push(`w_${width}`)
    }
    
    // Add crop mode
    if (crop) {
      transformations.push(`c_${crop}`)
    }

    // Add fetch format and other optimizations
    transformations.push('fl_progressive') // Progressive JPEG loading
    transformations.push('fl_lossy') // Allow lossy compression for better file size
    transformations.push('fl_preserve_transparency') // Preserve transparency for PNGs

    // Construct the optimized URL
    const transformationString = transformations.join(',')
    return `${baseUrl}/upload/${transformationString}/${imagePath}`
  } catch (error) {
    console.error('Error optimizing Cloudinary URL:', error)
    return url
  }
}

/**
 * Generate srcset for responsive Cloudinary images
 */
export function generateCloudinarySrcSet(url: string, widths: number[] = [400, 800, 1200, 1600]): string {
  if (!url.includes('res.cloudinary.com')) {
    return ''
  }

  return widths
    .map(width => `${optimizeCloudinaryUrl(url, { width })} ${width}w`)
    .join(', ')
}

/**
 * Preload images for faster loading
 * This can be used to preload critical images like the first carousel image
 */
export function preloadCloudinaryImage(url: string, options: { width?: number; quality?: number | 'auto' } = {}) {
  if (typeof window === 'undefined') return

  const optimizedUrl = optimizeCloudinaryUrl(url, options)
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = optimizedUrl
  link.setAttribute('fetchpriority', 'high')
  document.head.appendChild(link)
}
