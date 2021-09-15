import {TwitchApi} from "@cab432-a1/twitch-api";
import {twitchApiKey, twitchApiSecret} from "../config";

export const twitchApi = new TwitchApi({
    apiKey: twitchApiKey,
    apiSecret: twitchApiSecret
});
