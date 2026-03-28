# Bianca App Monorepo

Bianca Wellness - Secure healthcare communication platform for caregivers and wellness monitoring.

## Structure

This is a monorepo managed with Yarn workspaces.

```
bianca-app/
├── packages/
│   ├── backend/          # Backend API service
│   ├── mobile/           # React Native / Expo app (iOS, Android, Expo web)
│   ├── web/              # Pure React (Vite) desktop web app
│   └── shared/           # Shared design tokens and types
├── package.json          # Root workspace configuration
└── yarn.lock             # Workspace lock file
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

### `@bianca-app/mobile`

React Native / Expo caregiver app (see `packages/mobile/`).

### `@bianca-app/web`

Vite + React desktop web app (org dashboard shell; see `packages/web/`).

### `@bianca-app/shared`

Design tokens and theme catalog shared by mobile and web.

## License

UNLICENSED
