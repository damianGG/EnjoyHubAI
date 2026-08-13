export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
  }).format(amount)
}

export function formatSessionDate(startsAt: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(startsAt))
}
