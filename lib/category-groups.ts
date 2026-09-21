// Stable activity slugs remain the search/API identifiers; groups organize discovery.
export const CATEGORY_GROUPS = [
  { slug: 'adrenalina', name: 'Adrenalina', icon: '⚡', activities: ['paintball', 'go-karts', 'gokarty', 'quady', 'offroad', 'off-road', 'strzelnice', 'skoki'] },
  { slug: 'dzieci-i-rodzina', name: 'Dzieci i rodzina', icon: '🧸', activities: ['sale-zabaw', 'plac-zabaw', 'place-zabaw', 'park-trampolin', 'trampoliny', 'dmuchance', 'parki-rozrywki', 'mini-zoo'] },
  { slug: 'aktywnie', name: 'Aktywnie', icon: '🧗', activities: ['park-linowy', 'wspinaczka', 'jazda-konna', 'rowery'] },
  { slug: 'nad-woda', name: 'Nad wodą', icon: '🌊', activities: ['kajaki', 'sup', 'baseny', 'aquaparki', 'zeglarstwo', 'wakeboard'] },
  { slug: 'zagadki-i-gry', name: 'Zagadki i gry', icon: '🧩', activities: ['escape-room', 'vr', 'mini-golf', 'minigolf', 'bowling', 'kregle'] },
  { slug: 'relaks', name: 'Relaks', icon: '🌿', activities: ['spa', 'masaze', 'sauny', 'termy'] },
  { slug: 'warsztaty-i-odkrywanie', name: 'Warsztaty i odkrywanie', icon: '🎨', activities: ['warsztaty', 'ceramika', 'muzea', 'zwiedzanie'] },
  { slug: 'wydarzenia', name: 'Wydarzenia', icon: '🎟️', activities: ['wydarzenia'] },
] as const

export function categoryGroup(slug: string) {
  return CATEGORY_GROUPS.find(group => (group.activities as readonly string[]).includes(slug))
}
