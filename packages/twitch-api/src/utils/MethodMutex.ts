/**
 * Only allows `run` to be running one at a time.
 */
export default abstract class MethodMutex<T> {
    private runningPromise?: Promise<T>;

    protected abstract run(): Promise<T>;

    call(): Promise<T> {
        if (!this.runningPromise) {
            this.runningPromise = this.run();
        }

        return this.runningPromise;
    }
}

/**
 * A simple implementation of MethodMutex that uses the passed function as the
 * `run` function
 */
export class SimpleMethodMutex<T> extends MethodMutex<T> {
    constructor(protected readonly run: () => Promise<T>) {
        super();
    }
}
