import {randomUUID} from "crypto";
import {TimeoutCache} from "@cab432-a1/common";

/**
 * A store with a per-item timeout
 */
export default class SessionStore<T> {
    private readonly store;

    constructor(timeout: number) {
        this.store = new TimeoutCache<string, T>("session-store", timeout);
    }

    dispose(): void {
        this.store.dispose();
    }

    /**
     * Creates a new session
     * @param value The value to save in the session
     * @returns The session key
     */
    create(value: T): string {
        const key = randomUUID();
        this.store.set(key, value);
        return key;
    }

    /**
     * Updates the stored value
     * @param key The session key
     * @param value The new value to save
     * @param restartTimeout Reset the timeout
     * @returns false if the key didn't exist, true if the value was changed
     */
    update(key: string, value: T, restartTimeout = false): boolean {
        return this.store.update(key, value, restartTimeout);
    }

    /**
     * Gets the value of the stored key, or undefined if it doesnt exist
     * @param key The session key
     */
    get(key: string): T | undefined {
        return this.store.get(key);
    }
}
