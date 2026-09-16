import type { Metadata } from "next"

import { HomeDiscovery } from "@/components/home-discovery"
import { listMarketplaceDiscoveryAttractions } from "@/lib/marketplace/discovery"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Atrakcje i bilety online",
  description: "Odkrywaj atrakcje, sprawdzaj dostępne terminy i rezerwuj bilety online w EnjoyHub.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
    title: "EnjoyHub – atrakcje i bilety online",
    description: "Odkrywaj atrakcje, sprawdzaj dostępne terminy i rezerwuj bilety online w EnjoyHub.",
  },
}

export default async function Home() {
  try {
    const { items } = await listMarketplaceDiscoveryAttractions(50)
    return <HomeDiscovery attractions={items} />
  } catch (error) {
    console.error("[home] Failed to load marketplace discovery", error)
    return <HomeDiscovery attractions={[]} />
  }
}
