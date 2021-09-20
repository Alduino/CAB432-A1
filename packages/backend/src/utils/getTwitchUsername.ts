const twitchLinkRegex = /https?:\/\/(?:www\.)?twitch\.tv\/([0-9a-z_-]+)/i;
const fullTwitchLinkRegex = /^https?:\/\/(?:www\.)?twitch\.tv\/([0-9a-z_-]+)$/i;

export function getTwitchUsername(
    source: string,
    isFullLink = false
): string | undefined {
    if (!source) return;
    const match = source.match(
        isFullLink ? fullTwitchLinkRegex : twitchLinkRegex
    );
    if (!match) return;
    return match[1].toLowerCase().trim();
}

export function findTwitchUsername(links: string[]): string | undefined {
    for (const link of links) {
        const username = getTwitchUsername(link, true);
        if (username) return username;
    }
}
