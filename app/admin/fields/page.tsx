import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import FieldManagementClient from "@/components/field-management"
import { requirePlatformStaff } from "@/lib/platform-admin/access"

export default async function FieldsPage() {
  await requirePlatformStaff(["platform_superadmin", "platform_content"], "/admin/fields")

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Powrót do panelu admina
        </Link>
      </div>
      <FieldManagementClient />
    </div>
  )
}
