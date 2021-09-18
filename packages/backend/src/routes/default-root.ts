import {Request, Response} from "express";
import {twitterBaseUserId} from "../config";
import getTwitterSession from "../utils/getTwitterSession";

export default async function handleGetDefaultRoot(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const session = await getTwitterSession(req);

        // v1 and v2 ids are different, so we need to map between them
        const {screen_name} = await session.currentUser();

        const {
            data: {id}
        } = await session.v2.userByUsername(screen_name);

        res.json({id});
    } catch {
        res.json({id: twitterBaseUserId});
    }
}
