import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import CreateOfferDialog from "@/components/create-offer-dialog"

export default async function AdminPropertiesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user is super admin
  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (userData?.role !== "super_admin") {
    redirect("/dashboard")
  }

  // Get all properties with their offers
  const { data: properties } = await supabase
    .from("properties")
    .select(`
      id,
      title,
      city,
      is_active
    `)
    .order("created_at", { ascending: false })

  // Get all offers
  const { data: offers } = await supabase
    .from("offers")
    .select("id, place_id, title, is_active")
    .order("created_at", { ascending: false })

  // Group offers by property
  const offersByProperty: Record<string, typeof offers> = {}
  if (offers) {
    offers.forEach((offer) => {
      if (!offersByProperty[offer.place_id]) {
        offersByProperty[offer.place_id] = []
      }
      offersByProperty[offer.place_id].push(offer)
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link
              href="/admin"
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Property Offers</h1>
          <p className="text-muted-foreground">Create and manage time-based offers for properties</p>
        </div>

        {!properties || properties.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No properties found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {properties.map((property) => (
              <Card key={property.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{property.title}</CardTitle>
                      <CardDescription>{property.city}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={property.is_active ? "default" : "secondary"}>
                        {property.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <CreateOfferDialog propertyId={property.id} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {offersByProperty[property.id] && offersByProperty[property.id].length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="font-semibold mb-2">Offers:</h4>
                      <div className="grid gap-2">
                        {offersByProperty[property.id].map((offer) => (
                          <div
                            key={offer.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <span>{offer.title}</span>
                            <Badge variant={offer.is_active ? "default" : "secondary"}>
                              {offer.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No offers yet for this property</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
