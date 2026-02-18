use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;
use tokio::time::interval;
use tauri_plugin_shell::ShellExt;

mod menu;
mod tray;
mod window_state;

// Tauri command to open VS Code: with a URI
#[tauri::command]
async fn open_vscode(app: AppHandle, uri: String) -> Result<(), String> {
    app.shell()
        .open(&uri, None)
        .map_err(|e| format!("Failed to open VS Code: {}", e))?;
    Ok(())
}

// Sidecar state management
pub struct SidecarState {
    pub sidecar_port: u16,
    pub restart_attempts: Arc<Mutex<u32>>,
    pub last_restart: Arc<Mutex<std::time::Instant>>,
}

impl SidecarState {
    pub fn new() -> Self {
        Self {
            sidecar_port: std::env::var("DASHBOARD_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3010),
            restart_attempts: Arc::new(Mutex::new(0)),
            last_restart: Arc::new(Mutex::new(std::time::Instant::now())),
        }
    }
}

// Health check function
async fn check_sidecar_health(port: u16) -> bool {
    match reqwest::get(format!("http://127.0.0.1:{}/health", port)).await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

// Spawn sidecar process
fn spawn_sidecar(app: &AppHandle, port: u16) -> Result<std::process::Child, String> {
    // In dev mode, the resource directory is different - use the project root
    let sidecar_path = if cfg!(dev) {
        // In dev mode, look for the binary relative to the project root
        // current_dir() is the workspace root, binaries are in src-tauri/binaries/
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current dir: {}", e))?
            .join("binaries")
            .join(if cfg!(target_os = "macos") {
                if cfg!(target_arch = "aarch64") {
                    "sidecar-vscode-dashboard-aarch64-apple-darwin"
                } else {
                    "sidecar-vscode-dashboard-macos-x64"
                }
            } else if cfg!(target_os = "windows") {
                "sidecar-vscode-dashboard-win-x64.exe"
            } else {
                "sidecar-vscode-dashboard-linux-x64"
            })
    } else {
        // In production, use the resource directory
        app.path()
            .resolve(
                "binaries/sidecar-vscode-dashboard",
                tauri::path::BaseDirectory::Resource,
            )
            .map_err(|e| format!("Failed to resolve sidecar path: {}", e))?
    };

    log::info!("Attempting to spawn sidecar from: {:?}", sidecar_path);

    let mut command = std::process::Command::new(&sidecar_path);
    command.env("DASHBOARD_PORT", port.to_string());
    command.env("PORT", port.to_string()); // Backward compatibility
    command.env("HOST", "127.0.0.1");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))
}

// Start health monitoring
async fn start_health_monitor(app: AppHandle, port: u16) {
    let mut interval = interval(Duration::from_secs(5));
    let state: State<SidecarState> = app.state();

    loop {
        interval.tick().await;

        if !check_sidecar_health(port).await {
            log::warn!("Sidecar health check failed, attempting restart...");

            let mut attempts = state.restart_attempts.lock().await;
            let mut last_restart = state.last_restart.lock().await;

            // Reset attempts if more than 60 seconds have passed
            if last_restart.elapsed().as_secs() > 60 {
                *attempts = 0;
            }

            if *attempts >= 3 {
                log::error!("Sidecar restart limit exceeded");
                let _ = app.emit(
                    "sidecar-error",
                    serde_json::json!({
                        "message": "Failed to start backend service after multiple attempts"
                    }),
                );
                break;
            }

            *attempts += 1;
            *last_restart = std::time::Instant::now();

            // Try to spawn sidecar
            match spawn_sidecar(&app, port) {
                Ok(_) => {
                    log::info!("Sidecar restarted successfully");
                    let _ = app.emit(
                        "sidecar-restarted",
                        serde_json::json!({ "message": "Backend service restarted" }),
                    );
                }
                Err(e) => {
                    log::error!("Failed to restart sidecar: {}", e);
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidecarState::new())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Get sidecar port from state
            let state: State<SidecarState> = app.state();
            let port = state.sidecar_port;

            // Spawn sidecar on startup
            match spawn_sidecar(app.app_handle(), port) {
                Ok(mut child) => {
                    log::info!("Sidecar spawned successfully on port {}", port);

                    // Store child process for cleanup
                    app.manage(Arc::new(Mutex::new(child)));

                    // Start health monitoring
                    let app_handle = app.app_handle().clone();
                    tauri::async_runtime::spawn(async move {
                        // Wait a bit for sidecar to start
                        tokio::time::sleep(Duration::from_secs(2)).await;
                        start_health_monitor(app_handle, port).await;
                    });
                }
                Err(e) => {
                    log::error!("Failed to spawn sidecar: {}", e);
                }
            }

            // Restore window state
            if let Some(window) = app.get_webview_window("main") {
                window_state::restore_window_state(app.app_handle(), &window);
            }

            // Create menu
            let menu = menu::create_menu(app.app_handle());
            app.set_menu(menu)?;

            // Create tray icon
            let _ = tray::create_tray(app.app_handle());

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event);
        })
        .on_window_event(|app, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Save window state
                if let Some(window) = app.get_webview_window("main") {
                    window_state::save_window_state(app.app_handle(), &window);
                }

                // Gracefully shutdown sidecar
                if let Some(child) = app.try_state::<Arc<Mutex<std::process::Child>>>() {
                    let mut child = child.blocking_lock();
                    let _ = child.kill();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![open_vscode])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
