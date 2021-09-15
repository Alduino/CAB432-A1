import {randomUUID} from "crypto";
import {URLSearchParams} from "url";
import {Request, Router} from "express";
import fetch from "node-fetch";
import {TwitterApi} from "twitter-api-v2";
import urljoin from "url-join";
import {twitterConsumerKey, twitterConsumerSecret} from "../config";
import {generateSignature, twitterSessions} from "../utils/twitter";
import {AuthRouterUtils, createAuthRouter} from "./utils";

export const router = Router();

interface TokenResponse {
    token: string;
    tokenSecret: string;
}

async function requestToken(url: string, callback: string): Promise<TokenResponse> {
    const authHeaderKeys = {
        oauth_callback: callback,
        oauth_consumer_key: twitterConsumerKey,
        oauth_timestamp: (Date.now() / 1000).toFixed(0),
        oauth_nonce: randomUUID(),
        oauth_signature_method: "HMAC-SHA1",
        oauth_version: "1.0"
    };

    const fullAuthHeaderKeys = {
        ...authHeaderKeys,
        oauth_signature: generateSignature(
            {
                url,
                method: "POST"
            },
            {
                consumer: twitterConsumerSecret,
                oauth: ""
            },
            authHeaderKeys
        )
    };

    const authHeader =
        "OAuth " +
        Object.entries(fullAuthHeaderKeys)
            .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
            .join(", ");

    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: authHeader,
            "User-Agent": "twch API Client"
        }
    });

    if (!res.ok) {
        throw new Error(
            "request_token response was not ok (" + (await res.text()) + ")"
        );
    }

    const body = await res.text();
    const bodyParams = new URLSearchParams(body);

    if (!bodyParams.get("oauth_callback_confirmed")) {
        throw new Error("oauth callback was not confirmed");
    }

    return {
        token: bodyParams.get("oauth_token")!,
        tokenSecret: bodyParams.get("oauth_token_secret")!
    };
}

interface UserState {
    oauthConfig: {
        requestTokenUrl: string;
        authenticateUrl: string;
    };

    verifyUrl: string;
}

createAuthRouter<UserState, TokenResponse>(router, "twitter", {
    async getUserState() {
        const baseUrl = "https://api.twitter.com";

        return {
            oauthConfig: {
                requestTokenUrl: urljoin(baseUrl, "oauth/request_token"),
                authenticateUrl: urljoin(baseUrl, "oauth/authenticate"),
            },
            verifyUrl: urljoin(baseUrl, "account/verify_credentials.json")
        };
    },
    async getRedirectUrl(
        userState: UserState,
        routerState: string,
        callbackUrl: string,
        utils: AuthRouterUtils<TokenResponse>
    ) {
        const tokenResponse = await requestToken(
            userState.oauthConfig.requestTokenUrl,
            callbackUrl
        );

        utils.useCustomAuthState(tokenResponse.token);
        utils.setRequestState(tokenResponse);

        return `${userState.oauthConfig.authenticateUrl}?oauth_token=${tokenResponse.token}`;
    },
    async onComplete(authState, tokens, req, res) {
        if (req.query.denied) return false;

        const verifier = req.query.oauth_verifier;
        if (typeof verifier !== "string") return false;

        const {client} = await new TwitterApi({
            appKey: twitterConsumerKey,
            appSecret: twitterConsumerSecret,
            accessToken: tokens.token,
            accessSecret: tokens.tokenSecret
        }).login(verifier);

        const sessionId = twitterSessions.create(client);
        res.cookie("Twitter-Session", sessionId, {sameSite: "strict", httpOnly: true});

        return true;
    },
    mapAuthState(req) {
        return (
            (req.query.oauth_token as string) ??
            (req.query.denied as string) ??
            "INVALID_TOKEN"
        );
    },
    async check(state: UserState, req: Request) {
        const sessionId = req.cookies["Twitter-Session"];
        if (!sessionId) return {isLoggedIn: false};

        const session = twitterSessions.get(sessionId);
        if (!session) return {isLoggedIn: false};

        try {
            const user = await session.currentUser();
            return {isLoggedIn: true, identifier: user.screen_name};
        } catch {
            return {isLoggedIn: false};
        }
    }
});
