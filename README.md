# Bianca App Monorepo

Bianca Wellness - Secure healthcare communication platform for caregivers and wellness monitoring.

## Structure

This is a monorepo managed with Yarn workspaces.

```
bianca-app/
├── packages/
│   ├── backend/          # Backend API service
│   └── frontend/         # Frontend application
├── package.json          # Root workspace configuration
└── yarn.lock            # Workspace lock file
```

## Getting Started

### Install Dependencies

```bash
yarn install
```

### Development

```bash
# Run backend in development mode
yarn dev

# Run backend tests
yarn test

# Run linting
yarn lint
```

## Workspace Commands

All commands are run from the root directory. Use `yarn workspace <package-name> <command>` to run commands in specific packages.

### Backend (`@bianca-app/backend`)

```bash
# Development
yarn workspace @bianca-app/backend dev

# Testing
yarn workspace @bianca-app/backend test

# Docker
yarn workspace @bianca-app/backend docker:dev
```

## Packages

### `@bianca-app/backend`

Backend API service providing:
- REST API
- Real-time voice calls
- AI-powered transcription
- HIPAA-compliant patient care coordination

See `packages/backend/README.md` for more details.

### `@bianca-app/frontend`

Frontend application (see `packages/frontend/` for details).

## License

UNLICENSED
