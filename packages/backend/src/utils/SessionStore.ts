import {randomUUID} from "crypto";

interface SessionStoreItem<T> {
    timeoutTime: number;
    value: T;
}

/**
 * A store with a per-item timeout
 */
export default class SessionStore<T> {
    private readonly timeoutCheck = setInterval(
        () => this.checkForTimeout(),
        this.timeout
    );
    private readonly store = new Map<string, SessionStoreItem<T>>();

    constructor(private readonly timeout: number) {}

    dispose() {
        clearInterval(this.timeoutCheck);
    }

    /**
     * Creates a new session
     * @param value The value to save in the session
     * @returns The session key
     */
    create(value: T): string {
        const key = randomUUID();
        this.store.set(key, {
            timeoutTime: Date.now() + this.timeout,
            value
        });
        return key;
    }

    /**
     * Updates the stored value
     * @param key The session key
     * @param value The new value to save
     * @param restartTimeout Reset the timeout
     * @returns false if the key didn't exist, true if the value was changed
     */
    update(key: string, value: T, restartTimeout = false) {
        const item = this.store.get(key);
        if (!item) return false;

        if (restartTimeout) {
            item.timeoutTime = Date.now() + this.timeout;
        }

        item.value = value;

        return true;
    }

    /**
     * Gets the value of the stored key, or undefined if it doesnt exist
     * @param key The session key
     */
    get(key: string): T | undefined {
        return this.store.get(key)?.value;
    }

    private checkForTimeout() {
        const timedOutKeys = new Set<string>();
        const now = Date.now();

        for (const [k, {timeoutTime}] of this.store) {
            if (timeoutTime < now) timedOutKeys.add(k);
        }

        for (const k of timedOutKeys) {
            this.store.delete(k);
        }
    }
}
