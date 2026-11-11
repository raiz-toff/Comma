package app.comma.tracker

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.room.Room
import app.comma.tracker.data.CommaDao
import app.comma.tracker.data.CommaDb
import app.comma.tracker.data.LegacyImport
import app.comma.tracker.data.Prefs
import app.comma.tracker.drive.BackupWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch

class CommaApp : Application() {
    /** Outlives any screen, so a save is never cancelled by navigating away. */
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    lateinit var prefs: Prefs
        private set
    lateinit var db: CommaDb
        private set
    val dao: CommaDao get() = db.dao()

    /** A one-off message for the next screen to show, e.g. the result of the import. */
    val notice = MutableStateFlow<String?>(null)

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        db = Room.databaseBuilder(this, CommaDb::class.java, "comma-native.db").build()

        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(TRACKING_CHANNEL, "Shift tracking", NotificationManager.IMPORTANCE_LOW)
                .apply { description = "Shown while a shift is being recorded." }
        )

        scope.launch {
            notice.value = LegacyImport.runOnce(this@CommaApp)
            // Any later change to shifts or expenses queues a Drive backup.
            dao.rowCount().drop(1).collect {
                if (prefs.driveConnected.value) BackupWorker.schedule(this@CommaApp)
            }
        }
    }

    companion object {
        const val TRACKING_CHANNEL = "tracking"
    }
}
