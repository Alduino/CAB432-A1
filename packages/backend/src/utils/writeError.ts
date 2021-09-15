import {Response} from "express";

export default function writeError(res: Response, message: string, status = 400): void {
    res.status(status).json({
        error: true,
        message
    });
}
