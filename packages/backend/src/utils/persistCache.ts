import {existsSync} from "fs";
import {readFile, writeFile} from "fs/promises";
import {TimeoutCache, TimeoutStoreStructure} from "@cab432-a1/common";
import debugBuilder from "debug";

const debug = debugBuilder("app:cache-persistence");

/**
 * Persists a cache to a entries JSON-formatted file. Data and timeouts will be saved to the specified file every
 * interval, so that restarting the server doesn't lose the data.
 * Note, both the key and value must be serialisable.
 * @param cache The cache to persist
 * @param path The path to the file
 * @param interval The interval to update the file at. Will skip if there have been no changes.
 * @returns A function that, when called, will cancel the update interval
 */
export default async function persistCache(
    cache: TimeoutCache<unknown, unknown>,
    path: string,
    interval = 10000
): Promise<() => void> {
    const invalidator = cache.createInvalidator();

    const intervalId = setInterval(async () => {
        if (!invalidator.checkIfInvalid()) return;

        debug("Updating persistent storage");
        await writeFile(path, JSON.stringify(cache.getStore()));

        invalidator.revalidate();
    }, interval);

    if (existsSync(path)) {
        const source: TimeoutStoreStructure<unknown, unknown> = JSON.parse(
            await readFile(path, "utf8")
        );

        debug("Loading persistent storage");

        cache.writeToStore(source);
    }

    return () => clearInterval(intervalId);
}
