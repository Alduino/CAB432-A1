import {TimeoutCache} from "@cab432-a1/common";
import debugBuilder from "debug";
import {TweetV2, TwitterApi, UsersV2Params, UserV2} from "twitter-api-v2";
import {ONE_HOUR} from "../constants/durations";
import {TwitterTopAccount} from "../types/TwitterTopAccount";

const debug = debugBuilder("app:utils:twitter-top-account");

async function createTwitterTopAccount(
    account: UserV2,
    pinnedTweet?: TweetV2
): Promise<TwitterTopAccount> {
    const accountLinks = [
        ...account.entities?.url?.urls ?? [],
        ...account.entities?.description?.urls ?? [],
        ...pinnedTweet?.entities?.urls ?? []
    ].map(link => link.expanded_url);

    return {
        id: account.id,
        name: account.name,
        username: account.username,
        verified: account.verified ?? false,
        pinnedTweetId: account.pinned_tweet_id,
        description: account.description ?? "",
        accountLinks: accountLinks
    };
}

export const topAccountUsersCache = new TimeoutCache<string, TwitterTopAccount>(
    "top-account-users",
    ONE_HOUR * 4
);

const userRequestOptions = {
    "user.fields": [
        "verified",
        "description",
        "entities"
    ],
    "tweet.fields": [
        "author_id",
        "entities"
    ],
    expansions: "pinned_tweet_id"
} as UsersV2Params;

/**
 * Gets the account from the twitter API and loads the required information.
 * Requests are cached for 4 hours.
 */
export async function getTwitterTopAccount(
    apiClient: TwitterApi,
    userId: string
): Promise<TwitterTopAccount | undefined> {
    const cacheItem = topAccountUsersCache.get(userId);
    if (cacheItem) return cacheItem;

    debug("Loading the account information for %s", userId);
    const {data: account, includes} = await apiClient.v2.user(userId, userRequestOptions);

    if (!account) return undefined;

    const twitterTopAccount: TwitterTopAccount = await createTwitterTopAccount(
        account,
        includes?.tweets?.[0]
    );

    topAccountUsersCache.set(userId, twitterTopAccount);
    return twitterTopAccount;
}

const topAccountsCache = new TimeoutCache<
    string | undefined,
    TwitterTopAccount[]
>("top-accounts", ONE_HOUR * 2);

/**
 * Gets the account information for users that are following the user with the
 * specified ID. Results are cached for two hours.
 */
export async function getTwitterTopAccounts(
    apiClient: TwitterApi,
    userId: string
): Promise<TwitterTopAccount[] | undefined> {
    const cacheItem = topAccountsCache.get(userId);
    if (cacheItem) return cacheItem;

    debug("Checking the users that are following %s", userId);
    const following = await apiClient.v2.following(userId, {
        ...userRequestOptions,
        max_results: 1000
    });

    if (!following.data) {
        return undefined;
    }

    debug(
        "Loading the account information for %s accounts",
        following.data.length
    );
    const twitterAccounts = await Promise.all(
        following.data.map(acc => createTwitterTopAccount(acc))
    );
    debug("Got twitter accounts with updated links");

    topAccountsCache.set(userId, twitterAccounts);
    return twitterAccounts;
}
