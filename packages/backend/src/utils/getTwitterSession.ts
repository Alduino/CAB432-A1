import {Request} from "express";
import {TwitterApi} from "twitter-api-v2";
import {DEFAULT_SESSION_KEY} from "./SessionStore";
import {defaultTwitterSession, twitterSessions} from "./twitter";

/**
 * If there is already a cached default session, returns that. Otherwise,
 * creates a new session that is logged in with the app token, and saves it to
 * the cache.
 */
async function getDefaultTwitterSession(): Promise<TwitterApi> {
    const cached = twitterSessions.get(DEFAULT_SESSION_KEY);
    if (cached) return cached;

    const session = await defaultTwitterSession.appLogin();
    twitterSessions.setDefault(session);

    return session;
}

export default async function getTwitterSession(
    req: Request
): Promise<TwitterApi> {
    const sessionToken: string = req.cookies["Twitter-Session"];

    return (
        twitterSessions.get(sessionToken) ?? (await getDefaultTwitterSession())
    );
}
