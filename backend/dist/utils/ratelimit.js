"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
// Simple in-memory rate limiter
const store = new Map();
function rateLimit(key, max, windowMs) {
    const now = Date.now();
    const entry = store.get(key);
    // Clean expired entries on check (lazy cleanup, CF Workers compatible)
    if (entry && now > entry.resetAt) {
        store.delete(key);
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (!entry) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (entry.count >= max)
        return false;
    entry.count++;
    return true;
}
// Periodically clean up stale entries (Node.js only - wrapped in try for CF)
try {
    const interval = setInterval(() => {
        const now = Date.now();
        for (const [k, v] of store) {
            if (now > v.resetAt)
                store.delete(k);
        }
    }, 5 * 60 * 1000);
    if (interval.unref)
        interval.unref();
}
catch (e) { /* CF Workers: no setInterval in global scope, lazy cleanup is fine */ }
//# sourceMappingURL=ratelimit.js.map