# syntax=docker/dockerfile:1.7

ARG ELIXIR_VERSION=1.19.5
ARG OTP_VERSION=28
ARG DEBIAN_VERSION=trixie

FROM docker.io/library/node:22.14.0-bookworm-slim AS web-builder

WORKDIR /workspace

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/game-engine/package.json ./packages/game-engine/package.json
COPY packages/theme/package.json ./packages/theme/package.json

RUN npm ci --ignore-scripts

COPY apps/web ./apps/web
COPY packages/api-client ./packages/api-client
COPY packages/contracts ./packages/contracts
COPY packages/game-engine ./packages/game-engine
COPY packages/theme ./packages/theme

RUN npm run build:web

FROM docker.io/library/elixir:${ELIXIR_VERSION}-otp-${OTP_VERSION}-slim AS base

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      curl \
      git && \
    rm -rf /var/lib/apt/lists/*

ENV LANG=C.UTF-8
WORKDIR /app

FROM base AS dev

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=dev

CMD ["mix", "phx.server"]

FROM base AS builder

ENV MIX_ENV=prod

RUN mix local.hex --force && mix local.rebar --force

COPY apps/phoenix/mix.exs apps/phoenix/mix.lock ./

RUN mix deps.get --only ${MIX_ENV}
RUN mix deps.compile

COPY apps/phoenix/config ./config
COPY apps/phoenix/lib ./lib
COPY apps/phoenix/priv ./priv
COPY --from=web-builder /workspace/apps/phoenix/priv/static/assets/web ./priv/static/assets/web

RUN mix compile
RUN mix release

FROM docker.io/library/debian:${DEBIAN_VERSION}-slim AS runner

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      libstdc++6 \
      locales \
      msmtp-mta \
      openssl \
      tzdata && \
    ln -sf /usr/bin/msmtp /usr/bin/sendmail && \
    sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
    locale-gen && \
    rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV MIX_ENV=prod
ENV PHX_SERVER=true

WORKDIR /app

RUN useradd --system --create-home --home-dir /app --shell /usr/sbin/nologin app

COPY --from=builder --chown=app:app /app/_build/prod/rel/adventure_time_api ./

USER app

EXPOSE 4200

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD sh -ec 'curl --fail --silent "http://127.0.0.1:${PORT:-${PHX_PORT:-4200}}/ready" >/dev/null'

CMD ["bin/adventure_time_api", "start"]
