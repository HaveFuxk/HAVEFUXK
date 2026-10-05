/** @typedef {{id:string, title:string, liked:boolean, count:number}} Post */

/**
 * Independent teaching example: one canonical store, two subscribed views.
 * @param {Post[]} initial
 * @param {(id:string, liked:boolean) => Promise<void>} save Simulated transport.
 */
export function createLikes(initial, save) {
  const seed = initial.map(post => ({ ...post }));
  let posts = seed.map(post => ({ ...post }));
  let generation = 0;
  const pending = new Set();
  const listeners = new Set();
  let events = [];
  const snapshot = () => ({ posts: posts.map(p => ({ ...p })), pending: [...pending], events: [...events] });
  const emit = message => {
    events.push(message);
    for (const listener of listeners) listener(snapshot());
  };
  return {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    reset() {
      generation++; // Old responses must not overwrite a new session.
      posts = seed.map(post => ({ ...post }));
      pending.clear();
      events = [];
      emit('Reset: stale responses will be ignored.');
    },
    async toggle(id) {
      if (pending.has(id)) { emit(`Ignored duplicate: ${id} is pending.`); return 'ignored'; }
      const before = posts.find(post => post.id === id);
      if (!before) throw new Error('Unknown post');
      const requestGeneration = generation;
      const optimistic = { ...before, liked: !before.liked, count: Math.max(0, before.count + (before.liked ? -1 : 1)) };
      pending.add(id); // Lock before notifying views or awaiting transport.
      posts = posts.map(post => post.id === id ? optimistic : post);
      emit(`Optimistic ${optimistic.liked ? 'like' : 'unlike'}: ${id}.`);
      let result = 'success';
      try {
        await save(id, optimistic.liked);
        if (generation !== requestGeneration) return 'stale';
        emit(`Confirmed: ${id}.`);
      } catch {
        if (generation !== requestGeneration) return 'stale';
        posts = posts.map(post => post.id === id ? before : post);
        result = 'rejected';
        emit(`Rejected: restored ${id} in both views.`);
      } finally {
        if (generation === requestGeneration) {
          pending.delete(id);
          emit(`Ready: ${id}.`);
        }
      }
      return result;
    },
  };
}
