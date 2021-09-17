import {ok as assert} from "assert";
import {TimeoutCache, TopAccount} from "@cab432-a1/common";
import {Semaphore} from "async-mutex";
import debugBuilder from "debug";
import {Request, Response} from "express";
import fetch from "node-fetch";
import {TweetV2LookupResult, TwitterApi, UserV2} from "twitter-api-v2";
import {twitterBaseUserId} from "./config";
import RequiredProperties from "./utils/RequiredProperties";
import replaceAsync from "./utils/replaceAsync";
import {twitchApi} from "./utils/twitch";
import {defaultTwitterSession, twitterSessions} from "./utils/twitter";
import writeError from "./utils/writeError";

const debug = debugBuilder("app:route:top-accounts");

interface TwitterTopAccount {
    id: string;
    name: string;
    username: string;
    description: string;
    verified: boolean;
    pinnedTweetId?: string;
}

async function getUserIdToCheck(session?: TwitterApi) {
    if (session) {
        const {screen_name} = await session.currentUser();
        const {
            data: {id}
        } = await session.v2.userByUsername(screen_name);

        return id;
    } else {
        return twitterBaseUserId;
    }
}

const ONE_HOUR = 1000 * 60 * 60;
const getRedirectMutex = new Semaphore(20);
const redirectCache = new TimeoutCache<string, string>(
    "twitter-redirect",
    6 * ONE_HOUR
);

function getRedirect(link: string): Promise<string> {
    const cache = redirectCache.get(link);
    if (cache) return Promise.resolve(cache);

    return getRedirectMutex.runExclusive(async () => {
        const cache = redirectCache.get(link);
        if (cache) return Promise.resolve(cache);

        try {
            const response = await fetch(link, {timeout: 500});
            debug("Finished checking redirect of %s (%s)", link, response.url);
            redirectCache.set(link, response.url);
            return response.url;
        } catch {
            return link;
        }
    });
}

const twitterLinkRegex = /https:\/\/t\.co\/[a-zA-Z0-9]+/g;

async function loadRedirectingLinks(description: string): Promise<string> {
    return await replaceAsync(description, twitterLinkRegex, match =>
        getRedirect(match)
    );
}

const topAccountUsersCache = new TimeoutCache<string, TwitterTopAccount>(
    "top-account-users",
    ONE_HOUR * 4
);

async function createTwitterTopAccount(
    account: UserV2
): Promise<TwitterTopAccount> {
    return {
        id: account.id,
        name: account.name,
        username: account.username,
        verified: account.verified ?? false,
        pinnedTweetId: account.pinned_tweet_id,
        description: await loadRedirectingLinks(account.description ?? "")
    };
}

async function getTwitterTopAccount(
    id: string,
    twSession?: string
): Promise<TwitterTopAccount | undefined> {
    const cacheItem = topAccountUsersCache.get(id);
    if (cacheItem) return cacheItem;

    const twitterSession = twSession
        ? twitterSessions.get(twSession)
        : undefined;

    const api = twitterSession ?? (await defaultTwitterSession.appLogin());
    const {data: account} = await api.v2.user(id, {
        "user.fields": ["verified", "description", "pinned_tweet_id"]
    });

    if (!account) return undefined;

    const twitterTopAccount: TwitterTopAccount = await createTwitterTopAccount(
        account
    );

    topAccountUsersCache.set(id, twitterTopAccount);
    return twitterTopAccount;
}

const topAccountsCache = new TimeoutCache<
    string | undefined,
    TwitterTopAccount[]
>("top-accounts", ONE_HOUR);

async function getTwitterTopAccounts(
    twSession?: string
): Promise<TwitterTopAccount[]> {
    const cacheItem = topAccountsCache.get(twSession);
    if (cacheItem) return cacheItem;

    const twitterSession = twSession
        ? twitterSessions.get(twSession)
        : undefined;

    const api = twitterSession ?? (await defaultTwitterSession.appLogin());

    const checkUserId = await getUserIdToCheck(twitterSession);

    debug("Checking the users that are following %s", checkUserId);
    const following = await api.v2.following(checkUserId, {
        max_results: 1000,
        "user.fields": ["verified", "description", "pinned_tweet_id"]
    });

    const twitterAccounts = await Promise.all(
        following.data.map(acc => createTwitterTopAccount(acc))
    );
    debug("Got twitter accounts with updated links");

    topAccountsCache.set(twSession, twitterAccounts);
    return twitterAccounts;
}

const twitchLinkRegex = /https:\/\/(?:www\.)?twitch\.tv\/([a-z0-9_-]+)/i;

// TODO: Check if the username is a Twitch account
function getTwitchUsername(description: string): string | undefined {
    const match = description.match(twitchLinkRegex);
    if (!match) return;
    return match[1].toLowerCase();
}

