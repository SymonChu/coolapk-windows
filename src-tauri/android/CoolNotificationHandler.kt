package com.coolapk.windows

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.text.Html
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.net.URL
import java.util.concurrent.Executors

/** 参考官方 CoolNotificationHandler 和 AppPushManger 的通知展示行为。
 * 推送平台注册独立处理；这里负责展示当前客户端收到的消息。
 */
object CoolNotificationHandler {
    private val executor = Executors.newSingleThreadExecutor()
    private val channels = linkedMapOf(
        "o_community_interact" to "社区互动", "o_system_notification" to "系统通知",
        "o_private_message" to "私信通知", "o_reply" to "回复订阅",
        "o_special_follow" to "特别关注"
    )

    fun show(context: Context, payload: JSONObject): String {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return "error:系统通知权限未开启"
        val category = payload.optString("category", "comment")
        val channelId = when (category) {
            "message" -> "o_private_message"
            "system" -> "o_system_notification"
            "reply" -> "o_reply"
            "specialFollow" -> "o_special_follow"
            else -> "o_community_interact"
        }
        val sound = payload.optBoolean("sound", false)
        // Android channel settings are owned by the user; create a separate silent channel
        // so the in-app sound switch does not overwrite system preferences.
        val selectedChannel = if (sound) channelId else "${channelId}_silent"
        if (Build.VERSION.SDK_INT >= 26) {
            val manager = context.getSystemService(NotificationManager::class.java)
            channels.forEach { (id, name) ->
                manager.createNotificationChannel(NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH).apply {
                    enableLights(true); lightColor = 0xff4caf50.toInt(); setShowBadge(true)
                })
            }
            manager.createNotificationChannel(NotificationChannel(selectedChannel,
                channels.getValue(channelId) + if (sound) "" else "（静音）",
                if (sound) NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_LOW).apply {
                if (!sound) { setSound(null, null); enableVibration(false) }
                setShowBadge(true)
            })
        }
        val preferences = context.getSharedPreferences("native-notifications", Context.MODE_PRIVATE)
        val notificationId: Int
        synchronized(this) {
            notificationId = preferences.getInt("nextId", 132123).let { if (it == Int.MAX_VALUE) 132124 else it + 1 }
            preferences.edit().putInt("nextId", notificationId).apply()
        }
        val suppliedRoute = payload.optString("route", "/notifications")
        val route = if (suppliedRoute.matches(Regex("/(notifications|messages)(\\?[^#]*)?")) ||
            suppliedRoute.matches(Regex("/feed/\\d+(\\?[^#]*)?"))) suppliedRoute else "/notifications"
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("coolmarket://com.coolapk.desktop$route")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentIntent = PendingIntent.getActivity(context, notificationId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        fun plain(value: String) = Html.fromHtml(value, Html.FROM_HTML_MODE_LEGACY).toString().trim()
        val title = plain(payload.optString("title", "酷安新通知"))
        val body = plain(payload.optString("body"))
        val builder = NotificationCompat.Builder(context, selectedChannel)
            .setSmallIcon(R.drawable.ic_notification).setColor(0xff4caf50.toInt())
            .setContentTitle(title).setContentText(body).setTicker(title)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(if (category == "message") NotificationCompat.CATEGORY_MESSAGE else NotificationCompat.CATEGORY_SOCIAL)
            .setPriority(if (category == "message") NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setShowWhen(true).setAutoCancel(true).setContentIntent(contentIntent)
        if (sound) builder.setDefaults(NotificationCompat.DEFAULT_ALL) else builder.setSilent(true)
        // Publish immediately; load an optional avatar with bounded network and memory usage.
        NotificationManagerCompat.from(context).notify(notificationId, builder.build())
        val avatar = payload.optString("avatar")
        if (avatar.startsWith("https://")) executor.execute {
            try {
                val connection = URL(avatar).openConnection().apply { connectTimeout = 2000; readTimeout = 2000 }
                val bytes = connection.getInputStream().use { it.readBytesLimited(1024 * 1024) }
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                val options = BitmapFactory.Options().apply {
                    inSampleSize = (maxOf(bounds.outWidth, bounds.outHeight) / 256).coerceAtLeast(1)
                }
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) ?: return@execute
                val manager = context.getSystemService(NotificationManager::class.java)
                // Never resurrect a notification the user already dismissed.
                if (manager.activeNotifications.any { it.id == notificationId }) {
                    manager.notify(notificationId, builder.setLargeIcon(bitmap).setOnlyAlertOnce(true).build())
                }
            } catch (_: Exception) { /* Avatar failure must not prevent message delivery. */ }
        }
        return "shown"
    }

    private fun java.io.InputStream.readBytesLimited(limit: Int): ByteArray {
        val output = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (true) {
            val count = read(buffer)
            if (count < 0) break
            require(output.size() + count <= limit) { "avatar too large" }
            output.write(buffer, 0, count)
        }
        return output.toByteArray()
    }
}
