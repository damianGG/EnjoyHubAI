import { Suspense } from "react"
import { BellRing, CalendarDays, Mail, Users } from "lucide-react"

import { submitAttractionInterestAction } from "@/app/atrakcja/[slug]/actions"
import { AttractionDemandState } from "@/components/attraction-demand-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type AttractionDemandCardProps = {
  attractionId: string
  slug: string
}

export function AttractionDemandCard({ attractionId, slug }: AttractionDemandCardProps) {
  const action = submitAttractionInterestAction.bind(null, slug, attractionId)

  return (
    <Card className="overflow-hidden border-[#ff5a1f]/25 shadow-sm">
      <CardHeader className="bg-[#fff7f2]">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff5a1f]/10 text-[#ff5a1f]">
          <BellRing className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">Chcesz zarezerwować przez EnjoyHub?</CardTitle>
        <CardDescription>
          Ten obiekt nie prowadzi jeszcze rezerwacji w EnjoyHub. Powiedz nam, na jaki termin szukasz miejsca — pokażemy właścicielowi realne zainteresowanie i damy Ci znać, gdy rezerwacja online ruszy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <Suspense fallback={null}>
          <AttractionDemandState>
            <form action={action} className="space-y-3">
            <div className="hidden" aria-hidden="true">
              <label htmlFor={`company-website-${attractionId}`}>Strona firmy</label>
              <input id={`company-website-${attractionId}`} name="company_website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <label className="block space-y-1.5 text-sm">
              <span className="flex items-center gap-2 font-medium"><CalendarDays className="h-4 w-4" />Kiedy chcesz przyjechać?</span>
              <Input name="desired_date" type="date" required />
            </label>

            <label className="block space-y-1.5 text-sm">
              <span className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" />Liczba osób</span>
              <Input name="party_size" type="number" min="1" max="50" step="1" defaultValue="2" required />
            </label>

            <label className="block space-y-1.5 text-sm">
              <span className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4" />E-mail</span>
              <Input name="email" type="email" autoComplete="email" placeholder="twoj@email.pl" required />
            </label>

            <Button type="submit" className="h-11 w-full bg-[#ff5a1f] font-semibold text-white hover:bg-[#e94f18]">
              Chcę zarezerwować
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              To nie jest rezerwacja ani zobowiązanie do zakupu. Zgłoszenie pomaga nam uruchomić sprzedaż online dla tego miejsca.
            </p>
            </form>
          </AttractionDemandState>
        </Suspense>
      </CardContent>
    </Card>
  )
}
