![Tweetch Logo](packages/frontend/src/assets/logo-wide-black.svg)

Tweetch is a website that helps you discover new people on Twitch based on who you (and the people you watch) follow on Twitter. It also can show tweets that are relevant to a stream so you can see what people think about it, and it lets you view VODs uploaded to the streamer's Youtube channel if you missed a stream.

## Assignment Info

This website was created for the first assignment for CAB432 at QUT. If you are doing (or are going to do) this subject, obviously don't look through the code.

## Technical Info

Tweetch is written in Typescript and React. It uses Create React App for the frontend and Express for the backend. It uses the Twitter API to find followers and to discover the socials of users, the Twitch API to find a streamer's name and active broadcast, and the Youtube API to find their latest VOD.

Because the Tweetch source code is structured as a monorepo, building and running it is a bit hard. Luckily, Github is set up to build two images (one for the frontend and one for the backend) with production builds of the app. There's also a docker compose file that you can run (with modified environment variables). If you want to build and run it without Docker, please check the Dockerfiles inside `packages/frontend` and `packages/backend`.

Please note that Tweetch expects that the frontend and backend are running on the same domain and port (using a reverse proxy) set so that requests to `/api/*` are directed to the backend, and everything else goes to the frontend. We recommend Caddy for this, although you can see configuration using nginx in `prod-nginx.conf`.

To run Tweetch, you'll need to provide a few environment variables to set the secrets used to access the Twitch and Twitter APIs:

For the frontend, only `PORT` is requried. It specifies the port that the app's server will listen on. This should match whatever you have set in your 

For the backend:

- `PORT`: Sets the port that the backend will listen on.
- `TWITTER_API_KEY`: The key that Twitter gave you to use their API
- `TWITTER_API_SECRET`: The secret that is associated with the above key
- `TWITCH_API_KEY`: The key to access Twitch's API
- `TWITCH_API_SECRET`: The secret value for the above key
- `YOUTUBE_API_KEY`: The key to access the Youtube API
- `TWITTER_BASE_USER`: The ID the Twitter user whose followers will be searched if the Tweetch user isn't logged in
- `DEBUG`: See format of [`debug`](https://npmjs.org/package/debug). Tweetch writes log messages on `app:*` for logging done by the backend, `api:twitch*` for the Twitter API client, and `common:*` for various utilities.
