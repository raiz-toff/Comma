package app.comma.tracker.data

import android.content.Context
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

val DEFAULT_PLATFORMS = listOf("Uber Eats", "DoorDash", "SkipTheDishes", "Instacart", "Uber", "Lyft")

/** Small device settings. Observable so the UI updates as soon as one changes. */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("comma", Context.MODE_PRIVATE)

    private val _theme = MutableStateFlow(sp.getString("theme", "system") ?: "system")
    /** "system", "light" or "dark". */
    val theme: StateFlow<String> = _theme
    fun setTheme(value: String) {
        sp.edit { putString("theme", value) }
        _theme.value = value
    }

    private val _platforms = MutableStateFlow(
        sp.getString("platforms", null)?.split('\n')?.filter { it.isNotBlank() } ?: DEFAULT_PLATFORMS
    )
    val platforms: StateFlow<List<String>> = _platforms
    fun setPlatforms(value: List<String>) {
        sp.edit { putString("platforms", value.joinToString("\n")) }
        _platforms.value = value
    }

    var lastPlatform: String?
        get() = sp.getString("lastPlatform", null)
        set(value) = sp.edit { putString("lastPlatform", value) }

    private val _driveConnected = MutableStateFlow(sp.getBoolean("driveConnected", false))
    val driveConnected: StateFlow<Boolean> = _driveConnected
    fun setDriveConnected(value: Boolean) {
        sp.edit { putBoolean("driveConnected", value) }
        _driveConnected.value = value
    }

    private val _lastBackupAt = MutableStateFlow(sp.getLong("lastBackupAt", 0))
    val lastBackupAt: StateFlow<Long> = _lastBackupAt
    fun setLastBackupAt(value: Long) {
        sp.edit { putLong("lastBackupAt", value) }
        _lastBackupAt.value = value
    }

    private val _backupError = MutableStateFlow(sp.getString("backupError", null))
    /** Why the last automatic backup failed, or null when it worked. */
    val backupError: StateFlow<String?> = _backupError
    fun setBackupError(value: String?) {
        sp.edit { putString("backupError", value) }
        _backupError.value = value
    }

    var legacyImportDone: Boolean
        get() = sp.getBoolean("legacyImportDone", false)
        set(value) = sp.edit { putBoolean("legacyImportDone", value) }
}
