FROM node:22.15.0-alpine3.21 AS builder

WORKDIR /build

ADD . /build

RUN npm config set registry https://registry.npmmirror.com/ && \
    npm install -g pnpm@latest-10

RUN pnpm install && \
    pnpm --filter @wemd/web build


FROM node:alpine

WORKDIR /app

COPY --from=builder /build/apps/web/dist /app/

EXPOSE 8080

CMD ["npx","http-server", "-p", "8080"]

