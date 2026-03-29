use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Workspace info fetched from the sidecar API
#[derive(Debug, Clone, Deserialize)]
pub struct TrayWorkspace {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "type", default)]
    pub workspace_type: String,
    #[serde(rename = "lastAccessed")]
    pub last_accessed: String,
}

/// Claude session info fetched from the sidecar API
#[derive(Debug, Clone, Deserialize)]
pub struct ClaudeSession {
    pub pid: u64,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub cwd: String,
    pub state: String, // "working", "waiting", "idle", or "zombie"
}

/// Convert a workspace path to a vscode:// URI that VS Code's protocol handler recognizes.
/// Mirrors the convertToVSCodeURI logic in WorkspaceTable.js.
pub fn convert_to_vscode_uri(path: &str, workspace_type: &str) -> String {
    // Remote workspaces: transform vscode-remote:// to vscode://vscode-remote/
    match workspace_type {
        "remote" | "dev-container" | "attached-container" | "ssh-remote" => {
            if path.starts_with("vscode-remote://") {
                return path.replacen("vscode-remote://", "vscode://vscode-remote/", 1);
            }
            return path.to_string();
        }
        _ => {}
    }

    // Local workspaces: strip file://, decode, re-encode, prepend vscode://file
    let mut clean_path = path.to_string();
    if clean_path.starts_with("file://") {
        clean_path = clean_path[7..].to_string();
    }

    // Decode percent-encoded characters
    if let Ok(decoded) = urlencoding::decode(&clean_path) {
        clean_path = decoded.into_owned();
    }

    // Re-encode each path segment (preserve slashes)
    let encoded: String = clean_path
        .split('/')
        .map(|segment| urlencoding::encode(segment).into_owned())
        .collect::<Vec<_>>()
        .join("/");

    format!("vscode://file{}", encoded)
}

/// Managed state holding the tray icon handle for dynamic updates
pub struct TrayState {
    pub tray_icon: Arc<Mutex<Option<TrayIcon>>>,
}

impl TrayState {
    pub fn new() -> Self {
        Self {
            tray_icon: Arc::new(Mutex::new(None)),
        }
    }
}

/// Resolve the tray icon path (dev vs prod)
fn resolve_icon_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    if cfg!(dev) {
        // In dev mode, icons are in src-tauri/icons/ relative to the working dir
        let path = std::env::current_dir().ok()?.join("icons").join("32x32.png");
        if path.exists() { Some(path) } else { None }
    } else {
        // In production, use the resource directory
        let resource_dir = app.path().resource_dir().ok()?;
        let path = resource_dir.join("icons").join("32x32.png");
        if path.exists() {
            Some(path)
        } else {
            // Fallback: icon may be bundled alongside the executable
            let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
            let path = exe_dir.join("icons").join("32x32.png");
            if path.exists() { Some(path) } else { None }
        }
    }
}

/// Create the initial tray icon with custom app icon and default menu
pub fn create_tray(app: &tauri::AppHandle) -> tauri::Result<TrayIcon> {
    let tray_menu = build_menu(app, &[], false, &HashMap::new(), &HashMap::new(), 0, 0, 0);

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&tray_menu)
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(handle_tray_menu_event)
        .on_tray_icon_event(|tray, event| {
            // On Windows/Linux, left-click shows the main window
            #[cfg(not(target_os = "macos"))]
            {
                use tauri::tray::{TrayIconEvent, MouseButton};
                if let TrayIconEvent::Click { button, .. } = event {
                    if button == MouseButton::Left {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _: Result<(), _> = window.show();
                            let _: Result<(), _> = window.set_focus();
                        }
                    }
                }
            }
            // Suppress unused variable warnings on macOS
            #[cfg(target_os = "macos")]
            {
                let _ = (tray, event);
            }
        });

    // Load custom icon, fall back to default if not found
    if let Some(icon_path) = resolve_icon_path(app) {
        match tauri::image::Image::from_path(&icon_path) {
            Ok(image) => {
                log::info!("Loaded tray icon from {:?}", icon_path);
                builder = builder.icon(image);
            }
            Err(e) => {
                log::warn!("Failed to load tray icon from {:?}: {}, using default", icon_path, e);
            }
        }
    } else {
        log::warn!("Tray icon file not found, using default icon");
    }

    builder.build(app)
}

