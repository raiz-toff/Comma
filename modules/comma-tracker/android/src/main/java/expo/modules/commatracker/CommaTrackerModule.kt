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
      val context = appContext.reactContext ?: return@Function
      Log.d("CommaTrackerModule", "startTracking called, launching foreground service")
      
      val intent = Intent(context, LocationTrackingService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    Function("stopTracking") {
      val context = appContext.reactContext ?: return@Function
      Log.d("CommaTrackerModule", "stopTracking called, stopping service")
      
      val intent = Intent(context, LocationTrackingService::class.java)
      context.stopService(intent)
    }
  }
}
