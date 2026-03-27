# Contributing to VS Code Launchpad

Thanks for your interest in contributing! This document provides guidelines for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/vscode-launchpad.git
   cd vscode-launchpad
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your change:
   ```bash
   git checkout -b my-feature
   ```

## Development

### Running Locally

```bash
# Start both frontend and backend in dev mode
npm run dev

# Or start them separately:
npm run dev:server   # Backend on http://localhost:3010
npm run dev:react    # Frontend on http://localhost:3020
```

### Running Tests

```bash
# All frontend tests
npm test

# Server tests
npm run test:server

# All tests
npm run test:all

# E2E tests (requires running dev server)
npm run test:e2e
```

Please ensure all tests pass before submitting a PR. See [docs/TESTING.md](docs/TESTING.md) for detailed test documentation.

### Building

```bash
# Build React frontend
npm run build:react

# Build Tauri desktop app
npm run tauri:build
```

## Development Workflow — OpenSpec

This project uses the **OpenSpec (OPSX)** plugin for structured, spec-driven development. All feature work follows a defined artifact workflow.

### Prerequisites

- [Claude Code](https://claude.ai/code) with the OpenSpec plugin installed

### Workflow

Use the `/opsx:*` slash commands to drive development:

1. **`/opsx:new`** — Start a new change (creates a change directory under `openspec/changes/`)
2. **`/opsx:continue`** — Create the next artifact in sequence
3. **`/opsx:ff`** — Fast-forward: generate all artifacts through tasks in one pass
4. **`/opsx:apply`** — Implement tasks from the change's `tasks.md`
5. **`/opsx:verify`** — Verify implementation matches the change artifacts
6. **`/opsx:archive`** — Archive a completed change

### Artifact Sequence

The artifact sequence is strict: **proposal** → **design** → **delta specs** → **tasks** → **implementation**. Use `/opsx:continue` to advance one step at a time, or `/opsx:ff` to generate all artifacts in one go.

### Directory Structure

```
openspec/
├── specs/           # Main capability specifications (source of truth)
│   └── <capability>/
│       └── spec.md
└── changes/
    ├── <active-change>/     # In-progress changes
    │   ├── .openspec.yaml   # Metadata
    │   ├── proposal.md      # Why this change exists
    │   ├── design.md        # Design decisions
    │   ├── specs/           # Delta specs (modifications to main specs)
    │   └── tasks.md         # Implementation checklist
    └── archive/             # Completed changes
```

For more details, see the workflow documentation in [CLAUDE.md](CLAUDE.md).

## Submitting Changes

1. Make your changes in a feature branch
2. Write or update tests as needed
3. Ensure all tests pass: `npm run test:all`
4. Commit with a clear message describing what and why:
   ```
   feat(component): add dark mode toggle

   Add a toggle in the header to switch between light and dark themes.
   Theme preference is persisted in localStorage.
   ```
5. Push to your fork and open a Pull Request

### Commit Message Convention

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `test`: Adding or updating tests
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `ci`: CI/CD changes

## Reporting Issues

- Use GitHub Issues to report bugs or request features
- Include steps to reproduce for bugs
- Include your OS, Node.js version, and browser if relevant

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
