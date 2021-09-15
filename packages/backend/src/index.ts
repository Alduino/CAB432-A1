import cookieParser from "cookie-parser";
import express from "express";
import {router as authRouter} from "./auth";

const app = express();
app.use(cookieParser());

app.use("/api/auth", authRouter);

app.listen(process.env.PORT, () => console.log("Listening"));
