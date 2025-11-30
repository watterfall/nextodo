use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub version: String,
    pub locale: String,
}

/// Data file types for cold/hot separation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DataFileType {
    Active,
    Archive,
    PomodoroHistory,
}

impl DataFileType {
    pub fn filename(&self) -> &'static str {
        match self {
            DataFileType::Active => "active.json",
            DataFileType::Archive => "archive.json",
            DataFileType::PomodoroHistory => "pomodoro_history.json",
        }
    }

    pub fn temp_filename(&self) -> String {
        format!("{}.tmp", self.filename())
    }
}

/// Get the application data directory path
#[tauri::command]
pub fn get_app_data_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    let path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // Ensure directory exists
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }

    Ok(path.to_string_lossy().to_string())
}

/// Get all data file paths
#[tauri::command]
pub fn get_data_file_paths(app_handle: tauri::AppHandle) -> Result<DataFilePaths, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // Ensure directory exists
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    }

    Ok(DataFilePaths {
        active: data_dir.join(DataFileType::Active.filename()).to_string_lossy().to_string(),
        archive: data_dir.join(DataFileType::Archive.filename()).to_string_lossy().to_string(),
        pomodoro_history: data_dir.join(DataFileType::PomodoroHistory.filename()).to_string_lossy().to_string(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataFilePaths {
    pub active: String,
    pub archive: String,
    pub pomodoro_history: String,
}

/// Atomic write - write to temp file then rename
/// This prevents data corruption from incomplete writes
#[tauri::command]
pub fn atomic_write_file(
    app_handle: tauri::AppHandle,
    file_type: String,
    content: String,
) -> Result<(), String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // Ensure directory exists
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    }

    let file_type = match file_type.as_str() {
        "active" => DataFileType::Active,
        "archive" => DataFileType::Archive,
        "pomodoro_history" => DataFileType::PomodoroHistory,
        _ => return Err(format!("Unknown file type: {}", file_type)),
    };

    let final_path = data_dir.join(file_type.filename());
    let temp_path = data_dir.join(file_type.temp_filename());

    // Step 1: Write to temporary file
    {
        let mut temp_file = fs::File::create(&temp_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;

        temp_file
            .write_all(content.as_bytes())
            .map_err(|e| format!("Failed to write to temp file: {}", e))?;

        // Ensure data is flushed to disk
        temp_file
            .sync_all()
            .map_err(|e| format!("Failed to sync temp file: {}", e))?;
    }

    // Step 2: Atomic rename (replaces existing file)
    fs::rename(&temp_path, &final_path)
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;

    Ok(())
}

/// Read a data file
#[tauri::command]
pub fn read_data_file(
    app_handle: tauri::AppHandle,
    file_type: String,
) -> Result<Option<String>, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let file_type = match file_type.as_str() {
        "active" => DataFileType::Active,
        "archive" => DataFileType::Archive,
        "pomodoro_history" => DataFileType::PomodoroHistory,
        _ => return Err(format!("Unknown file type: {}", file_type)),
    };

    let file_path = data_dir.join(file_type.filename());

    if !file_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(Some(content))
}

/// Create a backup of the current data files
#[tauri::command]
pub fn backup_data(app_handle: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // Create backup directory with timestamp
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let backup_dir = data_dir.join(format!("backup_{}", timestamp));
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    // Copy all data files
    let files = [
        DataFileType::Active,
        DataFileType::Archive,
        DataFileType::PomodoroHistory,
    ];

    let mut backed_up = Vec::new();
    for file_type in files {
        let source = data_dir.join(file_type.filename());
        if source.exists() {
            let dest = backup_dir.join(file_type.filename());
            fs::copy(&source, &dest).map_err(|e| e.to_string())?;
            backed_up.push(file_type.filename());
        }
    }

    // Also backup legacy file if it exists
    let legacy_source = data_dir.join("focusflow_data.json");
    if legacy_source.exists() {
        let legacy_dest = backup_dir.join("focusflow_data.json");
        fs::copy(&legacy_source, &legacy_dest).map_err(|e| e.to_string())?;
        backed_up.push("focusflow_data.json");
    }

    Ok(format!(
        "Backup created at: {} (files: {})",
        backup_dir.to_string_lossy(),
        backed_up.join(", ")
    ))
}

/// Migrate from legacy single file to separated files
#[tauri::command]
pub fn migrate_legacy_data(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let legacy_path = data_dir.join("focusflow_data.json");
    let active_path = data_dir.join(DataFileType::Active.filename());

    // Check if migration is needed
    if !legacy_path.exists() || active_path.exists() {
        return Ok(false); // No migration needed
    }

    // Read legacy data
    let legacy_content = fs::read_to_string(&legacy_path)
        .map_err(|e| format!("Failed to read legacy file: {}", e))?;

    let legacy_data: serde_json::Value = serde_json::from_str(&legacy_content)
        .map_err(|e| format!("Failed to parse legacy file: {}", e))?;

    // Extract and write separated data
    // Active data (tasks, settings, etc.)
    let active_data = serde_json::json!({
        "version": legacy_data.get("version").unwrap_or(&serde_json::json!("2.0")),
        "lastModified": legacy_data.get("lastModified"),
        "tasks": legacy_data.get("tasks").unwrap_or(&serde_json::json!([])),
        "trash": legacy_data.get("trash").unwrap_or(&serde_json::json!([])),
        "reviews": legacy_data.get("reviews").unwrap_or(&serde_json::json!([])),
        "customTagGroups": legacy_data.get("customTagGroups"),
        "settings": legacy_data.get("settings")
    });

    // Archive data
    let archive_data = serde_json::json!({
        "version": "2.0",
        "lastModified": legacy_data.get("lastModified"),
        "tasks": legacy_data.get("archive").unwrap_or(&serde_json::json!([]))
    });

    // Pomodoro history
    let pomodoro_data = serde_json::json!({
        "version": "2.0",
        "lastModified": legacy_data.get("lastModified"),
        "sessions": legacy_data.get("pomodoroHistory").unwrap_or(&serde_json::json!([]))
    });

    // Write separated files atomically
    let write_atomic = |path: &PathBuf, data: &serde_json::Value| -> Result<(), String> {
        let temp_path = path.with_extension("json.tmp");
        let content = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Failed to serialize: {}", e))?;

        {
            let mut file = fs::File::create(&temp_path)
                .map_err(|e| format!("Failed to create temp file: {}", e))?;
            file.write_all(content.as_bytes())
                .map_err(|e| format!("Failed to write temp file: {}", e))?;
            file.sync_all()
                .map_err(|e| format!("Failed to sync temp file: {}", e))?;
        }

        fs::rename(&temp_path, path)
            .map_err(|e| format!("Failed to rename: {}", e))?;

        Ok(())
    };

    write_atomic(&data_dir.join(DataFileType::Active.filename()), &active_data)?;
    write_atomic(&data_dir.join(DataFileType::Archive.filename()), &archive_data)?;
    write_atomic(&data_dir.join(DataFileType::PomodoroHistory.filename()), &pomodoro_data)?;

    // Rename legacy file to indicate migration complete
    let migrated_path = data_dir.join("focusflow_data.migrated.json");
    fs::rename(&legacy_path, &migrated_path)
        .map_err(|e| format!("Failed to rename legacy file: {}", e))?;

    Ok(true)
}

/// Get system information
#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        version: std::env::consts::ARCH.to_string(),
        locale: sys_locale::get_locale().unwrap_or_else(|| "en-US".to_string()),
    }
}

/// Trigger a reload event to frontend
#[tauri::command]
pub fn trigger_reload(app_handle: tauri::AppHandle, file_type: String) -> Result<(), String> {
    use tauri::Emitter;

    app_handle
        .emit("data-file-changed", file_type)
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}
