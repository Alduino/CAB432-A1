import cookieParser from "cookie-parser";
import express from "express";
import {router as authRouter} from "./auth";
import handleGetDefaultRoot from "./routes/default-root";
import handleStreamTweets from "./routes/stream-tweets";
import handleTopAccounts, {handleTopAccount} from "./routes/top-accounts";

const app = express();
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/default-root", handleGetDefaultRoot);
app.get("/api/top-accounts", handleTopAccounts);
app.get("/api/top-accounts/:id", handleTopAccount);
app.get("/api/stream-tweets", handleStreamTweets);

app.listen(process.env.PORT, () => console.log("Listening"));
