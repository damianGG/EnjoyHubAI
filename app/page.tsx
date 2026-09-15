import { HomeDiscovery } from "@/components/home-discovery"
import { listMarketplaceDiscoveryAttractions } from "@/lib/marketplace/discovery"

export const revalidate = 60

export default async function Home() {
  try {
    const { items } = await listMarketplaceDiscoveryAttractions(50)
    return <HomeDiscovery attractions={items} />
  } catch (error) {
    console.error("[home] Failed to load marketplace discovery", error)
    return <HomeDiscovery attractions={[]} />
  }
}
