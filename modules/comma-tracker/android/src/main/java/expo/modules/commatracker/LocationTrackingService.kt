package expo.modules.commatracker

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase

class LocationTrackingService : Service() {
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var lastInsertedLocation: android.location.Location? = null
    private var isLocationUpdateActive = false
    private var activityPendingIntent: PendingIntent? = null
    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val pauseGpsRunnable = Runnable {
        Log.d(TAG, "Still for ${STILL_TIMEOUT_MS}ms — pausing GPS to save battery.")
        stopLocationUpdates()
    }

    private var overlay: ShiftOverlay? = null
    private var activeDistanceMeters = 0.0
    private val overlayTicker = object : Runnable {
        override fun run() {
            tickOverlay()
            mainHandler.postDelayed(this, 1000L)
        }
    }

    companion object {
        private const val CHANNEL_ID = "comma_tracker_channel"
        private const val NOTIFICATION_ID = 9876
        private const val TAG = "LocationTrackingService"
        private const val PREFS_NAME = "CommaTracker"
        private const val KEY_TRACKING_ACTIVE = "tracking_active"
        private const val RESTART_DELAY_MS = 2000L
        // Commands delivered by ActivityTransitionReceiver when movement state changes.
        const val ACTION_MOVEMENT = "expo.modules.commatracker.ACTION_MOVEMENT"
        const val ACTION_STILL = "expo.modules.commatracker.ACTION_STILL"
        // Battery-first: pause GPS only after this long of confirmed stillness (so short stops —
        // red lights, brief waits — keep GPS on and don't shred the route).
        private const val STILL_TIMEOUT_MS = 150_000L // 2.5 min
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    processLocation(location)
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // On Android 13+ the system can restart this service with a null intent
        // (START_STICKY). Check the flag — if the shift was ended normally, stop
        // immediately rather than restarting phantom tracking.
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_TRACKING_ACTIVE, false)) {
            Log.d(TAG, "onStartCommand: tracking_active=false, stopping self.")
            stopSelf()
            return START_NOT_STICKY
        }

        createNotificationChannel()
        val notification = createNotification()
        try {
            // Android 10+ requires the foreground-service type to be supplied at the
            // startForeground() call site; on Android 14 the 2-arg overload throws
            // MissingForegroundServiceTypeException (the manifest declaration alone is not
            // enough). Android 12+ additionally throws ForegroundServiceStartNotAllowedException
            // when this is reached from a background-delivered start (AlarmManager restart or
            // BootReceiver) — in that case we cannot legally run, so abandon instead of crashing.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.e(TAG, "startForeground refused (likely a background start on Android 12+); abandoning.", e)
            stopSelf()
            return START_NOT_STICKY
        }

        // Movement-gated GPS (battery-first): the foreground service stays up for the whole
        // shift, but the GPS radio only runs while the user is actually moving. Movement/still
        // is detected by the Activity Transition API (cheap, runs on the sensor hub).
        when (intent?.action) {
            ACTION_MOVEMENT -> {
                cancelPauseGps()
                if (!isLocationUpdateActive) startLocationUpdates()
            }
            ACTION_STILL -> {
                schedulePauseGps()
            }
            else -> {
                // Initial start (or START_STICKY re-create): begin GPS now so we never miss an
                // in-progress drive, and register movement detection so we can sleep GPS while still.
                if (!isLocationUpdateActive) startLocationUpdates()
                registerActivityTransitions()
                startOverlay()
            }
        }

        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // User swiped the app from recents. stopWithTask="false" keeps the service
        // alive on stock Android, but schedule a restart as a safety net for OEMs.
        Log.d(TAG, "App task removed — scheduling safety-net restart.")
        scheduleRestart()
    }

    override fun onDestroy() {
        super.onDestroy()
        cancelPauseGps()
        mainHandler.removeCallbacks(overlayTicker)
        overlay?.hide()
        overlay = null
        unregisterActivityTransitions()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        isLocationUpdateActive = false
        Log.d(TAG, "LocationTrackingService destroyed.")

        // If the shift is still supposed to be active (notification dismissed by user
        // or killed by the OS on Android 13+), reschedule the service to restart.
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_TRACKING_ACTIVE, false)) {
            Log.d(TAG, "Shift still active — scheduling restart after destroy.")
            scheduleRestart()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ─── Private helpers ────────────────────────────────────────────────────────

    private fun scheduleRestart() {
        val restartIntent = Intent(applicationContext, LocationTrackingService::class.java)
        val pendingIntent = PendingIntent.getService(
            applicationContext,
            1,
            restartIntent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = SystemClock.elapsedRealtime() + RESTART_DELAY_MS
        // A ~2s restart does not need exact-alarm precision. We use the inexact
        // allow-while-idle variant, which still fires through Doze but needs no special
        // permission — SCHEDULE_EXACT_ALARM is Play-restricted and has been removed from
        // the manifest. (setAndAllowWhileIdle exists on API 23+.)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent
            )
        } else {
            alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
        }
    }

    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000L).apply {
            setMinUpdateDistanceMeters(20f)
            setMaxUpdateDelayMillis(30000L)
        }.build()

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                android.os.Looper.getMainLooper()
            )
            isLocationUpdateActive = true

            // Capture last known location immediately as the shift start anchor,
            // avoiding the 10s cold-start gap before the first real GPS fix.
            fusedLocationClient.lastLocation.addOnSuccessListener { loc ->
                if (loc != null) {
                    val ageMs = System.currentTimeMillis() - loc.time
                    if (ageMs < 60_000L) {
                        // Do not log raw coordinates — precise location is PII and Log.d is not
                        // stripped from release builds (readable via adb logcat).
                        Log.d(TAG, "Anchor point saved (age=${ageMs}ms)")
                        saveLocationToDatabase(loc)
                    } else {
                        Log.d(TAG, "Last known location too stale (${ageMs}ms), skipping anchor.")
                    }
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Lost location permission: $e")
        }
    }

    private fun stopLocationUpdates() {
        if (!isLocationUpdateActive) return
        fusedLocationClient.removeLocationUpdates(locationCallback)
        isLocationUpdateActive = false
        Log.d(TAG, "GPS paused (user still).")
    }

    private fun schedulePauseGps() {
        mainHandler.removeCallbacks(pauseGpsRunnable)
        mainHandler.postDelayed(pauseGpsRunnable, STILL_TIMEOUT_MS)
    }

    private fun cancelPauseGps() {
        mainHandler.removeCallbacks(pauseGpsRunnable)
    }

    // ─── Movement detection (Activity Transition API) ───────────────────────────
    private fun registerActivityTransitions() {
        if (activityPendingIntent != null) return // already registered

        val activityTypes = intArrayOf(
            DetectedActivity.IN_VEHICLE,
            DetectedActivity.ON_BICYCLE,
            DetectedActivity.WALKING,
            DetectedActivity.RUNNING,
            DetectedActivity.STILL
        )
        val transitions = ArrayList<ActivityTransition>()
        for (type in activityTypes) {
            transitions.add(
                ActivityTransition.Builder()
                    .setActivityType(type)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build()
            )
        }
        val request = ActivityTransitionRequest(transitions)

        val broadcast = Intent(this, ActivityTransitionReceiver::class.java)
        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pi = PendingIntent.getBroadcast(this, 2, broadcast, piFlags)
        activityPendingIntent = pi

        try {
            ActivityRecognition.getClient(this)
                .requestActivityTransitionUpdates(request, pi)
                .addOnSuccessListener { Log.d(TAG, "Activity transitions registered (movement-gated GPS active).") }
                .addOnFailureListener { e -> Log.e(TAG, "Activity transition registration failed; GPS stays on. $e") }
        } catch (e: SecurityException) {
            // ACTIVITY_RECOGNITION not granted → degrade gracefully: GPS just stays on for the
            // whole shift (the prior behavior). No crash, no battery gating.
            Log.e(TAG, "ACTIVITY_RECOGNITION not granted; movement gating disabled.", e)
            activityPendingIntent = null
        }
    }

    private fun unregisterActivityTransitions() {
        val pi = activityPendingIntent ?: return
        try {
            ActivityRecognition.getClient(this).removeActivityTransitionUpdates(pi)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unregister activity transitions", e)
        }
        activityPendingIntent = null
    }

    // ─── Floating "live shift" overlay ──────────────────────────────────────────
    private fun startOverlay() {
        if (overlay == null) overlay = ShiftOverlay(this)
        mainHandler.removeCallbacks(overlayTicker)
        mainHandler.post(overlayTicker)
    }

    /** Runs every second: show the floating pill ONLY when Comma is backgrounded (so it never
     *  covers Comma's own UI or steals taps from the in-app shift controls). */
    private fun tickOverlay() {
        val o = overlay ?: return
        if (!android.provider.Settings.canDrawOverlays(this) || isAppInForeground()) {
            o.hide()
            return
        }
        o.show() // over another app — no-op if already shown
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val startedAt = prefs.getLong("tracking_started_at", System.currentTimeMillis())
        val elapsedSec = ((System.currentTimeMillis() - startedAt) / 1000L).coerceAtLeast(0L)
        val unit = prefs.getString("distance_unit", "mi") ?: "mi"
        val factor = if (unit == "km") 1000.0 else 1609.344
        val dist = activeDistanceMeters / factor
        o.update(formatElapsed(elapsedSec), String.format(java.util.Locale.US, "%.1f %s", dist, unit))
    }

    /** True when Comma's own UI is on screen (its process is at FOREGROUND importance). While a
     *  shift runs in the background, the process sits at FOREGROUND_SERVICE importance instead. */
    private fun isAppInForeground(): Boolean {
        return try {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val procs = am.runningAppProcesses ?: return false
            procs.any {
                it.processName == packageName &&
                    it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun formatElapsed(totalSec: Long): String {
        val h = totalSec / 3600
        val m = (totalSec % 3600) / 60
        val s = totalSec % 60
        return if (h > 0) String.format(java.util.Locale.US, "%d:%02d:%02d", h, m, s)
        else String.format(java.util.Locale.US, "%d:%02d", m, s)
    }

    private fun processLocation(loc: android.location.Location) {
        val lastLoc = lastInsertedLocation
        if (lastLoc != null) {
            val distance = haversineDistance(lastLoc.latitude, lastLoc.longitude, loc.latitude, loc.longitude)
            val timeDeltaMs = loc.time - lastLoc.time
            val speed = if (timeDeltaMs > 0) distance / (timeDeltaMs / 1000.0) else 0.0

            // Discard GPS jitter (>150 km/h implied speed) or sub-20m movements
            if (speed > 42.0 || distance < 20.0) {
                Log.d(TAG, "Location filtered: speed=$speed m/s, distance=$distance m")
                return
            }
            activeDistanceMeters += distance
        }
        saveLocationToDatabase(loc)
    }

    private fun saveLocationToDatabase(loc: android.location.Location) {
        var db: SQLiteDatabase? = null
        try {
            val dbFile = java.io.File(filesDir, "SQLite/comma.db")
            db = SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READWRITE)
            val values = ContentValues().apply {
                put("lat", loc.latitude)
                put("lon", loc.longitude)
                put("timestamp", loc.time)
            }
            db.insert("temp_native_points", null, values)
            lastInsertedLocation = loc
            // Do not log raw coordinates (PII; survives into release logcat).
            Log.d(TAG, "Saved coordinate")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save location to SQLite", e)
        } finally {
            db?.close()
        }
    }

    private fun haversineDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val R = 6371e3
        val phi1 = Math.toRadians(lat1)
        val phi2 = Math.toRadians(lat2)
        val deltaPhi = Math.toRadians(lat2 - lat1)
        val deltaLambda = Math.toRadians(lon2 - lon1)
        val a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    private fun createNotification(): Notification {
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Comma — Shift Active")
            .setContentText("Recording your mileage in the background.")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)

        // Tapping the ongoing notification reopens the app — without a content intent it does
        // nothing, which is the main way a user returns to a tracking app.
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        if (launchIntent != null) {
            launchIntent.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            val contentIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            builder.setContentIntent(contentIntent)
        }

        return builder.build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Shift Tracking",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Shows while Comma is recording mileage during an active shift."
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
