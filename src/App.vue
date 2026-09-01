<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { CalendarEvent, DayCell, PastelColor } from './types'
import { fetchEvents, createEvent, deleteEvent } from './api'

// --- 状態管理 ---
const currentDate = ref(new Date())
const selectedDateStr = ref<string>(new Date().toISOString().split('T')[0])
const events = ref<CalendarEvent[]>([])
const isModalOpen = ref(false)
const selectedEvent = ref<CalendarEvent | null>(null)
const isSidebarOpen = ref(false) // レスポンシブ用サイドバートグル

// フォーム入力値
const form = ref<{
  id?: string
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  isAllDay: boolean
  color: PastelColor
}>({
  title: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  startTime: '10:00',
  endTime: '11:00',
  isAllDay: false,
  color: 'lavender'
})

// パステルカラー定義（さらに優しいトーンに刷新）
const colorOptions: { key: PastelColor; label: string; bg: string; text: string; border: string }[] = [
  { key: 'sakura', label: 'サクラ', bg: '#FDE8ED', text: '#D14D72', border: '#FBC4D0' },
  { key: 'mint', label: 'ミント', bg: '#E3F8EB', text: '#2E7D4E', border: '#B8ECCB' },
  { key: 'lavender', label: 'ラベンダー', bg: '#F0EAFE', text: '#7048E8', border: '#D3BEFD' },
  { key: 'sky', label: 'スカイ', bg: '#E1F3FD', text: '#1976D2', border: '#BBE3FC' },
  { key: 'lemon', label: 'レモン', bg: '#FEF8DB', text: '#B78103', border: '#FCEEA7' },
]

// --- カレンダー計算（月曜始まり） ---
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())
const monthYearTitle = computed(() => {
  return currentDate.value.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
})

// 月曜始まりの曜日配列
const weekDays = [
  { label: '月', isWeekend: false },
  { label: '火', isWeekend: false },
  { label: '水', isWeekend: false },
  { label: '木', isWeekend: false },
  { label: '金', isWeekend: false },
  { label: '土', isWeekend: true, type: 'sat' },
  { label: '日', isWeekend: true, type: 'sun' },
]

// 月曜始まりのインデックス変換 (日:0->6, 月:1->0, 火:2->1, ... 土:6->5)
const getMondayFirstDayIndex = (day: number) => (day + 6) % 7

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  // 月曜始まりの開始オフセット
  const startingDayOffset = getMondayFirstDayIndex(firstDayOfMonth.getDay())
  const totalDays = lastDayOfMonth.getDate()

  const days: DayCell[] = []
  const todayStr = new Date().toISOString().split('T')[0]

  // 1. 前月の日付埋め
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startingDayOffset - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({
      date: d,
      dateString: dateStr,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: events.value.filter(e => e.start_time.startsWith(dateStr))
    })
  }

  // 2. 当月の日付
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({
      date: d,
      dateString: dateStr,
      dayNumber: i,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      events: events.value.filter(e => e.start_time.startsWith(dateStr))
    })
  }

  // 3. 翌月の日付埋め (6週グリッド: 計42マス)
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({
      date: d,
      dateString: dateStr,
      dayNumber: i,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: events.value.filter(e => e.start_time.startsWith(dateStr))
    })
  }

  return days
})

// 選択中の日付のイベント一覧（サイドバーに表示）
const selectedDateEvents = computed(() => {
  return events.value.filter(e => e.start_time.startsWith(selectedDateStr.value))
})

const selectedDateLabel = computed(() => {
  const d = new Date(selectedDateStr.value + 'T00:00:00')
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })
})

// --- 操作ハンドラー ---
const loadData = async () => {
  const data = await fetchEvents()
  if (data && data.length > 0) {
    events.value = data
  }
}

const prevMonth = () => {
  currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1)
}

const nextMonth = () => {
  currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1)
}

const goToToday = () => {
  const now = new Date()
  currentDate.value = now
  selectedDateStr.value = now.toISOString().split('T')[0]
}

const selectDay = (dateStr: string) => {
  selectedDateStr.value = dateStr
}

// モーダル操作
const openAddModal = (dateStr?: string) => {
  selectedEvent.value = null
  const targetDate = dateStr || selectedDateStr.value || new Date().toISOString().split('T')[0]
  selectedDateStr.value = targetDate
  form.value = {
    title: '',
    description: '',
    date: targetDate,
    startTime: '09:00',
    endTime: '10:00',
    isAllDay: false,
    color: 'lavender'
  }
  isModalOpen.value = true
}

