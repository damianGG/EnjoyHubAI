import { redirect } from "next/navigation"

export default function AllCategoriesPage() {
  // Redirect /k/all to /k/ (empty categories means all)
  redirect("/k/")
}
