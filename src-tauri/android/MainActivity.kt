package com.coolapk.windows

import android.content.ClipData
import android.content.ContentUris
import android.content.ContentValues
import android.content.res.Configuration
import android.content.Intent
import android.app.AlertDialog
import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.view.View
import android.view.WindowManager
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.Keep
import androidx.core.content.FileProvider
import androidx.core.content.ContextCompat
import androidx.core.graphics.Insets
import androidx.core.graphics.ColorUtils
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File
import java.lang.ref.WeakReference

class MainActivity : TauriActivity() {
    @Volatile private var topSafeAreaPx = 0
    private var mainWebView: WeakReference<WebView>? = null

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        mainWebView = WeakReference(webView)
    }

    @Keep
    fun getSafeAreaTop(unused: String): String = topSafeAreaPx.toString()

    private fun syncWebSafeArea(top: Int) {
        topSafeAreaPx = top
        // WebView 不可靠地提供 CSS safe-area，按实际像素比例传入顶部安全区；旋转时同步更新。
        mainWebView?.get()?.evaluateJavascript("document.documentElement.style.setProperty('--android-safe-area-top', ($top / window.devicePixelRatio) + 'px')", null)
    }

    @Keep
    fun getRuntimeInfo(unused: String): String {
        val webview = androidx.webkit.WebViewCompat.getCurrentWebViewPackage(this)
        fun safe(value: String?): String = (value ?: "unavailable").replace(Regex("[^A-Za-z0-9._ -]"), "_").take(96)
        return org.json.JSONObject().apply {
            put("android_release", safe(Build.VERSION.RELEASE))
            put("android_sdk", Build.VERSION.SDK_INT)
            put("manufacturer", safe(Build.MANUFACTURER))
            put("model", safe(Build.MODEL))
            put("webview_package", safe(webview?.packageName))
            put("webview_version", safe(webview?.versionName))
        }.toString()
    }

    private fun applySystemBarTheme(dark: Boolean, profile: Boolean = false, dimmed: Boolean = false) {
        // 个人页背景与网页一致；吸顶或离开个人页后恢复普通顶栏颜色。
        val surface = if (profile) { if (dark) Color.rgb(0x0e, 0x10, 0x12) else Color.rgb(0xf2, 0xf2, 0xf6) } else { if (dark) Color.rgb(0x18, 0x1b, 0x1e) else Color.WHITE }
        // 状态栏保持透明，网页直接绘制后方内容；原生底部安全区仍同步主题和弹层遮罩。
        val background = if (dimmed) ColorUtils.blendARGB(surface, Color.BLACK, 0.4f) else surface
        window.decorView.setBackgroundColor(background)
        findViewById<View>(android.R.id.content).setBackgroundColor(background)
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = !dark
    }

    @Keep
    fun setSystemBarTheme(theme: String): String {
        runOnUiThread { applySystemBarTheme(theme.startsWith("dark"), theme.contains("-profile"), theme.endsWith("-dimmed")) }
        return "ok"
    }

    @Keep
    fun getUploadFileName(location: String): String {
        val uri = Uri.parse(location)
        require(uri.scheme == "content") { "只接受文件选择器返回的 content URI" }
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (column >= 0) {
                    val name = cursor.getString(column)
                    if (!name.isNullOrBlank()) return name
                }
            }
        }
        throw IllegalArgumentException("无法读取所选文件名，请重新选择文件")
    }
    @Keep
    fun showCoolNotification(payload: String): String = try {
        CoolNotificationHandler.show(this, org.json.JSONObject(payload))
    } catch (error: Exception) { "error:${error.message ?: error.javaClass.simpleName}" }

    override fun onStart() { super.onStart(); BackgroundNotificationService.mainVisible = true }
    override fun onStop() { BackgroundNotificationService.mainVisible = false; super.onStop() }

    @Keep
    fun setBackgroundNotifications(enabled: String): String = try {
        val intent = Intent(this, BackgroundNotificationService::class.java)
        BackgroundNotificationService.failure = null
        if (enabled == "true") { ContextCompat.startForegroundService(this, intent); "started" }
        else { stopService(intent); "stopped" }
    } catch (error: Exception) { "error:${error.message ?: error.javaClass.simpleName}" }

    @Keep
    fun backgroundNotificationState(unused: String): String = when {
        BackgroundNotificationService.failure != null -> "error:${BackgroundNotificationService.failure}"
        !BackgroundNotificationService.active -> "stopped"
        BackgroundNotificationService.mainVisible -> "foreground"
        else -> "background"
    }
    @Volatile private var pendingSave: File? = null
    @Volatile private var saveResult: String = "pending"

    private fun rememberPublishedApk(file: File, uri: Uri) {
        if (file.extension.lowercase() !in listOf("apk", "xapk", "apks")) return
        val preferences = getSharedPreferences("published-apks", MODE_PRIVATE)
        val locations = preferences.getStringSet("locations", emptySet())!!.toMutableSet()
        locations.add(uri.toString())
        preferences.edit().putStringSet("locations", locations).apply()
    }

    @Keep
    fun deletePublishedApk(location: String): String = try {
        val preferences = getSharedPreferences("published-apks", MODE_PRIVATE)
        val locations = preferences.getStringSet("locations", emptySet())!!.toMutableSet()
        require(locations.contains(location)) { "只能删除本应用导出的安装包" }
        val uri = Uri.parse(location)
        require(uri.scheme == "content") { "安装包地址无效" }
        if (DocumentsContract.isDocumentUri(this, uri)) require(DocumentsContract.deleteDocument(contentResolver, uri)) { "无法删除所选目录中的安装包" }
        else contentResolver.delete(uri, null, null)
        locations.remove(location)
        preferences.edit().putStringSet("locations", locations).apply()
        "deleted"
    } catch (error: java.io.FileNotFoundException) { "deleted" }
    catch (error: Exception) { "error:${error.message ?: error.javaClass.simpleName}" }

    private val saveLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        completeDocumentSave(result.resultCode, result.data)
    }

    private fun completeDocumentSave(resultCode: Int, data: Intent?) {
        val file = pendingSave ?: return
        Thread {
        val result = try {
            val uri = data?.data
            require(resultCode == Activity.RESULT_OK && uri != null) { "已取消保存" }
            contentResolver.openOutputStream(uri)?.use { output -> file.inputStream().use { it.copyTo(output) } }
                ?: throw IllegalStateException("无法写入所选文件")
            if (file.extension.lowercase() in listOf("apk", "xapk", "apks")) {
                val flags = (data?.flags ?: 0) and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                contentResolver.takePersistableUriPermission(uri, flags)
                rememberPublishedApk(file, uri)
            }
            uri.toString()
        } catch (error: Exception) { "error:${error.message}" }
        pendingSave = null
        saveResult = result
        }.start()
    }

    @Keep
    fun takeSavedFileResult(unused: String): String = saveResult

    @Keep
    fun publishSavedFile(path: String): String = try {
        val file = localFile(path)
        require(file.isFile && file.length() > 0) { "保存文件为空" }
        val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()) ?: "application/octet-stream"
        require(pendingSave == null) { "请先完成当前保存" }
        pendingSave = file
        saveResult = "pending"
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            try { saveLauncher.launch(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = mime
                putExtra(Intent.EXTRA_TITLE, file.name)
            }) } catch (error: Exception) { pendingSave = null; throw error }
            "pending"
        } else {
            Thread {
            val result = try {
            val image = mime.startsWith("image/")
            val collection = if (image) MediaStore.Images.Media.EXTERNAL_CONTENT_URI else MediaStore.Downloads.EXTERNAL_CONTENT_URI
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, file.name)
                put(MediaStore.MediaColumns.MIME_TYPE, mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH, if (image) Environment.DIRECTORY_PICTURES + "/Coolapk/" else Environment.DIRECTORY_DOWNLOADS + "/")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val uri = contentResolver.insert(collection, values) ?: throw IllegalStateException("无法创建公共文件")
            try {
                contentResolver.openOutputStream(uri)?.use { output -> file.inputStream().use { it.copyTo(output) } }
                    ?: throw IllegalStateException("无法写入公共文件")
                contentResolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
                rememberPublishedApk(file, uri)
                uri.toString()
            } catch (error: Exception) { contentResolver.delete(uri, null, null); throw error }
            } catch (error: Exception) { "error:${error.message ?: error.javaClass.simpleName}" }
            pendingSave = null
            saveResult = result
            }.start()
            "pending"
        }
    } catch (error: Exception) { "error:${error.message ?: error.javaClass.simpleName}" }

    private fun localFile(path: String): File {
        val file = File(path).canonicalFile
        val roots = listOfNotNull(filesDir, cacheDir, getExternalFilesDir(null)).map { it.canonicalFile }
        require(roots.any { file == it || file.path.startsWith(it.path + File.separator) }) { "文件不在应用目录内" }
        require(file.exists()) { "文件不存在" }
        return file
    }

    private fun showLocalFile(file: File) {
        if (file.isDirectory) {
            val children = file.listFiles()?.sortedWith(compareBy<File> { !it.isDirectory }.thenBy { it.name }) ?: emptyList()
            AlertDialog.Builder(this).setTitle(file.name)
                .setItems(children.map { if (it.isDirectory) "📁 ${it.name}" else it.name }.toTypedArray()) { _, index ->
                    try { showLocalFile(localFile(children[index].path)) }
                    catch (error: Exception) { AlertDialog.Builder(this).setMessage(error.message).setPositiveButton("确定", null).show() }
                }.setNegativeButton("关闭", null).show()
        } else {
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
            val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension.lowercase()) ?: "application/octet-stream"
            startActivity(Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                clipData = ClipData.newRawUri(file.name, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            })
        }
    }

    @Keep
    fun openLocalPath(path: String): String = try {
        showLocalFile(localFile(path))
        "opened"
    } catch (error: Exception) { "error:${error.message ?: error.javaClass.simpleName}" }

    @Keep
    fun installDownloadedApk(path: String): String = try {
        val file = localFile(path)
        require(file.isFile && file.extension.equals("apk", true)) { "系统安装器只支持 APK；拆分安装包请使用对应安装工具" }
        launchApkInstaller(FileProvider.getUriForFile(this, "$packageName.fileprovider", file))
    } catch (error: Exception) { "error:${error.message ?: error.javaClass.simpleName}" }

    private fun launchApkInstaller(uri: Uri): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            return "permission_required"
        }
        startActivity(Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            clipData = ClipData.newRawUri("安装包", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        })
        return "started"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        applySystemBarTheme(resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES)
        // 保证旧版 Android 也派发键盘遮挡区域，由原生容器统一避让。
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        // 顶部由网页安全区避让，让内容可以绘制在透明状态栏后；左右、底部和键盘仍由原生处理。
        val content = findViewById<View>(android.R.id.content)
        val safeAreaTypes = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
        val handledTypes = safeAreaTypes or WindowInsetsCompat.Type.ime()
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val bars = insets.getInsets(safeAreaTypes)
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
            // 键盘高度已包含底部系统区域，取较大值而非相加，避免输入框被重复顶起。
            view.setPadding(bars.left, 0, bars.right, maxOf(bars.bottom, keyboard.bottom))
            syncWebSafeArea(bars.top)
            // 网页使用显式传入的顶部安全区，清除重复派发，避免再次缩小内容区。
            WindowInsetsCompat.Builder(insets)
                .setInsets(handledTypes, Insets.NONE)
                .setInsetsIgnoringVisibility(safeAreaTypes, Insets.NONE)
                .build()
        }
        ViewCompat.requestApplyInsets(content)
    }

    private fun updateFile(path: String): File {
        val directory = File(filesDir, "coolapk-desktop-update").canonicalFile
        val file = File(path).canonicalFile
        require(file.parentFile == directory && file.isFile && file.length() > 0L && file.extension.equals("apk", true)) {
            "更新包不在应用更新目录内"
        }
        return file
    }

    private fun updateUri(value: String): Uri {
        val uri = Uri.parse(value)
        require(uri.scheme == "content" && uri.authority == MediaStore.AUTHORITY) { "更新包地址无效" }
        val id = ContentUris.parseId(uri)
        require(uri == ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI, id)) {
            "更新包不在系统下载目录"
        }
        contentResolver.query(
            uri,
            arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.OWNER_PACKAGE_NAME),
            null,
            null,
            null,
        ).use { cursor ->
            require(cursor != null && cursor.moveToFirst()) { "更新包已被删除" }
            val name = cursor.getString(0)
            val size = cursor.getLong(1)
            val owner = cursor.getString(2)
            require(name.matches(Regex("coolapk-v?[0-9].+-android-arm64\\.apk", RegexOption.IGNORE_CASE)) && size > 0L && owner == packageName) {
                "下载目录中的更新包无效"
            }
        }
        return uri
    }

    // Rust 通过 JNI 按名称调用，Release 混淆时必须保留方法名称和实现。
    @Keep
    fun publishUpdateApk(path: String): String = try {
        val file = updateFile(path)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            "private_fallback"
        } else {
            val displayName = file.name.replace(Regex("-\\d+-\\d+\\.apk$", RegexOption.IGNORE_CASE), ".apk")
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
                put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.android.package-archive")
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("无法在下载目录创建更新包")
            try {
                contentResolver.openOutputStream(uri)?.use { output -> file.inputStream().use { it.copyTo(output) } }
                    ?: throw IllegalStateException("无法写入下载目录")
                val ready = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
                contentResolver.update(uri, ready, null, null)
                uri.toString()
            } catch (error: Exception) {
                contentResolver.delete(uri, null, null)
                throw error
            }
        }
    } catch (error: Exception) {
        "error:${error.message ?: error.javaClass.simpleName}"
    }

    // 待安装包恢复也由 JNI 调用，不能被当作未使用的方法裁剪。
    @Keep
    fun isUpdatePackageAvailable(location: String): String = try {
        if (location.startsWith("content://")) updateUri(location) else updateFile(location)
        "available"
    } catch (_: Exception) {
        "missing"
    }

    // 保留系统安装器入口，避免下载成功后因方法被混淆而无法安装。
    @Keep
    fun launchUpdateInstaller(location: String): String = try {
        val uri = if (location.startsWith("content://")) {
            updateUri(location)
        } else {
            FileProvider.getUriForFile(this, "$packageName.fileprovider", updateFile(location))
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            "permission_required"
        } else {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                clipData = ClipData.newRawUri("更新包", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(intent)
            "started"
        }
    } catch (error: Exception) {
        "error:${error.message ?: error.javaClass.simpleName}"
    }
}
