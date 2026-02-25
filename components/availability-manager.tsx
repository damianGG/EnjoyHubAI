"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar as CalendarIcon, Plus, X, Save, AlertCircle, CheckCircle } from "lucide-react"
import type { AttractionAvailability, SeasonalPrice, BookingMode } from "@/lib/types/dynamic-fields"
import { format, parseISO } from "date-fns"

interface AvailabilityManagerProps {
  propertyId: string
  initialAvailability?: AttractionAvailability | null
  basePrice: number
}

export default function AvailabilityManager({
  propertyId,
  initialAvailability,
  basePrice,
}: AvailabilityManagerProps) {
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    initialAvailability?.booking_mode || "daily"
  )
  const [minStay, setMinStay] = useState(initialAvailability?.min_stay || 1)
  const [maxStay, setMaxStay] = useState(initialAvailability?.max_stay || null)
  const [enableMultiBooking, setEnableMultiBooking] = useState(
    initialAvailability?.enable_multi_booking || false
  )
  const [dailyCapacity, setDailyCapacity] = useState(
    initialAvailability?.daily_capacity || 10
  )
  const [blockedDates, setBlockedDates] = useState<Date[]>(
    (initialAvailability?.blocked_dates || []).map(d => parseISO(d))
  )
  const [selectedDatesToBlock, setSelectedDatesToBlock] = useState<Date[]>([])
  const [seasonalPrices, setSeasonalPrices] = useState<SeasonalPrice[]>(
    initialAvailability?.seasonal_prices || []
  )
  
  // New seasonal price form
  const [newSeasonStart, setNewSeasonStart] = useState<Date | undefined>()
  const [newSeasonEnd, setNewSeasonEnd] = useState<Date | undefined>()
  const [newSeasonPrice, setNewSeasonPrice] = useState("")
  const [newSeasonName, setNewSeasonName] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleBlockDates = async () => {
    if (selectedDatesToBlock.length === 0) return

    try {
      const datesToBlock = selectedDatesToBlock.map(d => format(d, "yyyy-MM-dd"))
      
      const response = await fetch(`/api/attractions/${propertyId}/block-dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          dates: datesToBlock,
          action: "block",
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setBlockedDates(prev => [...prev, ...selectedDatesToBlock])
        setSelectedDatesToBlock([])
        setSaveMessage({ type: "success", text: "Dates blocked successfully" })
      } else {
        setSaveMessage({ type: "error", text: "Failed to block dates" })
      }
    } catch (error) {
      setSaveMessage({ type: "error", text: "Error blocking dates" })
    }
  }

  const handleUnblockDate = async (date: Date) => {
    try {
      const dateStr = format(date, "yyyy-MM-dd")
      
      const response = await fetch(`/api/attractions/${propertyId}/block-dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          dates: [dateStr],
          action: "unblock",
        }),
      })

      if (response.ok) {
        setBlockedDates(prev => prev.filter(d => format(d, "yyyy-MM-dd") !== dateStr))
        setSaveMessage({ type: "success", text: "Date unblocked successfully" })
      } else {
        setSaveMessage({ type: "error", text: "Failed to unblock date" })
      }
    } catch (error) {
      setSaveMessage({ type: "error", text: "Error unblocking date" })
    }
  }

  const handleAddSeasonalPrice = () => {
    if (!newSeasonStart || !newSeasonEnd || !newSeasonPrice || !newSeasonName) {
      setSaveMessage({ type: "error", text: "Please fill all seasonal price fields" })
      return
    }

    const newSeason: SeasonalPrice = {
      start_date: format(newSeasonStart, "yyyy-MM-dd"),
      end_date: format(newSeasonEnd, "yyyy-MM-dd"),
      price: parseFloat(newSeasonPrice),
      name: newSeasonName,
    }

    setSeasonalPrices(prev => [...prev, newSeason])
    setNewSeasonStart(undefined)
    setNewSeasonEnd(undefined)
    setNewSeasonPrice("")
    setNewSeasonName("")
    setSaveMessage({ type: "success", text: "Seasonal price added. Don't forget to save!" })
  }

  const handleRemoveSeasonalPrice = (index: number) => {
    setSeasonalPrices(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch(`/api/attractions/${propertyId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_mode: bookingMode,
          min_stay: minStay,
          max_stay: maxStay || null,
          seasonal_prices: seasonalPrices,
          enable_multi_booking: enableMultiBooking,
          daily_capacity: enableMultiBooking ? dailyCapacity : null,
        }),
      })

      if (response.ok) {
        setSaveMessage({ type: "success", text: "Settings saved successfully!" })
      } else {
        let errorMessage = "Failed to save settings"
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // If JSON parsing fails, use default error message
        }
        setSaveMessage({ type: "error", text: errorMessage })
      }
    } catch (error) {
      setSaveMessage({ type: "error", text: "Error saving settings" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {saveMessage && (
        <Alert variant={saveMessage.type === "error" ? "destructive" : "default"}>
          {saveMessage.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{saveMessage.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="blocked-dates">Blocked Dates</TabsTrigger>
          <TabsTrigger value="seasonal-pricing">Seasonal Pricing</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Booking Mode</CardTitle>
              <CardDescription>Choose how guests can book this property</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={bookingMode} onValueChange={(value) => setBookingMode(value as BookingMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="daily" id="daily" />
                  <Label htmlFor="daily" className="cursor-pointer">
                    Daily - Multi-day stays (like Airbnb)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hourly" id="hourly" />
                  <Label htmlFor="hourly" className="cursor-pointer">
                    Hourly - Time-slot based bookings
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stay Requirements</CardTitle>
              <CardDescription>Set minimum and maximum stay duration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="minStay">
                  Minimum Stay ({bookingMode === "daily" ? "nights" : "hours"})
                </Label>
                <Input
                  id="minStay"
                  type="number"
                  min="1"
                  value={minStay}
                  onChange={(e) => setMinStay(parseInt(e.target.value) || 1)}
                  className="max-w-xs"
                />
              </div>
              <div>
                <Label htmlFor="maxStay">
                  Maximum Stay ({bookingMode === "daily" ? "nights" : "hours"}) - Optional
                </Label>
                <Input
                  id="maxStay"
                  type="number"
                  min={minStay}
                  value={maxStay || ""}
                  onChange={(e) => setMaxStay(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="No maximum"
                  className="max-w-xs"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Multi-Booking Capacity</CardTitle>
              <CardDescription>
                Enable selling multiple tickets for the same day (e.g., for play centers, museums, events)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-multi-booking" className="text-base">
                    Enable Multi-Booking
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow multiple guests to book the same day
                  </p>
                </div>
                <Switch
                  id="enable-multi-booking"
                  checked={enableMultiBooking}
                  onCheckedChange={setEnableMultiBooking}
                />
              </div>

              {enableMultiBooking && (
                <div className="pt-4 border-t">
                  <Label htmlFor="dailyCapacity">
                    Daily Capacity (Maximum bookings per day)
                  </Label>
                  <Input
                    id="dailyCapacity"
                    type="number"
                    min="1"
                    value={dailyCapacity}
                    onChange={(e) => setDailyCapacity(parseInt(e.target.value) || 1)}
                    className="max-w-xs mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    This sets the maximum number of separate bookings that can be made for each day.
                    The calendar will show occupancy levels from green (available) to red (full).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSaveSettings} disabled={isSaving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </TabsContent>

        {/* Blocked Dates Tab */}
        <TabsContent value="blocked-dates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Block Dates</CardTitle>
              <CardDescription>Select dates to make unavailable for booking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-md p-4">
                <Calendar
                  mode="multiple"
                  selected={selectedDatesToBlock}
                  onSelect={(dates) => setSelectedDatesToBlock(dates || [])}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    return date < today
                  }}
                  className="rounded-md"
                />
              </div>

              {selectedDatesToBlock.length > 0 && (
                <Button onClick={handleBlockDates}>
                  Block {selectedDatesToBlock.length} Date{selectedDatesToBlock.length !== 1 ? "s" : ""}
                </Button>
              )}
            </CardContent>
          </Card>

          {blockedDates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Currently Blocked Dates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {blockedDates.map((date, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-2">
                      <CalendarIcon className="h-3 w-3" />
                      {format(date, "PPP")}
                      <button
                        onClick={() => handleUnblockDate(date)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Seasonal Pricing Tab */}
        <TabsContent value="seasonal-pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Seasonal Pricing</CardTitle>
              <CardDescription>
                Set different prices for specific date ranges (e.g., summer, holidays)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Season Name</Label>
                  <Input
                    placeholder="e.g., Summer Season"
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Price per Night</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={`Base: $${basePrice}`}
                    value={newSeasonPrice}
                    onChange={(e) => setNewSeasonPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Calendar
                    mode="single"
                    selected={newSeasonStart}
                    onSelect={setNewSeasonStart}
                    className="rounded-md border"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Calendar
                    mode="single"
                    selected={newSeasonEnd}
                    onSelect={setNewSeasonEnd}
                    disabled={(date) => newSeasonStart ? date < newSeasonStart : false}
                    className="rounded-md border"
                  />
                </div>
              </div>

              <Button onClick={handleAddSeasonalPrice}>
                <Plus className="h-4 w-4 mr-2" />
                Add Seasonal Price
              </Button>
            </CardContent>
          </Card>

          {seasonalPrices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Seasonal Prices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {seasonalPrices.map((season, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <p className="font-medium">{season.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {season.start_date} to {season.end_date}
                        </p>
                        <p className="text-sm font-semibold text-primary">
                          ${season.price} per night
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSeasonalPrice(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button onClick={handleSaveSettings} disabled={isSaving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Seasonal Pricing"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}
