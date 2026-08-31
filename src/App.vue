<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { CalendarEvent, DayCell, PastelColor } from './types'
import { fetchEvents, createEvent, deleteEvent } from './api'

// --- State ---
const currentDate = ref(new Date())
const events = ref<CalendarEvent[]>([])
const isModalOpen = ref(false)
const selectedEvent = ref<CalendarEvent | null>(null)

// フォーム用の状態
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

const colorOptions: { key: PastelColor; label: string; bg: string; text: string }[] = [
  { key: 'sakura', label: 'サクラ', bg: '#FFE4E8', text: '#C84B68' },
  { key: 'mint', label: 'ミント', bg: '#E2FBE8', text: '#2B8246' },
  { key: 'lavender', label: 'ラベンダー', bg: '#EFE7FC', text: '#6D3EC4' },
  { key: 'sky', label: 'スカイ', bg: '#E1F5FE', text: '#0277BD' },
  { key: 'lemon', label: 'レモン', bg: '#FFF9C4', text: '#F57F17' },
]

// --- カレンダーグリッド計算 ---
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())
const monthYearTitle = computed(() => {
  return currentDate.value.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
})

const weekDays = ['月', '火', '水', '木', '金', '土', '日']

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  const startingDayOfWeek = firstDayOfMonth.getDay()
  const totalDays = lastDayOfMonth.getDate()

  const days: DayCell[] = []
  const todayStr = new Date().toISOString().split('T')[0]

  // 前月の日付埋め
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
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

  // 当月の日付
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

  // 翌月の日付埋め (6週間=42マス固定)
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

// 当日の全イベント（サイドバー用）
const todayEvents = computed(() => {
  const todayStr = new Date().toISOString().split('T')[0]
  return events.value.filter(e => e.start_time.startsWith(todayStr))
})

// --- アクション ---
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
  currentDate.value = new Date()
}

// モーダルを開く（新規作成）
const openAddModal = (dateStr?: string) => {
  selectedEvent.value = null
  form.value = {
    title: '',
    description: '',
    date: dateStr || new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    isAllDay: false,
    color: 'lavender'
  }
  isModalOpen.value = true
}

// モーダルを開く（詳細・編集）
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
    // オフライン・モック用 fallback
    events.value.push({
      id: crypto.randomUUID(),
      ...payload
    })
  }

  closeModal()
}

