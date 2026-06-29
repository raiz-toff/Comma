package expo.modules.commatracker

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

    companion object {
        private const val CHANNEL_ID = "comma_tracker_channel"
        private const val NOTIFICATION_ID = 9876
        private const val TAG = "LocationTrackingService"
        private const val PREFS_NAME = "CommaTracker"
        private const val KEY_TRACKING_ACTIVE = "tracking_active"
        private const val RESTART_DELAY_MS = 2000L
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
        startForeground(NOTIFICATION_ID, notification)

        if (!isLocationUpdateActive) {
            startLocationUpdates()
        } else {
            Log.d(TAG, "Location updates already active, skipping duplicate registration.")
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
        alarmManager.set(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + RESTART_DELAY_MS,
            pendingIntent
        )
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
                        Log.d(TAG, "Anchor point saved: lat=${loc.latitude}, lon=${loc.longitude} (age=${ageMs}ms)")
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
            Log.d(TAG, "Saved coordinate: lat=${loc.latitude}, lon=${loc.longitude}")
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
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Comma — Shift Active")
            .setContentText("Recording your mileage in the background.")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
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
