export interface PromiseDispatch<T> {
    resolve(value: T): void;
    reject(err: unknown): void;
    promise: Promise<T>;
}

export default function createPromiseDispatch<T = void>(): PromiseDispatch<T> {
    let resolve: PromiseDispatch<T>["resolve"],
        reject: PromiseDispatch<T>["reject"];

    const promise = new Promise<T>((yay, nay) => {
        resolve = yay;
        reject = nay;
    });

    return {
        resolve: resolve!,
        reject: reject!,
        promise
    };
}
