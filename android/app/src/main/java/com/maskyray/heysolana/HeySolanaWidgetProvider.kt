package com.maskyray.heysolana

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class HeySolanaWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACTION_START_AI = "com.maskyray.heysolana.START_AI"
        private const val ACTION_SHOW_PIP = "com.maskyray.heysolana.SHOW_PIP"
        private const val ACTION_OPEN_DASHBOARD = "com.maskyray.heysolana.OPEN_DASHBOARD"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Update each widget instance
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        
        when (intent.action) {
            ACTION_START_AI -> {
                openDeepLink(context, "heysolana://ai/start")
            }
            ACTION_SHOW_PIP -> {
                openDeepLink(context, "heysolana://pip/show")
            }
            ACTION_OPEN_DASHBOARD -> {
                openDeepLink(context, "heysolana://dashboard")
            }
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        // Create RemoteViews object for the widget layout
        val views = RemoteViews(context.packageName, R.layout.heysolana_widget)

        // Set up click intents for buttons
        views.setOnClickPendingIntent(R.id.btn_start_ai, createPendingIntent(context, ACTION_START_AI))
        views.setOnClickPendingIntent(R.id.btn_show_pip, createPendingIntent(context, ACTION_SHOW_PIP))
        views.setOnClickPendingIntent(R.id.btn_dashboard, createPendingIntent(context, ACTION_OPEN_DASHBOARD))

        // Update the widget
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun createPendingIntent(context: Context, action: String): PendingIntent {
        val intent = Intent(context, HeySolanaWidgetProvider::class.java).apply {
            this.action = action
        }
        return PendingIntent.getBroadcast(
            context,
            action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun openDeepLink(context: Context, deepLink: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            // Fallback: open main app
            val fallbackIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (fallbackIntent != null) {
                context.startActivity(fallbackIntent)
            }
        }
    }
} 