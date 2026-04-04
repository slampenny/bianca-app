# Backend Docker assets

All **local** Compose overrides and the **app image** recipe for this package live here. Run commands from **`packages/backend`** (the backend package root) so paths like `../.env` and `../devops/asterisk` resolve correctly.

## Common commands

Defined in `package.json`:

| Goal | Command |
|------|---------|
| MongoDB, Redis, Asterisk (dev) | `yarn docker:dev:services` |
| Full dev stack (compose) | `yarn docker:dev` |
| Build app image | `yarn docker:build` |
| Integration test DB | `yarn test:integration:docker` |
| **Free disk** (build cache + unused images, keeps container data) | `yarn docker:low-disk` |
| **Wait for prune to finish** (then compact virtual disk on Windows) | `yarn docker:wait-prune` |

For deeper cleanup (including optional volume/network pruning), see `scripts/cleanup-docker.sh`. On **Windows + WSL2**, after Docker cleanup you may still need to **compact a VHDX**: Docker Desktop uses `docker_data.vhdx`; **Docker Engine inside WSL only** (common on Windows Pro without Desktop) uses your distro’s **`ext4.vhdx`**. See `scripts/compact-docker-vhdx.md`.

Production/staging hosts use a **`docker-compose.yml` generated at deploy time** (CodeDeploy/userdata) in `/opt/bianca-*` — that file is **not** checked in here.

## Files

- **`Dockerfile`** — multi-stage image for the Node API (CodeBuild / local `yarn docker:build`).
- **`docker-compose.yml`** — base stack; merged with environment-specific files.
- **`docker-compose.dev.yml`** — local development (app build target, observability profile, etc.).
- **`docker-compose.*.yml`** — prod, staging, test, EC2, etc.
- **`observability/`** — Prometheus/Grafana config for the `observability` Compose profile.
