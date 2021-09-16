import {TimeoutCache, TopAccount} from "@cab432-a1/common";
import {Semaphore} from "async-mutex";
import debugBuilder from "debug";
import {Request, Response} from "express";
import fetch from "node-fetch";
import {TwitterApi} from "twitter-api-v2";
import {twitterBaseUserId} from "./config";
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
const redirectCache = new TimeoutCache<string, string>("twitter-redirect", 6 * ONE_HOUR);
function getRedirect(link: string): Promise<string> {
    const cache = redirectCache.get(link);
    if (cache) return Promise.resolve(cache);

    return getRedirectMutex.runExclusive(async () => {
        try {
            const response = await fetch(link);
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

const topAccountsCache = new TimeoutCache<string | undefined, TwitterTopAccount[]>("top-accounts", ONE_HOUR);
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
        max_results: 50,
        "user.fields": ["verified", "description"]
    });

    const twitterAccounts = await Promise.all(
        following.data.map(async acc => ({
            id: acc.id,
            name: acc.name,
            username: acc.username,
            verified: acc.verified ?? false,
            description: await loadRedirectingLinks(acc.description ?? "")
        }))
    );
    debug("Got twitter accounts with updated links");

    topAccountsCache.set(twSession, twitterAccounts);
    return twitterAccounts;
}

const twitchLinkRegex = /https:\/\/(?:www\.)?twitch\.tv\/([a-zA-Z0-9_-]+)/;

// TODO: Check if the username is a Twitch account
function getTwitchUsername(description: string): string | undefined {
    const match = description.match(twitchLinkRegex);
    if (!match) return;
    debug("Got match for Twitch link: %s", match[1]);
    return match[1].toLowerCase();
}

function getTwitchUsernames(accounts: TwitterTopAccount[]): Record<string, TwitterTopAccount> {
    const usernames = new Map<string, TwitterTopAccount>();

    for (const acc of accounts) {
        const twitchUsername = getTwitchUsername(acc.description);
        if (twitchUsername?.trim()) usernames.set(twitchUsername.trim(), acc);
    }

    return Object.fromEntries(usernames.entries());
}

async function getTopAccounts(
    twitterTopAccounts: TwitterTopAccount[]
): Promise<TopAccount[]> {
    const usernames = getTwitchUsernames(twitterTopAccounts);

    debug("Getting Twitch users");
    const accounts = await twitchApi.getUsersByLogins(Object.keys(usernames));

    debug("Getting Twitch streams");
    const streams = await twitchApi.getStreamsByLogins(Object.keys(usernames));

    return Object.entries(usernames).map(([twitchName, user]) => {
        const twitchAccount = accounts[twitchName];

        return {
            id: user.id,
            twitterId: user.id,
            twitterName: user.name,
            twitterUsername: user.username,
            twitterVerified: user.verified,
            twitchId: twitchAccount.id,
            twitchLogin: twitchAccount.login,
            twitchName: twitchAccount.displayName,
            isLiveOnTwitch: streams[twitchName]?.length > 0,
            description: user.description
        };
    });
}

export default async function handleTopAccounts(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const session = req.cookies["Twitter-Session"];
        const topTwitterAccounts = await getTwitterTopAccounts(session);
        const topAccounts = await getTopAccounts(topTwitterAccounts);
        res.json({data: topAccounts});
    } catch (err) {
        console.error(err);
        writeError(res, "Something went wrong", 500);
    }
}
