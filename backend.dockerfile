FROM node:lts as pnpm-install
RUN curl -f https://get.pnpm.io/v6.14.js | node - add --global pnpm

FROM pnpm-install as dependencies
WORKDIR /app

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . ./
RUN pnpm install -r --offline

FROM dependencies
WORKDIR /app

RUN pnpm recursive --filter "@cab432-a1/backend" run build

ENTRYPOINT ["node", "packages/backend/bin.js"]
