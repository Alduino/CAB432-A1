import {Router} from "express";
import {router as twitterRouter} from "./twitter";

export const router = Router();

router.use("/twitter", twitterRouter);
