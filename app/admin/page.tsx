import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Shield, FolderTree, ListTree, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function AdminDashboard() {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6" />
              <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
            </div>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome, Super Admin</h2>
          <p className="text-muted-foreground">Manage categories, fields, and system configuration</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Category Management */}
          <Link href="/admin/categories">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <FolderTree className="h-6 w-6 text-primary" />
                  <CardTitle>Category Management</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>Create, edit, and delete entertainment categories</CardDescription>
              </CardContent>
            </Card>
          </Link>

          {/* Field Management */}
          <Link href="/admin/fields">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <ListTree className="h-6 w-6 text-primary" />
                  <CardTitle>Field Management</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>Configure dynamic fields for each category</CardDescription>
              </CardContent>
            </Card>
          </Link>

          {/* Property Offers */}
          <Link href="/admin/properties">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-6 w-6 text-primary" />
                  <CardTitle>Property Offers</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>Create time-based offers for properties</CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
