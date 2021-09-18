import {TimeoutCache} from "@cab432-a1/common";
import {Semaphore} from "async-mutex";
import debugBuilder from "debug";
import fetch from "node-fetch";
import {ONE_HOUR} from "../constants/durations";
import replaceAsync from "../utils/replaceAsync";
import persistCache from "./persistCache";

const debug = debugBuilder("app:utils:twitter-redirects");

const getRedirectMutex = new Semaphore(50);

export const redirectCache = new TimeoutCache<string, string>(
    "twitter-redirect",
    6 * ONE_HOUR
);

// loading this data can be very slow, and there is a lot of it
persistCache(redirectCache, "/tmp/redirect-cache.json");

export function getRedirect(link: string): Promise<string> {
    const cache = redirectCache.get(link);
    if (cache) return Promise.resolve(cache);

    return getRedirectMutex.runExclusive(async () => {
        const cache = redirectCache.get(link);
        if (cache) return Promise.resolve(cache);

        try {
            const response = await fetch(link, {timeout: 1500});
            debug("Finished checking redirect of %s (%s)", link, response.url);
            redirectCache.set(link, response.url);
            return response.url;
        } catch {
            return link;
        }
    });
}

const twitterLinkRegex = /https:\/\/t\.co\/[a-zA-Z0-9]+/g;

export async function loadRedirectingLinks(
    description: string
): Promise<string> {
    return await replaceAsync(description, twitterLinkRegex, match =>
        getRedirect(match)
    );
}