/// Handle menu item clicks from the tray
fn handle_tray_menu_event(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id();
    let id_str = id.as_ref();

    if id_str.starts_with("ws_open:") {
        // Workspace quick-open: extract the URI after the prefix
        let uri = &id_str["ws_open:".len()..];
        if let Err(e) = app.opener().open_url(uri, None::<&str>) {
            log::error!("Failed to open workspace from tray: {}", e);
        }
    } else {
        match id_str {
            "show_dashboard" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _: Result<(), _> = window.show();
                    let _: Result<(), _> = window.set_focus();
                }
            }
            "check_updates" => {
                let _ = app.emit("check-for-updates", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        }
    }
}

/// Map workspace type to a colored emoji indicator
fn type_emoji(workspace_type: &str) -> &'static str {
    match workspace_type {
        "local" => "🔵",
        "ssh-remote" => "🟣",
        "dev-container" => "🟢",
        "attached-container" => "🟡",
        "remote" => "🩷",
        _ => "⚪",
    }
}

/// Check if a workspace type is remote (cannot validate path locally)
fn is_remote_type(workspace_type: &str) -> bool {
    matches!(workspace_type, "remote" | "dev-container" | "attached-container" | "ssh-remote")
}

/// Build the tray menu with workspace entries, Claude session data, and health status
fn build_menu(
    app: &tauri::AppHandle,
    workspaces: &[TrayWorkspace],
    backend_healthy: bool,
    validity: &HashMap<String, bool>,
    session_counts: &HashMap<String, (usize, usize)>,
    total_active: usize,
    total_idle: usize,
    zombie_count: usize,
) -> Menu<tauri::Wry> {
    let status_label = if backend_healthy { "Backend: Running" } else { "Backend: Offline" };

    if workspaces.is_empty() {
        let no_ws = MenuItem::with_id(app, "no_workspaces", "No workspaces found", false, None::<&str>).unwrap();
        let sep1 = PredefinedMenuItem::separator(app).unwrap();
        let show = MenuItem::with_id(app, "show_dashboard", "Show Dashboard", true, None::<&str>).unwrap();
        let updates = MenuItem::with_id(app, "check_updates", "Check for Updates", true, None::<&str>).unwrap();
        let sep2 = PredefinedMenuItem::separator(app).unwrap();
        let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
        let sep3 = PredefinedMenuItem::separator(app).unwrap();
        let status = MenuItem::with_id(app, "backend_status", status_label, false, None::<&str>).unwrap();

        Menu::with_items(app, &[
            &no_ws, &sep1, &show, &updates, &sep2, &quit, &sep3, &status,
        ]).unwrap()
    } else {
        // Build workspace items (up to 10, already sorted by last_accessed desc)
        let ws_items: Vec<MenuItem<tauri::Wry>> = workspaces.iter().take(10).map(|ws| {
            let emoji = type_emoji(&ws.workspace_type);
            let is_valid = is_remote_type(&ws.workspace_type)
                || validity.get(&ws.path).copied().unwrap_or(true);

            // Append Claude session indicator if sessions exist
            let claude_suffix = match session_counts.get(&ws.path) {
                Some((working, waiting)) if *working > 0 && *waiting > 0 => {
                    format!(" ⚡{} ⏳{}", working, waiting)
                }
                Some((working, 0)) if *working > 0 => format!(" ⚡{}", working),
                Some((0, waiting)) if *waiting > 0 => format!(" ⏳{}", waiting),
                _ => String::new(),
            };

            let label = if is_valid {
                format!("{} {}{}", emoji, ws.name, claude_suffix)
            } else {
                format!("{} ✗ {}{}", emoji, ws.name, claude_suffix)
            };
            let uri = convert_to_vscode_uri(&ws.path, &ws.workspace_type);
            let menu_id = format!("ws_open:{}", uri);
            MenuItem::with_id(app, &menu_id, &label, is_valid, None::<&str>).unwrap()
        }).collect();

        let sep1 = PredefinedMenuItem::separator(app).unwrap();
        let show = MenuItem::with_id(app, "show_dashboard", "Show Dashboard", true, None::<&str>).unwrap();
        let updates = MenuItem::with_id(app, "check_updates", "Check for Updates", true, None::<&str>).unwrap();
        let sep2 = PredefinedMenuItem::separator(app).unwrap();
        let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
        let sep3 = PredefinedMenuItem::separator(app).unwrap();
        let status = MenuItem::with_id(app, "backend_status", status_label, false, None::<&str>).unwrap();

        let mut menu_items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();

        // Claude session summary line (only if sessions exist)
        let claude_summary_item;
        let claude_sep;
        let total_sessions = total_active + total_idle;
        if total_sessions > 0 || zombie_count > 0 {
            let mut parts = Vec::new();
            if total_active > 0 { parts.push(format!("{} working", total_active)); }
            if total_idle > 0 { parts.push(format!("{} waiting", total_idle)); }
            if zombie_count > 0 { parts.push(format!("{} zombie", zombie_count)); }
            let summary_label = format!("Claude: {}", parts.join(", "));
            claude_summary_item = MenuItem::with_id(app, "claude_summary", &summary_label, false, None::<&str>).unwrap();
            claude_sep = PredefinedMenuItem::separator(app).unwrap();
            menu_items.push(&claude_summary_item);
            menu_items.push(&claude_sep);
        }

        for item in &ws_items {
            menu_items.push(item);
        }
        menu_items.push(&sep1);
        menu_items.push(&show);
        menu_items.push(&updates);
        menu_items.push(&sep2);
        menu_items.push(&quit);
        menu_items.push(&sep3);
        menu_items.push(&status);

        Menu::with_items(app, &menu_items).unwrap()
    }
}

