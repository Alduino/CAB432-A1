import {randomUUID} from "crypto";
import {
    AuthCheckResponse,
    AuthLinkResponse,
    AuthPollResponse
} from "@cab432-a1/common";
import {Requestor} from "@openid/appauth";
import {Request, Response, Router} from "express";
import fetch from "node-fetch";
import writeError from "../utils/writeError";

interface RequestInfo {
    isComplete: boolean;
    isFailed: boolean;
    userState: unknown;

    onComplete(): void;

    onFailure(): void;

    checkValidity?(req: Request): boolean;
}

export interface AuthRouterOpts<T, R> {
    getUserState(): Promise<T>;

    /**
     * Returns the URL to redirect the user to, that shows a login page on this
     * service.
     * @param userState State returned from `getUserState()`
     * @param routerState Internal router state. Must be returned as `state` query parameter when redirected back here.
     * @param callbackUrl The URL to redirect back to (will be .../callback)
     * @param utils Various utilities for this router and request
     */
    getRedirectUrl(
        userState: T,
        routerState: string,
        callbackUrl: string,
        utils: AuthRouterUtils<R>
    ): string | Promise<string>;

    /**
     * Maps the request to the auth state. Should be used if it isn't in the normal `state` param.
     * @param req
     */
    mapAuthState?(req: Request): string;

    /**
     * Use the final request to do something (could be setting a cookie, etc)
     * @returns true if authentication was successful, false if it wasn't
     */
    onComplete?(
        authState: string,
        requestState: R,
        req: Request,
        res: Response
    ): boolean | Promise<boolean>;

    /**
     * Checks if the client is already authenticated
     * @param userState State returned from `getUserState()`
     * @param req The HTTP request
     */
    check?(userState: T, req: Request): boolean | Promise<AuthCheckResponse>;

    /**
     * Log the user out. Do nothing if they aren't logged in.
     * @param req Http request
     * @param res Http response
     */
    logout?(req: Request, res: Response): void;
}

interface WrappedRequestInfo {
    info: RequestInfo;
    timeoutTime: number;
    customAuthState?: string;
}

type TimeoutList = [
    timeout: number,
    source: Map<string, unknown>,
    moveTo?: Map<string, number>
];

const MINUTE_MS = 1000 * 60 * 60;

class RequestMap {
    // Maps a request ID to its data, as well as the time it will move to `timedOutRequests`
    private readonly requests = new Map<string, WrappedRequestInfo>();

    // Maps a custom auth state to the request ID
    private readonly customAuthStates = new Map<string, string>();

    // Maps a request ID to the time it is fully deleted
    private readonly timedOutRequests = new Map<string, number>();

    private readonly checkTimeoutInterval = setInterval(
        () => this.checkTimeout(),
        5000
    );

    /**
     * @param timeout Number of milliseconds that the request object is valid for. Defaults to 5 minutes.
     * @param fullTimeout Number of milliseconds a smaller value will be stored to notify that the request has timed out. Defaults to an hour.
     */
    constructor(
        private readonly timeout = MINUTE_MS * 5,
        private readonly fullTimeout = MINUTE_MS * 60
    ) {}

    private static createInfo(): RequestInfo {
        return {
            isComplete: false,
            isFailed: false,
            userState: undefined,
            onComplete() {
                this.isComplete = true;
            },
            onFailure() {
                this.isFailed = true;
            }
        };
    }

    addRequest() {
        const id = randomUUID();

        this.requests.set(id, {
            timeoutTime: Date.now() + this.timeout,
            info: RequestMap.createInfo()
        });

        return id;
    }

    hasRequest(reqId: string) {
        return this.requests.has(reqId);
    }

    mapCustomAuthState(authState: string) {
        return this.customAuthStates.get(authState);
    }

    getRequest(reqId: string) {
        if (this.requests.has(reqId)) {
            return this.requests.get(reqId)!.info;
        }

        if (this.customAuthStates.has(reqId)) {
            return this.requests.get(this.customAuthStates.get(reqId)!)!.info;
        }

        return undefined;
    }

    hasTimedOut(reqId: string) {
        return this.timedOutRequests.has(reqId);
    }

    dispose() {
        clearInterval(this.checkTimeoutInterval);
    }

    setCustomAuthState(requestId: string, state: string) {
        this.customAuthStates.set(state, requestId);
    }

    /**
     * Deletes requests that have timed out
     * @param now The current time, in milliseconds
     * @param requests A list of request IDs mapped to their timeout time
     */
    private deleteTimedOutRequests(
        now: number,
        requests: Map<string, TimeoutList>
    ) {
        for (const [reqId, [timeoutTime, map, target]] of requests) {
            if (timeoutTime > now) return;
            map.delete(reqId);
            target?.set(reqId, Date.now() + this.fullTimeout);
        }
    }

