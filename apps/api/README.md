# Legacy Fastify API Archive

`apps/api` is an archived reference copy of the pre-Phoenix backend.

It is kept only for:

- behavioral comparison during Phoenix parity work
- historical migration reference
- preserving legacy implementations that may still be useful to inspect

It is not part of normal development anymore:

- the live backend is Phoenix in `apps/phoenix`
- root workspace scripts no longer target this app
- production migration now runs through Phoenix `mix pwa_import`
- no live secrets or active `.env` file should remain inside `apps/api`

Legacy env material, if temporarily retained for historical inspection, should live outside the repo in an external archive path.

If a file here is cited from active Phoenix code or docs, treat it as read-only reference material unless a task explicitly asks you to update the archive.
