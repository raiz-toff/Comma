package app.comma.tracker.drive

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import app.comma.tracker.CommaApp
import app.comma.tracker.data.Backup
import app.comma.tracker.data.Snapshot
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import com.google.android.gms.tasks.Task
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Google needs the driver to approve access on screen; launch [intent] to ask. */
class NeedsSignIn(val intent: PendingIntent) : Exception("Google Drive needs you to sign in again.")

private class Unauthorized : IOException("Google Drive rejected the sign-in.")

data class RemoteBackup(val id: String, val modifiedAt: Long)

/**
 * Backup to the app's private folder in the driver's own Google Drive (the "appDataFolder"
 * space: hidden from their normal files, invisible to every other app). One file,
 * replaced on each backup. Plain HTTPS calls, no Drive SDK.
 */
object Drive {
    private const val FILE_NAME = "comma-backup.json"
    private const val API = "https://www.googleapis.com/drive/v3/files"
    private const val UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id"
    private val scope = Scope("https://www.googleapis.com/auth/drive.appdata")
    private val json = Json { ignoreUnknownKeys = true }

    @Serializable
    private data class FileList(val files: List<FileEntry> = emptyList())

    @Serializable
    private data class FileEntry(val id: String, val modifiedTime: String = "")

    suspend fun backupNow(app: CommaApp) = withContext(Dispatchers.IO) {
        val bytes = Backup.export(app)
        withToken(app) { token ->
            val old = list(token)
            upload(token, bytes)
            // Only after the new file is safely up are the previous ones removed.
            old.forEach { http("DELETE", "$API/${it.id}", token) }
        }
        app.prefs.setLastBackupAt(System.currentTimeMillis())
        app.prefs.setBackupError(null)
    }

    suspend fun latest(app: CommaApp): RemoteBackup? = withContext(Dispatchers.IO) {
        withToken(app) { token -> list(token).firstOrNull() }
    }

    suspend fun restore(app: CommaApp, backup: RemoteBackup): Snapshot = withContext(Dispatchers.IO) {
        val bytes = withToken(app) { token -> http("GET", "$API/${backup.id}?alt=media", token) }
        Backup.restore(app, bytes)
    }

    /** Finishes a sign-in started from [NeedsSignIn]; throws if access was not granted. */
    fun completeSignIn(context: Context, data: Intent?) {
        val result = Identity.getAuthorizationClient(context).getAuthorizationResultFromIntent(data)
        if (result.accessToken == null) throw IOException("Google Drive access was not granted.")
    }

    private suspend fun token(context: Context): String {
        val request = AuthorizationRequest.builder().setRequestedScopes(listOf(scope)).build()
        val result = Identity.getAuthorizationClient(context).authorize(request).await()
        result.pendingIntent?.let { if (result.hasResolution()) throw NeedsSignIn(it) }
        return result.accessToken ?: throw IOException("Google did not return an access token.")
    }

    /** Runs [block] with a token, refreshing it once if Google says it has expired. */
    private suspend fun <T> withToken(context: Context, block: (String) -> T): T {
        val first = token(context)
        return try {
            block(first)
        } catch (e: Unauthorized) {
            Identity.getAuthorizationClient(context)
                .clearToken(ClearTokenRequest.builder().setToken(first).build()).await()
            block(token(context))
        }
    }

    private fun list(token: String): List<RemoteBackup> {
        val query = URLEncoder.encode("name = '$FILE_NAME' and trashed = false", "UTF-8")
        val body = http(
            "GET",
            "$API?spaces=appDataFolder&q=$query&orderBy=modifiedTime%20desc&fields=files(id,modifiedTime)",
            token,
        )
        return json.decodeFromString(FileList.serializer(), body.decodeToString()).files.map {
            RemoteBackup(it.id, runCatching { Instant.parse(it.modifiedTime).toEpochMilli() }.getOrDefault(0))
        }
    }

    private fun upload(token: String, content: ByteArray) {
        val boundary = "comma-${System.nanoTime()}"
        val body = ByteArrayOutputStream().apply {
            write(
                ("--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
                    "{\"name\":\"$FILE_NAME\",\"parents\":[\"appDataFolder\"]}\r\n" +
                    "--$boundary\r\nContent-Type: application/json\r\n\r\n").encodeToByteArray()
            )
            write(content)
            write("\r\n--$boundary--\r\n".encodeToByteArray())
        }.toByteArray()
        http("POST", UPLOAD, token, body, "multipart/related; boundary=$boundary")
    }

    private fun http(
        method: String,
        url: String,
        token: String,
        body: ByteArray? = null,
        contentType: String? = null,
    ): ByteArray {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000
            connection.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", contentType)
                connection.setFixedLengthStreamingMode(body.size)
                connection.outputStream.use { it.write(body) }
            }
            val code = connection.responseCode
            if (code == 401) throw Unauthorized()
            if (code !in 200..299) {
                val detail = connection.errorStream?.use { it.readBytes().decodeToString() }.orEmpty()
                throw IOException("Google Drive error $code. ${detail.take(200)}")
            }
            return connection.inputStream.use { it.readBytes() }
        } finally {
            connection.disconnect()
        }
    }

    private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
        addOnSuccessListener { continuation.resume(it) }
        addOnFailureListener { continuation.resumeWithException(it) }
    }
}
