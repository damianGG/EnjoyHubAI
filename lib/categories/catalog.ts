export type CatalogSubcategory = {
  id: string
  parent_category_id: string
  name: string
  slug: string
  icon?: string | null
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
}

export type CatalogCategory = {
  id: string
  name: string
  slug: string
  icon?: string | null
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  subcategories: CatalogSubcategory[]
}

export function buildCategoryCatalog(
  categories: Array<Omit<CatalogCategory, "subcategories">>,
  subcategories: CatalogSubcategory[],
): CatalogCategory[] {
  return categories
    .map((category) => ({
      ...category,
      subcategories: subcategories
        .filter((subcategory) => subcategory.parent_category_id === category.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    }))
    .filter((category) => category.subcategories.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "pl"))
}

export function findCategoryForSlug(catalog: CatalogCategory[], slug: string | null | undefined) {
  if (!slug) return null
  return catalog.find(
    (category) =>
      category.slug === slug
      || category.subcategories.some((subcategory) => subcategory.slug === slug),
  ) ?? null
}
