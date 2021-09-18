import {ok as assert} from "assert";
import {requireOkResponse, TimeoutCache, TopAccount} from "@cab432-a1/common";
import {Semaphore} from "async-mutex";
import debugBuilder from "debug";
import {Request, Response} from "express";
import {youtube_v3} from "googleapis";
import {parse as parseDuration, toSeconds} from "iso8601-duration";
import fetch from "node-fetch";
import {TweetV2LookupResult, TwitterApi, UserV2} from "twitter-api-v2";
import {twitterBaseUserId} from "./config";
import RequiredProperties from "./utils/RequiredProperties";
import persistCache from "./utils/persistCache";
import replaceAsync from "./utils/replaceAsync";
import {twitchApi} from "./utils/twitch";
import {defaultTwitterSession, twitterSessions} from "./utils/twitter";
import writeError from "./utils/writeError";
import {youtubeApi} from "./utils/youtube";

const debug = debugBuilder("app:route:top-accounts");

interface TwitterTopAccount {
    id: string;
    name: string;
    username: string;
    description: string;
    verified: boolean;
    pinnedTweetId?: string;
}

interface AccountIdentifiers {
    twitchLogin: string;
    youtubeId?: string;
}

interface YoutubeVod {
    channelId: string;
    videoId: string;
    embedHtml: string;
    title: string;
    // in seconds
    duration: number;
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

const ONE_HOUR_SECONDS = 60 * 60;
const ONE_HOUR = ONE_HOUR_SECONDS * 1000;

const getRedirectMutex = new Semaphore(50);
const redirectCache = new TimeoutCache<string, string>(
    "twitter-redirect",
    6 * ONE_HOUR
);

// loading this data can be very slow, and there is a lot of it
persistCache(redirectCache, "/tmp/redirect-cache.json");

function getRedirect(link: string): Promise<string> {
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

    debug("Logging into the API");
    const api = twitterSession ?? (await defaultTwitterSession.appLogin());

    const checkUserId = await getUserIdToCheck(twitterSession);

    debug("Checking the users that are following %s", checkUserId);
    const following = await api.v2.following(checkUserId, {
        max_results: 1000,
        "user.fields": ["verified", "description", "pinned_tweet_id"]
    });

    debug("Loading the account information for %s accounts", following.data.length);
    const twitterAccounts = await Promise.all(
        following.data.map(acc => createTwitterTopAccount(acc))
    );
    debug("Got twitter accounts with updated links");

    topAccountsCache.set(twSession, twitterAccounts);
    return twitterAccounts;
}

const twitchLinkRegex = /https:\/\/(?:www\.)?twitch\.tv\/([0-9a-z_-]+)/i;

function getTwitchUsername(description: string): string | undefined {
    const match = description.match(twitchLinkRegex);
    if (!match) return;
    return match[1].toLowerCase();
}

const youtubeIdMappingCache = new TimeoutCache<string, string>(
    "youtube-id-mapping",
    ONE_HOUR * 4
);

// requires a lot of requests to the youtube api, which is slow and uses up how many we can do
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

async function getUsernamesFromDescription(
    accounts: TwitterTopAccount[]
): Promise<Map<TwitterTopAccount, AccountIdentifiers>> {
    const usernames = new Map<TwitterTopAccount, AccountIdentifiers>();

    for (const acc of accounts) {
        const twitchUsername = getTwitchUsername(acc.description)?.trim();
        const youtubeId = await getYoutubeId(acc.description);

        if (twitchUsername) {
            usernames.set(acc, {
                twitchLogin: twitchUsername,
                youtubeId
            });
        }
    }

    return usernames;
}

async function getUsernamesFromPinnedTweet(
    apiClient: TwitterApi,
    accounts: RequiredProperties<TwitterTopAccount, "pinnedTweetId">[]
): Promise<Map<TwitterTopAccount, AccountIdentifiers>> {
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

    const usernames = new Map<TwitterTopAccount, AccountIdentifiers>();

    await Promise.all(
        pinnedTweets.map(async tweet => {
            const source = await loadRedirectingLinks(tweet.text);
            const twitchUsername = getTwitchUsername(source)?.trim();
            const youtubeId = await getYoutubeId(source);

            assert(tweet.author_id, "tweet does not have an author id");
            const twitterUser = twitterAccounts.get(tweet.author_id);
            assert(twitterUser, "could not find user with the author id");

            if (twitchUsername) {
                usernames.set(twitterUser, {
                    twitchLogin: twitchUsername,
                    youtubeId
                });
            }
        })
    );

    return usernames;
}

const videoInfoCache = new TimeoutCache<string, youtube_v3.Schema$Video>(
    "video-info",
    4 * ONE_HOUR
);

// could use up the quota quickly, and isn't very fast
persistCache(videoInfoCache, "/tmp/video-info-cache.json");

const channelFeedVideoIdRegex = /<yt:videoId>([0-9a-z_-]+)<\/yt:videoId>/gi;

/**
 * Finds the most recent VOD upload for each user, and returns a map
 * with the user's ID as the key and the upload as the value. If the user
 * doesn't have any uploads, it will not be in the result.
 *
 * It checks the 15 most recent videos in the channel, and if any of them are
 * longer than 30 minutes, it returns the most recent of them. Otherwise, it
 * returns the user's latest video.
 *
 * @param channelIds A list of YouTube channel IDs to find VODs from
 * @param minimumDuration Override the minimum duration to recognise as a VOD (in seconds)
 */
async function getYoutubeVods(
    channelIds: string[],
    minimumDuration = ONE_HOUR_SECONDS / 2
): Promise<Map<string, YoutubeVod>> {
    const mostRecentVideoIds = await Promise.all(
        channelIds.map(async userId => {
            // uses an old xml endpoint that gives the most recent 15 video IDs
            // without using up 100 quota points

            try {
                debug("Getting 15 most recent videos for %s", userId);
                const res = await fetch(
                    `https://www.youtube.com/feeds/videos.xml?channel_id=${userId}`
                )
                    .then(requireOkResponse)
                    .then(res => res.text());

                // no need to get an entire xml parser just for this
                return Array.from(res.matchAll(channelFeedVideoIdRegex))
                    .map(match => match[1])
                    .filter(match => match);
            } catch {
                debug("Could not load videos for %s", userId);
                return [];
            }
        })
    ).then(res => res.flat());

    debug(
        "Found %s of the most recent videos from %s channels",
        mostRecentVideoIds.length,
        channelIds.length
    );

    const uncachedVideos = mostRecentVideoIds.filter(
        it => !videoInfoCache.has(it)
    );

    const cachedVideos = mostRecentVideoIds
        .map(it => videoInfoCache.get(it))
        .filter(it => it) as youtube_v3.Schema$Video[];

    // max. 50 ids per request
    const batches = Array.from({
        length: Math.ceil(uncachedVideos.length / 50)
    }).map((_, i) => uncachedVideos.slice(i * 50, (i + 1) * 50));

    debug(
        "Getting data for %s uncached videos, in %s batches",
        uncachedVideos.length,
        batches.length
    );

    const videos = await Promise.all(
        batches.map(async batch => {
            const {data} = await youtubeApi.videos.list({
                part: ["id", "snippet", "contentDetails", "player"],
                id: batch
            });
            const resultVideos = data?.items;
            assert(Array.isArray(resultVideos), "could not load video data");

            for (const vid of resultVideos) {
                videoInfoCache.set(vid.id as string, vid);
            }

            return resultVideos;
        })
    ).then(res => res.flat());

    const result = new Map<string, YoutubeVod>();

    for (const video of [...videos, ...cachedVideos]) {
        assert(video, "video is not defined");
        const {snippet, contentDetails, player} = video;

        assert(video.id, "video does not have id");
        assert(snippet, "snippet was not included in response");
        assert(contentDetails, "content details were not included in response");
        assert(player, "video player was not included in response");

        assert(player.embedHtml, "video player does not have embed source");
        assert(snippet.title, "snippet does not include title");
        assert(snippet.channelId, "snippet does not have a channel id");

        if (result.has(snippet.channelId)) continue;

        // livestreams are not VODs
        if (
            snippet.liveBroadcastContent &&
            snippet.liveBroadcastContent !== "none"
        ) {
            continue;
        }

        assert(contentDetails.duration, "video does not have a duration");
        const duration = toSeconds(parseDuration(contentDetails.duration));
        if (duration < minimumDuration) continue;

        result.set(snippet.channelId, {
            channelId: snippet.channelId,
            duration,
            embedHtml: player.embedHtml,
            title: snippet.title,
            videoId: video.id
        });
    }

    return result;
}

async function getTopAccounts(
    apiClient: TwitterApi,
    twitterTopAccounts: TwitterTopAccount[]
): Promise<TopAccount[]> {
    debug("Finding usernames from account descriptions");
    const usernamesFromDescription = await getUsernamesFromDescription(
        twitterTopAccounts
    );
    const usersWithNameInDescription = new Set(
        Array.from(usernamesFromDescription.keys()).map(usr => usr.id)
    );

    debug("Finding usernames from pinned tweets");
    const accountsWithPinnedTweet = twitterTopAccounts.filter(
        acc => !!acc.pinnedTweetId && !usersWithNameInDescription.has(acc.id)
    ) as RequiredProperties<TwitterTopAccount, "pinnedTweetId">[];
    const usernamesFromPinned = await getUsernamesFromPinnedTweet(
        apiClient,
        accountsWithPinnedTweet
    );

    debug(
        "Linked %s accounts from a description, and %s from a pinned tweet, out of %s",
        usernamesFromDescription.size,
        usernamesFromPinned.size,
        twitterTopAccounts.length
    );

    const users = new Map([
        ...usernamesFromDescription,
        ...usernamesFromPinned
    ]);

    const userIdentifiers = Array.from(users.values());
    const twitchLogins = userIdentifiers.map(user => user.twitchLogin);
    const youtubeIds = userIdentifiers
        .map(user => user.youtubeId)
        .filter(v => v) as string[];

    debug("Getting Twitch users");
    const twitchAccounts = await twitchApi.getUsersByLogins(twitchLogins);

    debug("Getting Twitch streams");
    const streams = await twitchApi.getStreamsByLogins(twitchLogins);

    debug("Getting latest videos");
    const vodVideos = await getYoutubeVods(youtubeIds);

    return Array.from(users.entries())
        .map(([user, {twitchLogin, youtubeId}]): TopAccount | undefined => {
            const twitchAccount = twitchAccounts[twitchLogin];
            if (!twitchAccount) return;

            const youtubeVod = youtubeId && vodVideos.get(youtubeId);

            return {
                id: user.id,
                twitterId: user.id,
                twitterLogin: user.username,
                twitterVerified: user.verified,
                twitchId: twitchAccount.id,
                twitchLogin: twitchAccount.login,
                twitchStreamId: streams[twitchLogin]?.[0]?.id,
                profilePictureUrl: twitchAccount.profileImageUrl,
                notLiveCoverUrl: twitchAccount.offlineImageUrl,
                displayName: twitchAccount.displayName,
                description: user.description,
                youtube: youtubeVod
                    ? {
                          id: youtubeVod.videoId,
                          title: youtubeVod.title,
                          embedHtml: youtubeVod.embedHtml
                      }
                    : undefined
            };
        })
        .filter(acc => acc) as TopAccount[];
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

        debug("Loading the top Twitter accounts for the session");
        const topTwitterAccounts = await getTwitterTopAccounts(session);

        debug("Linking the Twitter accounts with their other information");
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
