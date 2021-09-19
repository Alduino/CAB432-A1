FROM node:lts as dependencies
RUN curl -f https://get.pnpm.io/v6.14.js | node - add --global pnpm

WORKDIR /app

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . ./
RUN pnpm install -r --offline

FROM dependencies as backend
WORKDIR /app

RUN pnpm recursive run build

ENTRYPOINT ["node", "packages/backend/bin.js"]

FROM nginx:stable-alpine as frontend

COPY frontend-nginx.conf /etc/nginx/nginx.conf
COPY --from=dependencies /app/packages/frontend/build /srv

ENTRYPOINT ["nginx", "-g", "daemon off;"]
