import createDebug, {Debugger} from "debug";

interface TimeoutCacheItem<T> {
    timeoutTime: number;
    value: T;
}

class InvalidateStateImpl implements InvalidateState {
    private isInvalid = false;

    constructor(private readonly doDispose: () => void) {}

    invalidate(): void {
        this.isInvalid = true;
    }

    revalidate(): void {
        this.isInvalid = false;
    }

    checkIfInvalid(): boolean {
        return this.isInvalid;
    }

    dispose(): void {
        this.doDispose();
    }
}

declare const timeoutStoreStructure: unique symbol;

/**
 * The value that is returned from `getStore()`, and that is passed to
 * `writeToStore()`.
 */
export type TimeoutStoreStructure<K, V> = {
    DO_NOT_USE_OR_YOU_WILL_BE_FIRED: true;
    [timeoutStoreStructure]: [K, V];
};

export interface InvalidateState {
    /**
     * Returns true if it is invalid. Can be set true by the implementer, and
     * set back to false by calling `revalidate()`.
     */
    checkIfInvalid(): boolean;

    /**
     * Sets the state back to being valid
     */
    revalidate(): void;

    /**
     * Removes the invalidator from its implementer
     */
    dispose(): void;
}

/**
 * A store with a per-item timeout
 */
export default class TimeoutCache<K, V> {
    private readonly timeoutCheck = setInterval(
        () => this.checkForTimeout(),
        10000
    );

    private readonly store = new Map<K, TimeoutCacheItem<V>>();
    private readonly debug: Debugger;
    private readonly invalidators = new Set<InvalidateStateImpl>();

    constructor(identifier: string, private readonly timeout: number) {
        this.debug = createDebug(`common:timeout-cache:${identifier}`);
    }

    dispose(): void {
        clearInterval(this.timeoutCheck);
    }

    /**
     * Adds an item to the cache with the specified key. The item will be
     * deleted after the time specified in `timeout` in the constructor.
     */
    set(key: K, value: V): void {
        this.debug("Adding %s", key);
        this.store.set(key, {
            timeoutTime: Date.now() + this.timeout,
            value
        });
        this.invalidate();
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

        this.invalidate();

        return true;
    }

    /**
     * Gets the value of the key, or undefined if it doesn't exist
     */
    get(key: K): V | undefined {
        return this.store.get(key)?.value;
    }

    /**
     * Checks if the cache contains the item
     */
    has(key: K): boolean {
        return this.store.has(key);
    }

    /**
     * Returns a state that is set to invalid when a cached value changes
     */
    createInvalidator(): InvalidateState {
        const invalidate = () => this.invalidators.delete(invalidator);
        const invalidator = new InvalidateStateImpl(invalidate);
        this.invalidators.add(invalidator);
        return invalidator;
    }

    /**
     * Returns the internal store. The value returned is an opaque internal
     * structure and is subject to change (in ways that won't break caching).
     */
    getStore(): TimeoutStoreStructure<K, V> {
        return Array.from(
            this.store.entries()
        ) as unknown as TimeoutStoreStructure<K, V>;
    }

    /**
     * Writes data that was returned from `getStore()` back to the store. Will
     * override any values with the same key. Note that values that have timed
     * out may not be removed instantly.
     * @remarks This does not delete any existing cache data (unless overwritten)
     */
    writeToStore(data: TimeoutStoreStructure<K, V>) {
        const entries = data as unknown as [K, TimeoutCacheItem<V>][];

        for (const [key, value] of entries) {
            this.store.set(key, value);
        }
    }

    private invalidate() {
        for (const invalidator of this.invalidators) {
            invalidator.invalidate();
        }
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

        if (timedOutKeys.size > 0) {
            this.debug("Cleared %s items", timedOutKeys.size);
            this.invalidate();
        }
    }
}
