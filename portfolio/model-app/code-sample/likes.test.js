import test from 'node:test';
import assert from 'node:assert/strict';
import { createLikes } from './likes.js';
import { createDemoServer } from './server.js';

const initial = [
  { id: 'a', title: 'Synthetic A', liked: false, count: 7 },
  { id: 'b', title: 'Synthetic B', liked: false, count: 2 },
];
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('success synchronizes two subscribed views before transport resolves', async () => {
  const request = deferred();
  const calls = [];
  const store = createLikes(initial, (id, liked) => { calls.push({ id, liked }); return request.promise; });
  let feed, detail;
  store.subscribe(state => { feed = state; });
  store.subscribe(state => { detail = state; });
  const operation = store.toggle('a');
  assert.equal(feed.posts[0].count, 8);
  assert.equal(detail.posts[0].liked, true);
  assert.deepEqual(feed.pending, ['a']);
  assert.deepEqual(calls, [{ id: 'a', liked: true }]);
  request.resolve();
  assert.equal(await operation, 'success');
  assert.deepEqual(feed, detail);
  assert.deepEqual(feed.pending, []);
  assert.deepEqual(feed.posts[1], initial[1]);
});

test('rejection rolls back both views and leaves other post untouched', async () => {
  const request = deferred();
  const store = createLikes(initial, () => request.promise);
  let feed, detail;
  store.subscribe(state => { feed = state; });
  store.subscribe(state => { detail = state; });
  const operation = store.toggle('a');
  request.reject(new Error('Synthetic failure'));
  assert.equal(await operation, 'rejected');
  assert.deepEqual(feed.posts, initial);
  assert.deepEqual(detail.posts, initial);
  assert.deepEqual(feed.pending, []);
});

test('double click while pending produces only one transport call', async () => {
  const request = deferred();
  let calls = 0;
  const store = createLikes(initial, () => { calls++; return request.promise; });
  const first = store.toggle('a');
  assert.equal(await store.toggle('a'), 'ignored');
  assert.equal(calls, 1);
  assert.equal(store.snapshot().posts[0].count, 8);
  request.resolve();
  await first;
});

test('unlike decrements count, clamps at zero, and isolates other posts', async () => {
  const store = createLikes([{ ...initial[0], liked: true, count: 0 }, initial[1]], async () => {});
  await store.toggle('a');
  assert.equal(store.snapshot().posts[0].count, 0);
  assert.equal(store.snapshot().posts[0].liked, false);
  assert.deepEqual(store.snapshot().posts[1], initial[1]);
  await store.toggle('a');
  await store.toggle('a');
  assert.equal(store.snapshot().posts[0].count, 0);
});

test('reset ignores stale rejection without unlocking a newer request', async () => {
  const old = deferred(), fresh = deferred();
  let calls = 0;
  const store = createLikes(initial, () => (++calls === 1 ? old.promise : fresh.promise));
  const first = store.toggle('a');
  store.reset();
  assert.deepEqual(store.snapshot().posts, initial);
  const second = store.toggle('a');
  old.reject(new Error('Late rejection'));
  assert.equal(await first, 'stale');
  assert.deepEqual(store.snapshot().pending, ['a']);
  assert.equal(store.snapshot().posts[0].count, 8);
  fresh.resolve();
  assert.equal(await second, 'success');
});

test('local server serves browser core and denies arbitrary files', async () => {
  const server = createDemoServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /src="app.js"/);
    const core = await fetch(`${base}/likes.js`);
    assert.equal(core.status, 200);
    assert.match(await core.text(), /export function createLikes/);
    assert.equal((await fetch(`${base}/package.json`)).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
