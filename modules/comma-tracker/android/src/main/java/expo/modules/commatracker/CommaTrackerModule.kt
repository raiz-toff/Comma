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
        .putFloat("active_distance_meters", 0f)
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
        prefs.edit()
          .putBoolean("tracking_active", false)
          .putFloat("active_distance_meters", 0f)
          .apply()
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

    // ─── Floating "live shift" overlay (draw over other apps) ─────────────────
    Function("hasOverlayPermission") {
      val context = appContext.reactContext ?: return@Function false
      Settings.canDrawOverlays(context)
    }

    Function("requestOverlayPermission") {
      val context = appContext.reactContext
      if (context != null && !Settings.canDrawOverlays(context)) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(intent)
        } catch (e: Exception) {
          Log.e("CommaTrackerModule", "Failed to open overlay permission settings", e)
        }
      }
    }

    // JS pushes the live shift timing so the overlay's clock mirrors the in-app timer exactly
    // (pause-aware), even while the app is backgrounded and JS timers are frozen.
    Function("setShiftTiming") { startTimeMs: Double, pausedSeconds: Double, isPaused: Boolean, frozenElapsed: Double ->
      val context = appContext.reactContext
      if (context != null) {
        context.getSharedPreferences("CommaTracker", android.content.Context.MODE_PRIVATE).edit()
          .putLong("shift_start_time", startTimeMs.toLong())
          .putLong("shift_paused_seconds", pausedSeconds.toLong())
          .putBoolean("shift_is_paused", isPaused)
          .putLong("shift_frozen_elapsed", frozenElapsed.toLong())
          .apply()
      }
    }

    // Returns (and clears) whether the user tapped the floating pill to open the shift console.
    Function("consumeOpenConsole") {
      val context = appContext.reactContext ?: return@Function false
      val prefs = context.getSharedPreferences("CommaTracker", android.content.Context.MODE_PRIVATE)
      val pending = prefs.getBoolean("open_console_pending", false)
      if (pending) prefs.edit().putBoolean("open_console_pending", false).apply()
      pending
    }

    // Returns the total GPS distance accumulated by the tracking service this session, in metres.
    // Written by LocationTrackingService on every GPS update; JS polls it to show live mileage.
    Function("getActiveDistanceMeters") {
      val context = appContext.reactContext ?: return@Function 0.0
      val prefs = context.getSharedPreferences("CommaTracker", android.content.Context.MODE_PRIVATE)
      prefs.getFloat("active_distance_meters", 0f).toDouble()
    }

    // The native overlay renders miles in the user's distance unit; JS pushes it here.
    Function("setDistanceUnit") { unit: String ->
      val context = appContext.reactContext
      if (context != null) {
        context.getSharedPreferences("CommaTracker", android.content.Context.MODE_PRIVATE)
          .edit().putString("distance_unit", unit).apply()
      }
    }
  }
}
