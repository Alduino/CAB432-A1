import {ok as assert} from "assert";
import {StreamTweetsResponse} from "@cab432-a1/common";
import {Request, Response} from "express";
import getAccountIdentifiers from "../utils/getAccountIdentifiers";
import getTwitterSession from "../utils/getTwitterSession";
import {twitchApi} from "../utils/twitch";
import {loadRedirectingLinks} from "../utils/twitter-redirects";
import {getTwitterTopAccount} from "../utils/twitter-top-account";
import writeError from "../utils/writeError";

export default async function handleStreamTweets(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const {id: userId} = req.query;

        if (typeof userId !== "string") {
            writeError(res, "id query param must be set");
            return;
        }

        const apiClient = await getTwitterSession(req);

        const thisUser = await apiClient.v2.user(userId).then(res => res.data);
        if (!thisUser) {
            writeError(res, "User not found", 404);
            return;
        }

        const twitterTopAccount = await getTwitterTopAccount(apiClient, userId);
        if (!twitterTopAccount) {
            writeError(res, "Could not find a linked Twitch account", 404);
            return;
        }

        const identifierResult = await getAccountIdentifiers(apiClient, [
            twitterTopAccount
        ]);

        const identifiers = identifierResult.get(twitterTopAccount);
        assert(identifiers, "identifier result has no data");

        const streams = await twitchApi.getStreamsByLogins([
            identifiers.twitchLogin
        ]);
        const thisStream = streams.get(identifiers.twitchLogin)?.[0];

        if (!thisStream) {
            writeError(res, "Stream not found", 404);
            return;
        }

        const mostRecentMentioningTweetsResult =
            await apiClient.v2.userMentionTimeline(thisUser.id, {
                start_time: thisStream.startedAt,
                max_results: 15,
                "tweet.fields": ["author_id", "created_at"]
            });

        const mentioningTweets = mostRecentMentioningTweetsResult.tweets;

        const mostRecentTweetsResult = await apiClient.v2.userTimeline(
            thisUser.id,
            {
                start_time: thisStream.startedAt,
                max_results: 15,
                "tweet.fields": ["author_id", "created_at"]
            }
        );

        const selfTweets = mostRecentTweetsResult.tweets;

        const tweets = [...mentioningTweets, ...selfTweets].sort(
            (a, b) =>
                new Date(b.created_at!).getTime() -
                new Date(a.created_at!).getTime()
        );

        const tweetAuthorIds = new Set(
            tweets.map(tw => tw.author_id as string)
        );

        const tweetAuthorList = await apiClient.v2.users(
            Array.from(tweetAuthorIds),
            {
                "user.fields": ["profile_image_url", "verified"]
            }
        );

        const tweetAuthors = new Map(
            tweetAuthorList.data.map(author => [author.id, author])
        );

        const result: StreamTweetsResponse = {
            data: await Promise.all(
                tweets.map(async tweet => {
                    assert(tweet.author_id, "tweet does not have an author id");
                    assert(
                        tweet.created_at,
                        "tweet does not have a creation time"
                    );

                    const author = tweetAuthors.get(tweet.author_id);
                    assert(author, "tweet does not have an author");

                    return {
                        tweetId: tweet.id,
                        authorDisplayName: author.name,
                        authorUsername: author.username,
                        authorIsVerified: author.verified ?? false,
                        profilePicUrl: author.profile_image_url,
                        publishTime: tweet.created_at,
                        source: await loadRedirectingLinks(tweet.text)
                    };
                })
            )
        };

        res.json(result);
    } catch (err) {
        console.error(err);
        writeError(res, "Something went wrong", 500);
    }
}
