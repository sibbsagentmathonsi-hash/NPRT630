# SyncStock 2.0

SyncStock is an inventory and access-management system with separate operational and administrative portals. It uses a React and Vite frontend, a Node.js and Express API, and PostgreSQL persistence.

## Repository Contents

- `Code/` contains the application source, configuration, and setup instructions.
- `Demo/` contains demonstration notes.
- `Documents/` contains the project specifications and planning documents.

See the [application guide](Code/README.md) for the full feature overview, API reference, environment variables, and setup details.

## Quick Start

Requirements: Node.js 18 or later, npm, and Docker Desktop, or a local PostgreSQL server.

From PowerShell:

```powershell
Set-Location Code
npm.cmd install
Copy-Item backend\.env.example backend\.env
docker compose up -d
npm.cmd run dev
```

Edit `backend\.env` for your local database or email settings. Do not commit that file.

## Tests and Build

```powershell
npm.cmd test --workspace backend
npm.cmd run build
```
