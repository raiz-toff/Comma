package app.comma.tracker.tracking

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import app.comma.tracker.CommaApp
import app.comma.tracker.MainActivity
import app.comma.tracker.R
import app.comma.tracker.data.ActiveShift
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Records distance while a shift runs. It holds no state of its own: the active_shift row
 * says whether a shift is running, paused or over, and this service only follows it. The
 * screens change that row and then call [sync]; if Android restarts the service, it reads
 * the row and carries on.
 */
class TrackingService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val dao get() = (application as CommaApp).dao
    private lateinit var client: FusedLocationProviderClient
    private var listening = false
    private var anchor: Location? = null

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.locations.forEach(::onFix)
        }
    }

    override fun onCreate() {
        super.onCreate()
        client = LocationServices.getFusedLocationProviderClient(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            ServiceCompat.startForeground(
                this, NOTIFICATION_ID, notification(null), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } catch (e: Exception) {
            // Android refuses a location service without the permission, or one restarted
            // from the background. The shift's timer still runs; opening the app resumes GPS.
            stopSelf()
            return START_NOT_STICKY
        }
        scope.launch { follow() }
        return START_STICKY
    }

    override fun onDestroy() {
        stopListening()
        scope.cancel()
        super.onDestroy()
    }

    private suspend fun follow() {
        val active = dao.activeNow()
        if (active == null || active.isEnded) {
            stopListening()
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }
        if (active.isPaused) stopListening() else startListening()
        show(active)
    }

    private fun startListening() {
        if (listening) return
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5_000L)
            .setMinUpdateDistanceMeters(10f)
            .build()
        try {
            client.requestLocationUpdates(request, callback, Looper.getMainLooper())
            listening = true
        } catch (e: SecurityException) {
            // Permission was taken away mid-shift; keep the timer, record no distance.
        }
    }

    private fun stopListening() {
        if (listening) client.removeLocationUpdates(callback)
        listening = false
        anchor = null // distance covered while paused is not counted
    }

    private fun onFix(fix: Location) {
        if (fix.accuracy > MAX_ACCURACY_M) return
        val from = anchor
        if (from == null) {
            anchor = fix
            return
        }
        val metres = from.distanceTo(fix)
        val seconds = (fix.elapsedRealtimeNanos - from.elapsedRealtimeNanos) / 1e9
        if (seconds <= 0) return
        // Parked or waiting: GPS wanders a few metres. Keep the anchor and count nothing.
        if (metres < maxOf(MIN_STEP_M, fix.accuracy)) return
        anchor = fix
        // A jump no vehicle could make is a bad fix: move the anchor, don't count the jump.
        if (metres / seconds > MAX_SPEED_MPS) return
        scope.launch {
            dao.addDistance(metres.toDouble())
            dao.activeNow()?.let(::show)
        }
    }

    private fun show(active: ActiveShift) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED || android.os.Build.VERSION.SDK_INT < 33
        ) {
            NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification(active))
        }
    }

    private fun notification(active: ActiveShift?): Notification {
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val builder = NotificationCompat.Builder(this, CommaApp.TRACKING_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat)
            .setContentTitle(if (active?.isPaused == true) "Shift paused" else "Shift running")
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        if (active != null) {
            val km = String.format(Locale.CANADA, "%.1f km", active.distanceM / 1000)
            builder.setContentText("${active.platform} · $km")
            if (!active.isPaused) {
                val now = System.currentTimeMillis()
                builder.setUsesChronometer(true).setWhen(now - active.workedMs(now))
            } else {
                builder.setShowWhen(false)
            }
        }
        return builder.build()
    }

    companion object {
        private const val NOTIFICATION_ID = 1
        private const val MAX_ACCURACY_M = 50f
        private const val MIN_STEP_M = 15f
        private const val MAX_SPEED_MPS = 42.0 // about 150 km/h

        fun hasLocationPermission(context: Context): Boolean =
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED

        /**
         * Call after any change to the active shift (start, pause, resume, end, discard).
         * The service reads the new state and starts, adjusts or stops itself. Without the
         * location permission it cannot run at all, so it is simply stopped.
         */
        fun sync(context: Context) {
            val intent = Intent(context, TrackingService::class.java)
            if (hasLocationPermission(context)) ContextCompat.startForegroundService(context, intent)
            else context.stopService(intent)
        }
    }
}
