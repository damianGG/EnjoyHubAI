import React from 'react';

export default function ColorsDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Gradient */}
      <section className="bg-hero-gradient py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="heading-gradient text-6xl mb-4">EnjoyHub Colors</h1>
          <p className="text-white text-xl mb-8">
            A complete color system for an energetic and entertaining experience
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button className="btn-primary">Primary Button</button>
            <button className="btn-accent">Accent Button</button>
            <button className="btn-outline-primary">Outline Button</button>
          </div>
        </div>
      </section>

      {/* Color Palette Section */}
      <section className="slider-section">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="section-title text-center">Color Palette</h2>
          <p className="section-subtitle text-center">
            All brand colors with their complete shade variations
          </p>

          {/* Primary Colors */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200 mb-4">
              Primary (Orange) - Energetic
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
                <div key={shade} className="text-center">
                  <div
                    className="h-20 rounded-lg mb-2 shadow"
                    style={{ backgroundColor: `var(--color-primary-${shade})` }}
                  />
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {shade}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Secondary Colors */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200 mb-4">
              Secondary (Yellow) - Vibrant
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
                <div key={shade} className="text-center">
                  <div
                    className="h-20 rounded-lg mb-2 shadow"
                    style={{ backgroundColor: `var(--color-secondary-${shade})` }}
                  />
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {shade}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accent Colors */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200 mb-4">
              Accent (Blue) - Electric
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
                <div key={shade} className="text-center">
                  <div
                    className="h-20 rounded-lg mb-2 shadow"
                    style={{ backgroundColor: `var(--color-accent-${shade})` }}
                  />
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {shade}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Neutral Colors */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200 mb-4">
              Neutral (Graphite) - Professional
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
                <div key={shade} className="text-center">
                  <div
                    className="h-20 rounded-lg mb-2 shadow border border-neutral-200"
                    style={{ backgroundColor: `var(--color-neutral-${shade})` }}
                  />
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {shade}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Components Section */}
      <section className="py-16 px-4 bg-white dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="section-title text-center">Component Examples</h2>

          {/* Badges */}
          <div className="mb-12">
            <h3 className="text-xl font-bold mb-4 text-neutral-800 dark:text-neutral-200">
              Badges
            </h3>
            <div className="flex gap-4 flex-wrap">
              <span className="badge-primary">Primary Badge</span>
              <span className="badge-secondary">Secondary Badge</span>
              <span className="badge-accent">Accent Badge</span>
            </div>
          </div>

          {/* Cards */}
          <div className="mb-12">
            <h3 className="text-xl font-bold mb-4 text-neutral-800 dark:text-neutral-200">
              Cards
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="card p-6">
                <h4 className="text-xl font-bold mb-2 text-neutral-800 dark:text-neutral-200">
                  Standard Card
                </h4>
                <p className="text-neutral-600 dark:text-neutral-400">
                  A clean, modern card with shadow and border
                </p>
              </div>
              <div className="card-gradient p-6">
                <h4 className="text-xl font-bold mb-2 text-neutral-800">
                  Gradient Card
                </h4>
                <p className="text-neutral-600">
                  Card with subtle gradient background
                </p>
              </div>
              <div className="feature-card-gradient">
                <h4 className="text-xl font-bold mb-2 text-neutral-800 dark:text-neutral-200">
                  Feature Card
                </h4>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Special card for highlighting features
                </p>
              </div>
            </div>
          </div>

          {/* Category Icons */}
          <div className="mb-12">
            <h3 className="text-xl font-bold mb-4 text-neutral-800 dark:text-neutral-200">
              Category Icons
            </h3>
            <div className="flex gap-4">
              <div className="category-icon">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="category-icon-primary">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Gradients */}
          <div className="mb-12">
            <h3 className="text-xl font-bold mb-4 text-neutral-800 dark:text-neutral-200">
              Gradient Backgrounds
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-hero-gradient p-8 rounded-xl text-center">
                <h4 className="text-2xl font-bold text-white mb-2">Hero Gradient</h4>
                <p className="text-white">Orange to Yellow</p>
              </div>
              <div className="bg-accent-gradient p-8 rounded-xl text-center">
                <h4 className="text-2xl font-bold text-white mb-2">Accent Gradient</h4>
                <p className="text-white">Blue to Orange</p>
              </div>
              <div className="bg-category-gradient p-8 rounded-xl text-center">
                <h4 className="text-2xl font-bold text-white mb-2">Category Gradient</h4>
                <p className="text-white">Blue to Light Blue</p>
              </div>
              <div className="bg-dark-gradient p-8 rounded-xl text-center">
                <h4 className="text-2xl font-bold text-white mb-2">Dark Gradient</h4>
                <p className="text-white">Dark to Darker</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Typography Section */}
      <section className="slider-section">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="section-title">Typography Examples</h2>
          <p className="section-subtitle">
            All typography styles used throughout the application
          </p>
          <h1 className="heading-gradient text-5xl mb-8">
            Gradient Heading Example
          </h1>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-lg text-neutral-700 dark:text-neutral-300">
              This is body text using the neutral color palette. It maintains good
              readability in both light and dark modes.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-gradient py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-white">
          <p className="mb-2">EnjoyHub Color System</p>
          <p className="text-sm text-neutral-300">
            Designed for energy, vibrancy, and entertainment
          </p>
        </div>
      </footer>
    </div>
  );
}
