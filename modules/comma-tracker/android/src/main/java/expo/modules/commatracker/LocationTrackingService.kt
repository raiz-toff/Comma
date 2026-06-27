package expo.modules.commatracker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase

class LocationTrackingService : Service() {
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var lastInsertedLocation: android.location.Location? = null

    companion object {
        private const val CHANNEL_ID = "comma_tracker_channel"
        private const val NOTIFICATION_ID = 9876
        private const val TAG = "LocationTrackingService"
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
        createNotificationChannel()
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
        
        startLocationUpdates()
        
        return START_STICKY
    }

    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000L).apply {
            setMinUpdateDistanceMeters(20f)
            setMaxUpdateDelayMillis(30000L)
        }.build()

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, null)
        } catch (unlikely: SecurityException) {
            Log.e(TAG, "Lost location permission. Could not request updates. $unlikely")
        }
    }

    private fun processLocation(loc: android.location.Location) {
        val lastLoc = lastInsertedLocation
        if (lastLoc != null) {
            val distance = haversineDistance(lastLoc.latitude, lastLoc.longitude, loc.latitude, loc.longitude)
            val timeDeltaMs = loc.time - lastLoc.time
            val speed = if (timeDeltaMs > 0) distance / (timeDeltaMs / 1000.0) else 0.0

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
            val dbFile = getDatabasePath("comma.db")
            db = SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READWRITE)
            
            val values = ContentValues().apply {
                put("lat", loc.latitude)
                put("lon", loc.longitude)
                put("timestamp", loc.time) // unix epoch ms
            }
            db.insert("temp_native_points", null, values)
            lastInsertedLocation = loc
            Log.d(TAG, "Saved coordinate to SQLite: lat=${loc.latitude}, lon=${loc.longitude}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to insert location into SQLite database", e)
        } finally {
            db?.close()
        }
    }

    private fun haversineDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val R = 6371e3 // Earth radius in meters
        val phi1 = Math.toRadians(lat1)
        val phi2 = Math.toRadians(lat2)
        val deltaPhi = Math.toRadians(lat2 - lat1)
        val deltaLambda = Math.toRadians(lon2 - lon1)
        val a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Comma Native Tracker")
            .setContentText("Recording mileage offline.")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Comma Mileage Tracker Service Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }
}
