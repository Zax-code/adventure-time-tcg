# @adventure-time/db (archived)

Legacy Drizzle schema and migrations from the Fastify era, kept only as a
reference (see the repository `AGENTS.md`). It is no longer an npm workspace and
is neither installed nor typechecked.

Phoenix and its Ecto migrations own the live schema. Do not run these
migrations against the Phoenix database; `drizzle.config.ts` refuses to run
without an explicit `LEGACY_DATABASE_URL`.
