# EnjoyHub Tailwind CSS Color Configuration Guide

## 🎨 Color Palette Overview

The EnjoyHub color palette is designed to be energetic and entertaining, reflecting the vibrant nature of the platform.

### Base Colors

- **Primary (Orange)**: `#FF6B00` - Energetic and attention-grabbing
- **Secondary (Yellow)**: `#FFD441` - Vibrant and cheerful
- **Accent (Blue)**: `#00B4FF` - Electric and modern
- **Neutral (Graphite)**: `#1F1F1F` - Professional and elegant
- **Light**: `#FFFFFF` - Clean and bright

## 📊 Color Shades

Each color comes with a complete set of shades from 50 (lightest) to 950 (darkest):

### Primary (Orange)
```css
primary-50:  #FFF8F2  /* Very light orange */
primary-100: #FFE9D9
primary-200: #FFD3B3
primary-300: #FFB580  /* primary-light */
primary-400: #FF9040
primary-500: #FF6B00  /* Base color */
primary-600: #D95B00
primary-700: #B34B00  /* primary-dark */
primary-800: #803600
primary-900: #592500
primary-950: #331500  /* Very dark orange */
```

### Secondary (Yellow)
```css
secondary-50:  #FFFDF6  /* Very light yellow */
secondary-100: #FFF9E3
secondary-200: #FFF2C6
secondary-300: #FFEAA0  /* secondary-light */
secondary-400: #FFDF71
secondary-500: #FFD441  /* Base color */
secondary-600: #D9B437
secondary-700: #B3942E  /* secondary-dark */
secondary-800: #806A21
secondary-900: #594A17
secondary-950: #332A0D  /* Very dark yellow */
```

### Accent (Blue)
```css
accent-50:  #F2FBFF  /* Very light blue */
accent-100: #D9F4FF
accent-200: #B3E9FF
accent-300: #80DAFF  /* accent-light */
accent-400: #40C7FF
accent-500: #00B4FF  /* Base color */
accent-600: #0099D9
accent-700: #007EB3  /* accent-dark */
accent-800: #005A80
accent-900: #003F59
accent-950: #002433  /* Very dark blue */
```

### Neutral (Graphite)
```css
neutral-50:  #F4F4F4  /* Very light gray */
neutral-100: #DDDDDD
neutral-200: #BCBCBC
neutral-300: #8F8F8F  /* neutral-light */
neutral-400: #575757
neutral-500: #1F1F1F  /* Base color */
neutral-600: #1A1A1A
neutral-700: #161616  /* neutral-dark */
neutral-800: #101010
neutral-900: #0B0B0B
neutral-950: #060606  /* Very dark gray */
```

## 🎨 Gradients

### Hero Gradient
Diagonal gradient from primary to secondary (orange to yellow)
```html
<div class="bg-hero-gradient">...</div>
```
CSS: `linear-gradient(135deg, #FF6B00 0%, #FFD441 100%)`

### Hero Gradient Vertical
Vertical gradient from primary to secondary
```html
<div class="bg-hero-gradient-vertical">...</div>
```
CSS: `linear-gradient(180deg, #FF6B00 0%, #FFD441 100%)`

### Accent Gradient
Diagonal gradient from accent to primary (blue to orange)
```html
<div class="bg-accent-gradient">...</div>
```
CSS: `linear-gradient(135deg, #00B4FF 0%, #FF6B00 100%)`

### Accent Gradient Vertical
Vertical gradient from accent to primary
```html
<div class="bg-accent-gradient-vertical">...</div>
```
CSS: `linear-gradient(180deg, #00B4FF 0%, #FF6B00 100%)`

### Category Gradient
Diagonal gradient for category icons
```html
<div class="bg-category-gradient">...</div>
```
CSS: `linear-gradient(135deg, #00B4FF 0%, #80DAFF 100%)`

### Dark Gradient
Gradient for dark backgrounds
```html
<div class="bg-dark-gradient">...</div>
```
CSS: `linear-gradient(135deg, #1F1F1F 0%, #101010 100%)`

## 🔘 Button Styles

### Primary Button
Gradient button with orange-to-yellow gradient
```html
<button class="btn-primary">Click Me</button>
```
- Gradient background: primary → secondary
- White text
- Rounded-xl corners
- Shadow-lg with hover effect
- Smooth transitions

### Accent Button
Solid accent blue button
```html
<button class="btn-accent">Click Me</button>
```
- Accent background
- White text
- Hover: darker accent
- Rounded-xl corners
- Shadow effects

### Outline Primary Button
Outlined button that fills on hover
```html
<button class="btn-outline-primary">Click Me</button>
```
- Border: primary color
- Text: primary color
- Hover: fills with primary, white text

## 🏷️ Badge Styles

### Primary Badge
```html
<span class="badge-primary">New</span>
```
Orange background with white text

### Secondary Badge
```html
<span class="badge-secondary">Featured</span>
```
Yellow background with dark text

### Accent Badge
```html
<span class="badge-accent">Hot</span>
```
Blue background with white text

## 🎴 Card Styles

### Standard Card
```html
<div class="card">
  <!-- Card content -->
</div>
```
- Rounded-2xl corners
- White background
- Shadow-xl
- Border: neutral-100
- Hover: increased shadow

### Dark Card
```html
<div class="card-dark">
  <!-- Card content -->
</div>
```
For use in light mode with dark appearance

