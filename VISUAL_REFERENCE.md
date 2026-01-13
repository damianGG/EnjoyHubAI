# EnjoyHub Color System - Quick Reference

## 🎨 Visual Component Reference

This document provides a quick visual reference for all the custom utility classes available in the EnjoyHub color system.

### Color Swatches

#### Primary (Orange) - Energetic
```
░░░░░░ 50  #FFF8F2   ← Very light
▒▒▒▒▒▒ 100 #FFE9D9
▒▒▒▒▒▒ 200 #FFD3B3
▓▓▓▓▓▓ 300 #FFB580   ← primary-light
▓▓▓▓▓▓ 400 #FF9040
██████ 500 #FF6B00   ← BASE COLOR
██████ 600 #D95B00
██████ 700 #B34B00   ← primary-dark
██████ 800 #803600
██████ 900 #592500
██████ 950 #331500   ← Very dark
```

#### Secondary (Yellow) - Vibrant
```
░░░░░░ 50  #FFFDF6   ← Very light
▒▒▒▒▒▒ 100 #FFF9E3
▒▒▒▒▒▒ 200 #FFF2C6
▓▓▓▓▓▓ 300 #FFEAA0   ← secondary-light
▓▓▓▓▓▓ 400 #FFDF71
██████ 500 #FFD441   ← BASE COLOR
██████ 600 #D9B437
██████ 700 #B3942E   ← secondary-dark
██████ 800 #806A21
██████ 900 #594A17
██████ 950 #332A0D   ← Very dark
```

#### Accent (Blue) - Electric
```
░░░░░░ 50  #F2FBFF   ← Very light
▒▒▒▒▒▒ 100 #D9F4FF
▒▒▒▒▒▒ 200 #B3E9FF
▓▓▓▓▓▓ 300 #80DAFF   ← accent-light
▓▓▓▓▓▓ 400 #40C7FF
██████ 500 #00B4FF   ← BASE COLOR
██████ 600 #0099D9
██████ 700 #007EB3   ← accent-dark
██████ 800 #005A80
██████ 900 #003F59
██████ 950 #002433   ← Very dark
```

#### Neutral (Graphite) - Professional
```
░░░░░░ 50  #F4F4F4   ← Very light
▒▒▒▒▒▒ 100 #DDDDDD
▒▒▒▒▒▒ 200 #BCBCBC
▓▓▓▓▓▓ 300 #8F8F8F   ← neutral-light
▓▓▓▓▓▓ 400 #575757
██████ 500 #1F1F1F   ← BASE COLOR (Dark theme base)
██████ 600 #1A1A1A
██████ 700 #161616   ← neutral-dark
██████ 800 #101010
██████ 900 #0B0B0B
██████ 950 #060606   ← Very dark
```

---

## 🔘 Button Components

### .btn-primary
```
╔═══════════════════════╗
║ [Gradient: 🟠→🟡]      ║
║   Primary Button      ║  ← White text, rounded-xl
║                       ║     Shadow-lg with hover effect
╚═══════════════════════╝
Background: linear-gradient(to right, #FF6B00, #FFD441)
```

### .btn-accent
```
╔═══════════════════════╗
║ [Solid Blue: 🔵]      ║
║   Accent Button       ║  ← White text, rounded-xl
║                       ║     Hover: darker blue
╚═══════════════════════╝
Background: #00B4FF → hover: #007EB3
```

### .btn-outline-primary
```
╔═══════════════════════╗
║ ┌───────────────────┐ ║
║ │  Outline Button   │ ║  ← Orange border/text
║ └───────────────────┘ ║     Hover: filled orange bg
╚═══════════════════════╝
Border: 2px #FF6B00, Hover: bg #FF6B00 + white text
```

---

## 🏷️ Badge Components

### .badge-primary
```
┌──────────────┐
│ Primary (🟠) │  ← Orange bg, white text, rounded-lg
└──────────────┘
```

### .badge-secondary
```
┌────────────────┐
│ Secondary (🟡) │  ← Yellow bg, dark text, rounded-lg
└────────────────┘
```

### .badge-accent
```
┌──────────────┐
│ Accent (🔵)  │  ← Blue bg, white text, rounded-lg
└──────────────┘
```

---

## 🎴 Card Components

### .card
```
╔═════════════════════════════╗
║                             ║
║    Standard Card            ║  ← White bg, shadow-xl
║                             ║     Border: neutral-100
║    Content goes here        ║     Rounded-2xl
║                             ║     Hover: increased shadow
║                             ║
╚═════════════════════════════╝
```

### .card-gradient
```
╔═════════════════════════════╗
║ [Gradient: 🟠→🔵 subtle]    ║
║    Gradient Card            ║  ← Gradient bg
║                             ║     Shadow-xl
║    Content goes here        ║     Rounded-2xl
║                             ║
╚═════════════════════════════╝
Background: linear-gradient(to bottom right, #FFF8F2, #F2FBFF)
```

### .feature-card-gradient
```
╔═════════════════════════════╗
║ [Gradient: white→orange]    ║
║    Feature Card             ║  ← Gradient bg
║                             ║     Border: primary-200
║    Content goes here        ║     Rounded-2xl
║                             ║     Hover: enhanced shadow
╚═════════════════════════════╝
```

---

## 📝 Typography

### .section-title
```
████████████████████
Section Title Here        ← Bold, 3xl (md:4xl)
                            Dark in light mode
                            Light in dark mode
```

