import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function dateFormattedWithHoursAndMinutes(dateNumber: number): string {
  return format(new Date(dateNumber), 'dd MMM yyyy HH:mm', {
    locale: es,
  })
}

export function dateFormattedWithHours(dateNumber: number): string {
  return format(new Date(dateNumber), 'dd MMM HH:mm', {
    locale: es,
  })
}

export function dateFormattedFromDate(date: Date): string {
  return format(date, 'dd MMM yyyy', {
    locale: es,
  })
}

export function HourFormattedFromDate(date: Date): string {
  return format(date, 'HH:mm', {
    locale: es,
  })
}

export function dateFormattedWithHoursAndMinutesFromDate(date: Date): string {
  return format(date, 'dd MMM yyyy HH:mm', {
    locale: es,
  })
}

export function formatPopupDate(dateValue: string | null | undefined): string {
  if (!dateValue) return '-'

  const parsedDate = parseDate(dateValue)

  if (!parsedDate) {
    return dateValue
  }

  return format(parsedDate, 'dd/MM/yyyy HH:mm', {
    locale: es,
  })
}

export function formatSimulationDate(dateStr: string): string {
  try {
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    const hours = dateStr.substring(8, 10)
    const minutes = dateStr.substring(10, 12)

    const dateObj = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`)
    return format(dateObj, 'dd MMM yyyy HH:mm', { locale: es })
  } catch {
    return dateStr
  }
}

export function parseDate(dateValue: string): Date | null {
  const compactPattern = /^\d{14}$/

  if (compactPattern.test(dateValue)) {
    const year = Number.parseInt(dateValue.slice(0, 4), 10)
    const month = Number.parseInt(dateValue.slice(4, 6), 10) - 1
    const day = Number.parseInt(dateValue.slice(6, 8), 10)
    const hour = Number.parseInt(dateValue.slice(8, 10), 10)
    const minute = Number.parseInt(dateValue.slice(10, 12), 10)
    const second = Number.parseInt(dateValue.slice(12, 14), 10)

    const parsedCompactDate = new Date(year, month, day, hour, minute, second)
    return Number.isNaN(parsedCompactDate.getTime()) ? null : parsedCompactDate
  }

  const parsedDate = new Date(dateValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

export function toTimestamp(dateValue: string): number {
  const parsedDate = parseDate(dateValue)
  return parsedDate?.getTime() ?? Number.NEGATIVE_INFINITY
}

export function formatDate(dateValue?: string): string {
  if (!dateValue) return '--'

  const parsedDate = parseDate(dateValue)
  if (!parsedDate) return dateValue

  const day = String(parsedDate.getDate()).padStart(2, '0')
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const year = parsedDate.getFullYear()
  const hour = String(parsedDate.getHours()).padStart(2, '0')
  const minute = String(parsedDate.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} ${hour}:${minute}`
}
