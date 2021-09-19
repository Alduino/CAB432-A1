FROM node:lts as dependencies
RUN curl -f https://get.pnpm.io/v6.14.js | node - add --global pnpm

WORKDIR /app

COPY pnpm-lock.yaml ./
RUN pnpm fetch

ADD . ./
RUN pnpm install -r --offline

FROM dependencies as build
RUN pnpm recursive --filter "@cab432-a1/frontend" run build

FROM nginx:stable-alpine

COPY frontend-nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/packages/frontend/build /srv
ENTRYPOINT ["nginx", "-g", "daemon off;"]
