const CATEGORY_ICON_PATHS: Record<string, string> = {
  paintball: "/icons/categories/marker-paintball.svg",
  gokarty: "/icons/categories/marker-gokarty.svg",
  "go-karts": "/icons/categories/marker-gokarty.svg",
  "park-trampolin": "/icons/categories/marker-park-trampolin.svg",
  trampoliny: "/icons/categories/marker-park-trampolin.svg",
  "plac-zabaw": "/icons/categories/marker-plac-zabaw.svg",
  "place-zabaw": "/icons/categories/marker-plac-zabaw.svg",
  playground: "/icons/categories/marker-plac-zabaw.svg",
  "park-linowy": "/icons/categories/marker-park-linowy.svg",
  "adventure-park": "/icons/categories/marker-park-linowy.svg",
}

export function getEnjoyHubCategoryIcon(slug?: string | null) {
  const normalized = (slug ?? "").trim().toLowerCase().replaceAll("_", "-")
  return CATEGORY_ICON_PATHS[normalized] ?? null
}
