interface TimeoutCacheItem<T> {
    timeoutTime: number;
    value: T;
}

/**
 * A store with a per-item timeout
 */
export default class TimeoutCache<K, V> {
    private readonly timeoutCheck = setInterval(
        () => this.checkForTimeout(),
        this.timeout
    );
    private readonly store = new Map<K, TimeoutCacheItem<V>>();

    constructor(private readonly timeout: number) {}

    dispose(): void {
        clearInterval(this.timeoutCheck);
    }

    /**
     * Adds an item to the cache with the specified key. The item will be
     * deleted after the time specified in `timeout` in the constructor.
     */
    set(key: K, value: V): void {
        this.store.set(key, {
            timeoutTime: Date.now() + this.timeout,
            value
        });
    }

    /**
     * Updates the stored value
     * @param key The session key
     * @param value The new value to save
     * @param restartTimeout Reset the timeout
     * @returns false if the key didn't exist, true if the value was changed
     */
    update(key: K, value: V, restartTimeout = false): boolean {
        const item = this.store.get(key);
        if (!item) return false;

        if (restartTimeout) {
            item.timeoutTime = Date.now() + this.timeout;
        }

        item.value = value;

        return true;
    }

    /**
     * Gets the value of the key, or undefined if it doesn't exist
     */
    get(key: K): V | undefined {
        return this.store.get(key)?.value;
    }

    private checkForTimeout() {
        const timedOutKeys = new Set<K>();
        const now = Date.now();

        for (const [k, {timeoutTime}] of this.store) {
            if (timeoutTime < now) timedOutKeys.add(k);
        }

        for (const k of timedOutKeys) {
            this.store.delete(k);
        }
    }
}
