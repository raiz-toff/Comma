package expo.modules.commatracker

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat

class CommaTrackerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CommaTracker")

    Function("startTracking") {
      val context = appContext.reactContext
        ?: run {
          Log.e("CommaTrackerModule", "startTracking: no reactContext")
          return@Function false
        }

      // Refuse to launch the service without location permission. Otherwise the service
      // starts, fails at requestLocationUpdates() with a SecurityException, and runs forever
      // recording nothing while the JS layer shows an "active shift" — silent data loss.
      val granted = ContextCompat.checkSelfPermission(
        context, Manifest.permission.ACCESS_FINE_LOCATION
      ) == PackageManager.PERMISSION_GRANTED
      if (!granted) {
        Log.e("CommaTrackerModule", "startTracking: ACCESS_FINE_LOCATION not granted; aborting.")
        return@Function false
      }

      Log.d("CommaTrackerModule", "startTracking called, launching foreground service")
      // Write flag (and a start timestamp, used by BootReceiver to reject stale restarts)
      // BEFORE starting the service so onStartCommand sees it.
      val prefs = context.getSharedPreferences("CommaTracker", android.content.Context.MODE_PRIVATE)
      prefs.edit()
        .putBoolean("tracking_active", true)
        .putLong("tracking_started_at", System.currentTimeMillis())
        .apply()
      val intent = Intent(context, LocationTrackingService::class.java)
      return@Function try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        true
      } catch (e: Exception) {
        // ForegroundServiceStartNotAllowedException (API 31+) when started from background.
        Log.e("CommaTrackerModule", "startTracking: failed to start foreground service", e)
        prefs.edit().putBoolean("tracking_active", false).apply()
        false
      }
    }

    Function("stopTracking") {
      val context = appContext.reactContext
      if (context != null) {
        Log.d("CommaTrackerModule", "stopTracking called, stopping service")
        // Clear flag BEFORE stopping so onDestroy does not schedule a restart
        val prefs = context.getSharedPreferences("CommaTracker", android.content.Context.MODE_PRIVATE)
        prefs.edit().putBoolean("tracking_active", false).apply()
        val intent = Intent(context, LocationTrackingService::class.java)
        context.stopService(intent)
      }
    }

    // Opens the system battery optimization exemption dialog for this app.
    // Once granted, the OS (including OEM battery killers on Samsung, Xiaomi, etc.)
    // will not terminate the foreground service when the app is swiped from recents.
    Function("requestBatteryOptimizationExemption") {
      val context = appContext.reactContext
      if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = context.getSystemService(PowerManager::class.java)
        if (pm != null && !pm.isIgnoringBatteryOptimizations(context.packageName)) {
          Log.d("CommaTrackerModule", "Requesting battery optimization exemption")
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
        } else {
          Log.d("CommaTrackerModule", "Battery optimization already disabled — no prompt needed")
        }
      }
    }
  }
}
