import {URL} from "url";
import {requireOkResponse, TimeoutCache} from "@cab432-a1/common";
import createDebug from "debug";
import fetch, {RequestInit} from "node-fetch";
import urljoin from "url-join";
import TwitchStream from "./TwitchStream";
import TwitchUser from "./TwitchUser";
import {
    TwitchCursorResponseType,
    TwitchResponseType,
    TwitchStreamType,
    TwitchTokenResponseType,
    TwitchUserType
} from "./types";
import {SimpleMethodMutex} from "./utils/MethodMutex";

const debug = createDebug("api:twitch");
const requestDebug = createDebug("api:twitch:request");

const ONE_HOUR = 1000 * 60 * 60;

export interface TwitchApiOpts {
    apiKey: string;
    apiSecret: string;
    baseUrl?: string;
    cacheDuration?: number;
}

export default class TwitchApi {
    private initialised = false;
    private accessToken = "NOT_SET";

    private readonly init = new SimpleMethodMutex(() => this.doInit());
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly baseUrl: string;

    private readonly usersByLoginsCache: TimeoutCache<string, TwitchUser>;

    constructor(opts: TwitchApiOpts) {
        this.apiKey = opts.apiKey;
        this.apiSecret = opts.apiSecret;
        this.baseUrl = opts.baseUrl ?? "https://api.twitch.tv/helix";

        this.usersByLoginsCache = new TimeoutCache<string, TwitchUser>(
            "twitch-api:users-by-logins",
            opts.cacheDuration ?? ONE_HOUR
        );
    }

    /**
     * Joins the params (in entries form) into a query string, and adds them to
     * the end of the base URL
     */
    private static buildUrl(
        base: string,
        params: ([string, string] | undefined)[]
    ) {
        return (
            base +
            "?" +
            params
                .filter(p => !!p)
                .map(p => p!.join("="))
                .join("&")
        );
    }

    /**
     * Loads data from a paginated endpoint, until there are `totalCount` items.
     * @param totalCount The number of items to return. May return less.
     * @param maxPerReq The maximum number of items that can be returned per request
     * @param request Function to send the request
     * @private
     */
    private static async paginate<T>(
        totalCount: number,
        maxPerReq: number,
        request: (
            count: number,
            after?: string
        ) => Promise<TwitchCursorResponseType<T[]>>
    ): Promise<T[]> {
        let currentCount = 0,
            after: string | undefined = undefined;
        const resultList: T[] = [];

        while (totalCount === 0 || currentCount < totalCount - maxPerReq) {
            const thisCount =
                totalCount === 0
                    ? maxPerReq
                    : Math.min(totalCount - currentCount, maxPerReq);

            const result: TwitchCursorResponseType<T[]> = await request(
                thisCount,
                after
            );

            resultList.push(...result.data);

            if (!result.pagination.cursor) break;

            currentCount += thisCount;
            after = result.pagination.cursor;
        }

        return resultList;
    }

    async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
        await this.init.call();

        requestDebug("%s %s", opts.method ?? "GET", path);

