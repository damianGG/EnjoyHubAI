"use client"

import { useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SupplyImage = {
  id: string
  image_url: string
  source_type: string
  source_url?: string | null
  rights_confirmed: boolean
  is_primary: boolean
}

export function SupplyImageManager({ leadId, images }: { leadId: string; images: SupplyImage[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(formData: FormData) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/supply/${leadId}/images`, { method: "POST", body: formData })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Nie udało się wgrać zdjęcia")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wgrać zdjęcia")
    } finally {
      setBusy(false)
    }
  }

  async function remove(imageId: string) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/supply/${leadId}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Nie udało się usunąć zdjęcia")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się usunąć zdjęcia")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="overflow-hidden rounded-xl border bg-background">
              <div className="aspect-[4/3] bg-muted"><img src={image.image_url} alt="Zdjęcie atrakcji" className="h-full w-full object-cover" /></div>
              <div className="space-y-3 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {image.is_primary && <Badge>Główne</Badge>}
                  <Badge variant="secondary">{sourceLabel(image.source_type)}</Badge>
                  <Badge variant={image.rights_confirmed ? "default" : "outline"}>{image.rights_confirmed ? "Prawa potwierdzone" : "Tylko roboczo"}</Badge>
                </div>
                {image.source_url && <p className="truncate text-xs text-muted-foreground" title={image.source_url}>{image.source_url}</p>}
                <Button type="button" variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => remove(image.id)}><Trash2 className="mr-2 h-4 w-4" />Usuń</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Brak zdjęć. Możesz je dodać po rozmowie z operatorem.</div>
      )}

      <form action={upload} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm xl:col-span-2">
          <span className="font-medium">Plik</span>
          <Input name="image" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Źródło zdjęcia</span>
          <select name="sourceType" defaultValue="owner" className="h-10 w-full rounded-md border bg-background px-3 text-sm" disabled={busy}>
            <option value="owner">Przekazane przez właściciela</option>
            <option value="admin">Własne / wykonane przez EnjoyHub</option>
            <option value="licensed">Licencjonowane</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">URL źródła / notatka</span>
          <Input name="sourceUrl" placeholder="Opcjonalnie" disabled={busy} />
        </label>

        <label className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm md:col-span-1">
          <input type="checkbox" name="rightsConfirmed" value="true" className="h-4 w-4" disabled={busy} />
          Mam potwierdzone prawo do publikacji
        </label>
        <label className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm md:col-span-1">
          <input type="checkbox" name="isPrimary" value="true" className="h-4 w-4" disabled={busy} />
          Ustaw jako zdjęcie główne
        </label>
        <div className="flex items-end md:col-span-2 xl:justify-end">
          <Button type="submit" disabled={busy} className="w-full xl:w-auto">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}Dodaj zdjęcie</Button>
        </div>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Zdjęcia bez potwierdzonych praw są widoczne tylko roboczo w Supply. Nie trafiają do publicznej galerii.</p>
    </div>
  )
}

function sourceLabel(value: string) {
  return ({ owner: "Właściciel", admin: "EnjoyHub", licensed: "Licencja", public_reference: "Referencja" } as Record<string, string>)[value] ?? value
}
