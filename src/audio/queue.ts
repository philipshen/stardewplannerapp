/** Play order for a radio station: random, with no repeat until every track has played. */
export type Keyed = { key: string };

export function shuffled<T>(list: T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class PlayQueue<T extends Keyed> {
  private queue: T[] = [];
  private forId = '';
  constructor(private random: () => number = Math.random) {}

  /** Forget the order, for example after a station change. */
  reset() { this.queue = []; this.forId = ''; }

  /**
   * The next track of `list`. `id` names the station; `last` is the track that just played.
   * A new round never starts with `last`, so a track does not play twice in a row.
   */
  next(id: string, list: T[], last: T | null): T | null {
    if (!list.length) return null;
    const full = id + '|' + list.map((t) => t.key).join(',');
    if (this.forId !== full || !this.queue.length) {
      this.queue = shuffled(list, this.random);
      if (this.queue.length > 1 && this.queue[0].key === last?.key) this.queue.push(this.queue.shift()!);
      this.forId = full;
    }
    return this.queue.shift() ?? null;
  }
}
