package app.comma.tracker.data

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable

/** All times are epoch milliseconds. Money is CAD, distance is kilometres. */
@Serializable
@Entity(tableName = "shifts", indices = [Index("startTime")])
data class Shift(
    @PrimaryKey val id: String,
    val platform: String,
    val startTime: Long,
    val endTime: Long,
    val pausedSeconds: Long = 0,
    val pay: Double = 0.0,
    val tips: Double = 0.0,
    val distanceKm: Double = 0.0,
    val notes: String = "",
) {
    val total: Double get() = pay + tips
    val workedSeconds: Long get() = ((endTime - startTime) / 1000 - pausedSeconds).coerceAtLeast(0)
}

@Serializable
@Entity(tableName = "expenses", indices = [Index("date")])
data class Expense(
    @PrimaryKey val id: String,
    val category: String,
    val amount: Double,
    val date: Long,
    val deductiblePct: Int = 100,
    val note: String = "",
)

/**
 * The shift being recorded right now. One row at most. It lives in the database, not in
 * memory, so a killed process or a reboot never loses a running shift.
 */
@Entity(tableName = "active_shift")
data class ActiveShift(
    @PrimaryKey val id: Int = 1,
    val platform: String,
    val startTime: Long,
    val pausedMs: Long = 0,
    val pausedAt: Long? = null,
    val endedAt: Long? = null,
    val distanceM: Double = 0.0,
) {
    val isPaused: Boolean get() = pausedAt != null
    val isEnded: Boolean get() = endedAt != null
    fun workedMs(now: Long): Long =
        ((endedAt ?: pausedAt ?: now) - startTime - pausedMs).coerceAtLeast(0)
}

data class ShiftTotals(val count: Int, val pay: Double, val tips: Double, val km: Double, val seconds: Long) {
    val total: Double get() = pay + tips
}

data class ExpenseTotals(val total: Double, val deductible: Double)
data class NamedTotal(val name: String, val total: Double)
data class PlatformTotal(val name: String, val total: Double, val seconds: Long)

private const val WORKED = "MAX((endTime - startTime) / 1000 - pausedSeconds, 0)"

@Dao
abstract class CommaDao {
    // Shifts
    @Query("SELECT * FROM shifts ORDER BY startTime DESC")
    abstract fun shifts(): Flow<List<Shift>>

    @Query("SELECT * FROM shifts ORDER BY startTime DESC LIMIT :limit")
    abstract fun recentShifts(limit: Int): Flow<List<Shift>>

    @Query("SELECT * FROM shifts WHERE id = :id")
    abstract suspend fun shift(id: String): Shift?

    @Upsert
    abstract suspend fun saveShift(shift: Shift)

    @Query("DELETE FROM shifts WHERE id = :id")
    abstract suspend fun deleteShift(id: String)

    // Expenses
    @Query("SELECT * FROM expenses ORDER BY date DESC")
    abstract fun expenses(): Flow<List<Expense>>

    @Query("SELECT * FROM expenses WHERE id = :id")
    abstract suspend fun expense(id: String): Expense?

    @Upsert
    abstract suspend fun saveExpense(expense: Expense)

    @Query("DELETE FROM expenses WHERE id = :id")
    abstract suspend fun deleteExpense(id: String)

    // Totals, always computed by SQLite
    @Query(
        "SELECT COUNT(*) AS count, COALESCE(SUM(pay), 0) AS pay, COALESCE(SUM(tips), 0) AS tips, " +
            "COALESCE(SUM(distanceKm), 0) AS km, COALESCE(SUM($WORKED), 0) AS seconds " +
            "FROM shifts WHERE startTime >= :from AND startTime < :to"
    )
    abstract fun shiftTotals(from: Long, to: Long): Flow<ShiftTotals>

    @Query(
        "SELECT platform AS name, SUM(pay + tips) AS total, SUM($WORKED) AS seconds " +
            "FROM shifts WHERE startTime >= :from AND startTime < :to GROUP BY platform ORDER BY total DESC"
    )
    abstract fun platformTotals(from: Long, to: Long): Flow<List<PlatformTotal>>

    /** Earnings grouped by local calendar bucket; [format] is an SQLite strftime pattern. */
    @Query(
        "SELECT strftime(:format, startTime / 1000, 'unixepoch', 'localtime') AS name, SUM(pay + tips) AS total " +
            "FROM shifts WHERE startTime >= :from AND startTime < :to GROUP BY name"
    )
    abstract fun earningsBuckets(format: String, from: Long, to: Long): Flow<List<NamedTotal>>

    @Query(
        "SELECT COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(amount * deductiblePct / 100.0), 0) AS deductible " +
            "FROM expenses WHERE date >= :from AND date < :to"
    )
    abstract fun expenseTotals(from: Long, to: Long): Flow<ExpenseTotals>

    @Query(
        "SELECT category AS name, SUM(amount) AS total FROM expenses " +
            "WHERE date >= :from AND date < :to GROUP BY category ORDER BY total DESC"
    )
    abstract fun categoryTotals(from: Long, to: Long): Flow<List<NamedTotal>>

    /** Re-emits on every write to either table; the automatic backup listens to it. */
    @Query("SELECT (SELECT COUNT(*) FROM shifts) + (SELECT COUNT(*) FROM expenses)")
    abstract fun rowCount(): Flow<Int>

    @Query("SELECT (SELECT COUNT(*) FROM shifts) + (SELECT COUNT(*) FROM expenses)")
    abstract suspend fun rowCountNow(): Int

    // Active shift
    @Query("SELECT * FROM active_shift WHERE id = 1")
    abstract fun active(): Flow<ActiveShift?>

    @Query("SELECT * FROM active_shift WHERE id = 1")
    abstract suspend fun activeNow(): ActiveShift?

    @Upsert
    abstract suspend fun saveActive(active: ActiveShift)

    @Query("UPDATE active_shift SET distanceM = distanceM + :metres WHERE id = 1 AND pausedAt IS NULL AND endedAt IS NULL")
    abstract suspend fun addDistance(metres: Double)

    @Query("DELETE FROM active_shift")
    abstract suspend fun clearActive()

    @Transaction
    open suspend fun finishShift(shift: Shift) {
        saveShift(shift)
        clearActive()
    }

    // Backup and restore
    @Query("SELECT * FROM shifts")
    abstract suspend fun allShifts(): List<Shift>

    @Query("SELECT * FROM expenses")
    abstract suspend fun allExpenses(): List<Expense>

    @Upsert
    abstract suspend fun saveShifts(shifts: List<Shift>)

    @Upsert
    abstract suspend fun saveExpenses(expenses: List<Expense>)

    @Query("DELETE FROM shifts")
    abstract suspend fun deleteAllShifts()

    @Query("DELETE FROM expenses")
    abstract suspend fun deleteAllExpenses()

    @Transaction
    open suspend fun replaceAll(shifts: List<Shift>, expenses: List<Expense>) {
        deleteAllShifts()
        deleteAllExpenses()
        saveShifts(shifts)
        saveExpenses(expenses)
    }
}

// Changing an entity means raising the version AND writing a Migration, or existing
// installs lose their data.
@Database(entities = [Shift::class, Expense::class, ActiveShift::class], version = 1, exportSchema = false)
abstract class CommaDb : RoomDatabase() {
    abstract fun dao(): CommaDao
}
