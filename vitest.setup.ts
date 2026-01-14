import { afterEach } from 'vitest'
import { Subscription } from 'rxjs'

// Global subscription tracker
const subscriptions = new Set<Subscription>()

// Helper to track subscriptions
export function trackSubscription(sub: Subscription): Subscription {
  subscriptions.add(sub)
  return sub
}

// Auto-cleanup after each test
afterEach(() => {
  subscriptions.forEach(sub => {
    if (!sub.closed) {
      sub.unsubscribe()
    }
  })
  subscriptions.clear()
})
