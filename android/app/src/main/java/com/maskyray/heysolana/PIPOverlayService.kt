package com.maskyray.heysolana

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.core.app.NotificationCompat
import android.animation.ValueAnimator
import android.os.Vibrator
import android.os.VibrationEffect
import android.view.animation.DecelerateInterpolator

class PIPOverlayService : Service() {
    
    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var isOverlayVisible = false
    
    private var cancelAreaView: View? = null
    private var isCancelAreaVisible = false

    private var snapAnimator: ValueAnimator? = null

    companion object {
        const val ACTION_START_PIP = "START_PIP"
        const val ACTION_STOP_PIP = "STOP_PIP"
        const val CHANNEL_ID = "PIP_SERVICE_CHANNEL"
        private const val NOTIFICATION_ID = 1001
        
        fun startPIPOverlay(context: Context) {
            val intent = Intent(context, PIPOverlayService::class.java)
            intent.action = ACTION_START_PIP
            context.startForegroundService(intent)
        }
        
        fun stopPIPOverlay(context: Context) {
            val intent = Intent(context, PIPOverlayService::class.java)
            intent.action = ACTION_STOP_PIP
            context.startService(intent)
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_PIP -> {
                if (!isOverlayVisible) {
                    startForeground(NOTIFICATION_ID, createNotification())
                    showFloatingOverlay()
                }
            }
            ACTION_STOP_PIP -> {
                hideFloatingOverlay()
                stopSelf()
            }
        }
        return START_STICKY
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "HeySolana PIP Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Service for HeySolana floating AI assistant"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(): Notification {
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val stopIntent = Intent(this, PIPOverlayService::class.java).apply {
            action = ACTION_STOP_PIP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("HeySolana AI Assistant")
            .setContentText("Floating AI assistant is active")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(openAppPendingIntent)
            .addAction(R.drawable.ic_notification, "Stop", stopPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
    
    private fun showFloatingOverlay() {
        if (isOverlayVisible || windowManager == null) return
        
        try {
            // Inflate the floating view
            floatingView = LayoutInflater.from(this).inflate(R.layout.pip_floating_overlay, null)
            
            // Set up the layout parameters
            val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = 100
                y = 100
            }
            
            // Set up touch handling for dragging
            setupTouchHandling(floatingView!!, params)
            
            // Set up click handlers
            setupClickHandlers(floatingView!!)
            
            // Add the view to window manager
            windowManager!!.addView(floatingView, params)
            isOverlayVisible = true
            
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun showCancelArea() {
        if (isCancelAreaVisible || windowManager == null) return
        try {
            cancelAreaView = LayoutInflater.from(this).inflate(R.layout.pip_cancel_area, null)
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                100, // height in px
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.BOTTOM
                y = 0
            }
            windowManager!!.addView(cancelAreaView, params)
            isCancelAreaVisible = true
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun hideCancelArea() {
        if (isCancelAreaVisible && cancelAreaView != null && windowManager != null) {
            try {
                windowManager!!.removeView(cancelAreaView)
                isCancelAreaVisible = false
                cancelAreaView = null
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun isInCancelArea(y: Int, viewHeight: Int): Boolean {
        val displayMetrics = resources.displayMetrics
        val screenHeight = displayMetrics.heightPixels
        val overlayBottom = y + viewHeight
        // Consider the overlay in the cancel area if its bottom is within the bottom 220px
        return overlayBottom > screenHeight - 220
    }

    private fun highlightCancelArea(highlight: Boolean) {
        cancelAreaView?.findViewById<ImageView>(R.id.cancel_icon)?.alpha = if (highlight) 1f else 0.7f
        cancelAreaView?.findViewById<ImageView>(R.id.cancel_icon)?.scaleX = if (highlight) 1.2f else 1f
        cancelAreaView?.findViewById<ImageView>(R.id.cancel_icon)?.scaleY = if (highlight) 1.2f else 1f
    }

    private fun snapToEdge(x: Int, y: Int): Pair<Int, Int> {
        val displayMetrics = resources.displayMetrics
        val screenWidth = displayMetrics.widthPixels
        val screenHeight = displayMetrics.heightPixels
        val bubbleWidth = floatingView?.width ?: 200
        val bubbleHeight = floatingView?.height ?: 200
        val snapX = if (x + bubbleWidth / 2 < screenWidth / 2) 0 else screenWidth - bubbleWidth
        val boundedY = y.coerceIn(0, screenHeight - bubbleHeight)
        return Pair(snapX, boundedY)
    }

    private fun animateSnap(params: WindowManager.LayoutParams, targetX: Int, targetY: Int) {
        snapAnimator?.cancel()
        val startX = params.x
        val startY = params.y
        val animator = ValueAnimator.ofFloat(0f, 1f)
        snapAnimator = animator
        animator.duration = 250
        animator.interpolator = DecelerateInterpolator()
        animator.addUpdateListener { animation ->
            if (floatingView == null) {
                animator.cancel()
                return@addUpdateListener
            }
            val fraction = animation.animatedFraction
            params.x = (startX + (targetX - startX) * fraction).toInt()
            params.y = (startY + (targetY - startY) * fraction).toInt()
            windowManager?.updateViewLayout(floatingView, params)
        }
        animator.start()
    }

    private fun fadeInCancelArea() {
        cancelAreaView?.let { view ->
            view.alpha = 0f
            view.animate().alpha(1f).setDuration(200).start()
        }
    }

    private fun fadeOutCancelArea() {
        cancelAreaView?.let { view ->
            view.animate().alpha(0f).setDuration(200).withEndAction {
                hideCancelArea()
            }.start()
        } ?: hideCancelArea()
    }

    private fun vibrateOnClose() {
        try {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(80)
            }
        } catch (_: Exception) {}
    }

    private fun setupTouchHandling(view: View, params: WindowManager.LayoutParams) {
        var startX = 0f
        var startY = 0f
        var startClickX = 0f
        var startClickY = 0f
        val mainButton = view.findViewById<ImageView>(R.id.pip_main_button)
        val mainContent = view.findViewById<LinearLayout>(R.id.pip_main_content)
        val dragTargets = listOf(view, mainButton, mainContent)
        dragTargets.forEach { target ->
            target?.setOnTouchListener(object : View.OnTouchListener {
                var isDrag = false
                override fun onTouch(v: View?, event: MotionEvent): Boolean {
                    when (event.action) {
                        MotionEvent.ACTION_DOWN -> {
                            startX = params.x.toFloat()
                            startY = params.y.toFloat()
                            startClickX = event.rawX
                            startClickY = event.rawY
                            showCancelArea()
                            fadeInCancelArea()
                            isDrag = false
                            return true
                        }
                        MotionEvent.ACTION_MOVE -> {
                            val deltaX = event.rawX - startClickX
                            val deltaY = event.rawY - startClickY
                            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                                params.x = (startX + deltaX).toInt()
                                params.y = (startY + deltaY).toInt()
                                windowManager?.updateViewLayout(view, params)
                                val inCancel = isInCancelArea(params.y, view.height)
                                highlightCancelArea(inCancel)
                                isDrag = true
                            }
                            return true
                        }
                        MotionEvent.ACTION_UP -> {
                            fadeOutCancelArea()
                            val (snapX, snapY) = snapToEdge(params.x, params.y)
                            animateSnap(params, snapX, snapY)
                            if (isInCancelArea(params.y, view.height)) {
                                vibrateOnClose()
                                hideFloatingOverlay()
                                stopSelf()
                            } else if (!isDrag && v == mainButton) {
                                startAISession()
                            }
                            return false
                        }
                        else -> return false
                    }
                }
            })
        }
        // No redundant click handler on mainButton
    }
    
    private fun setupClickHandlers(view: View) {
        // Main PIP button - start AI session
        view.findViewById<ImageView>(R.id.pip_main_button)?.setOnClickListener {
            startAISession()
        }
        
        // Close button
        view.findViewById<ImageView>(R.id.pip_close_button)?.setOnClickListener {
            hideFloatingOverlay()
            stopSelf()
        }
        
        // Minimize button
        view.findViewById<ImageView>(R.id.pip_minimize_button)?.setOnClickListener {
            minimizeOverlay()
        }
    }
    
    private fun startAISession() {
        // Open app with AI intent
        val intent = Intent(this, MainActivity::class.java).apply {
            data = android.net.Uri.parse("heysolana://ai/start")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(intent)
    }
    
    private fun minimizeOverlay() {
        floatingView?.let { view ->
            val mainContent = view.findViewById<LinearLayout>(R.id.pip_main_content)
            val mainButton = view.findViewById<ImageView>(R.id.pip_main_button)
            
            if (mainContent.visibility == View.VISIBLE) {
                mainContent.visibility = View.GONE
                mainButton.visibility = View.VISIBLE
            } else {
                mainContent.visibility = View.VISIBLE
                mainButton.visibility = View.GONE
            }
        }
    }
    
    private fun hideFloatingOverlay() {
        snapAnimator?.cancel()
        snapAnimator = null
        if (isOverlayVisible && floatingView != null && windowManager != null) {
            try {
                val view = floatingView
                floatingView = null // Set to null before removing
                windowManager!!.removeView(view)
                isOverlayVisible = false
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        hideFloatingOverlay()
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
} 