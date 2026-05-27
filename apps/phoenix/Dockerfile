# syntax=docker/dockerfile:1.7

ARG ELIXIR_VERSION=1.19.5
ARG OTP_VERSION=28
ARG DEBIAN_VERSION=trixie

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

COPY mix.exs mix.lock ./
COPY config ./config

RUN mix deps.get --only ${MIX_ENV}
RUN mix deps.compile

COPY lib ./lib
COPY priv ./priv

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
