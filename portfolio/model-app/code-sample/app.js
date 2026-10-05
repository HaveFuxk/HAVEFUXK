import { createLikes } from './likes.js';

const store = createLikes([
  { id: 'demo-post', title: 'Paper robot on a blue shelf', liked: false, count: 7 },
  { id: 'other-post', title: 'Untouched synthetic post', liked: false, count: 2 },
], async () => {
  // Capture controls when the request begins, not when its timer finishes.
  const delay = Number(document.querySelector('#delay').value);
  const reject = document.querySelector('#reject').checked;
  await new Promise(resolve => setTimeout(resolve, delay));
  if (reject) throw new Error('Simulated rejection');
});

store.subscribe(({ posts, pending, events }) => {
  const post = posts.find(post => post.id === 'demo-post');
  const busy = pending.includes(post.id);
  for (const button of document.querySelectorAll('.like')) {
    button.textContent = `${post.liked ? 'Unlike' : 'Like'} · ${post.count}`;
    button.setAttribute('aria-pressed', String(post.liked));
    // Keep clicks available so the core pending guard is observable in the log.
    button.setAttribute('aria-label', `${post.liked ? 'Unlike' : 'Like'} in ${button.dataset.view} view${busy ? ', request pending' : ''}`);
  }
  for (const status of document.querySelectorAll('.status')) status.textContent = busy ? 'Saving… extra clicks are ignored.' : 'Ready';
  const log = document.querySelector('#log');
  log.replaceChildren(...events.map(event => {
    const item = document.createElement('li');
    item.textContent = event;
    return item;
  }));
  log.scrollTop = log.scrollHeight;
});
for (const button of document.querySelectorAll('.like')) button.addEventListener('click', () => store.toggle('demo-post'));
document.querySelector('#reset').addEventListener('click', () => store.reset());
