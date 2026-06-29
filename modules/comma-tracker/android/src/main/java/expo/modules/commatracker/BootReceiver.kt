package expo.modules.commatracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != "android.intent.action.QUICKBOOT_POWERON") return

        val prefs = context.getSharedPreferences("CommaTracker", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("tracking_active", false)) return

        // Guard against resurrecting a "phantom" shift: if the active-shift flag is stale (the
        // app was killed mid-shift and the user never ended it), clear it instead of restarting
        // tracking days later after a reboot.
        val startedAt = prefs.getLong("tracking_started_at", 0L)
        val ageMs = System.currentTimeMillis() - startedAt
        val maxAgeMs = 24L * 60 * 60 * 1000 // 24 hours
        if (startedAt <= 0L || ageMs > maxAgeMs) {
            Log.d("BootReceiver", "Active-shift flag is stale (age=${ageMs}ms) — clearing, not restarting.")
            prefs.edit().putBoolean("tracking_active", false).apply()
            return
        }

        Log.d("BootReceiver", "Boot detected with active shift — restarting LocationTrackingService")
        val serviceIntent = Intent(context, LocationTrackingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