const openDetailModal = (event: CalendarEvent, e: MouseEvent) => {
  e.stopPropagation()
  selectedEvent.value = event
  const [date, time] = event.start_time.split('T')
  const endTime = event.end_time.split('T')[1] || ''

  form.value = {
    id: event.id,
    title: event.title,
    description: event.description || '',
    date: date,
    startTime: time ? time.slice(0, 5) : '09:00',
    endTime: endTime ? endTime.slice(0, 5) : '10:00',
    isAllDay: event.is_all_day === 1,
    color: event.color || 'lavender'
  }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  selectedEvent.value = null
}

const handleSave = async () => {
  if (!form.value.title.trim()) return

  const startTimeIso = form.value.isAllDay
    ? `${form.value.date}T00:00:00`
    : `${form.value.date}T${form.value.startTime}:00`

  const endTimeIso = form.value.isAllDay
    ? `${form.value.date}T23:59:59`
    : `${form.value.date}T${form.value.endTime}:00`

  const payload: Omit<CalendarEvent, 'id'> = {
    title: form.value.title,
    description: form.value.description,
    start_time: startTimeIso,
    end_time: endTimeIso,
    is_all_day: form.value.isAllDay ? 1 : 0,
    color: form.value.color
  }

  try {
    const created = await createEvent(payload)
    events.value.push(created)
  } catch {
    events.value.push({ id: crypto.randomUUID(), ...payload })
  }

  closeModal()
}