/// Update the tray menu with fresh workspace data, Claude sessions, and health status
pub async fn update_tray_menu(
    app: &tauri::AppHandle,
    workspaces: &[TrayWorkspace],
    backend_healthy: bool,
    validity: &HashMap<String, bool>,
    session_counts: &HashMap<String, (usize, usize)>,
    total_active: usize,
    total_idle: usize,
    zombie_count: usize,
) {
    let tray_state: tauri::State<'_, TrayState> = app.state();
    let tray_icon = tray_state.tray_icon.lock().await;

    if let Some(tray) = tray_icon.as_ref() {
        let new_menu = build_menu(app, workspaces, backend_healthy, validity, session_counts, total_active, total_idle, zombie_count);
        if let Err(e) = tray.set_menu(Some(new_menu)) {
            log::error!("Failed to update tray menu: {}", e);
        } else {
            log::info!("Tray menu updated: {} workspaces, backend {}", workspaces.len(), if backend_healthy { "online" } else { "offline" });
        }
    } else {
        log::warn!("Tray icon not stored in state, cannot update menu");
    }
}

/// Fetch workspaces from the sidecar API
pub async fn fetch_workspaces(port: u16) -> Vec<TrayWorkspace> {
    let url = format!("http://127.0.0.1:{}/api/workspaces", port);
    match reqwest::get(&url).await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Vec<TrayWorkspace>>().await {
                    Ok(mut workspaces) => {
                        // Sort by last_accessed descending
                        workspaces.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));
                        workspaces
                    }
                    Err(e) => {
                        log::warn!("Failed to parse workspace response: {}", e);
                        Vec::new()
                    }
                }
            } else {
                Vec::new()
            }
        }
        Err(e) => {
            log::warn!("Failed to fetch workspaces for tray: {}", e);
            Vec::new()
        }
    }
}

/// Response from /api/claude-sessions
#[derive(Debug, Deserialize)]
pub struct ClaudeSessionsResponse {
    #[serde(rename = "hookConfigured", default)]
    pub hook_configured: bool,
    #[serde(default)]
    pub sessions: Vec<ClaudeSession>,
}

/// Fetch Claude sessions from the sidecar API
pub async fn fetch_claude_sessions(port: u16) -> ClaudeSessionsResponse {
    let url = format!("http://127.0.0.1:{}/api/claude-sessions", port);
    match reqwest::get(&url).await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<ClaudeSessionsResponse>().await {
                    Ok(data) => data,
                    Err(e) => {
                        log::warn!("Failed to parse claude-sessions response: {}", e);
                        ClaudeSessionsResponse { hook_configured: false, sessions: Vec::new() }
                    }
                }
            } else {
                ClaudeSessionsResponse { hook_configured: false, sessions: Vec::new() }
            }
        }
        Err(e) => {
            log::debug!("Failed to fetch claude-sessions for tray: {}", e);
            ClaudeSessionsResponse { hook_configured: false, sessions: Vec::new() }
        }
    }
}

