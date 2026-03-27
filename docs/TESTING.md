# Testing

VS Code Launchpad has comprehensive automated test coverage across three layers.

## Running Tests

```bash
# Run all frontend unit tests (once)
npm test

# Run frontend tests in watch mode
npm run test:watch

# Run frontend tests with coverage report
npm run test:coverage

# Run server/API tests
npm run test:server

# Run server tests in watch mode
npm run test:server:watch

# Run all tests (frontend + server)
npm run test:all

# Run E2E tests (requires running dev server)
npm run test:e2e

# Run E2E tests with interactive UI
npm run test:e2e:ui
```

### Running a Single Test File

```bash
# Single frontend test
npx react-scripts test --watchAll=false --testPathPattern="App.test"

# Single server test
npx jest --config jest.server.config.js --testPathPattern="api.test"

# Single E2E test
npx playwright test e2e/dashboard.spec.js
```

## Test Structure

```
src/
  __tests__/
    App.test.jsx              # App component tests (loading, error states)
    components/
      Dashboard.test.jsx      # Dashboard component tests
      WorkspaceTable.test.jsx # WorkspaceTable component tests
  utils/
    workspaceUtils.test.js    # Utility function tests (URI parsing)
  __mocks__/
    @tauri-apps/              # Tauri API mocks for testing

server/
  __tests__/
    api.test.js               # API endpoint tests (supertest)
    workspaceScanner.test.js  # Workspace scanner integration tests

e2e/
  dashboard.spec.js           # Dashboard page E2E tests
  workspace-opening.spec.js   # Workspace opening E2E tests
  column-visibility.spec.js   # Column visibility E2E tests
  dark-theme.spec.js          # Dark theme E2E tests
```

## Test Naming Conventions

- **Unit tests**: `*.test.js` or `*.test.jsx` — placed next to source files or in `__tests__/`
- **E2E tests**: `*.spec.js` — placed in `e2e/` directory
- **Test descriptions**: Use `describe` blocks with `Spec: <requirement name>` format
- **Test cases**: Use `it('should...')` or `it('does...')` format

## E2E Test Prerequisites

E2E tests require a running development server:

```bash
# Terminal 1: Start the backend
npm run dev:server

# Terminal 2: Start the frontend
npm run dev:react

# Terminal 3: Run E2E tests
npm run test:e2e
```

Or configure the `webServer` option in [`playwright.config.js`](../playwright.config.js) to auto-start.

## Test Mocking

- Frontend tests mock all `@tauri-apps/*` modules via mappings in `package.json` → `src/__mocks__/`
- Server tests mock `workspaceScanner` to avoid filesystem dependency

## CI Integration

Tests run automatically via GitHub Actions (`.github/workflows/test.yml`):
- **Unit & integration tests** run on every push to main/develop
- **E2E tests** run on pull requests only (builds frontend, starts servers, runs Playwright with Chromium)