function getTwitchUsernamesFromDescription(
    accounts: TwitterTopAccount[]
): Record<string, TwitterTopAccount> {
    const usernames = new Map<string, TwitterTopAccount>();

    for (const acc of accounts) {
        const twitchUsername = getTwitchUsername(acc.description)?.trim();
        if (twitchUsername) usernames.set(twitchUsername, acc);
    }

    return Object.fromEntries(usernames.entries());
}

async function getTwitchUsernamesFromPinnedTweet(
    apiClient: TwitterApi,
    accounts: RequiredProperties<TwitterTopAccount, "pinnedTweetId">[]
) {
    const batchResults: Promise<TweetV2LookupResult>[] = [];

    // twitter lets us batch in groups of 100
    for (let i = 0; i < accounts.length; i += 100) {
        const thisBatchIds = accounts
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

    const twitterAccounts = new Map(accounts.map(acc => [acc.id, acc]));

    const usernames = new Map<string, TwitterTopAccount>();

    await Promise.all(
        pinnedTweets.map(async tweet => {
            const source = await loadRedirectingLinks(tweet.text);
            const twitchUsername = getTwitchUsername(source)?.trim();
            assert(tweet.author_id, "tweet does not have an author id");

            const twitterUser = twitterAccounts.get(tweet.author_id);
            assert(twitterUser, "could not find user with the author id");

            if (twitchUsername) usernames.set(twitchUsername, twitterUser);
        })
    );

    return Object.fromEntries(usernames.entries());
}

async function getTopAccounts(
    apiClient: TwitterApi,
    twitterTopAccounts: TwitterTopAccount[]
): Promise<TopAccount[]> {
    const usernamesFromDescription =
        getTwitchUsernamesFromDescription(twitterTopAccounts);
    const usersWithNameInDescription = new Set(
        Object.values(usernamesFromDescription).map(usr => usr.id)
    );

    const accountsWithPinnedTweet = twitterTopAccounts.filter(
        acc => !!acc.pinnedTweetId && !usersWithNameInDescription.has(acc.id)
    ) as RequiredProperties<TwitterTopAccount, "pinnedTweetId">[];
    const usernamesFromPinned = await getTwitchUsernamesFromPinnedTweet(
        apiClient,
        accountsWithPinnedTweet
    );

    debug(
        "Linked %s accounts from a description, and %s from a pinned tweet, out of %s",
        Object.keys(usernamesFromDescription).length,
        Object.keys(usernamesFromPinned).length,
        twitterTopAccounts.length
    );

    const usernames = {
        ...usernamesFromDescription,
        ...usernamesFromPinned
    };

    debug("Getting Twitch users");
    const accounts = await twitchApi.getUsersByLogins(Object.keys(usernames));

    debug("Getting Twitch streams");
    const streams = await twitchApi.getStreamsByLogins(Object.keys(usernames));

    return Object.entries(usernames).map(([twitchName, user]): TopAccount | undefined => {
        const twitchAccount = accounts[twitchName];
        if (!twitchAccount) return;

        return {
            id: user.id,
            twitterId: user.id,
            twitterLogin: user.username,
            twitterVerified: user.verified,
            twitchId: twitchAccount.id,
            twitchLogin: twitchAccount.login,
            twitchStreamId: streams[twitchName]?.[0]?.id,
            profilePictureUrl: twitchAccount.profileImageUrl,
            notLiveCoverUrl: twitchAccount.offlineImageUrl,
            displayName: twitchAccount.displayName,
            description: user.description
        };
    }).filter(acc => acc) as TopAccount[];
}

function sortTopAccounts(a: TopAccount, b: TopAccount) {
    const byLive =
        (b.twitchStreamId ? 1 : 0) - Number(a.twitchStreamId ? 1 : 0);
    if (byLive) return byLive;
    return a.displayName.localeCompare(b.displayName);
}

// /api/top-accounts
export default async function handleTopAccounts(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const session = req.cookies["Twitter-Session"];
        const apiClient =
            twitterSessions.get(session) ??
            (await defaultTwitterSession.appLogin());

        const topTwitterAccounts = await getTwitterTopAccounts(session);
        const topAccounts = await getTopAccounts(apiClient, topTwitterAccounts);

        // show live accounts first, otherwise by their name
        topAccounts.sort(sortTopAccounts);

        res.json({data: topAccounts});
    } catch (err) {
        console.error(err);
        writeError(res, "Something went wrong", 500);
    }
}

// /api/top-accounts/:id
export async function handleTopAccount(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const {id} = req.params;

        const session = req.cookies["Twitter-Session"];
        const topTwitterAccount = await getTwitterTopAccount(id, session);

        if (!topTwitterAccount) {
            writeError(res, "Not found", 404);
            return;
        }

        const apiClient =
            twitterSessions.get(session) ??
            (await defaultTwitterSession.appLogin());
        const [topAccount] = await getTopAccounts(apiClient, [
            topTwitterAccount
        ]);

        if (!topAccount) {
            writeError(res, "Not found", 404);
            return;
        }

        res.json(topAccount);
    } catch (err) {
        console.error(err);
        writeError(res, "Something went wrong", 500);
    }
}