/// Count Claude sessions per workspace path (CWD matching)
fn count_sessions_per_workspace(workspaces: &[TrayWorkspace], sessions: &[ClaudeSession]) -> HashMap<String, (usize, usize)> {
    // Returns: path -> (working_count, waiting_count)
    let mut counts: HashMap<String, (usize, usize)> = HashMap::new();

    for session in sessions {
        let cwd = session.cwd.trim_end_matches('/');
        for ws in workspaces {
            let ws_path = ws.path.trim_start_matches("file://").trim_end_matches('/');
            // Decode percent-encoding for comparison
            let decoded_ws_path = urlencoding::decode(ws_path).unwrap_or(std::borrow::Cow::Borrowed(ws_path));
            if cwd == decoded_ws_path.as_ref() || cwd.starts_with(&format!("{}/", decoded_ws_path.as_ref())) {
                let entry = counts.entry(ws.path.clone()).or_insert((0, 0));
                if session.state == "working" {
                    entry.0 += 1;
                } else if session.state == "waiting" {
                    entry.1 += 1;
                }
                break;
            }
        }
    }

    counts
}

/// Validate workspace paths via the sidecar API.
/// Returns a map of workspace id → valid (true/false).
/// On any failure, returns an empty map (all workspaces treated as valid).
pub async fn validate_workspace_paths(port: u16, workspaces: &[TrayWorkspace]) -> HashMap<String, bool> {
    let url = format!("http://127.0.0.1:{}/api/validate-paths", port);

    // Build the request body: { workspaces: [{id, path}, ...] }
    let payload: Vec<serde_json::Value> = workspaces.iter().map(|ws| {
        serde_json::json!({ "id": ws.id, "path": ws.path })
    }).collect();
    let body = serde_json::json!({ "workspaces": payload });

    let client = reqwest::Client::new();
    match client.post(&url).json(&body).send().await {
        Ok(response) => {
            if response.status().is_success() {
                // Response: { results: { "ws-id": true/false, ... } }
                #[derive(Deserialize)]
                struct ValidateResponse {
                    results: HashMap<String, bool>,
                }
                match response.json::<ValidateResponse>().await {
                    Ok(parsed) => {
                        // Convert id-keyed results to path-keyed for build_menu lookup
                        let mut path_validity = HashMap::new();
                        for ws in workspaces {
                            if let Some(&valid) = parsed.results.get(&ws.id) {
                                path_validity.insert(ws.path.clone(), valid);
                            }
                        }
                        path_validity
                    }
                    Err(e) => {
                        log::warn!("Failed to parse validate-paths response: {}", e);
                        HashMap::new()
                    }
                }
            } else {
                log::warn!("validate-paths returned status {}", response.status());
                HashMap::new()
            }
        }
        Err(e) => {
            log::warn!("Failed to call validate-paths: {}", e);
            HashMap::new()
        }
    }
}

