package expo.modules.commatracker

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Intent
import android.os.Build
import android.util.Log

class CommaTrackerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CommaTracker")

    Function("startTracking") {
      val context = appContext.reactContext
      if (context != null) {
        Log.d("CommaTrackerModule", "startTracking called, launching foreground service")
        // Write flag BEFORE starting the service so onStartCommand sees it
        val prefs = context.getSharedPreferences("CommaTracker", android.content.Context.MODE_PRIVATE)
        prefs.edit().putBoolean("tracking_active", true).apply()
        val intent = Intent(context, LocationTrackingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
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
  }
}
