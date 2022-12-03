class Timeline {
  static readonly DEFAULT_MAX_SIZE = 120;
  readonly #data = new Map<number, number>();
  get #snapshots() {
    return [...this.#data.keys()];
  }

  #counter = 0;
  #total = 0;
  
  #lastActivity = Date.now();
  readonly start = Date.now();

  get lastActivity() {
    return this.#lastActivity;
  }

  constructor(public readonly maxSize = Timeline.DEFAULT_MAX_SIZE) {}

  get ready() {
    return this.#data.size >= this.maxSize;
  }

  hasSpike(greaterThan: number) {
    for(const value of this.#data.values()){
      if(value >= greaterThan) return true;
    }

    return false
  }

  increment(by = 1) {
    this.#counter += by;
    this.#total += by;
    return this;
  }

  snapshot() {
    let timestamp = Date.now();
    if (this.#counter !== 0) {
      this.#lastActivity = timestamp;
    }

    if (this.#data.has(timestamp)) timestamp += 3;

    this.#data.set(timestamp, this.#counter);
    this.#counter = 0;

    if (this.#data.size > this.maxSize) {
      
      const keep = this.#snapshots.slice(-this.maxSize);  

      for (const key of this.#snapshots) {
        if (!keep.includes(key)) this.#data.delete(key);
      }
    }

    return this;
  }

  get total() {
    return this.#total;
  }

  count(seconds = 30) {
    const start = Date.now() - seconds * 1000;
    let total = 0;

    for (const time of this.#snapshots) {
      if (time < start) continue;
      total += this.#data.get(time) ?? 0;
    }

    return total;
  }

  average(seconds = 30) {
    return this.count(seconds) / seconds;
  }
}

class TimedValue<T> {
  public readonly expiry: number;
  constructor(public readonly value: T, public readonly ttl: number) {
    this.expiry = Date.now() + ttl;
  }

  get expired() {
    return this.expiry < Date.now();
  }
}

export class TimelineGroup {
  readonly #timelines = new Map<string, TimedValue<Timeline>>();
  constructor(
    public readonly lifetime = 60 * 1000,
    public readonly maxSize = Timeline.DEFAULT_MAX_SIZE
  ) {}

  #clear() {
    for (const [key, timeline] of this.#timelines) {
      if (timeline.expired) this.#timelines.delete(key);
    }
  }

  entries() {
    this.#clear();

    return [...this.#timelines.entries()].map(
      ([key, timeline]) => [key, timeline.value] as const
    );
  }

  snapshot() {
    for (const timeline of this.#timelines.values()) {
      timeline.value.snapshot();
    }
    return this;
  }

  has(key: string) {
    this.#clear();
    return this.#timelines.has(key);
  }

  get(key: string) {
    let timeline = this.#timelines.get(key)?.value;

    if (!timeline) {
      timeline = new Timeline(this.maxSize);
    }

    this.#timelines.set(key, new TimedValue(timeline, this.lifetime));
    this.#clear();

    return timeline;
  }
}
