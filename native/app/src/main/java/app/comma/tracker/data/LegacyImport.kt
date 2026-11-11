package app.comma.tracker.data

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import app.comma.tracker.CommaApp
import java.io.File

/**
 * One-time import from the React Native version of Comma, whose database sits in the same
 * app data folder when this app is installed as an update over it. The old file is only
 * read, never changed or deleted.
 */
object LegacyImport {
    private val platformLabels = mapOf(
        "doordash" to "DoorDash", "ubereats" to "Uber Eats", "skip" to "SkipTheDishes",
        "foodora" to "Foodora", "instacart" to "Instacart", "lyft" to "Lyft", "uber" to "Uber",
        "amazonflex" to "Amazon Flex", "other" to "Other",
    )

    private val categoryIds = mapOf(
        "fuel" to "fuel", "maintenance" to "maintenance", "bike_maintenance" to "maintenance",
        "insurance" to "insurance", "licensing" to "licensing", "interest" to "financing",
        "leasing" to "financing", "phone" to "phone", "data_plan" to "phone", "parking" to "parking",
        "tolls" to "parking", "wash" to "wash", "supplies" to "supplies", "software" to "supplies",
        "meals" to "meals", "fees" to "fees", "bank_fees" to "fees", "accounting" to "fees",
    )

    /** Returns a sentence describing what was imported, or null when there was nothing to do. */
    suspend fun runOnce(app: CommaApp): String? {
        if (app.prefs.legacyImportDone) return null
        val file = File(app.filesDir, "SQLite/comma.db")
        if (!file.exists() || app.dao.rowCountNow() > 0) {
            app.prefs.legacyImportDone = true
            return null
        }
        return try {
            val (shifts, expenses) = read(file)
            app.dao.saveShifts(shifts)
            app.dao.saveExpenses(expenses)
            app.prefs.legacyImportDone = true
            if (shifts.isEmpty() && expenses.isEmpty()) null
            else "Brought over ${shifts.size} shifts and ${expenses.size} expenses from the previous Comma."
        } catch (e: Exception) {
            // Leave the flag unset so the next launch tries again; the old file is untouched.
            null
        }
    }

    private fun read(file: File): Pair<List<Shift>, List<Expense>> {
        val db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READWRITE)
        try {
            val shifts = buildList {
                db.rawQuery(
                    "SELECT * FROM shifts WHERE sync_deleted_at IS NULL AND is_demo = 0 " +
                        "AND reconciliation_status != 'tracking'", null
                ).use { c ->
                    while (c.moveToNext()) {
                        val start = millis(c.long("start_time"))
                        val end = millis(c.long("end_time"))
                        if (start <= 0 || end < start) continue
                        val gps = c.double("active_mileage") + c.double("dead_mileage")
                        val platform = c.string("platform")
                        add(
                            Shift(
                                id = c.string("id"),
                                platform = platformLabels[platform]
                                    ?: platform.replaceFirstChar { it.uppercase() }.ifBlank { "Other" },
                                startTime = start,
                                endTime = end,
                                pausedSeconds = c.long("paused_seconds"),
                                pay = c.double("gross_revenue") + c.double("bonus_amount"),
                                tips = c.double("tips_revenue"),
                                distanceKm = if (gps > 0) gps else c.double("tracked_mileage"),
                                notes = c.string("notes"),
                            )
                        )
                    }
                }
            }
            val expenses = buildList {
                db.rawQuery("SELECT * FROM expenses WHERE sync_deleted_at IS NULL AND is_demo = 0", null).use { c ->
                    while (c.moveToNext()) {
                        val merchant = c.string("merchant")
                        val notes = c.string("notes")
                        add(
                            Expense(
                                id = c.string("id"),
                                category = categoryIds[c.string("category")] ?: "other",
                                amount = c.double("amount"),
                                date = millis(c.long("date")),
                                deductiblePct = c.double("deductible_pct").toInt().coerceIn(0, 100),
                                note = listOf(merchant, notes).filter { it.isNotBlank() }.joinToString(" · "),
                            )
                        )
                    }
                }
            }
            return shifts to expenses
        } finally {
            db.close()
        }
    }

    /** The old app stored seconds; tolerate rows that already hold milliseconds. */
    private fun millis(value: Long): Long = if (value in 1 until 100_000_000_000L) value * 1000 else value

    private fun Cursor.string(name: String): String =
        getColumnIndex(name).let { if (it < 0 || isNull(it)) "" else getString(it) }

    private fun Cursor.long(name: String): Long =
        getColumnIndex(name).let { if (it < 0 || isNull(it)) 0 else getLong(it) }

    private fun Cursor.double(name: String): Double =
        getColumnIndex(name).let { if (it < 0 || isNull(it)) 0.0 else getDouble(it) }
}
