FROM node:lts as build
RUN curl -f https://get.pnpm.io/v6.14.js | node - add --global pnpm

WORKDIR /app

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . ./
RUN pnpm install -r --offline

RUN pnpm recursive run build

FROM build as backend
WORKDIR /app

ENTRYPOINT ["node", "packages/backend/bin.js"]

FROM nginx:stable-alpine as frontend

COPY frontend-nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/packages/frontend/build /srv

ENTRYPOINT ["nginx", "-g", "daemon off;"]
