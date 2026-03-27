use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use tauri::Manager;

pub fn create_menu(app: &tauri::AppHandle) -> Menu<tauri::Wry> {
    let app_name = "VS Code Launchpad";

    // macOS specific menu
    #[cfg(target_os = "macos")]
    {
        let app_menu = Submenu::with_items(
            app,
            app_name,
            true,
            &[
                &MenuItem::with_id(app, "app_about", "About", true, None::<&str>).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "app_preferences", "Preferences...", true, Some("Cmd+,")).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "app_hide", "Hide", true, Some("Cmd+H")).unwrap(),
                &MenuItem::with_id(app, "app_hide_others", "Hide Others", true, Some("Cmd+Option+H")).unwrap(),
                &MenuItem::with_id(app, "app_show_all", "Show All", true, None::<&str>).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "app_quit", "Quit", true, Some("Cmd+Q")).unwrap(),
            ],
        ).unwrap();

        let edit_menu = Submenu::with_items(
            app,
            "Edit",
            true,
            &[
                &MenuItem::with_id(app, "edit_undo", "Undo", true, Some("Cmd+Z")).unwrap(),
                &MenuItem::with_id(app, "edit_redo", "Redo", true, Some("Cmd+Shift+Z")).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "edit_cut", "Cut", true, Some("Cmd+X")).unwrap(),
                &MenuItem::with_id(app, "edit_copy", "Copy", true, Some("Cmd+C")).unwrap(),
                &MenuItem::with_id(app, "edit_paste", "Paste", true, Some("Cmd+V")).unwrap(),
                &MenuItem::with_id(app, "edit_select_all", "Select All", true, Some("Cmd+A")).unwrap(),
            ],
        ).unwrap();

        let view_menu = Submenu::with_items(
            app,
            "View",
            true,
            &[
                &MenuItem::with_id(app, "view_reload", "Reload", true, Some("Cmd+R")).unwrap(),
                &MenuItem::with_id(app, "view_toggle_devtools", "Toggle Developer Tools", true, Some("Cmd+Option+I")).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "view_actual_size", "Actual Size", true, Some("Cmd+0")).unwrap(),
                &MenuItem::with_id(app, "view_zoom_in", "Zoom In", true, Some("Cmd+Plus")).unwrap(),
                &MenuItem::with_id(app, "view_zoom_out", "Zoom Out", true, Some("Cmd+-")).unwrap(),
            ],
        ).unwrap();

        let window_menu = Submenu::with_items(
            app,
            "Window",
            true,
            &[
                &MenuItem::with_id(app, "window_minimize", "Minimize", true, Some("Cmd+M")).unwrap(),
                &MenuItem::with_id(app, "window_close", "Close", true, Some("Cmd+W")).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "window_bring_all_to_front", "Bring All to Front", true, None::<&str>).unwrap(),
            ],
        ).unwrap();

        let help_menu = Submenu::with_items(
            app,
            "Help",
            true,
            &[
                &MenuItem::with_id(app, "help_check_updates", "Check for Updates", true, None::<&str>).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "help_documentation", "Documentation", true, None::<&str>).unwrap(),
            ],
        ).unwrap();

        Menu::with_items(app, &[
            &app_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ]).unwrap()
    }

    // Windows/Linux specific menu
    #[cfg(not(target_os = "macos"))]
    {
        let file_menu = Submenu::with_items(
            app,
            "File",
            true,
            &[
                &MenuItem::with_id(app, "app_preferences", "Preferences...", true, None::<&str>).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "app_quit", "Exit", true, None::<&str>).unwrap(),
            ],
        ).unwrap();

        let edit_menu = Submenu::with_items(
            app,
            "Edit",
            true,
            &[
                &MenuItem::with_id(app, "edit_undo", "Undo", true, Some("Ctrl+Z")).unwrap(),
                &MenuItem::with_id(app, "edit_redo", "Redo", true, Some("Ctrl+Y")).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "edit_cut", "Cut", true, Some("Ctrl+X")).unwrap(),
                &MenuItem::with_id(app, "edit_copy", "Copy", true, Some("Ctrl+C")).unwrap(),
                &MenuItem::with_id(app, "edit_paste", "Paste", true, Some("Ctrl+V")).unwrap(),
                &MenuItem::with_id(app, "edit_select_all", "Select All", true, Some("Ctrl+A")).unwrap(),
            ],
        ).unwrap();

        let view_menu = Submenu::with_items(
            app,
            "View",
            true,
            &[
                &MenuItem::with_id(app, "view_reload", "Reload", true, Some("Ctrl+R")).unwrap(),
                &MenuItem::with_id(app, "view_toggle_devtools", "Toggle Developer Tools", true, Some("Ctrl+Shift+I")).unwrap(),
            ],
        ).unwrap();

        let help_menu = Submenu::with_items(
            app,
            "Help",
            true,
            &[
                &MenuItem::with_id(app, "help_check_updates", "Check for Updates", true, None::<&str>).unwrap(),
                &PredefinedMenuItem::separator(app).unwrap(),
                &MenuItem::with_id(app, "app_about", "About", true, None::<&str>).unwrap(),
            ],
        ).unwrap();

        Menu::with_items(app, &[
            &file_menu,
            &edit_menu,
            &view_menu,
            &help_menu,
        ]).unwrap()
    }
}

pub fn handle_menu_event(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        "app_quit" => {
            app.exit(0);
        }
        "app_hide" => {
            if let Some(window) = app.get_webview_window("main") {
                let _: Result<(), _> = window.minimize();
            }
        }
        "window_minimize" => {
            if let Some(window) = app.get_webview_window("main") {
                let _: Result<(), _> = window.minimize();
            }
        }
        "window_close" => {
            if let Some(window) = app.get_webview_window("main") {
                let _: Result<(), _> = window.close();
            }
        }
        "view_reload" => {
            if let Some(window) = app.get_webview_window("main") {
                let _: Result<(), _> = window.eval("window.location.reload()");
            }
        }
        "view_toggle_devtools" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval("if (window.__TAURI_DEVTOOLS__) { window.__TAURI_DEVTOOLS__.toggle() }");
            }
        }
        "help_check_updates" => {
            // Trigger update check
            let _ = app.emit("check-for-updates", ());
        }
        _ => {}
    }
}
