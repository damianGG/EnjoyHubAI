import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Mail, Phone } from "lucide-react"
import { Organizer } from "@/types/attraction"

interface OrganizerInfoProps {
  organizer: Organizer
}

export default function OrganizerInfo({ organizer }: OrganizerInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About the Organizer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Section: Organizer profile */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={organizer.image} alt={organizer.name} />
              <AvatarFallback className="text-lg">
                {organizer.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{organizer.name}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {organizer.description}
              </p>
            </div>
          </div>

          {/* Section: Contact information */}
          {(organizer.phone || organizer.email) && (
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
              {organizer.phone && (
                <Button variant="outline" className="flex-1" asChild>
                  <a href={`tel:${organizer.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    {organizer.phone}
                  </a>
                </Button>
              )}
              {organizer.email && (
                <Button variant="outline" className="flex-1" asChild>
                  <a href={`mailto:${organizer.email}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    {organizer.email}
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