### .section-subtitle
```
Medium weight subtitle    ← Medium, lg (md:xl)
                            Muted color
```

### .heading-gradient
```
🟠🟡🟠🟡🟠🟡🟠🟡
Gradient Heading          ← Bold, gradient text
                            Orange to Yellow
```

---

## 🎯 Category Icons

### .category-icon
```
┌─────────┐
│ [🔵→💠] │  ← 3rem × 3rem, rounded-xl
│    🔥    │     Gradient: blue to light blue
└─────────┘     White icon, shadow-lg
```

### .category-icon-primary
```
┌─────────┐
│ [🟠→🟡] │  ← 3rem × 3rem, rounded-xl
│    ⭐    │     Gradient: orange to light orange
└─────────┘     White icon, shadow-lg
```

---

## 🌈 Gradient Backgrounds

### .bg-hero-gradient (diagonal 135°)
```
╔══════════════════════════════╗
║ 🟠                          ║
║    Orange                   ║
║       ↘                     ║
║          Yellow          🟡 ║
╚══════════════════════════════╝
linear-gradient(135deg, #FF6B00, #FFD441)
```

### .bg-accent-gradient (diagonal 135°)
```
╔══════════════════════════════╗
║ 🔵                          ║
║    Blue                     ║
║       ↘                     ║
║          Orange          🟠 ║
╚══════════════════════════════╝
linear-gradient(135deg, #00B4FF, #FF6B00)
```

### .bg-category-gradient (diagonal 135°)
```
╔══════════════════════════════╗
║ 🔵                          ║
║    Blue                     ║
║       ↘                     ║
║          Light Blue      💠 ║
╚══════════════════════════════╝
linear-gradient(135deg, #00B4FF, #80DAFF)
```

---

## 🎠 Slider Components

### .slider-section
```
╔═══════════════════════════════════════╗
║ [Gradient background: gray→white]     ║
║                                       ║
║   ┌──────┐  ┌──────┐  ┌──────┐      ║
║   │ Card │  │ Card │  │ Card │      ║ ← Horizontal scroll
║   └──────┘  └──────┘  └──────┘      ║
║                                       ║
╚═══════════════════════════════════════╝
Background gradient changes in dark mode
```

### .slider-card
```
╔══════════════╗
║              ║
║   [Image]    ║  ← Card with scale-up hover
║              ║     transform: scale(1.05)
║   Content    ║
║              ║
╚══════════════╝
```

---

## 🌓 Dark Mode Variations

In dark mode (`.dark` class on root):
- Background: `#1F1F1F`
- Cards: `#161616`
- Text: `#F4F4F4`
- Primary: `#FF9040` (brighter for visibility)
- Secondary: `#FFDF71` (brighter)
- Accent: `#40C7FF` (brighter)

All components automatically adapt their colors!

---

## 💡 Usage Examples

### Hero Section
```html
<section class="bg-hero-gradient py-20">
  <h1 class="heading-gradient text-6xl">Welcome</h1>
  <button class="btn-primary">Get Started</button>
</section>
```

### Card with Badge
```html
<div class="card p-6">
  <span class="badge-accent">Featured</span>
  <h3 class="section-title text-xl">Title</h3>
  <p>Content here</p>
</div>
```

### Category Grid
```html
<div class="grid grid-cols-3 gap-4">
  <div class="feature-card-gradient">
    <div class="category-icon">
      <svg>...</svg>
    </div>
    <h4>Category Name</h4>
  </div>
</div>
```

---

## 📊 Color Usage Guidelines

| Purpose | Use |
|---------|-----|
| Main CTA | `.btn-primary` |
| Secondary CTA | `.btn-accent` |
| Featured items | `.badge-primary` |
| Information | `.badge-accent` |
| Hero sections | `.bg-hero-gradient` |
| Category icons | `.category-icon` or `.category-icon-primary` |
| Cards | `.card`, `.card-gradient`, `.feature-card-gradient` |
| Section titles | `.section-title` |
| Gradient headings | `.heading-gradient` |

---

## 🎨 Tailwind Utility Usage

You can also use standard Tailwind classes:

```html
<!-- Text colors -->
<p class="text-primary-500">Orange text</p>
<p class="text-secondary-300">Light yellow text</p>
<p class="text-accent-700">Dark blue text</p>

<!-- Backgrounds -->
<div class="bg-primary-50">Very light orange bg</div>
<div class="bg-neutral-800">Dark gray bg</div>

<!-- Borders -->
<div class="border border-primary-300">Orange border</div>

<!-- Hover states -->
<button class="bg-primary-500 hover:bg-primary-600">
  Hover for darker
</button>
```

---

## 🚀 Quick Start

1. **View the live demo**: Navigate to `/colors-demo` in your app
2. **Read the guide**: Check `TAILWIND_COLOR_GUIDE.md` for detailed docs
3. **Use the classes**: Start using `.btn-primary`, `.card`, etc.
4. **Check shades**: Use `primary-50` through `primary-950` for variations
5. **Test dark mode**: Add `.dark` class to root element

---

## 📦 Files Reference

- `app/globals.css` - Active configuration (CSS-first v4)
- `tailwind.config.js` - Traditional config (reference)
- `TAILWIND_COLOR_GUIDE.md` - Complete documentation
- `COLOR_CONFIGURATION_SUMMARY.md` - Implementation guide
- `app/colors-demo/page.tsx` - Live demo page

---

**Note:** This is a visual reference guide. For interactive examples, visit `/colors-demo` in your browser.
