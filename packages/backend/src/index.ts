import cookieParser from "cookie-parser";
import express from "express";
import {router as authRouter} from "./auth";
import handleTopAccounts from "./top-accounts";

const app = express();
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.get("/api/top-accounts", handleTopAccounts);

app.listen(process.env.PORT, () => console.log("Listening"));
