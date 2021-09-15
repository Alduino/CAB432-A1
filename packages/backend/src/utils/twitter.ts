import {createHmac, sign} from "crypto";
import {URL} from "url";
import {TwitterApi} from "twitter-api-v2";
import SessionStore from "./SessionStore";

const percentEncodeDisabled = new Set(["-", ".", "_", "~"]);

for (let i = 0; i < 10; i++) {
    percentEncodeDisabled.add(i.toString());
}

for (let i = 0; i < 26; i++) {
    const lowerStart = "a".charCodeAt(0);
    const upperStart = "A".charCodeAt(0);
    percentEncodeDisabled.add(String.fromCharCode(lowerStart + i));
    percentEncodeDisabled.add(String.fromCharCode(upperStart + i));
}

function percentEncode(src: string): string {
    const res: string[] = [];

    for (const char of src) {
        if (percentEncodeDisabled.has(char)) {
            res.push(char);
            continue;
        }

        const charCode = char.charCodeAt(0);
        res.push(`%${charCode.toString(16).toUpperCase()}`);
    }

    return res.join("");
}

export function generateSignature(
    req: {url: string; method: string},
    keys: {consumer: string; oauth: string | ""},
    params: Record<string, string>
): string {
    const items = Object.entries(params).map(([k, v]) => [
        percentEncode(k),
        percentEncode(v)
    ]);

    // sorts by converting to a string - items will become `key, value` so it will sort correctly
    items.sort();

    const paramStr = items.map(([k, v]) => `${k}=${v}`).join("&");

    const baseStr = `${req.method.toUpperCase()}&${percentEncode(
        req.url
    )}&${percentEncode(paramStr)}`;
    const signingKey = `${percentEncode(keys.consumer)}&${percentEncode(
        keys.oauth
    )}`;

    const hmac = createHmac("sha1", signingKey);
    hmac.update(baseStr);
    return hmac.digest("base64");
}

const ONE_HOUR = 1000 * 60 * 60;
export const twitterSessions = new SessionStore<TwitterApi>(24 * ONE_HOUR);
