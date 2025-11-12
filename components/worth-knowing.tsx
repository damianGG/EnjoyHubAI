import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Activity, Backpack, CalendarX, Clock, Info } from "lucide-react"

interface FieldValue {
  value?: string
  file_url?: string
  category_fields: {
    field_name: string
    field_label: string
    field_type: string
  } | null
}

interface WorthKnowingProps {
  fieldValues: FieldValue[]
}

const fieldIcons: Record<string, any> = {
  minimum_age: User,
  activity_level: Activity,
  skill_level: Activity,
  what_to_bring: Backpack,
  equipment: Backpack,
  accessibility: Info,
  cancellation_policy: CalendarX,
  opening_hours: Clock,
  duration: Clock,
}

export default function WorthKnowing({ fieldValues }: WorthKnowingProps) {
  if (!fieldValues || fieldValues.length === 0) {
    return null
  }

  // Filter out empty values
  const validFields = fieldValues.filter(
    (fv) => fv.category_fields && (fv.value || fv.file_url)
  )

  if (validFields.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Warto wiedzieć</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {validFields.map((fieldValue, index) => {
            const field = fieldValue.category_fields
            if (!field) return null

            const IconComponent = fieldIcons[field.field_name] || Info
            
            return (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">{field.field_label}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {fieldValue.value || (
                      fieldValue.file_url && (
                        <a
                          href={fieldValue.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View file
                        </a>
                      )
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
