import {google} from "googleapis";
import {youtubeApiKey} from "../config";

export const youtubeApi = google.youtube({
    version: "v3",
    auth: youtubeApiKey
})
