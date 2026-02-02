## 1. Project Setup

- [x] 1.1 Initialize Node.js project with package.json
- [x] 1.2 Install dependencies: express, react, react-dom, axios
- [x] 1.3 Set up build tooling (webpack or create-react-app)
- [x] 1.4 Create project directory structure (src/, public/, server/)

## 2. Backend - Webserver Setup

- [x] 2.1 Create Express server that listens on localhost:3000
- [x] 2.2 Configure server to only bind to 127.0.0.1
- [x] 2.3 Set up static file serving for React frontend
- [x] 2.4 Create /api/workspaces endpoint

## 3. Backend - Workspace File Reading

- [x] 3.1 Implement function to read workspace storage directory path (`~/Library/Application Support/Code/User/workspaceStorage/`)
- [x] 3.2 Implement function to scan and list all JSON files in workspace storage
- [x] 3.3 Implement JSON parsing with error handling for malformed files
- [x] 3.4 Parse and extract workspace metadata from supported formats (local folders, remote workspaces, dev containers, SSH remotes)
- [x] 3.5 Extract workspace name, path, type, and last modified date
- [x] 3.6 Store parsed workspaces in in-memory cache

## 4. Backend - API Implementation

- [x] 4.1 Implement GET /api/workspaces endpoint to return cached workspaces
- [x] 4.2 Ensure API response includes all required fields (name, path, lastModified)
- [x] 4.3 Add error handling and logging for API requests
- [x] 4.4 Implement periodic refresh timer (default 30 seconds)
- [x] 4.5 Update in-memory cache on refresh interval

## 5. Frontend - React Dashboard Setup

- [x] 5.1 Create React app component structure
- [x] 5.2 Set up API client to fetch workspaces from /api/workspaces
- [x] 5.3 Create main dashboard component
- [x] 5.4 Implement state management for workspaces list

## 6. Frontend - Dashboard UI Components

- [x] 6.1 Create workspace table component with columns (name, last modified, path/workspace type)
- [x] 6.2 Implement workspace type filtering (local folders, remote workspaces, dev containers, SSH remotes)
- [x] 6.3 Implement search/filter input field
- [x] 6.4 Implement column sorting functionality
- [x] 6.5 Add styling for dashboard (CSS or CSS-in-JS)
- [x] 6.6 Make dashboard responsive for different screen sizes

## 7. Frontend - Search and Filter

- [x] 7.1 Implement search filter logic for workspace name
- [x] 7.2 Implement search filter logic for workspace path
- [x] 7.3 Implement workspace type filter (local, remote, dev-container, ssh-remote)
- [x] 7.4 Update table display when search or filter changes
- [x] 7.5 Add clear search/filter button

## 8. Frontend - Sorting

- [x] 8.1 Implement sort by name (ascending/descending)
- [x] 8.2 Implement sort by path (ascending/descending)
- [x] 8.3 Implement sort by last modified date (newest/oldest first)
- [x] 8.4 Add visual indicators for current sort column and direction

## 9. Frontend - Real-time Updates

- [x] 9.1 Implement polling to refresh workspace list from API
- [x] 9.2 Update dashboard when new workspaces are detected
- [x] 9.3 Handle removed workspaces gracefully
- [x] 9.4 Add loading indicator during refresh

## 10. Testing and Deployment

- [x] 10.1 Test webserver starts and listens on localhost:3000
- [x] 10.2 Test workspace file reading with sample data (local, remote, dev-container, SSH formats)
- [x] 10.3 Test API endpoint returns correct data with workspace type information
- [x] 10.4 Test dashboard loads and displays workspaces
- [x] 10.5 Test search and filter functionality (name, path, type)
- [x] 10.6 Test sorting functionality
- [x] 10.7 Test workspace type filtering
- [x] 10.8 Create README with setup and usage instructions
- [x] 10.9 Test periodic refresh works correctly
- [x] 10.10 Verify external connections are rejected
- [x] 10.11 Package application for distribution
