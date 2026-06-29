package expo.modules.commatracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * Receives Activity Transition callbacks (movement vs. still) and tells the already-running
 * LocationTrackingService to resume or pause the GPS radio. This is the core of the
 * battery-first, movement-gated tracking: GPS only runs while the user is actually moving.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return
        val result = ActivityTransitionResult.extractResult(intent) ?: return

        var moving = false
        var still = false
        for (event in result.transitionEvents) {
            if (event.transitionType != ActivityTransition.ACTIVITY_TRANSITION_ENTER) continue
            when (event.activityType) {
                DetectedActivity.IN_VEHICLE,
                DetectedActivity.ON_BICYCLE,
                DetectedActivity.WALKING,
                DetectedActivity.RUNNING,
                DetectedActivity.ON_FOOT -> moving = true
                DetectedActivity.STILL -> still = true
            }
        }

        // Movement wins if a single batch somehow contains both.
        val action = when {
            moving -> LocationTrackingService.ACTION_MOVEMENT
            still -> LocationTrackingService.ACTION_STILL
            else -> return
        }

        Log.d("ActivityTransition", "Transition -> $action")
        val serviceIntent = Intent(context, LocationTrackingService::class.java).setAction(action)
        // The tracking service is already a running foreground service during a shift, so this
        // just delivers a command to it — it is NOT a background foreground-service start.
        try {
            context.startService(serviceIntent)
        } catch (e: Exception) {
            Log.e("ActivityTransition", "Could not deliver transition to service", e)
        }
    }
}
