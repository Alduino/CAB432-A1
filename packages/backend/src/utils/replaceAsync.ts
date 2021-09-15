// https://stackoverflow.com/a/48032528
export default async function replaceAsync(
    str: string,
    regex: RegExp,
    replacer: (match: string) => Promise<string>
): Promise<string> {
    const promises: Promise<string>[] = [];

    str.replace(regex, match => {
        const promise = replacer(match);
        promises.push(promise);
        return "";
    });

    const replacements = await Promise.all(promises);
    return str.replace(regex, () => replacements.shift()!);
}
