package expo.modules.commatracker

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * A small floating "live shift" pill drawn over other apps (Maps, delivery apps) while a shift
 * is active. Display-only: shows elapsed time + active miles, and tapping it reopens Comma.
 *
 * Requires the SYSTEM_ALERT_WINDOW ("display over other apps") special-access permission; if it
 * isn't granted, show() simply no-ops so tracking is unaffected.
 */
class ShiftOverlay(private val context: Context) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var root: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var timeView: TextView? = null
    private var milesView: TextView? = null

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    fun show() {
        if (root != null) return
        if (!Settings.canDrawOverlays(context)) {
            Log.d("ShiftOverlay", "Overlay permission not granted; skipping.")
            return
        }

        val time = TextView(context).apply {
            text = "0:00"
            setTextColor(Color.WHITE)
            textSize = 16f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val miles = TextView(context).apply {
            text = "0.0 mi"
            setTextColor(Color.parseColor("#10b981"))
            textSize = 12f
        }

        val container = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(8), dp(12), dp(8))
            background = GradientDrawable().apply {
                cornerRadius = dp(14).toFloat()
                setColor(Color.parseColor("#0d0d0d"))
                setStroke(dp(1), Color.parseColor("#10b981"))
            }
            addView(time)
            addView(miles)
            setOnClickListener { openApp() }
        }

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(16)
            y = dp(120)
        }
        params = lp

        // Make the pill draggable anywhere on screen. A press that doesn't really move (under the
        // system touch-slop) is treated as a tap and opens the app; anything more drags it.
        val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
        container.setOnTouchListener(object : View.OnTouchListener {
            private var startX = 0
            private var startY = 0
            private var touchDownX = 0f
            private var touchDownY = 0f
            private var dragging = false

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        startX = lp.x
                        startY = lp.y
                        touchDownX = event.rawX
                        touchDownY = event.rawY
                        dragging = false
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - touchDownX).toInt()
                        val dy = (event.rawY - touchDownY).toInt()
                        if (!dragging &&
                            (kotlin.math.abs(dx) > touchSlop || kotlin.math.abs(dy) > touchSlop)
                        ) {
                            dragging = true
                        }
                        if (dragging) {
                            lp.x = startX + dx
                            lp.y = startY + dy
                            try {
                                windowManager.updateViewLayout(v, lp)
                            } catch (e: Exception) {
                                Log.e("ShiftOverlay", "Failed to move overlay", e)
                            }
                        }
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        if (!dragging) v.performClick()
                        return true
                    }
                }
                return false
            }
        })

        try {
            windowManager.addView(container, lp)
            root = container
            timeView = time
            milesView = miles
            Log.d("ShiftOverlay", "Overlay shown.")
        } catch (e: Exception) {
            Log.e("ShiftOverlay", "Failed to add overlay view", e)
        }
    }

    fun update(timeText: String, milesText: String) {
        timeView?.text = timeText
        milesView?.text = milesText
    }

    fun hide() {
        val view = root ?: return
        try {
            windowManager.removeView(view)
        } catch (e: Exception) {
            Log.e("ShiftOverlay", "Failed to remove overlay view", e)
        }
        root = null
        params = null
        timeView = null
        milesView = null
    }

    private fun openApp() {
        // Signal the app to open the live shift console (not just the home screen) when it
        // comes to the foreground.
        context.getSharedPreferences("CommaTracker", Context.MODE_PRIVATE)
            .edit().putBoolean("open_console_pending", true).apply()
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        if (launch != null) {
            try {
                context.startActivity(launch)
            } catch (e: Exception) {
                Log.e("ShiftOverlay", "Failed to open app from overlay", e)
            }
        }
    }
}
