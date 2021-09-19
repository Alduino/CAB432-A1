import {TimeoutCache} from "@cab432-a1/common";
import {ONE_HOUR} from "../constants/durations";
import {TwitterTopAccount} from "../types/TwitterTopAccount";
import {findTwitchUsername} from "./getTwitchUsername";
import persistCache from "./persistCache";
import {youtubeApi} from "./youtube";

export interface AccountIdentifiers {
    twitchLogin: string;
    youtubeId?: string;
}

export const twitterIdentifiersCache = new TimeoutCache<
    string,
    AccountIdentifiers
>("twitter-identifiers", 4 * ONE_HOUR);
persistCache(twitterIdentifiersCache, "/tmp/twitter-identifiers-cache.json");

export const youtubeIdMappingCache = new TimeoutCache<
    string,
    string | undefined
>("youtube-id-mapping", ONE_HOUR * 4);
persistCache(youtubeIdMappingCache, "/tmp/youtube-id-mapping-cache.json");

const youtubeLinkRegex =
    /^https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/([0-9a-z_-]+)|(?:(?:c|u|user)\/)?([0-9a-z_-]+))/i;

async function getYoutubeId(source: string): Promise<string | undefined> {
    const match = source.match(youtubeLinkRegex);
    if (!match) return;
    const idFromUrl = match[1]?.toLowerCase();
    const customNameFromUrl = match[2]?.toLowerCase();
    if (idFromUrl) return idFromUrl;

    const cachedItem = youtubeIdMappingCache.get(customNameFromUrl);
    if (cachedItem) return cachedItem;

    // matches links to youtube videos, not an account
    if (customNameFromUrl === "watch") return;

    const channels = await youtubeApi.channels.list({
        part: ["id"],
        forUsername: customNameFromUrl
    });

    const channel = channels.data.items?.[0];

    if (!channel || !channel.id) {
        youtubeIdMappingCache.set(customNameFromUrl, undefined);
        return undefined;
    }

    youtubeIdMappingCache.set(customNameFromUrl, channel.id);
    return channel.id;
}

async function findYoutubeId(links: string[]): Promise<string | undefined> {
    for (const link of links) {
        const match = await getYoutubeId(link);
        if (match) return match;
    }
}

/**
 * Attempts to find identifiers for each account's description links and a
 * pinned tweet's links.
 */
export default async function getAccountIdentifiers(
    accounts: TwitterTopAccount[]
): Promise<Map<TwitterTopAccount, AccountIdentifiers>> {
    const usernames = new Map<TwitterTopAccount, AccountIdentifiers>();

    await Promise.all(
        accounts.map(async acc => {
            const cacheItem = twitterIdentifiersCache.get(acc.id);
            if (cacheItem) {
                usernames.set(acc, cacheItem);
                return;
            }

            const twitchUsername = findTwitchUsername(acc.accountLinks);

            if (twitchUsername) {
                const youtubeId = await findYoutubeId(acc.accountLinks);

                const identifiers: AccountIdentifiers = {
                    twitchLogin: twitchUsername,
                    youtubeId
                };

                twitterIdentifiersCache.set(acc.id, identifiers);
                usernames.set(acc, identifiers);
            }
        })
    );

    return usernames;
}
