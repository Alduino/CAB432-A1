import {TopAccount} from "@cab432-a1/common";
import debugBuilder from "debug";
import {Request, Response} from "express";
import {TwitterApi} from "twitter-api-v2";
import {TwitterTopAccount} from "../types/TwitterTopAccount";
import getAccountIdentifiers from "../utils/getAccountIdentifiers";
import getTwitterSession from "../utils/getTwitterSession";
import {twitchApi} from "../utils/twitch";
import {
    getTwitterTopAccount,
    getTwitterTopAccounts
} from "../utils/twitter-top-account";
import writeError from "../utils/writeError";
import {getYoutubeVods} from "../utils/youtube";

const debug = debugBuilder("app:route:top-accounts");

async function getTopAccounts(
    apiClient: TwitterApi,
    twitterTopAccounts: TwitterTopAccount[]
): Promise<TopAccount[]> {
    const users = await getAccountIdentifiers(apiClient, twitterTopAccounts);

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
                twitchStreamId: streams.get(twitchLogin)?.[0]?.id,
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
        const {id} = req.query;
        if (typeof id !== "string") {
            writeError(res, "user_id query param must be set");
            return;
        }

        const apiClient = await getTwitterSession(req);

        debug("Loading the top Twitter accounts for the session");
        const topTwitterAccounts = await getTwitterTopAccounts(apiClient, id);

        if (typeof topTwitterAccounts === "undefined") {
            writeError(res, "twitter account does not exist", 404);
            return;
        }

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

        const apiClient = await getTwitterSession(req);

        const topTwitterAccount = await getTwitterTopAccount(apiClient, id);

        if (!topTwitterAccount) {
            writeError(res, "Not found", 404);
            return;
        }

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
