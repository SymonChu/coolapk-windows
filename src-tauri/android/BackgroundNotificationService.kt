package com.coolapk.windows

import android.app.Service
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/** 仅在用户启用后台提醒时运行；不在开机或进程被杀后自动重启。 */
class BackgroundNotificationService : Service() {
    companion object {
        @Volatile var active = false
        @Volatile var mainVisible = true
        @Volatile var failure: String? = null
    }
    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel("coolapk-background", "后台消息检查", NotificationManager.IMPORTANCE_LOW))
        }
        val open = PendingIntent.getActivity(this, 48115, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, "coolapk-background")
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle("酷安后台消息检查")
            .setContentText("正在检查新消息，点击返回应用；可在通知设置中关闭")
            .setContentIntent(open).setOngoing(true).setSilent(true).build()
        try {
            ServiceCompat.startForeground(this, 48115, notification,
                if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC else 0)
            active = true
        } catch (error: Exception) {
            failure = error.message ?: "系统不允许启动后台消息检查"
            stopSelf()
        }
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_NOT_STICKY
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onTimeout(startId: Int, fgsType: Int) {
        failure = "系统已暂停后台消息检查，请返回应用后恢复"
        stopSelf()
    }
    override fun onTaskRemoved(rootIntent: Intent?) { stopSelf() }
    override fun onDestroy() { active = false; super.onDestroy() }
}
