# MODEL-APP: keeping a like consistent across two views

MODEL-APP is a community product for model hobbyists to share photography, organize collections and discuss their interests. It is available on [the web](https://poseshelf.com), [iOS through the App Store](https://apps.apple.com/app/id6782850253), and [Android through direct APK download](https://poseshelf.com/android). Android is not yet listed on Google Play.

This case study covers photographs, posts, likes and comments. Its focused engineering example is one like action updating the same post in a paginated feed and a detail screen.

## My role and development approach

I use AI-assisted development for implementation and debugging. My responsibilities include defining requirements and user flows, making product decisions, tracking issues, reviewing features against acceptance criteria, and maintaining release and handover documentation. For the new teaching sample below, I requested the scope and behaviors; AI drafted the standalone implementation, interface and tests.

## Requirement

When someone likes a post, they should receive immediate feedback. Opening its detail screen should show a consistent like state and count. If the server rejects the action, the interface should recover rather than continue presenting an accepted action. A change to one post should not affect other posts or discard already loaded feed pages.

These are acceptance criteria that can be checked with synthetic data. The stale-view scenario follows from the architecture; this article does not claim it was a documented user-reported production incident.

## Architecture and surrounding flow

The app uses Expo, React Native and TypeScript for mobile and web interfaces. TanStack Query manages server-data caches, while Supabase provides authentication, database access and storage. The feed and detail screen call a shared `usePostLike` hook rather than implementing separate like behavior.

Publishing begins with selected images. The composer compresses and uploads them before calling a database function to create the post and its media records. The code marks a successful database call as a commit boundary: later cleanup must not remove images that now belong to a published post. This separates an unsuccessful publication from an unsuccessful local cleanup step.

The detail screen supports comments, including an optional image. A successful comment submission clears the input, updates the displayed comment count and refreshes the comment query. This case study does not treat comments and post likes as identical update mechanisms: the focused example is the shared post-like cache.

## Like flow

The hook receives a post identifier and the like state observed when the user presses the button. Before updating the interface, it cancels matching feed and detail fetches and takes snapshots of the relevant cached data. Cancelling fetches reduces the chance that an in-flight response will immediately overwrite the optimistic update; it does not make every possible concurrent event safe.

The optimistic transition flips the target post's like state and adjusts its count. The count is clamped at zero. It maps over every cached feed page and updates matching detail-cache entries using query-key prefixes. The update creates new objects for changed data rather than modifying the cached records in place. Other posts and pagination metadata remain intact.

The database mutation inserts or deletes a row in `post_likes`. Database access policies check the authenticated identity and the relevant post conditions. These checks remain necessary even when the interface disables a pending button: client-side controls are a usability measure, not an authorization boundary.

If the mutation fails, the hook restores the saved feed and detail snapshots. A duplicate insert with the expected uniqueness error is treated as success because the like relationship already exists. That is a specific idempotency decision, not a rule that all database errors are harmless.

## Tradeoff

Optimistic updates make the interaction feel immediate and avoid waiting for a complete feed refresh after every like. The cost is additional state management: cache shapes, snapshots, updates and error recovery need to agree.

The current hook does not automatically invalidate the queries after success. It keeps the optimistic result and relies on later refresh for reconciliation. This avoids another immediate fetch, but it means the displayed aggregate count can temporarily differ from the database when other users act concurrently. I present this as a tradeoff visible in the implementation, not as a performance result or a historical motivation I can independently verify.

## Failure scenario and verification

Consider a feed and detail cache that both show a post with two likes. The user presses like, and both immediately display three. The database then rejects the request. The rollback should return both views to two, with the original unliked state. Updating only the currently visible screen would leave the other cached view inconsistent.

Existing hook tests cover successful cross-view updates, a zero-count unlike, permission-error rollback and duplicate-insert handling. They render the real hook with mocked database responses and inspect the caches. Those tests exercise client behavior; a mocked permission error does not prove that a live database policy is configured correctly. The production hook tests were inspected, not rerun for this write-up.

A manual smoke check on the live web app confirmed that liking a post changed its detail count from two to three, returning to the feed showed three, and unliking restored two. This verifies one web interaction path; it does not establish native-app coverage, publication or comment-submission correctness. Publishing and comments were reviewed in source, and their draft screens were inspected without submitting content.

## Limits and next steps

Restoring whole snapshots can become stale if overlapping mutations update the same cached data. A disabled detail button reduces one overlap path, but it does not establish a global concurrency guarantee. A stronger design could serialize operations per post or use narrower rollback logic, then test delayed and reordered responses explicitly.

The [public teaching sample](./code-sample/README.md) now demonstrates this bounded problem with synthetic posts and a simulated request. It uses a new JavaScript ES-module store with one canonical list shared by Feed and Detail, rather than the production TanStack Query hooks. It locks each post while pending, rolls back only that post on rejection, and ignores responses from an earlier reset generation. It requires no production backend, credentials or private source. The browser imports the same core module used by the tests.

The sample includes five core unit tests and one localhost HTTP smoke test. They cover shared updates, rollback, duplicate-click suppression, zero-count behavior, isolation of other posts, stale responses after reset and delivery of the browser's core module. A manual browser check also confirmed a successful update in both views and rollback after a simulated rejection. These checks do not prove production backend correctness or replace native-app testing.

For the product walkthrough and its scope, see [demo notes](./demo-notes.md).

Implementation references in the private project: `src/lib/usePostLike.ts`, `src/lib/optimisticFeed.ts`, `src/lib/usePostLike.test.tsx`, `app/(tabs)/compose.tsx` and `src/lib/useCommentThread.ts`.
