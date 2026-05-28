import * as Notifications from 'expo-notifications'
import { SchedulableTriggerInputTypes } from 'expo-notifications'
import { getSolunarForDate } from './solunar'

const FEED_PREFIX = 'bp_feed_'

export async function getPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync()
  return status
}

export async function requestPermission() {
  const { status } = await Notifications.requestPermissionsAsync()
  return status
}

export async function cancelFeedingAlerts() {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      all
        .filter(n => n.identifier?.startsWith(FEED_PREFIX))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    )
  } catch (_) {}
}

export async function scheduleFeedingAlerts({ major, minor, leadMinutes = 15 }, homePortName, lat, lng) {
  await cancelFeedingAlerts()
  if (!major && !minor) return []

  const now       = Date.now()
  const scheduled = []

  for (let dayOffset = 0; dayOffset <= 1 && scheduled.length < 2; dayOffset++) {
    const dayStart = new Date()
    dayStart.setDate(dayStart.getDate() + dayOffset)
    dayStart.setHours(0, 0, 0, 0)

    const sol = getSolunarForDate(dayStart, lat, lng)
    const candidates = [
      major && { ...sol.major1, kind: 'Major' },
      major && { ...sol.major2, kind: 'Major' },
      minor && { ...sol.minor1, kind: 'Minor' },
      minor && { ...sol.minor2, kind: 'Minor' },
    ].filter(Boolean).sort((a, b) => a.startH - b.startH)

    for (const w of candidates) {
      if (scheduled.length >= 2) break
      const fireMs = dayStart.getTime() + w.startH * 3_600_000 - leadMinutes * 60_000
      if (fireMs <= now) continue

      const id = `${FEED_PREFIX}${w.kind.toLowerCase()}_${dayStart.toISOString().slice(0, 10)}_${Math.round(w.startH * 10)}`
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: `🎣 ${w.kind} feeding window`,
            body:  `Starts in ${leadMinutes} min at ${homePortName} (${w.start})`,
          },
          trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(fireMs) },
        })
        scheduled.push(w)
      } catch (_) {}
    }
  }

  return scheduled
}
