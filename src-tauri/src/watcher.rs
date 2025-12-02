use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher, EventKind};
use std::sync::atomic::Ordering;
use std::sync::mpsc::channel;
use std::sync::Arc;
use std::time::Duration;
use std::collections::HashSet;
use tauri::{AppHandle, Emitter, Manager};

use crate::WatcherState;

/// Data files to watch
const WATCHED_FILES: &[&str] = &["active.json", "archive.json", "pomodoro_history.json"];

/// Start watching the data files for external changes
pub fn start_watcher(app_handle: AppHandle, watcher_state: Arc<WatcherState>) -> notify::Result<()> {
    let (tx, rx) = channel();

    let mut watcher = RecommendedWatcher::new(
        move |res| {
            if let Err(e) = tx.send(res) {
                eprintln!("Error sending file event: {}", e);
            }
        },
        Config::default().with_poll_interval(Duration::from_secs(1)),
    )?;

    // Get app data directory
    if let Ok(data_dir) = app_handle.path().app_data_dir() {
        // Ensure directory exists
        if !data_dir.exists() {
            std::fs::create_dir_all(&data_dir).ok();
        }

        // Watch the data directory
        watcher.watch(data_dir.as_path(), RecursiveMode::NonRecursive)?;

        println!("Watching for file changes in: {:?}", data_dir);
        println!("Monitored files: {:?}", WATCHED_FILES);

        // Track recently emitted events to avoid duplicates
        let mut recent_events: HashSet<String> = HashSet::new();

        // Process events
        loop {
            match rx.recv() {
                Ok(event) => {
                    if let Ok(event) = event {
                        // Check if watcher is paused (during DnD operations)
                        if watcher_state.paused.load(Ordering::SeqCst) {
                            continue;
                        }

                        // Only process modify/create events
                        let is_write_event = matches!(
                            event.kind,
                            EventKind::Modify(_) | EventKind::Create(_)
                        );

                        if !is_write_event {
                            continue;
                        }

                        // Check if the changed file is one of our data files
                        for path in &event.paths {
                            if let Some(file_name) = path.file_name() {
                                let file_name_str = file_name.to_string_lossy().to_string();

                                // Skip temp files
                                if file_name_str.ends_with(".tmp") {
                                    continue;
                                }

                                // Check if it's a watched file
                                if let Some(file_type) = get_file_type(&file_name_str) {
                                    // Double-check pause state before emitting
                                    if watcher_state.paused.load(Ordering::SeqCst) {
                                        println!("Skipping file change (watcher paused): {} (type: {})", file_name_str, file_type);
                                        continue;
                                    }

                                    // Deduplicate events (same file within short period)
                                    let event_key = format!("{}:{}", file_type, std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .map(|d| d.as_secs() / 2) // 2-second window
                                        .unwrap_or(0));

                                    if recent_events.contains(&event_key) {
                                        continue;
                                    }
                                    recent_events.insert(event_key.clone());

                                    // Clean up old events
                                    if recent_events.len() > 100 {
                                        recent_events.clear();
                                    }

                                    println!("Data file changed externally: {} (type: {})", file_name_str, file_type);

                                    // Emit event to frontend with file type
                                    if let Err(e) = app_handle.emit("data-file-changed", file_type) {
                                        eprintln!("Failed to emit event: {}", e);
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Watch error: {}", e);
                    break;
                }
            }
        }
    }

    Ok(())
}

/// Get file type from filename
fn get_file_type(filename: &str) -> Option<&'static str> {
    match filename {
        "active.json" => Some("active"),
        "archive.json" => Some("archive"),
        "pomodoro_history.json" => Some("pomodoro_history"),
        // Legacy file for backwards compatibility
        "focusflow_data.json" => Some("legacy"),
        _ => None,
    }
}
