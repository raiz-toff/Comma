package app.comma.tracker.drive

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.comma.tracker.CommaApp
import java.io.IOException
import java.util.concurrent.TimeUnit

/** The automatic backup: runs a few minutes after the last change, once there is a network. */
class BackupWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as CommaApp
        if (!app.prefs.driveConnected.value) return Result.success()
        // Never replace a good backup with an empty phone (a fresh install before restoring).
        if (app.dao.rowCountNow() == 0) return Result.success()
        return try {
            Drive.backupNow(app)
            Result.success()
        } catch (e: NeedsSignIn) {
            app.prefs.setBackupError("Google Drive needs you to sign in again.")
            Result.failure()
        } catch (e: IOException) {
            app.prefs.setBackupError(e.message ?: "Backup could not reach Google Drive.")
            if (runAttemptCount < 5) Result.retry() else Result.failure()
        } catch (e: Exception) {
            app.prefs.setBackupError(e.message ?: "Backup failed.")
            Result.failure()
        }
    }

    companion object {
        fun schedule(context: Context) {
            val request = OneTimeWorkRequestBuilder<BackupWorker>()
                .setInitialDelay(5, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork("drive-backup", ExistingWorkPolicy.REPLACE, request)
        }
    }
}
