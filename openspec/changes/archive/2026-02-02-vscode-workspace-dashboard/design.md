## Context

VS Code stores workspace metadata in JSON files under `~/Library/Application Support/Code/User/workspaceStorage/`. Each workspace has a unique folder containing state files. Users often have multiple workspaces scattered across their filesystem and lose track of them. A dashboard that aggregates and displays this information would help users quickly locate and understand their workspaces.

## Goals / Non-Goals

**Goals:**
- Create a simple webserver that reads workspace JSON files from the VS Code storage directory
- Display workspace information in a user-friendly dashboard UI
- Show workspace paths, names, and other relevant metadata
- Provide a quick way to browse and search through all workspaces
- Run locally on localhost for security

**Non-Goals:**
- Modifying or writing to workspace files
- Syncing workspaces across machines
- Integration with VS Code extensions
- Authentication or multi-user support
- Workspace management (opening, deleting, etc.)

## Decisions

**1. Technology Stack: Node.js + Express + React**
- Express for the backend webserver (lightweight, simple routing)
- React for the frontend dashboard (interactive UI, component-based)
- Rationale: Node.js is fast to develop with, Express is minimal and well-suited for file serving, React provides a responsive UI. Alternatives considered: Python Flask (less familiar to most JS devs), vanilla HTML/JS (less maintainable for complex UI).

**2. File Reading Strategy: Scan on Startup + Periodic Refresh**
- Read all workspace JSON files when the server starts
- Optionally refresh on a timer (e.g., every 30 seconds) to catch new workspaces
- Rationale: Avoids filesystem overhead on every request. Alternatives: read on every request (slower), watch filesystem (complex).

**3. Data Structure: In-Memory Cache**
- Store parsed workspace data in memory as a JavaScript object
- Expose via REST API endpoint (`/api/workspaces`)
- Rationale: Fast access, simple implementation. Alternatives: database (overkill), file-based cache (slower).

**4. Frontend Architecture: Single-Page Application**
- React app served from the same Express server
- API calls to `/api/workspaces` for data
- Rationale: Simpler deployment, no CORS issues. Alternatives: separate frontend/backend (more complex).

**5. UI Components: Table + Search/Filter**
- Display workspaces in a sortable table
- Include search/filter by workspace name or path
- Show key metadata: workspace name, path, last modified date
- Rationale: Familiar UI pattern, easy to scan and search. Alternatives: card grid (less scannable for many items).

## Risks / Trade-offs

**[Risk] Workspace files may be large or numerous**
→ Mitigation: Implement pagination or lazy loading if performance becomes an issue. Start with in-memory cache and optimize if needed.

**[Risk] Workspace JSON structure may vary**
→ Mitigation: Parse defensively, extract only essential fields (path, name). Log warnings for malformed files.

**[Risk] File permissions may prevent reading some workspace files**
→ Mitigation: Gracefully skip unreadable files, log errors for debugging.

**[Risk] Localhost-only access limits usefulness**
→ Trade-off: Accepted for security. Users can port-forward if remote access is needed.

**[Risk] No persistence across server restarts**
→ Trade-off: Acceptable for a dashboard. Data is re-read on startup.

## Migration Plan

1. Start the webserver: `npm start`
2. Open browser to `http://localhost:3000`
3. Dashboard loads and displays all discovered workspaces
4. No migration needed (new application)

## Open Questions

- Should we support filtering by workspace type (folder vs. remote)? 
  - ANSWER: YES
- Should we add a "quick open" feature to launch workspaces in VS Code?
  - ANSWER: NOT NOW
- What metadata fields are most useful to display (path, name, last modified, folder count)?
  - ANSWER: NAME, LAST MODIFIED, PATH or WORKSPACE