const handleDelete = async () => {
  if (!selectedEvent.value) return
  try {
    await deleteEvent(selectedEvent.value.id)
  } catch {
    // mock delete
  }
  events.value = events.value.filter(e => e.id !== selectedEvent.value?.id)
  closeModal()
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="calendar-app">
    <!-- サイドバー -->
    <aside class="sidebar">
      <div class="app-logo">
        <div class="logo-icon">🌸</div>
        <h2>Pastel Plan</h2>
      </div>

      <button class="btn-create" @click="openAddModal()">
        <span class="plus-icon">＋</span> 新しい予定
      </button>

      <div class="today-section">
        <h3>今日のスケジュール</h3>
        <div v-if="todayEvents.length === 0" class="empty-state">
          予定はありません ☕️
        </div>
        <ul v-else class="today-list">
          <li 
            v-for="ev in todayEvents" 
            :key="ev.id" 
            :class="['today-card', `tag-${ev.color}`]"
            @click="openDetailModal(ev, $event)"
          >
            <span class="today-time">
              {{ ev.is_all_day ? '終日' : ev.start_time.split('T')[1]?.slice(0, 5) }}
            </span>
            <span class="today-title">{{ ev.title }}</span>
          </li>
        </ul>
      </div>
    </aside>

    <!-- メインカレンダー領域 -->
    <main class="main-content">
      <!-- ヘッダーツールバー -->
      <header class="header">
        <div class="month-title-group">
          <h1>{{ monthYearTitle }}</h1>
          <button class="btn-today" @click="goToToday">今日</button>
        </div>

        <div class="nav-controls">
          <button class="btn-icon" @click="prevMonth">‹</button>
          <button class="btn-icon" @click="nextMonth">›</button>
        </div>
      </header>

      <!-- 曜日ヘッダー -->
      <div class="weekdays-grid">
        <div 
          v-for="(day, index) in weekDays" 
          :key="day" 
          :class="['weekday-label', { 'is-sun': index === 6, 'is-sat': index === 5 }]"
        >
          {{ day }}
        </div>
      </div>

      <!-- 日付グリッド -->
      <div class="days-grid">
        <div
          v-for="cell in calendarDays"
          :key="cell.dateString"
          :class="[
            'day-cell',
            { 'other-month': !cell.isCurrentMonth, 'is-today': cell.isToday }
          ]"
          @click="openAddModal(cell.dateString)"
        >
          <div class="cell-top">
            <span :class="['day-number', { 'today-badge': cell.isToday }]">
              {{ cell.dayNumber }}
            </span>
          </div>

          <!-- イベントバッジ一覧 -->
          <div class="cell-events">
            <div
              v-for="ev in cell.events"
              :key="ev.id"
              :class="['event-badge', `tag-${ev.color}`]"
              @click="openDetailModal(ev, $event)"
            >
              <span v-if="!ev.is_all_day" class="event-time">
                {{ ev.start_time.split('T')[1]?.slice(0, 5) }}
              </span>
              <span class="event-badge-title">{{ ev.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 予定作成・詳細モーダル -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-card">
        <div class="modal-header">
          <h3>{{ selectedEvent ? '予定の詳細・編集' : '新しい予定を作成' }}</h3>
          <button class="btn-close" @click="closeModal">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>タイトル</label>
            <input v-model="form.title" type="text" placeholder="ミーティング、買い物など" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>日付</label>
              <input v-model="form.date" type="date" />
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input v-model="form.isAllDay" type="checkbox" /> 終日
              </label>
            </div>
          </div>

          <div v-if="!form.isAllDay" class="form-row">
            <div class="form-group">
              <label>開始時間</label>
              <input v-model="form.startTime" type="time" />
            </div>
            <div class="form-group">
              <label>終了時間</label>
              <input v-model="form.endTime" type="time" />
            </div>
          </div>

          <!-- カラー選択パレット -->
          <div class="form-group">
            <label>カラータグ</label>
            <div class="color-picker">
              <button
                v-for="c in colorOptions"
                :key="c.key"
                type="button"
                :class="['color-swatch', `tag-${c.key}`, { active: form.color === c.key }]"
                @click="form.color = c.key"
              >
                {{ c.label }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>メモ / 説明</label>
            <textarea v-model="form.description" rows="3" placeholder="詳細を入力"></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button v-if="selectedEvent" class="btn-delete" @click="handleDelete">
            削除
          </button>
          <div class="spacer"></div>
          <button class="btn-cancel" @click="closeModal">キャンセル</button>
          <button class="btn-primary" @click="handleSave">
            {{ selectedEvent ? '更新' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --- 全体レイアウト --- */
.calendar-app {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: #f7f9fc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #334155;
  user-select: none;
}

/* --- パステルタグカラー定義 --- */
.tag-sakura { background: #ffe4e8; color: #c84b68; }
.tag-mint { background: #e2fbe8; color: #2b8246; }
.tag-lavender { background: #efe7fc; color: #6d3ec4; }
.tag-sky { background: #e1f5fe; color: #0277bd; }
.tag-lemon { background: #fff9c4; color: #b78103; }

/* --- サイドバー --- */
.sidebar {
  width: 280px;
  background: #ffffff;
  border-right: 1px solid #eef2f6;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 10px rgba(0,0,0,0.02);
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}
.logo-icon {
  font-size: 24px;
}
.app-logo h2 {
  font-size: 20px;
  font-weight: 700;
  color: #475569;
  margin: 0;
}

.btn-create {
  background: #7c4dff;
  background: linear-gradient(135deg, #a78bfa 0%, #818cf8 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px 18px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(167, 139, 250, 0.35);
  transition: all 0.2s ease;
}
.btn-create:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(167, 139, 250, 0.45);
}

.today-section {
  margin-top: 32px;
  flex: 1;
  overflow-y: auto;
}
.today-section h3 {
  font-size: 14px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}
.empty-state {
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
  padding: 20px 0;
}
.today-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.today-card {
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.today-card:hover {
  transform: scale(1.02);
}
.today-time {
  display: block;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.8;
}
.today-title {
  font-size: 13px;
  font-weight: 600;
}

/* --- メインコンテンツ --- */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.month-title-group {
  display: flex;
  align-items: center;
  gap: 16px;
}
.month-title-group h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.btn-today {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-today:hover {
  background: #f1f5f9;
}

.nav-controls {
  display: flex;
  gap: 6px;
}
.btn-icon {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  transition: all 0.15s;
}
.btn-icon:hover {
  background: #f8fafc;
  color: #1e293b;
}

/* 曜日ラベル */
.weekdays-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 8px 0;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}
.weekday-label.is-sun { color: #f43f5e; }
.weekday-label.is-sat { color: #0284c7; }

/* カレンダーマス目 */
.days-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 6px;
  min-height: 0;
}
.day-cell {
  background: #ffffff;
  border-radius: 12px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  border: 1px solid #f1f5f9;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s;
}
.day-cell:hover {
  border-color: #cbd5e1;
}
.day-cell.other-month {
  background: #fafbfc;
  opacity: 0.45;
}
.cell-top {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}
.day-number {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.today-badge {
  background: #818cf8;
  color: #ffffff !important;
}

/* イベントバッジ */
.cell-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
}
.event-badge {
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
.event-time {
  font-size: 10px;
  opacity: 0.8;
}

/* --- モーダル --- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-card {
  background: #ffffff;
  width: 440px;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #1e293b;
}
.btn-close {
  background: none;
  border: none;
  font-size: 16px;
  color: #94a3b8;
  cursor: pointer;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.form-group input[type="text"],
.form-group input[type="date"],
.form-group input[type="time"],
.form-group textarea {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
  color: #334155;
}
.form-group input:focus,
.form-group textarea:focus {
  border-color: #a78bfa;
}
.form-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.checkbox-group {
  margin-top: 20px;
}

/* カラーセレクター */
.color-picker {
  display: flex;
  gap: 8px;
}
.color-swatch {
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.color-swatch.active {
  border-color: #475569;
  transform: translateY(-2px);
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.spacer { flex: 1; }
.btn-primary {
  background: #818cf8;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel {
  background: #f1f5f9;
  color: #475569;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
}
.btn-delete {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
</style>