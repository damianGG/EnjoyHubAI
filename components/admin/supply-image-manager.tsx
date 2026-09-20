"use client"

import { useRef, useState } from "react"
import { BrainCircuit, ImagePlus, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
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

  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<string | null>(null)
  const [primary, setPrimary] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploading = useRef(false)

  async function upload(formData: FormData) {
    if (uploading.current || files.length === 0) return
    uploading.current = true
    setBusy(true)
    setError(null)
    const failed: File[] = []
    const errors: string[] = []
    let completed = 0
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Przesyłanie ${index + 1} z ${files.length}: ${file.name}`)
        try {
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Dozwolone są JPG, PNG i WebP")
          if (file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error("Plik musi mieć od 1 bajta do 10 MB")
          const body = new FormData()
          for (const key of ["sourceType", "sourceUrl", "rightsConfirmed"]) {
            const value = formData.get(key)
            if (typeof value === "string") body.set(key, value)
          }
          body.set("image", file)
          body.set("isPrimary", String(primary && index === 0))
          const response = await fetch(`/api/admin/supply/${leadId}/images`, { method: "POST", body })
          const result = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(result.error || "Nie udało się wgrać zdjęcia")
          completed += 1
          if (primary && index === 0) setPrimary(false)
        } catch (e) {
          failed.push(file)
          errors.push(`${file.name}: ${e instanceof Error ? e.message : "Nie udało się wgrać zdjęcia"}`)
        }
      }
      setFiles(failed)
      if (fileInput.current) fileInput.current.value = ""
      setProgress(`Dodano ${completed} z ${files.length} zdjęć.${failed.length ? " Ponów przesyłanie nieudanych plików lub wybierz nowe." : ""}`)
      setError(errors.length ? errors.join("\n") : null)
      if (completed > 0) router.refresh()
    } finally {
      uploading.current = false
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
      <div className="flex flex-col gap-3 rounded-xl border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Brakuje danych o atrakcji?</p>
          <p className="text-sm text-muted-foreground">Uruchom research AI, sprawdź źródła i zatwierdź tylko wybrane informacje.</p>
        </div>
        <Button asChild variant="outline" className="shrink-0"><Link href={`/admin/supply/${leadId}/enrichment`}><BrainCircuit className="mr-2 h-4 w-4" />AI i kompletność</Link></Button>
      </div>

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

      <form onSubmit={(event) => { event.preventDefault(); void upload(new FormData(event.currentTarget)) }} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm xl:col-span-2">
          <span className="font-medium">Zdjęcia — możesz wybrać wiele plików</span>
          <Input ref={fileInput} name="image" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy}
            onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); setError(null); setProgress(null) }} />
          <p className="text-xs text-muted-foreground">JPG, PNG lub WebP, maks. 10 MB na plik. Wybrano: {files.length}.</p>
          {files.length > 0 && <ul className="max-h-32 overflow-auto text-xs">{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}</li>)}</ul>}
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
          Mam potwierdzone prawo do publikacji wszystkich wybranych zdjęć
        </label>
        <label className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm md:col-span-1">
          <input type="checkbox" name="isPrimary" value="true" checked={primary} onChange={(event) => setPrimary(event.target.checked)} className="h-4 w-4" disabled={busy} />
          Ustaw pierwsze wybrane zdjęcie jako główne
        </label>
        <div className="flex items-end md:col-span-2 xl:justify-end">
          <Button type="submit" disabled={busy || files.length === 0} className="w-full xl:w-auto">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}Dodaj zdjęcia</Button>
        </div>
      </form>

      {progress && <p role="status" className="text-sm">{progress}</p>}
      {error && <p role="alert" className="whitespace-pre-line text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Zdjęcia bez potwierdzonych praw są widoczne tylko roboczo w Supply. Nie trafiają do publicznej galerii.</p>
    </div>
  )
}

function sourceLabel(value: string) {
  return ({ owner: "Właściciel", admin: "EnjoyHub", licensed: "Licencja", public_reference: "Referencja" } as Record<string, string>)[value] ?? value
}
