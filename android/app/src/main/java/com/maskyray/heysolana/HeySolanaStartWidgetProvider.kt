package com.maskyray.heysolana

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class HeySolanaStartWidgetProvider : AppWidgetProvider() {
    
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }
    
    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.heysolana_start_widget)
        
        // Create intent to start AI session immediately
        val startAIIntent = Intent(context, MainActivity::class.java).apply {
            data = Uri.parse("heysolana://ai/start")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val startAIPendingIntent = PendingIntent.getActivity(
            context, 
            0, 
            startAIIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        // Set click listener for the entire widget
        views.setOnClickPendingIntent(R.id.start_widget_container, startAIPendingIntent)
        
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
} 