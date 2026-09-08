const CATEGORY_ICON_PATHS: Record<string, string> = {
  paintball: "/icons/categories/paintball.svg",
  gokarty: "/icons/categories/gokarty.webp",
  "go-karts": "/icons/categories/gokarty.webp",
  "park-trampolin": "/icons/categories/park-trampolin.webp",
  trampoliny: "/icons/categories/park-trampolin.webp",
  "plac-zabaw": "/icons/categories/plac-zabaw.webp",
  "place-zabaw": "/icons/categories/plac-zabaw.webp",
  playground: "/icons/categories/plac-zabaw.webp",
  "park-linowy": "/icons/categories/park-linowy.webp",
  "adventure-park": "/icons/categories/park-linowy.webp",
}

export function getEnjoyHubCategoryIcon(slug?: string | null) {
  const normalized = (slug ?? "").trim().toLowerCase().replaceAll("_", "-")
  return CATEGORY_ICON_PATHS[normalized] ?? null
}