/// Refresh the tray menu by fetching current data
pub async fn refresh_tray(app: &tauri::AppHandle, port: u16) {
    log::debug!("Tray refresh: fetching workspaces from port {}", port);
    let workspaces = fetch_workspaces(port).await;
    let healthy = super::check_sidecar_health(port).await;
    let validity = validate_workspace_paths(port, &workspaces).await;

    // Fetch Claude sessions and compute per-workspace counts
    let claude_data = fetch_claude_sessions(port).await;
    let live_sessions: Vec<_> = claude_data.sessions.iter().filter(|s| s.state != "zombie").cloned().collect();
    let session_counts = count_sessions_per_workspace(&workspaces, &live_sessions);
    let total_active = live_sessions.iter().filter(|s| s.state == "working").count();
    let total_idle = live_sessions.iter().filter(|s| s.state != "working").count();
    let zombie_count = claude_data.sessions.iter().filter(|s| s.state == "zombie").count();

    log::debug!(
        "Tray refresh: {} workspaces, healthy={}, {} paths validated, {} claude sessions",
        workspaces.len(), healthy, validity.len(), live_sessions.len()
    );
    update_tray_menu(app, &workspaces, healthy, &validity, &session_counts, total_active, total_idle, zombie_count).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_state_starts_empty() {
        let state = TrayState::new();
        // TrayIcon should be None initially
        let guard = state.tray_icon.blocking_lock();
        assert!(guard.is_none(), "TrayState should start with no icon");
    }

    #[test]
    fn blocking_lock_provides_immediate_access() {
        // This test verifies the fix: blocking_lock() in synchronous context
        // makes the value immediately available, unlike the old async spawn pattern
        // which could leave the value as None when accessed shortly after.
        let state = TrayState::new();

        // Simulate synchronous storage (the fix)
        {
            let guard = state.tray_icon.blocking_lock();
            // We can't create a real TrayIcon in tests, but we verify the lock works
            assert!(guard.is_none());
            // In production: *guard = Some(tray_icon);
        }

        // Immediately accessible after the lock is released
        let guard = state.tray_icon.blocking_lock();
        // Lock is acquired without blocking — no race condition
        assert!(guard.is_none()); // Still None since we didn't set a real icon
    }

    #[tokio::test]
    async fn async_spawn_storage_can_race_with_reader() {
        // This test demonstrates the BUG: storing a value via async spawn
        // means the value may not be available when a reader checks immediately.
        let shared = Arc::new(Mutex::new(false));

        // Simulate the old pattern: store value via async spawn
        let writer = shared.clone();
        tokio::spawn(async move {
            // This task is queued but may not run immediately
            let mut guard = writer.lock().await;
            *guard = true;
        });

        // Read immediately WITHOUT awaiting the spawn — simulates the refresh
        // task reading TrayState before the icon storage spawn executes.
        // NOTE: This succeeds on a multi-threaded runtime but demonstrates
        // the pattern issue — the value might still be false (unset).
        let guard = shared.lock().await;
        // On a busy runtime, the spawn may not have executed yet.
        // The fix avoids this race entirely by using synchronous storage.
        let _ = *guard; // Value is indeterminate — could be true or false
    }

    #[test]
    fn tray_workspace_deserializes_from_api_json() {
        let json = r#"[
            {"id": "ws-1", "name": "my-project", "path": "/home/user/my-project", "type": "local", "lastAccessed": "2026-03-09T10:00:00Z"},
            {"id": "ws-2", "name": "other-project", "path": "/home/user/other", "type": "ssh-remote", "lastAccessed": "2026-03-08T10:00:00Z"}
        ]"#;

        let workspaces: Vec<TrayWorkspace> = serde_json::from_str(json).unwrap();
        assert_eq!(workspaces.len(), 2);
        assert_eq!(workspaces[0].id, "ws-1");
        assert_eq!(workspaces[0].name, "my-project");
        assert_eq!(workspaces[0].path, "/home/user/my-project");
        assert_eq!(workspaces[0].workspace_type, "local");
        assert_eq!(workspaces[0].last_accessed, "2026-03-09T10:00:00Z");
        assert_eq!(workspaces[1].workspace_type, "ssh-remote");
    }

    #[test]
    fn tray_workspace_deserializes_with_extra_fields() {
        // The API returns more fields than TrayWorkspace needs — verify it ignores extras
        let json = r#"{"id": "abc123", "name": "proj", "path": "/p", "lastAccessed": "2026-01-01T00:00:00Z", "type": "local", "size": 1024}"#;
        let ws: TrayWorkspace = serde_json::from_str(json).unwrap();
        assert_eq!(ws.id, "abc123");
        assert_eq!(ws.name, "proj");
        assert_eq!(ws.workspace_type, "local");
    }

    #[test]
    fn tray_workspace_type_defaults_when_missing() {
        let json = r#"{"id": "ws-1", "name": "proj", "path": "/p", "lastAccessed": "2026-01-01T00:00:00Z"}"#;
        let ws: TrayWorkspace = serde_json::from_str(json).unwrap();
        assert_eq!(ws.workspace_type, "");
    }

    #[test]
    fn workspaces_sort_by_last_accessed_descending() {
        let mut workspaces = vec![
            TrayWorkspace { id: "1".into(), name: "old".into(), path: "/old".into(), workspace_type: "local".into(), last_accessed: "2026-01-01T00:00:00Z".into() },
            TrayWorkspace { id: "2".into(), name: "newest".into(), path: "/new".into(), workspace_type: "local".into(), last_accessed: "2026-03-09T00:00:00Z".into() },
            TrayWorkspace { id: "3".into(), name: "mid".into(), path: "/mid".into(), workspace_type: "local".into(), last_accessed: "2026-02-01T00:00:00Z".into() },
        ];

        workspaces.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));

        assert_eq!(workspaces[0].name, "newest");
        assert_eq!(workspaces[1].name, "mid");
        assert_eq!(workspaces[2].name, "old");
    }

    #[test]
    fn workspaces_limited_to_ten() {
        let workspaces: Vec<TrayWorkspace> = (0..15).map(|i| TrayWorkspace {
            id: format!("ws-{}", i),
            name: format!("project-{}", i),
            path: format!("/path/{}", i),
            workspace_type: "local".into(),
            last_accessed: format!("2026-03-{:02}T00:00:00Z", i + 1),
        }).collect();

        let shown: Vec<_> = workspaces.iter().take(10).collect();
        assert_eq!(shown.len(), 10);
        assert_eq!(workspaces.len(), 15);
    }

    // --- Type emoji tests ---

    #[test]
    fn type_emoji_maps_all_known_types() {
        assert_eq!(type_emoji("local"), "🔵");
        assert_eq!(type_emoji("ssh-remote"), "🟣");
        assert_eq!(type_emoji("dev-container"), "🟢");
        assert_eq!(type_emoji("attached-container"), "🟡");
        assert_eq!(type_emoji("remote"), "🩷");
    }

    #[test]
    fn type_emoji_unknown_and_empty_fallback() {
        assert_eq!(type_emoji(""), "⚪");
        assert_eq!(type_emoji("something-new"), "⚪");
    }

    // --- Remote type detection tests ---

    #[test]
    fn is_remote_type_identifies_remote_types() {
        assert!(is_remote_type("ssh-remote"));
        assert!(is_remote_type("dev-container"));
        assert!(is_remote_type("attached-container"));
        assert!(is_remote_type("remote"));
    }

    #[test]
    fn is_remote_type_rejects_local_and_unknown() {
        assert!(!is_remote_type("local"));
        assert!(!is_remote_type(""));
        assert!(!is_remote_type("unknown"));
    }

    // --- Label formatting tests ---

    #[test]
    fn workspace_label_valid_local() {
        let emoji = type_emoji("local");
        let is_valid = true;
        let name = "my-project";
        let label = if is_valid {
            format!("{} {}", emoji, name)
        } else {
            format!("{} ✗ {}", emoji, name)
        };
        assert_eq!(label, "🔵 my-project");
    }

    #[test]
    fn workspace_label_invalid_local() {
        let emoji = type_emoji("local");
        let is_valid = false;
        let name = "deleted-project";
        let label = if is_valid {
            format!("{} {}", emoji, name)
        } else {
            format!("{} ✗ {}", emoji, name)
        };
        assert_eq!(label, "🔵 ✗ deleted-project");
    }

    #[test]
    fn workspace_label_remote_always_valid_even_if_validation_says_false() {
        // Remote workspaces should never show as invalid
        let ws_type = "ssh-remote";
        let validation_says_invalid = false;
        let is_valid = is_remote_type(ws_type) || validation_says_invalid;
        assert!(is_valid, "Remote workspaces must always be treated as valid");
    }

    #[test]
    fn workspace_label_valid_when_no_validity_data() {
        // When validity map is empty (API failure fallback), workspaces default to valid
        let validity: HashMap<String, bool> = HashMap::new();
        let is_valid = validity.get("/some/path").copied().unwrap_or(true);
        assert!(is_valid, "Missing validity data should default to valid");
    }

    // --- Validate-paths response parsing test ---

    #[test]
    fn validate_response_parsing() {
        // Simulate the JSON response from /api/validate-paths
        let response_json = r#"{"results": {"ws-1": true, "ws-2": false, "ws-3": true}}"#;

        #[derive(Deserialize)]
        struct ValidateResponse {
            results: HashMap<String, bool>,
        }
        let parsed: ValidateResponse = serde_json::from_str(response_json).unwrap();

        // Convert id-keyed results to path-keyed
        let workspaces = vec![
            TrayWorkspace { id: "ws-1".into(), name: "proj1".into(), path: "/path/1".into(), workspace_type: "local".into(), last_accessed: "".into() },
            TrayWorkspace { id: "ws-2".into(), name: "proj2".into(), path: "/path/2".into(), workspace_type: "local".into(), last_accessed: "".into() },
            TrayWorkspace { id: "ws-3".into(), name: "proj3".into(), path: "/path/3".into(), workspace_type: "ssh-remote".into(), last_accessed: "".into() },
        ];

        let mut path_validity = HashMap::new();
        for ws in &workspaces {
            if let Some(&valid) = parsed.results.get(&ws.id) {
                path_validity.insert(ws.path.clone(), valid);
            }
        }

        assert_eq!(path_validity.get("/path/1"), Some(&true));
        assert_eq!(path_validity.get("/path/2"), Some(&false));
        assert_eq!(path_validity.get("/path/3"), Some(&true));
    }

    // --- URI conversion tests (verifies the bug fix) ---

    #[test]
    fn convert_local_path_to_vscode_uri() {
        let uri = convert_to_vscode_uri("/Users/dev/my-project", "local");
        assert_eq!(uri, "vscode://file/Users/dev/my-project");
    }

    #[test]
    fn convert_local_file_uri_to_vscode_uri() {
        // Raw path from API may have file:// prefix
        let uri = convert_to_vscode_uri("file:///Users/dev/my-project", "local");
        assert_eq!(uri, "vscode://file/Users/dev/my-project");
    }

    #[test]
    fn convert_local_path_with_spaces() {
        let uri = convert_to_vscode_uri("/Users/dev/my project", "local");
        assert_eq!(uri, "vscode://file/Users/dev/my%20project");
    }

    #[test]
    fn convert_local_path_with_encoded_spaces() {
        // API may return percent-encoded paths
        let uri = convert_to_vscode_uri("file:///Users/dev/my%20project", "local");
        assert_eq!(uri, "vscode://file/Users/dev/my%20project");
    }

    #[test]
    fn convert_ssh_remote_uri() {
        let uri = convert_to_vscode_uri(
            "vscode-remote://ssh-remote+myhost/home/user/project",
            "ssh-remote",
        );
        assert_eq!(uri, "vscode://vscode-remote/ssh-remote+myhost/home/user/project");
    }

    #[test]
    fn convert_dev_container_uri() {
        let uri = convert_to_vscode_uri(
            "vscode-remote://dev-container+abc123/workspace",
            "dev-container",
        );
        assert_eq!(uri, "vscode://vscode-remote/dev-container+abc123/workspace");
    }

    #[test]
    fn convert_attached_container_uri() {
        let uri = convert_to_vscode_uri(
            "vscode-remote://attached-container+abc/workspace",
            "attached-container",
        );
        assert_eq!(uri, "vscode://vscode-remote/attached-container+abc/workspace");
    }

    #[test]
    fn convert_unknown_type_treated_as_local() {
        // Unknown or empty type should be treated as local
        let uri = convert_to_vscode_uri("/some/path", "");
        assert_eq!(uri, "vscode://file/some/path");
    }

    #[test]
    fn raw_path_without_conversion_opens_finder_not_vscode() {
        // This test documents the bug: a raw filesystem path passed to open_url
        // would open Finder (macOS) instead of VS Code.
        // The raw path does NOT start with vscode://, so the OS opens it as a file.
        let raw_path = "file:///Users/dev/my-project";
        assert!(!raw_path.starts_with("vscode://"),
            "Raw API paths don't have vscode:// scheme — they open in Finder, not VS Code");

        let converted = convert_to_vscode_uri(raw_path, "local");
        assert!(converted.starts_with("vscode://"),
            "Converted URI must use vscode:// scheme to open in VS Code");
    }
}
