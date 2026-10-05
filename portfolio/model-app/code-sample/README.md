# Optimistic likes: an independent interview example

An independent teaching example of optimistic updates and rollback, using synthetic posts and a simulated transport. Built with AI assistance for this portfolio, it runs without a production backend, account, or third-party dependencies.

For the accompanying product narrative, see [the case study](../case-study.md).

## Run locally

Requires Node.js 20 or later. From this directory:

```sh
npm test
npm start
```

Open http://127.0.0.1:4173. No `npm install` is needed. Stop with Ctrl+C. The server binds only to localhost and exposes five allowlisted routes serving four browser files. If port 4173 is occupied by an earlier copy of this demo, stop that copy first.

## Five-minute walkthrough

1. Set the response delay to 3 seconds and click Like in Feed. Detail immediately shows the same state.
2. Click again before the response. The event log shows the pending guard ignoring that click.
3. Turn on Reject requests and click Unlike. Both views update, then roll back to the previous state.
4. Reset during a request. Its eventual response is ignored and cannot modify the reset session.
5. Read `likes.js`, then `likes.test.js`. `app.js` imports the exact same core module tested by Node.

The core owns one canonical list and sends snapshots to both subscribers. A request locks its post before emitting or awaiting, replaces that post optimistically, and saves its previous object for rollback. Rejection restores only that post. `Math.max` prevents a negative count. A reset increments a generation counter so an old request cannot restore stale data or release a newer request's lock. Tests subscribe twice to model Feed and Detail; the interface likewise renders both from a single subscription.

## What the tests establish

Success and immediate synchronization, rejected-request rollback in both subscribers, duplicate-click suppression, unlike/zero-count behavior, isolation of another post, stale rejection after reset, and real local HTTP delivery of the browser's core module. These are unit tests plus a localhost server smoke test, not automated browser tests or production API tests.

## Limits and discussion

- One browser session with in-memory state; refresh discards it. The transport is a timer, not a backend.
- A successful response is assumed to confirm the optimistic value. A real server may return an authoritative count and requires reconciliation, authentication and authorization.
- Pending clicks are ignored, not queued. This is a visible UX choice; the buttons remain clickable so the guard can be demonstrated.
- Reset logically ignores old requests; it does not cancel the underlying timer. No multi-tab coordination, offline retry, distributed concurrency, pagination or persistence is implemented.
- Subscribers are trusted synchronous UI callbacks; this example does not isolate exceptions thrown by a subscriber.
- The event log is intentionally unbounded for a short demonstration.

## Provenance and AI collaboration

Created for this portfolio with AI assistance: I selected the post experience as the topic, and AI drafted the implementation, synthetic UI and tests. MODEL-APP's like hook supplied the conceptual context; this sample uses a new minimal JavaScript store instead of the app's React/Supabase implementation. The tests validate this standalone example, not the production backend.
