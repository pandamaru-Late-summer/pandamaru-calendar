// src/types.ts
export type PastelColor = 'sakura' | 'mint' | 'lavender' | 'sky' | 'lemon'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start_time: string // ISO string または YYYY-MM-DDTHH:mm
  end_time: string
  is_all_day: number // 1: true, 0: false
  color: PastelColor
}

export interface DayCell {
  date: Date
  dateString: string // YYYY-MM-DD
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}