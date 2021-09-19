import {ok as assert} from "assert";
import {requireOkResponse, TimeoutCache} from "@cab432-a1/common";
import debugBuilder from "debug";
import {google, youtube_v3} from "googleapis";
import {parse as parseDuration, toSeconds} from "iso8601-duration";
import fetch from "node-fetch";
import {youtubeApiKey} from "../config";
import {ONE_HOUR, ONE_HOUR_SECONDS} from "../constants/durations";
import persistCache from "./persistCache";

const debug = debugBuilder("app:utils:youtube");

export const youtubeApi = google.youtube({
    version: "v3",
    auth: youtubeApiKey
});

export interface YoutubeVod {
    channelId: string;
    videoId: string;
    embedHtml: string;
    title: string;
    // in seconds
    duration: number;
}

export const videoInfoCache = new TimeoutCache<string, youtube_v3.Schema$Video>(
    "video-info",
    4 * ONE_HOUR
);
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
export async function getYoutubeVods(
    channelIds: string[],
    minimumDuration = ONE_HOUR_SECONDS / 2
): Promise<Map<string, YoutubeVod>> {
    const mostRecentVideoIds = await Promise.all(
        channelIds.map(async userId => {
            // uses an old xml endpoint that gives the most recent 15 video IDs
            // without using up 100 quota points

            try {
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
