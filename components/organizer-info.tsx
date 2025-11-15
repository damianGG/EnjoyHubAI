"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Phone, Mail, User } from "lucide-react"
import { Organizer } from "@/types/attraction"

interface OrganizerInfoProps {
  organizer: Organizer
}

export default function OrganizerInfo({ organizer }: OrganizerInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>O organizatorze</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Organizer Header */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {organizer.image && <AvatarImage src={organizer.image} />}
            <AvatarFallback>
              <User className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-lg">{organizer.name}</h3>
            <p className="text-sm text-muted-foreground">Organizator</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {organizer.description}
        </p>

        {/* Contact Information */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <a
              href={`tel:${organizer.phone}`}
              className="text-sm hover:text-primary transition-colors"
            >
              {organizer.phone}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <a
              href={`mailto:${organizer.email}`}
              className="text-sm hover:text-primary transition-colors"
            >
              {organizer.email}
            </a>
          </div>
        </div>

        {/* Contact Button */}
        <div className="pt-2">
          <Button className="w-full" variant="outline">
            Skontaktuj się
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