const handleDelete = async () => {
  if (!selectedEvent.value) return
  try {
    await deleteEvent(selectedEvent.value.id)
  } catch {}
  events.value = events.value.filter(e => e.id !== selectedEvent.value?.id)
  closeModal()
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="app-layout">
    <!-- モバイル用バックドロップ -->
    <div 
      v-if="isSidebarOpen" 
      class="sidebar-backdrop" 
      @click="isSidebarOpen = false"
    ></div>

    <!-- サイドバー -->
    <aside :class="['sidebar', { 'is-open': isSidebarOpen }]">
      <div class="sidebar-header">
        <div class="brand">
          <span class="brand-badge">🌸</span>
          <span class="brand-text">Pastel Plan</span>
        </div>
        <button class="btn-close-sidebar" @click="isSidebarOpen = false">✕</button>
      </div>

      <button class="btn-new-event" @click="openAddModal()">
        <span class="btn-new-icon">+</span> 新しい予定
      </button>

      <!-- 選択日のイベントリスト -->
      <div class="day-events-panel">
        <div class="panel-header">
          <h3>{{ selectedDateLabel }} の予定</h3>
          <span class="badge-count">{{ selectedDateEvents.length }}</span>
        </div>

        <div v-if="selectedDateEvents.length === 0" class="empty-placeholder">
          <span class="empty-icon">☕️</span>
          <p>予定がありません</p>
        </div>

        <ul v-else class="event-scroll-list">
          <li
            v-for="ev in selectedDateEvents"
            :key="ev.id"
            :class="['event-card-item', `color-${ev.color}`]"
            @click="openDetailModal(ev, $event)"
          >
            <div class="event-card-time">
              {{ ev.is_all_day ? '終日' : `${ev.start_time.split('T')[1]?.slice(0, 5)} - ${ev.end_time.split('T')[1]?.slice(0, 5)}` }}
            </div>
            <div class="event-card-title">{{ ev.title }}</div>
            <div v-if="ev.description" class="event-card-desc">{{ ev.description }}</div>
          </li>
        </ul>
      </div>
    </aside>

    <!-- メインコンテンツ -->
    <main class="main-wrapper">
      <!-- トップナビゲーションバー -->
      <header class="topbar">
        <div class="topbar-left">
          <button class="btn-menu-toggle" @click="isSidebarOpen = true">☰</button>
          <h1 class="current-month-label">{{ monthYearTitle }}</h1>
          <button class="btn-pill" @click="goToToday">今月</button>
        </div>

        <div class="topbar-right">
          <div class="nav-button-group">
            <button class="nav-btn" @click="prevMonth">‹</button>
            <button class="nav-btn" @click="nextMonth">›</button>
          </div>
        </div>
      </header>

      <!-- 曜日ヘッダー (月曜始まり) -->
      <div class="weekdays-bar">
        <div
          v-for="w in weekDays"
          :key="w.label"
          :class="['weekday-col', { 'is-sat': w.type === 'sat', 'is-sun': w.type === 'sun' }]"
        >
          {{ w.label }}
        </div>
      </div>

      <!-- 月間グリッド -->
      <div class="calendar-grid-container">
        <div class="calendar-grid">
          <div
            v-for="cell in calendarDays"
            :key="cell.dateString"
            :class="[
              'date-cell',
              {
                'not-current-month': !cell.isCurrentMonth,
                'is-today': cell.isToday,
                'is-selected': cell.dateString === selectedDateStr
              }
            ]"
            @click="selectDay(cell.dateString)"
            @dblclick="openAddModal(cell.dateString)"
          >
            <div class="date-cell-header">
              <span class="day-number-badge">{{ cell.dayNumber }}</span>
            </div>

            <!-- イベントタグリスト -->
            <div class="date-cell-events">
              <div
                v-for="ev in cell.events.slice(0, 3)"
                :key="ev.id"
                :class="['event-chip', `color-${ev.color}`]"
                @click="openDetailModal(ev, $event)"
              >
                <span v-if="!ev.is_all_day" class="chip-time">
                  {{ ev.start_time.split('T')[1]?.slice(0, 5) }}
                </span>
                <span class="chip-text">{{ ev.title }}</span>
              </div>

              <!-- 3件を超える場合の +N件 表示 -->
              <span v-if="cell.events.length > 3" class="more-badge">
                +他 {{ cell.events.length - 3 }} 件
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 予定作成・編集モーダル -->
    <div v-if="isModalOpen" class="modal-backdrop" @click.self="closeModal">
      <div class="modal-window">
        <div class="modal-top">
          <h3>{{ selectedEvent ? '予定の編集' : '新しい予定' }}</h3>
          <button class="btn-icon-close" @click="closeModal">✕</button>
        </div>

        <div class="modal-fields">
          <div class="field-item">
            <label>タイトル</label>
            <input v-model="form.title" type="text" placeholder="予定名を入力" autofocus />
          </div>

          <div class="field-row">
            <div class="field-item flex-2">
              <label>日付</label>
              <input v-model="form.date" type="date" />
            </div>
            <div class="field-item flex-1 checkbox-field">
              <label class="custom-checkbox">
                <input v-model="form.isAllDay" type="checkbox" />
                <span class="checkbox-label">終日</span>
              </label>
            </div>
          </div>

          <div v-if="!form.isAllDay" class="field-row">
            <div class="field-item flex-1">
              <label>開始時間</label>
              <input v-model="form.startTime" type="time" />
            </div>
            <div class="field-item flex-1">
              <label>終了時間</label>
              <input v-model="form.endTime" type="time" />
            </div>
          </div>

          <div class="field-item">
            <label>パステルカラー</label>
            <div class="color-palette-selector">
              <button
                v-for="c in colorOptions"
                :key="c.key"
                type="button"
                :class="['color-pill', `color-${c.key}`, { active: form.color === c.key }]"
                @click="form.color = c.key"
              >
                {{ c.label }}
              </button>
            </div>
          </div>

          <div class="field-item">
            <label>メモ</label>
            <textarea v-model="form.description" rows="3" placeholder="メモや詳細を追加"></textarea>
          </div>
        </div>

        <div class="modal-actions">
          <button v-if="selectedEvent" class="btn-action-delete" @click="handleDelete">
            削除
          </button>
          <div class="spacer"></div>
          <button class="btn-action-cancel" @click="closeModal">キャンセル</button>
          <button class="btn-action-save" @click="handleSave">
            {{ selectedEvent ? '更新する' : '追加する' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==========================================================================
   パステルトーン・カラーシステム
   ========================================================================== */
.color-sakura { background: #fde8ed; color: #d14d72; border: 1px solid #fbc4d0; }
.color-mint { background: #e3f8eb; color: #2e7d4e; border: 1px solid #b8eccb; }
.color-lavender { background: #f0eaff; color: #7048e8; border: 1px solid #d3befd; }
.color-sky { background: #e1f3fd; color: #1976d2; border: 1px solid #bbe3fc; }
.color-lemon { background: #fef8db; color: #b78103; border: 1px solid #fceea7; }

/* ==========================================================================
   全体レイアウト & ベース設定
   ========================================================================== */
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: #fbfbfe;
  color: #334155;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow: hidden;
  position: relative;
}

/* ==========================================================================
   サイドバー
   ========================================================================== */
.sidebar {
  width: 300px;
  min-width: 300px;
  background: #ffffff;
  border-right: 1px solid #f0f3f8;
  display: flex;
  flex-direction: column;
  padding: 24px 20px;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.02);
  z-index: 20;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-badge {
  font-size: 22px;
}

.brand-text {
  font-size: 19px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.3px;
}

.btn-close-sidebar {
  display: none;
  background: none;
  border: none;
  font-size: 18px;
  color: #94a3b8;
  cursor: pointer;
}

.btn-new-event {
  background: linear-gradient(135deg, #a78bfa 0%, #818cf8 100%);
  color: white;
  border: none;
  border-radius: 14px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 8px 18px rgba(167, 139, 250, 0.3);
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-new-event:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 22px rgba(167, 139, 250, 0.4);
}

.btn-new-icon {
  font-size: 18px;
  font-weight: bold;
}

.day-events-panel {
  margin-top: 28px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: #64748b;
  margin: 0;
}

.badge-count {
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
}

.empty-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
  gap: 6px;
}

.empty-icon {
  font-size: 28px;
  opacity: 0.8;
}

.event-scroll-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.event-card-item {
  padding: 12px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.event-card-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.event-card-time {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.85;
  margin-bottom: 2px;
}

.event-card-title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
}

.event-card-desc {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ==========================================================================
   メインエリア
   ========================================================================== */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  min-width: 0;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.btn-menu-toggle {
  display: none;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 18px;
  cursor: pointer;
}

.current-month-label {
  font-size: 22px;
  font-weight: 800;
  color: #1e293b;
  margin: 0;
  letter-spacing: -0.5px;
}

.btn-pill {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-pill:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.nav-button-group {
  display: flex;
  gap: 6px;
}

.nav-btn {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.nav-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

/* 曜日ヘッダー */
.weekdays-bar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 10px 0;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
}

.weekday-col.is-sat { color: #0284c7; }
.weekday-col.is-sun { color: #f43f5e; }

/* グリッド本体 */
.calendar-grid-container {
  flex: 1;
  display: flex;
  min-height: 0;
}

.calendar-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: 6px;
  min-height: 0;
}

.date-cell {
  background: #ffffff;
  border-radius: 12px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  border: 1px solid #f1f5f9;
  cursor: pointer;
  transition: all 0.15s ease;
  overflow: hidden;
}

.date-cell:hover {
  border-color: #cbd5e1;
}

.date-cell.not-current-month {
  background: #fbfcfe;
  opacity: 0.4;
}

.date-cell.is-selected {
  border-color: #a78bfa;
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.2);
}

.date-cell-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.day-number-badge {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.date-cell.is-today .day-number-badge {
  background: #818cf8;
  color: #ffffff;
}

.date-cell-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
}

.event-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}

.chip-time {
  font-size: 9px;
  opacity: 0.85;
}

.chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-badge {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 600;
  padding-left: 2px;
}

/* ==========================================================================
   モーダル
   ========================================================================== */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.modal-window {
  background: #ffffff;
  width: 100%;
  max-width: 440px;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-top h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.btn-icon-close {
  background: none;
  border: none;
  font-size: 16px;
  color: #94a3b8;
  cursor: pointer;
}

.modal-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-item label {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.field-item input[type="text"],
.field-item input[type="date"],
.field-item input[type="time"],
.field-item textarea {
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  color: #1e293b;
  transition: border-color 0.15s;
}

.field-item input:focus,
.field-item textarea:focus {
  border-color: #a78bfa;
}

.field-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.flex-1 { flex: 1; }
.flex-2 { flex: 2; }

.checkbox-field {
  padding-bottom: 10px;
}

.custom-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.checkbox-label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.color-palette-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-pill {
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.color-pill.active {
  box-shadow: 0 0 0 2px #475569;
  transform: translateY(-2px);
}

.modal-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.spacer { flex: 1; }

.btn-action-save {
  background: #818cf8;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-action-save:hover {
  background: #6366f1;
}

.btn-action-cancel {
  background: #f1f5f9;
  color: #475569;
  border: none;
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.btn-action-delete {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

/* ==========================================================================
   レスポンシブ対応 (ブレイクポイント: 900px, 600px)
   ========================================================================== */
@media (max-width: 900px) {
  .btn-menu-toggle {
    display: block;
  }

  .btn-close-sidebar {
    display: block;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
    box-shadow: 10px 0 30px rgba(0, 0, 0, 0.1);
  }

  .sidebar.is-open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.3);
    backdrop-filter: blur(2px);
    z-index: 15;
  }

  .main-wrapper {
    padding: 16px;
  }
}

@media (max-width: 600px) {
  .topbar-left h1 {
    font-size: 18px;
  }

  .weekdays-bar {
    font-size: 11px;
  }

  .date-cell {
    padding: 2px 4px;
    border-radius: 8px;
  }

  .day-number-badge {
    width: 20px;
    height: 20px;
    font-size: 10px;
  }

  .event-chip {
    font-size: 9px;
    padding: 1px 3px;
  }

  .chip-time {
    display: none;
  }
}
</style>