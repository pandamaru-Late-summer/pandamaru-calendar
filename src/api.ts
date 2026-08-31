// src/api.ts
import { CalendarEvent } from './types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export async function fetchEvents(): Promise<CalendarEvent[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/events`)
    if (!res.ok) throw new Error('API取得に失敗しました')
    return await res.json()
  } catch (e) {
    console.warn('バックエンド未接続のため、ローカル状態を使用します')
    return []
  }
}

export async function createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
  const res = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  if (!res.ok) throw new Error('イベント作成に失敗しました')
  return await res.json()
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/events/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('イベント削除に失敗しました')
}