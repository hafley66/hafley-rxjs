import { afterEach } from 'vitest';
// Global subscription tracker
const subscriptions = new Set();
// Helper to track subscriptions
export function trackSubscription(sub) {
    subscriptions.add(sub);
    return sub;
}
// Auto-cleanup after each test
afterEach(() => {
    subscriptions.forEach(sub => {
        if (!sub.closed) {
            sub.unsubscribe();
        }
    });
    subscriptions.clear();
});
