import {ok as assert} from "assert";
import {TimeoutCache} from "@cab432-a1/common";
import debugBuilder from "debug";
import {TweetV2LookupResult, TwitterApi} from "twitter-api-v2";
import {ONE_HOUR} from "../constants/durations";
import {TwitterTopAccount} from "../types/TwitterTopAccount";
import RequiredProperties from "./RequiredProperties";
import {getTwitchUsername} from "./getTwitchUsername";
import persistCache from "./persistCache";
import {loadRedirectingLinks} from "./twitter-redirects";
import {youtubeApi} from "./youtube";

const debug = debugBuilder("app:utils:account-identifier");

export interface AccountIdentifiers {
    twitchLogin: string;
    youtubeId?: string;
}

export const twitterIdentifiersCache = new TimeoutCache<
    string,
    AccountIdentifiers
>("twitter-identifiers", 4 * ONE_HOUR);
persistCache(twitterIdentifiersCache, "/tmp/twitter-identifiers-cache.json");

export const youtubeIdMappingCache = new TimeoutCache<string, string>(
    "youtube-id-mapping",
    ONE_HOUR * 4
);
persistCache(youtubeIdMappingCache, "/tmp/youtube-id-mapping-cache.json");

const youtubeLinkRegex =
    /https:\/\/(?:www\.)?youtube\.com\/(?:channel\/([0-9a-z_-]+)|(?:(?:c|u|user)\/)?([0-9a-z_-]+))/i;

async function getYoutubeId(source: string): Promise<string | undefined> {
    const match = source.match(youtubeLinkRegex);
    if (!match) return;
    const idFromUrl = match[1]?.toLowerCase();
    const customNameFromUrl = match[2]?.toLowerCase();
    if (idFromUrl) return idFromUrl;

    const cachedItem = youtubeIdMappingCache.get(customNameFromUrl);
    if (cachedItem) return cachedItem;

    // from matches to youtube videos
    if (customNameFromUrl === "watch") return;

    const channels = await youtubeApi.channels.list({
        part: ["id"],
        forUsername: customNameFromUrl
    });

    const channel = channels.data.items?.[0];
    if (!channel || !channel.id) return undefined;

    youtubeIdMappingCache.set(customNameFromUrl, channel.id);
    return channel.id;
}

/**
 * Reads the description to try and find a Twitch and YouTube account link.
 * Results are cached for four hours.
 */
export async function getIdentifiersFromDescription(
    accounts: TwitterTopAccount[]
): Promise<Map<TwitterTopAccount, AccountIdentifiers>> {
    const usernames = new Map<TwitterTopAccount, AccountIdentifiers>();

    await Promise.all(
        accounts.map(async acc => {
            const cacheItem = twitterIdentifiersCache.get(acc.id);
            if (cacheItem) return cacheItem;

            const twitchUsername = getTwitchUsername(acc.description)?.trim();
            const youtubeId = await getYoutubeId(acc.description);

            if (twitchUsername) {
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

export async function getIdentifiersFromPinnedTweet(
    apiClient: TwitterApi,
    accounts: RequiredProperties<TwitterTopAccount, "pinnedTweetId">[]
): Promise<Map<TwitterTopAccount, AccountIdentifiers>> {
    const batchResults: Promise<TweetV2LookupResult>[] = [];

    const uncachedItems = accounts.filter(
        acc => !twitterIdentifiersCache.has(acc.id)
    );

    debug("Loading source of %s uncached pinned tweets", uncachedItems.length);

    // twitter lets us batch in groups of 100
    for (let i = 0; i < uncachedItems.length; i += 100) {
        const thisBatchIds = uncachedItems
            .slice(i, i + 100)
            .map(acc => acc.pinnedTweetId);
        const result = apiClient.v2.tweets(thisBatchIds, {
            "tweet.fields": "author_id"
        });
        batchResults.push(result);
    }

    const pinnedTweets = await Promise.all(batchResults).then(res =>
        res.flatMap(item => item.data)
    );

    const twitterAccounts = new Map(uncachedItems.map(acc => [acc.id, acc]));

    const usernames = new Map<TwitterTopAccount, AccountIdentifiers>();

    for (const acc of accounts) {
        const cached = twitterIdentifiersCache.get(acc.id);
        if (!cached) continue;
        usernames.set(acc, cached);
    }

    await Promise.all(
        pinnedTweets.map(async tweet => {
            const source = await loadRedirectingLinks(tweet.text);
            const twitchUsername = getTwitchUsername(source)?.trim();
            const youtubeId = await getYoutubeId(source);

            assert(tweet.author_id, "tweet does not have an author id");
            const twitterUser = twitterAccounts.get(tweet.author_id);
            assert(twitterUser, "could not find user with the author id");

            if (twitchUsername) {
                const identifiers: AccountIdentifiers = {
                    twitchLogin: twitchUsername,
                    youtubeId
                };

                twitterIdentifiersCache.set(twitterUser.id, identifiers);
                usernames.set(twitterUser, identifiers);
            }
        })
    );

    return usernames;
}

/**
 * Finds the identifiers of each account, sourced from their description or
 * a pinned tweet
 *
 * __Note__: If a Twitch link is found in the description, pinned tweets will
 * not be searched for a YouTube link, to lower API usage.
 */
export default async function getAccountIdentifiers(
    apiClient: TwitterApi,
    accounts: TwitterTopAccount[]
): Promise<Map<TwitterTopAccount, AccountIdentifiers>> {
    debug("Finding identifiers from account descriptions");

    const identifiersFromDescription = await getIdentifiersFromDescription(
        accounts
    );

    const usersWithIdentifiersFromDescription = new Set(
        Array.from(identifiersFromDescription.keys()).map(usr => usr.id)
    );

    debug("Finding identifiers from pinned tweets");

    const accountsWithPinnedTweet = accounts.filter(
        acc =>
            !!acc.pinnedTweetId &&
            !usersWithIdentifiersFromDescription.has(acc.id)
    ) as RequiredProperties<TwitterTopAccount, "pinnedTweetId">[];

    const identifiersFromPinned = await getIdentifiersFromPinnedTweet(
        apiClient,
        accountsWithPinnedTweet
    );

    return new Map([...identifiersFromDescription, ...identifiersFromPinned]);
}