### Gradient Card
```html
<div class="card-gradient">
  <!-- Card content -->
</div>
```
Subtle gradient background from primary-50 to accent-50

### Feature Card
```html
<div class="feature-card">
  <!-- Feature content -->
</div>
```
Card with hover effect that changes border to primary-300

### Feature Card Gradient
```html
<div class="feature-card-gradient">
  <!-- Feature content -->
</div>
```
Card with gradient background and special styling

## 📝 Typography Styles

### Section Title
```html
<h2 class="section-title">Section Heading</h2>
```
- Large, bold heading
- Responsive sizing (3xl → 4xl)
- Dark text in light mode, light text in dark mode

### Section Subtitle
```html
<p class="section-subtitle">Subtitle text</p>
```
- Medium weight
- Responsive sizing (lg → xl)
- Muted color

### Gradient Heading
```html
<h1 class="heading-gradient">Gradient Title</h1>
```
Text with gradient from primary to secondary

## 🎯 Category Icons

### Accent Category Icon
```html
<div class="category-icon">
  <!-- Icon SVG -->
</div>
```
Gradient from accent to accent-light

### Primary Category Icon
```html
<div class="category-icon-primary">
  <!-- Icon SVG -->
</div>
```
Gradient from primary to primary-light

## 🎠 Slider/Carousel Styles

### Slider Section
```html
<section class="slider-section">
  <!-- Slider content -->
</section>
```
Background gradient, different for light/dark modes

### Slider Card
```html
<div class="slider-card">
  <!-- Card content -->
</div>
```
Card with scale-up hover effect

## 🌓 Dark Mode

The color system fully supports dark mode based on the graphite color (#1F1F1F):

### Dark Mode Colors
- Background: `#1F1F1F`
- Cards: `#161616`
- Borders: `#575757`
- Text: `#F4F4F4`
- Brighter primary/secondary for better visibility

### Usage
```html
<html class="dark">
  <!-- All colors automatically adapt -->
</html>
```

Or use the next-themes package for automatic theme switching.

## 💡 Usage Examples

### Hero Section
```html
<section class="bg-hero-gradient py-20">
  <h1 class="heading-gradient text-6xl">Welcome to EnjoyHub</h1>
  <p class="text-white text-xl">Discover amazing attractions</p>
  <button class="btn-primary mt-4">Get Started</button>
</section>
```

### Card Grid
```html
<div class="grid grid-cols-3 gap-4">
  <div class="card p-6">
    <div class="category-icon mb-4">
      <svg>...</svg>
    </div>
    <h3 class="section-title text-xl">Title</h3>
    <p class="section-subtitle">Description</p>
    <span class="badge-primary">Featured</span>
  </div>
</div>
```

### Slider
```html
<section class="slider-section">
  <h2 class="section-title text-center">Featured Attractions</h2>
  <div class="flex gap-4 overflow-x-auto">
    <div class="slider-card min-w-[300px]">
      <!-- Attraction content -->
    </div>
  </div>
</section>
```

## 🎨 Tailwind CSS Utility Classes

You can also use standard Tailwind utilities with the color names:

```html
<!-- Text colors -->
<p class="text-primary-500">Orange text</p>
<p class="text-secondary-600">Dark yellow text</p>
<p class="text-accent-300">Light blue text</p>

<!-- Background colors -->
<div class="bg-primary-50">Very light orange background</div>
<div class="bg-secondary-500">Yellow background</div>
<div class="bg-accent-700">Dark blue background</div>

<!-- Border colors -->
<div class="border border-primary-300">Orange border</div>
<div class="border-2 border-accent-500">Blue border</div>

<!-- Hover states -->
<button class="bg-primary-500 hover:bg-primary-600">Hover me</button>
<button class="text-accent-500 hover:text-accent-700">Hover me</button>
```

## 📦 Installation & Configuration

The color configuration is already set up in:

1. **tailwind.config.js** - Traditional Tailwind v3/v4 config (for reference and tools)
2. **app/globals.css** - Tailwind CSS v4 inline theme configuration (active configuration)

Both files contain the complete color palette, but the project uses the CSS-first approach with `app/globals.css`.

### Using in Components

```tsx
import React from 'react';

export function MyComponent() {
  return (
    <div className="card">
      <h2 className="section-title">Title</h2>
      <p className="section-subtitle">Subtitle</p>
      <button className="btn-primary">Action</button>
      <span className="badge-accent">Tag</span>
    </div>
  );
}
```

## 🔍 Color Accessibility

All color combinations have been designed with accessibility in mind:
- Primary buttons use white text for maximum contrast
- Dark mode uses brighter variants of primary/secondary colors
- Neutral colors provide sufficient contrast ratios
- Gradient text uses bold weights for better readability

## 🚀 Best Practices

1. **Consistency**: Use the predefined utility classes for common patterns
2. **Gradients**: Use gradient backgrounds for hero sections and CTAs
3. **Contrast**: Always ensure sufficient contrast between text and background
4. **Dark Mode**: Test all components in both light and dark modes
5. **Hover States**: Use the provided hover variants for interactive elements
6. **Semantic Usage**: Use primary for main actions, accent for highlights, secondary for support

---

For more information or questions, refer to the Tailwind CSS documentation or the project's design system documentation.
