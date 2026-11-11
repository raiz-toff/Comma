package app.comma.tracker.data

import android.os.Build
import app.comma.tracker.CommaApp
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The whole backup: one JSON file. Unknown fields are ignored on read and every field
 * has a default, so a file written by a newer or older version of the app still opens.
 */
@Serializable
data class Snapshot(
    val format: Int = 1,
    val exportedAt: Long = 0,
    val device: String = "",
    val platforms: List<String> = emptyList(),
    val shifts: List<Shift> = emptyList(),
    val expenses: List<Expense> = emptyList(),
)

object Backup {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    suspend fun export(app: CommaApp): ByteArray {
        val snapshot = Snapshot(
            exportedAt = System.currentTimeMillis(),
            device = Build.MODEL ?: "",
            platforms = app.prefs.platforms.value,
            shifts = app.dao.allShifts(),
            expenses = app.dao.allExpenses(),
        )
        return json.encodeToString(Snapshot.serializer(), snapshot).encodeToByteArray()
    }

    /** Parses first, and only then replaces what is on the phone, in one transaction. */
    suspend fun restore(app: CommaApp, bytes: ByteArray): Snapshot {
        val snapshot = try {
            json.decodeFromString(Snapshot.serializer(), bytes.decodeToString())
        } catch (e: Exception) {
            throw IllegalArgumentException("That file is not a Comma backup.", e)
        }
        app.dao.replaceAll(snapshot.shifts, snapshot.expenses)
        if (snapshot.platforms.isNotEmpty()) app.prefs.setPlatforms(snapshot.platforms)
        return snapshot
    }
}
