import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Activity, Backpack, CalendarX, Info, Accessibility } from "lucide-react"

interface WorthKnowingItem {
  icon: "user" | "activity" | "backpack" | "wheelchair" | "calendar" | "info"
  title: string
  description: string
  link?: {
    text: string
    action: string
  }
}

interface WorthKnowingProps {
  items: WorthKnowingItem[]
}

const iconMap = {
  user: User,
  activity: Activity,
  backpack: Backpack,
  wheelchair: Accessibility,
  calendar: CalendarX,
  info: Info,
}

export function WorthKnowing({ items }: WorthKnowingProps) {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Warto wiedzieć</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => {
            const IconComponent = iconMap[item.icon]
            return (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0">
                  <IconComponent className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                    {item.link && (
                      <>
                        {" "}
                        <button className="text-primary underline hover:no-underline">
                          {item.link.text}
                        </button>
                      </>
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