        return fetch(urljoin(this.baseUrl, path), {
            ...opts,
            headers: {
                ...opts.headers,
                Authorization: `Bearer ${this.accessToken}`,
                "Client-Id": this.apiKey
            }
        })
            .then(requireOkResponse)
            .then(res => res.json())
            .catch(err => {
                err.message += `
Request: ${path}`;
                throw err;
            });
    }

    /**
     * Returns a list of streams associated with each login, in a map of
     * login to stream
     * @param logins The logins to search for
     * @param count The maximum number of streams to fetch per batch. 0 for all
     */
    async getStreamsByLogins(
        logins: string[],
        count = 0
    ): Promise<ReadonlyMap<string, TwitchStream[]>> {
        const streams = await this.getStreams("user_login", logins, count);

        const result = new Map<string, TwitchStream[]>();

        for (const stream of streams) {
            const {user_login} = stream;
            const list = result.get(user_login) ?? [];
            if (!result.has(user_login)) result.set(user_login, list);

            list.push(new TwitchStream(this, stream));
        }

        return result;
    }

    /**
     * Returns a list of users by their logins
     * @param logins The logins to search for
     * @remarks Cached by default for an hour
     */
    async getUsersByLogins(
        logins: string[]
    ): Promise<Record<string, TwitchUser>> {
        const cachedLogins = new Map(
            logins
                .map(
                    login =>
                        [login, this.usersByLoginsCache.get(login)] as [
                            string,
                            TwitchUser
                        ]
                )
                .filter(v => v[1])
        );
        const uncachedLogins = logins.filter(login => !cachedLogins.has(login));

        const users = await this.getUsers("login", uncachedLogins);

        const twitchUsers = users.map(
            usr => [usr.login, new TwitchUser(this, usr)] as const
        );

        for (const [key, value] of twitchUsers) {
            this.usersByLoginsCache.set(key, value);
        }

        return Object.fromEntries([
            ...twitchUsers,
            ...Array.from(cachedLogins.entries())
        ]);
    }

    /**
     * Actual value requesting for the various `getUsers` methods
     * @param key The query parameter key for each value
     * @param values The values to query by
     */
    private getUsers(key: string, values: string[]) {
        if (values.length === 0) return Promise.resolve([]);
        return this.batch(values, 100, values =>
            this.request<TwitchResponseType<TwitchUserType[]>>(
                TwitchApi.buildUrl(
                    "users",
                    values.map(id => [key, id] as [string, string])
                )
            )
        ).then(res => res.flatMap(v => v.data));
    }

    /**
     * Actual value requesting for the various `getStreams` methods
     * @param key The query parameter key for each value
     * @param values The values to query by
     * @param count The number of resulting items (per batch)
     */
    private getStreams(
        key: string,
        values: string[],
        count: number
    ): Promise<TwitchStreamType[]> {
        if (values.length === 0) return Promise.resolve([]);
        return this.batch(values, 100, values =>
            TwitchApi.paginate(count, 100, (count, after) =>
                this.request<TwitchCursorResponseType<TwitchStreamType[]>>(
                    TwitchApi.buildUrl("streams", [
                        ["first", count.toString()],
                        after ? ["after", after.toString()] : undefined,
                        ...values.map(id => [key, id] as [string, string])
                    ])
                )
            )
        ).then(res => res.flat());
    }

    private scheduleRefresh(ms: number) {
        debug(
            "Will refresh the access token in %s minutes",
            (ms / 60000).toFixed(1)
        );
        setTimeout(() => {
            debug("Refreshing the access token");
            this.initialised = false;
        }, ms);
    }

    private async doInit() {
        if (this.initialised) return;
        this.initialised = true;

        try {
            debug("Initialising");

            const url = new URL("https://id.twitch.tv/oauth2/token");
            url.searchParams.set("client_id", this.apiKey);
            url.searchParams.set("client_secret", this.apiSecret);
            url.searchParams.set("grant_type", "client_credentials");

            const res: TwitchTokenResponseType = await fetch(url, {
                method: "POST"
            })
                .then(requireOkResponse)
                .then(res => res.json());

            this.accessToken = res.access_token;

            // require a refresh a bit before expiry
            this.scheduleRefresh(res.expires_in - 10);
        } catch (err) {
            this.initialised = false;
            debug("Could not initialise: %s", err);
        }
    }

    /**
     * Performs batched requests, splitting the data into groups up to `maxEach`
     * in size.
     * @param data Each data piece
     * @param maxEach The maximum size of each slice
     * @param fetch A function to fetch the data and return the result
     * @private
     */
    private async batch<T, R>(
        data: T[],
        maxEach: number,
        fetch: (dataSlice: T[]) => Promise<R>
    ): Promise<R[]> {
        const groups: T[][] = [];

        for (let i = 0; i < data.length; i += maxEach) {
            groups.push(data.slice(i, i + maxEach));
        }

        return await Promise.all(groups.map(group => fetch(group)));
    }
}