    private checkTimeout() {
        const now = Date.now();

        const requestsWithIds = this.mergeRequestLists();
        this.deleteTimedOutRequests(now, requestsWithIds);
    }

    /**
     * Returns `requests` and `timedOutRequests` merged incl. req iq and timeout
     */
    private mergeRequestLists(): Map<string, TimeoutList> {
        const finalList = new Map<string, TimeoutList>();

        for (const [reqId, {timeoutTime, customAuthState}] of this.requests) {
            finalList.set(reqId, [
                timeoutTime,
                this.requests,
                this.timedOutRequests
            ]);

            if (customAuthState) {
                finalList.set(customAuthState, [
                    timeoutTime,
                    this.customAuthStates
                ]);
            }
        }

        for (const [reqId, timeoutTime] of this.timedOutRequests) {
            finalList.set(reqId, [timeoutTime, this.timedOutRequests]);
        }

        return finalList;
    }
}

export interface AuthRouterUtils<T> {
    useCustomAuthState(state: string): void;

    /**
     * Sets some state for this specific request, that can be accessed later in
     * `onComplete`.
     */
    setRequestState(state: T): void;
}

/**
 * Routes for external use:
 * - `/init`: Begins the authentication flow. Returns a link that redirects to the 3rd party's auth page, and a link to poll to check if authentication is complete.
 * - `/callback`: The callback URL for the OAuth flow
 * - `/check`: Checks if the client is already authenticated
 */
export async function createAuthRouter<T, R = never>(
    router: Router,
    name: string,
    opts: AuthRouterOpts<T, R>
): Promise<void> {
    const requests = new RequestMap();
    const userState = await opts.getUserState();

    router.get("/init", (req, res) => {
        const requestId = requests.addRequest();

        const baseUrl = `${req.protocol}://${
            req.headers.host ?? "NO_HOST_HEADER.local"
        }/api/auth/${name}`;

        res.json({
            link: `${baseUrl}/redirect?rid=${requestId}`,
            pollLink: `${baseUrl}/poll?rid=${requestId}`
        } as AuthLinkResponse);
    });

    router.get("/redirect", async (req, res) => {
        const requestId = req.query.rid;

        if (typeof requestId !== "string") {
            return writeError(res, "Missing `rid` query parameter");
        }

        if (requests.hasTimedOut(requestId)) {
            return writeError(res, "Request has timed out, please try again");
        }

        if (!requests.hasRequest(requestId)) {
            return writeError(res, "Invalid request ID");
        }

        const callbackUrl = `${req.protocol}://${
            req.headers.host ?? "NO_HOST_HEADER.local"
        }${req.baseUrl}/callback`;

        const utils: AuthRouterUtils<R> = {
            useCustomAuthState(state) {
                requests.setCustomAuthState(requestId, state);
            },
            setRequestState(state: R) {
                requests.getRequest(requestId)!.userState = state;
            }
        };

        try {
            const redirectUrl = await opts.getRedirectUrl(
                userState,
                requestId,
                callbackUrl,
                utils
            );
            res.redirect(redirectUrl);
        } catch (err) {
            console.error(err);
            writeError(res, "Could not redirect to login", 500);
        }
    });

    router.get("/poll", (req, res) => {
        const requestId = req.query.rid;
        if (typeof requestId !== "string")
            return writeError(res, "Missing `rid` query parameter");

        if (requests.hasTimedOut(requestId)) {
            return writeError(res, "Request has timed out, please try again");
        }

        const request = requests.getRequest(requestId);

        if (!request) {
            return writeError(res, "Invalid request ID");
        }

        res.json({
            isComplete: request.isComplete,
            isFailed: request.isFailed
        } as AuthPollResponse);
    });

    router.get("/callback", async (req, res) => {
        const authState = opts.mapAuthState?.(req) ?? req.query.state;

        if (typeof authState !== "string") {
            return writeError(res, "Missing state");
        }

        const requestId = requests.hasRequest(authState)
            ? authState
            : requests.mapCustomAuthState(authState);

        if (!requestId) {
            return writeError(res, "Invalid request ID");
        }

        if (requests.hasTimedOut(requestId)) {
            return writeError(res, "Request has timed out, please try again");
        }

        const request = requests.getRequest(requestId);

        if (!request) {
            return writeError(res, "Invalid request ID");
        }

        const success =
            (await opts.onComplete?.(
                authState,
                request.userState as R,
                req,
                res
            )) ?? true;

        if (success) {
            request.onComplete();
            res.status(200).json({success: true});
        } else {
            request.onFailure();
            writeError(res, "Authentication was not successful");
        }
    });

    router.get("/check", async (req, res) => {
        const result = (await opts.check?.(userState, req)) ?? {
            isLoggedIn: false
        };
        res.json(result);
    });

    router.post("/logout", (req, res) => {
        opts.logout?.(req, res);
        res.status(200).json({});
    });
}
