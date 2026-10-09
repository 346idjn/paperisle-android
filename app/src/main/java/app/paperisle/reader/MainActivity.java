package app.paperisle.reader;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.content.ClipData;
import android.content.SharedPreferences;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.provider.OpenableColumns;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.text.Html;
import android.util.Xml;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.widget.Toast;

import org.json.JSONObject;
import org.json.JSONArray;
import org.xmlpull.v1.XmlPullParser;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Stack;
import java.util.UUID;
import java.net.URL;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private static final int PICK_BOOK = 42;
    private static final int MAX_TEXT_BYTES = 2 * 1024 * 1024;
    private static final int MAX_EPUB_BYTES = 12 * 1024 * 1024;
    private static final int MAX_EPUB_EXPANDED_BYTES = 24 * 1024 * 1024;
    private static final int MAX_EPUB_COVER_BYTES = 6 * 1024 * 1024;
    private static final int MAX_COVER_STORED_BYTES = 384 * 1024;
    private static final int MAX_IMPORTED_CHARS = 350_000;
    private WebView webView;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean ttsInitFinished = false;
    private String ttsInitMessage = "";
    private boolean pageReady = false;
    private String pendingSpeech;
    private int pendingSpeechStartPage = -1;
    private float speechRate = 1.0f;
    private static final int PRELOAD_SPEECH_SEGMENTS = 3;
    private static final int MAX_SPEECH_SEGMENT_CHARS = 520;
    private static final class SpeechSegment {
        final String text; final int pageIndex;
        SpeechSegment(String text, int pageIndex) { this.text = text; this.pageIndex = pageIndex; }
    }
    private final ArrayList<SpeechSegment> speechSegments = new ArrayList<>();
    private final Map<String, SpeechSegment> queuedSpeech = new HashMap<>();
    private int speechSegmentIndex = 0;
    private int lastAnnouncedSpeechPage = -1;
    private BroadcastReceiver audioPlaybackReceiver;
    private boolean audioReceiverRegistered = false;
    private boolean readerActive = false;
    private int lastTopInset = -1;
    private int topInsetPx = 0;
    private int bottomInsetPx = 0;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        window.setStatusBarColor(0xFFF4F2EA);
        window.setNavigationBarColor(0xFFF4F2EA);
        window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        WindowCompat.setDecorFitsSystemWindows(window, false);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFFF4F2EA);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(true);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                pageReady = true;
                applySystemInsetsCss();
                notifyTtsStatus();
                notifyAppVisibility(true);
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), "Android");
        setContentView(webView);
        webView.setClipToPadding(true);
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets cutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());
            int top = Math.max(cutout.top, readerActive ? 0 : bars.top);
            int bottom = Math.max(bars.bottom, cutout.bottom);
            if (top != lastTopInset) {
                topInsetPx = top;
                lastTopInset = top;
                applySystemInsetsCss();
            }
            if (bottom != bottomInsetPx) {
                bottomInsetPx = bottom;
                applySystemInsetsCss();
            }
            if (view.getPaddingTop() != 0 || view.getPaddingBottom() != 0) view.setPadding(0, 0, 0, 0);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
        audioPlaybackReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                String token = intent == null ? "" : intent.getStringExtra(OnlinePlaybackService.EXTRA_TOKEN);
                boolean failed = intent != null && intent.getBooleanExtra("play_error", false);
                boolean stopped = intent != null && intent.getBooleanExtra("play_stopped", false);
                String callback = stopped ? "onOnlineAudioStopped" : failed ? "onOnlineAudioError" : "onOnlineAudioDone";
                evaluate("window." + callback + " && window." + callback + "(" + JSONObject.quote(token) + ")");
            }
        };
        IntentFilter audioFilter = new IntentFilter(OnlinePlaybackService.ACTION_COMPLETED);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(audioPlaybackReceiver, audioFilter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(audioPlaybackReceiver, audioFilter);
        audioReceiverRegistered = true;
        webView.loadUrl("file:///android_asset/index.html");

        tts = new TextToSpeech(this, this);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) {
                runOnUiThread(() -> {
                    SpeechSegment segment = queuedSpeech.get(utteranceId);
                    if (segment == null || segment.pageIndex < 0 || segment.pageIndex == lastAnnouncedSpeechPage) return;
                    lastAnnouncedSpeechPage = segment.pageIndex;
                    evaluate("window.onNativeSpeechPageStarted && window.onNativeSpeechPageStarted(" + segment.pageIndex + ")");
                });
            }
            @Override public void onDone(String utteranceId) {
                runOnUiThread(() -> {
                    if (queuedSpeech.remove(utteranceId) == null) return;
                    queueSpeechAhead();
                    if (speechSegmentIndex >= speechSegments.size() && queuedSpeech.isEmpty()) finishSpeechQueue();
                });
            }
            @Override public void onError(String utteranceId) { runOnUiThread(() -> { if (queuedSpeech.containsKey(utteranceId)) reportSpeechError("这段语音合成失败，朗读已停止。可点“开始朗读”重试。", false); }); }
            @Override public void onError(String utteranceId, int errorCode) { runOnUiThread(() -> { if (queuedSpeech.containsKey(utteranceId)) reportSpeechError("语音合成失败（" + errorCode + "），朗读已停止。可点“开始朗读”重试。", false); }); }
        });
    }

    @Override public void onInit(int status) {
        ttsInitFinished = true;
        ttsReady = false;
        if (status == TextToSpeech.SUCCESS && tts != null) {
            Locale voiceLocale = Locale.SIMPLIFIED_CHINESE;
            int available = tts.isLanguageAvailable(voiceLocale);
            if (available < TextToSpeech.LANG_AVAILABLE) {
                voiceLocale = Locale.CHINESE;
                available = tts.isLanguageAvailable(voiceLocale);
            }
            if (available >= TextToSpeech.LANG_AVAILABLE) {
                int result = tts.setLanguage(voiceLocale);
                ttsReady = result >= TextToSpeech.LANG_AVAILABLE;
            }
            if (ttsReady) {
                ttsInitMessage = "";
                tts.setSpeechRate(speechRate);
            } else ttsInitMessage = "未检测到可用的中文语音数据。请安装 Android 中文 TTS 语音后重试。";
        } else ttsInitMessage = "Android 系统语音引擎启动失败。请检查系统的文字转语音服务。";
        notifyTtsStatus();
        if (pendingSpeech != null) {
            String text = pendingSpeech; int startPage = pendingSpeechStartPage;
            pendingSpeech = null; pendingSpeechStartPage = -1;
            if (ttsReady) { if (startPage >= 0) speakPagesJson(text, startPage); else speak(text); }
            else reportSpeechError(ttsInitMessage, true);
        }
    }

    private void notifyTtsStatus() {
        if (!pageReady || webView == null) return;
        evaluate("window.onNativeTtsStatus && window.onNativeTtsStatus(" + ttsReady + "," + JSONObject.quote(ttsInitMessage) + ")");
    }

    private void reportSpeechError(String message) { reportSpeechError(message, false); }

    private void reportSpeechError(String message, boolean needsSetup) {
        pendingSpeech = null; pendingSpeechStartPage = -1; speechSegments.clear(); queuedSpeech.clear(); speechSegmentIndex = 0; lastAnnouncedSpeechPage = -1;
        if (tts != null) tts.stop();
        if (pageReady && webView != null) evaluate("window.onNativeSpeechError && window.onNativeSpeechError(" + JSONObject.quote(message) + "," + needsSetup + ")");
    }

    private void evaluate(String js) {
        if (webView != null) webView.evaluateJavascript(js, null);
    }

    private void applySystemInsetsCss() {
        if (!pageReady || webView == null) return;
        float density = getResources().getDisplayMetrics().density;
        String top = String.format(Locale.US, "%.2fpx", topInsetPx / density);
        String bottom = String.format(Locale.US, "%.2fpx", bottomInsetPx / density);
        evaluate("document.documentElement.style.setProperty('--app-system-top-inset'," + JSONObject.quote(top) + ");document.documentElement.style.setProperty('--app-system-bottom-inset'," + JSONObject.quote(bottom) + ");window.onReaderInsetsChanged&&window.onReaderInsetsChanged()");
    }

    private void updateReaderSystemBars(boolean active) {
        readerActive = active;
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        if (active) controller.hide(WindowInsetsCompat.Type.statusBars());
        else {
            controller.show(WindowInsetsCompat.Type.statusBars());
            getWindow().setNavigationBarColor(0xFFF4F2EA);
            controller.setAppearanceLightNavigationBars(true);
        }
        if (webView != null) { applySystemInsetsCss(); ViewCompat.requestApplyInsets(webView); }
    }

    private void setReaderNavigationColor(String hex, boolean lightIcons) {
        if (hex == null || !hex.matches("#[0-9a-fA-F]{6}")) return;
        final int color;
        try { color = Color.parseColor(hex); } catch (IllegalArgumentException ignored) { return; }
        runOnUiThread(() -> {
            if (!readerActive) return;
            getWindow().setNavigationBarColor(color);
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(lightIcons);
        });
    }

    private void setReaderActive(boolean active) {
        runOnUiThread(() -> updateReaderSystemBars(active));
    }

    private void notifyAppVisibility(boolean visible) {
        if (pageReady && webView != null) {
            String value = visible ? "true" : "false";
            evaluate("window.onAppVisibility && window.onAppVisibility(" + value + ")");
        }
    }

    private void speak(String text) {
        if (text == null || text.trim().isEmpty()) return;
        String safeText = text.length() > MAX_IMPORTED_CHARS ? text.substring(0, MAX_IMPORTED_CHARS) : text;
        if (!ttsInitFinished) {
            pendingSpeech = safeText; pendingSpeechStartPage = -1;
            Toast.makeText(this, "正在准备系统语音…", Toast.LENGTH_SHORT).show();
            return;
        }
        if (tts == null || !ttsReady) {
            reportSpeechError(ttsInitMessage.isEmpty() ? "系统中文语音不可用，请检查 Android 文字转语音设置。" : ttsInitMessage, true);
            return;
        }
        speechSegments.clear();
        appendSpeechSegments(safeText, -1);
        beginSpeechQueue();
    }

    private void speakPagesJson(String pagesJson, int startPageIndex) {
        if (pagesJson == null || pagesJson.isEmpty()) return;
        if (!ttsInitFinished) {
            pendingSpeech = pagesJson; pendingSpeechStartPage = Math.max(0, startPageIndex);
            Toast.makeText(this, "正在准备系统语音…", Toast.LENGTH_SHORT).show();
            return;
        }
        if (tts == null || !ttsReady) {
            reportSpeechError(ttsInitMessage.isEmpty() ? "系统中文语音不可用，请检查 Android 文字转语音设置。" : ttsInitMessage, true);
            return;
        }
        try {
            JSONArray pages = new JSONArray(pagesJson); speechSegments.clear(); int total = 0;
            for (int i = 0; i < pages.length(); i++) {
                String page = pages.optString(i, ""); total += page.length();
                if (total > MAX_IMPORTED_CHARS) break;
                appendSpeechSegments(page, Math.max(0, startPageIndex) + i);
            }
            if (speechSegments.isEmpty()) { evaluate("window.onSpeechFinished && window.onSpeechFinished()"); return; }
            beginSpeechQueue();
        } catch (Exception e) {
            reportSpeechError("无法准备当前书页的语音内容，请重新开始朗读。", false);
        }
    }

    private void appendSpeechSegments(String rawText, int pageIndex) {
        if (rawText == null) return;
        String text = rawText.replaceAll("\\s+", " ").trim();
        if (text.isEmpty()) return;
        int start = 0, i = 0;
        while (i < text.length()) {
            char ch = text.charAt(i); int length = i - start + 1;
            boolean sentenceEnd = "。！？!?；;".indexOf(ch) >= 0;
            boolean softEnd = "，,、：:".indexOf(ch) >= 0 && length >= 80;
            boolean hardEnd = length >= MAX_SPEECH_SEGMENT_CHARS;
            if (sentenceEnd || softEnd || hardEnd) {
                int end = i + 1;
                if (hardEnd && !sentenceEnd && !softEnd) {
                    int floor = Math.max(start + 160, end - 160);
                    for (int j = end - 1; j >= floor; j--) {
                        char candidate = text.charAt(j);
                        if ("。！？!?；;，,、：:".indexOf(candidate) >= 0) { end = j + 1; break; }
                    }
                }
                if (end > start && Character.isHighSurrogate(text.charAt(end - 1)) && end < text.length()) end--;
                if (end <= start) end = i + 1;
                String part = text.substring(start, end).trim(); if (!part.isEmpty()) speechSegments.add(new SpeechSegment(part, pageIndex));
                start = end; i = end;
            } else i++;
        }
        if (start < text.length()) { String part = text.substring(start).trim(); if (!part.isEmpty()) speechSegments.add(new SpeechSegment(part, pageIndex)); }
    }

    private void beginSpeechQueue() {
        if (tts == null || !ttsReady) return;
        tts.stop(); queuedSpeech.clear(); speechSegmentIndex = 0; lastAnnouncedSpeechPage = -1;
        tts.setSpeechRate(speechRate);
        if (speechSegments.isEmpty()) { finishSpeechQueue(); return; }
        queueSpeechAhead();
    }

    private void queueSpeechAhead() {
        if (tts == null || !ttsReady) return;
        while (speechSegmentIndex < speechSegments.size() && queuedSpeech.size() < PRELOAD_SPEECH_SEGMENTS) {
            SpeechSegment segment = speechSegments.get(speechSegmentIndex++);
            String utteranceId = "paperisle-" + UUID.randomUUID();
            int queueMode = queuedSpeech.isEmpty() ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD;
            queuedSpeech.put(utteranceId, segment);
            if (tts.speak(segment.text, queueMode, null, utteranceId) == TextToSpeech.ERROR) {
                reportSpeechError("系统语音引擎未能开始播放，请检查语音服务和媒体音量。", false); return;
            }
        }
    }

    private void finishSpeechQueue() {
        speechSegments.clear(); queuedSpeech.clear(); speechSegmentIndex = 0; lastAnnouncedSpeechPage = -1;
        evaluate("window.onSpeechFinished && window.onSpeechFinished()");
    }

    private void stopSystemSpeech() {
        pendingSpeech = null; pendingSpeechStartPage = -1;
        speechSegments.clear(); queuedSpeech.clear(); speechSegmentIndex = 0; lastAnnouncedSpeechPage = -1;
        if (tts != null) tts.stop();
    }

    private class AndroidBridge {
        @JavascriptInterface public void setReaderNavigationColor(String hex, boolean lightIcons) { MainActivity.this.setReaderNavigationColor(hex, lightIcons); }
        @JavascriptInterface public void chooseTextFile() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/plain", "application/epub+zip", "application/octet-stream"});
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { startActivityForResult(intent, PICK_BOOK); }
                catch (ActivityNotFoundException e) { Toast.makeText(MainActivity.this, "没有可用的文件选择器", Toast.LENGTH_SHORT).show(); }
            });
        }
        @JavascriptInterface public void speakText(String text) { runOnUiThread(() -> speak(text)); }
        @JavascriptInterface public void speakPages(String pagesJson, int startPageIndex) { runOnUiThread(() -> speakPagesJson(pagesJson, startPageIndex)); }
        @JavascriptInterface public void openTtsSettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)); }
                catch (ActivityNotFoundException e) { Toast.makeText(MainActivity.this, "请在系统设置的“文字转语音输出”中安装中文语音", Toast.LENGTH_LONG).show(); }
            });
        }
        @JavascriptInterface public void stopSpeech() { runOnUiThread(MainActivity.this::stopSystemSpeech); }
        @JavascriptInterface public void stopOnlineAudio() { runOnUiThread(MainActivity.this::releaseOnlinePlayer); }
        @JavascriptInterface public void setReaderActive(boolean active) { MainActivity.this.setReaderActive(active); }
        @JavascriptInterface public void ensurePlaybackNotificationPermission() { runOnUiThread(() -> { if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 7433); }); }
        @JavascriptInterface public void playOnlineAudio(String base64Audio, String token) { playOnlineAudioFile(base64Audio, token); }
        @JavascriptInterface public void saveSecret(String name, String value) {
            if (!allowedSecretName(name) || value == null || value.isEmpty()) return;
            try { storeSecret(name, value); runOnUiThread(() -> evaluate("window.onSecretSaved && window.onSecretSaved(" + JSONObject.quote(name) + ",true)")); }
            catch (Exception e) { runOnUiThread(() -> evaluate("window.onSecretSaved && window.onSecretSaved(" + JSONObject.quote(name) + ",false)")); }
        }
        @JavascriptInterface public void getSecret(String name, String requestId) {
            new Thread(() -> {
                String value = "";
                try { if (allowedSecretName(name)) value = readSecret(name); } catch (Exception ignored) { }
                final String result = value;
                runOnUiThread(() -> evaluate("window.onSecretResult && window.onSecretResult(" + JSONObject.quote(requestId) + "," + JSONObject.quote(result) + ")"));
            }, "paperisle-secret").start();
        }
        @JavascriptInterface public void clearSecret(String name) {
            if (!allowedSecretName(name)) return;
            getSharedPreferences("paperisle_secure", MODE_PRIVATE).edit().remove(name).apply();
        }
        @JavascriptInterface public void requestAudio(String endpoint, String headersJson, String body, String requestId) {
            new Thread(() -> performAudioRequest(endpoint, headersJson, body, requestId), "paperisle-tts-api").start();
        }
        @JavascriptInterface public void webDavGet(String endpoint, String username, String password, String requestId) {
            new Thread(() -> performWebDav("GET", endpoint, username, password, "", requestId), "paperisle-sync-get").start();
        }
        @JavascriptInterface public void webDavPut(String endpoint, String username, String password, String body, String requestId) {
            new Thread(() -> performWebDav("PUT", endpoint, username, password, body, requestId), "paperisle-sync-put").start();
        }
        @JavascriptInterface public void shareImageBase64(String imageBase64) {
            try {
                byte[] image = Base64.decode(imageBase64, Base64.DEFAULT);
                if (image.length > 8 * 1024 * 1024) throw new IllegalArgumentException("图片过大，无法分享");
                File directory = new File(getCacheDir(), "share");
                if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("无法准备分享文件");
                File file = new File(directory, "paperisle-" + UUID.randomUUID() + ".png");
                try (FileOutputStream output = new FileOutputStream(file)) { output.write(image); }
                android.net.Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                runOnUiThread(() -> {
                    Intent send = new Intent(Intent.ACTION_SEND); send.setType("image/png");
                    send.putExtra(Intent.EXTRA_STREAM, uri); send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    send.setClipData(ClipData.newUri(getContentResolver(), "纸屿摘录卡片", uri));
                    startActivity(Intent.createChooser(send, "分享摘录卡片"));
                });
            } catch (Exception e) { runOnUiThread(() -> Toast.makeText(MainActivity.this, "图片卡片生成失败", Toast.LENGTH_SHORT).show()); }
        }
        @JavascriptInterface public void setSpeechRate(float rate) {
            speechRate = Math.max(0.65f, Math.min(1.6f, rate));
            runOnUiThread(() -> { if (tts != null) tts.setSpeechRate(speechRate); });
        }
        @JavascriptInterface public void shareText(String title, String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, title == null ? "纸屿阅读" : title);
                send.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                startActivity(Intent.createChooser(send, "分享内容"));
            });
        }
    }

    private boolean allowedSecretName(String name) {
        return "ai_key".equals(name) || "azure_key".equals(name) || "custom_tts_key".equals(name) || "sync_username".equals(name) || "sync_password".equals(name);
    }

    private String keyAlias(String name) { return "paperisle_" + name; }

    private SecretKey getOrCreateSecretKey(String name) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        String alias = keyAlias(name);
        if (store.containsAlias(alias)) return (SecretKey) store.getKey(alias, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }

    private void storeSecret(String name, String value) throws Exception {
        SecretKey key = getOrCreateSecretKey(name); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key); byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        String saved = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(encrypted, Base64.NO_WRAP);
        getSharedPreferences("paperisle_secure", MODE_PRIVATE).edit().putString(name, saved).apply();
    }

    private String readSecret(String name) throws Exception {
        SharedPreferences prefs = getSharedPreferences("paperisle_secure", MODE_PRIVATE); String saved = prefs.getString(name, null);
        if (saved == null) return ""; String[] pieces = saved.split("\\.", 2); if (pieces.length != 2) return "";
        byte[] iv = Base64.decode(pieces[0], Base64.NO_WRAP), encrypted = Base64.decode(pieces[1], Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(name), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }

    private HttpsURLConnection openHttps(String endpoint) throws Exception {
        URL url = new URL(endpoint);
        if (!"https".equalsIgnoreCase(url.getProtocol())) throw new IllegalArgumentException("在线服务必须使用 HTTPS 地址");
        HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
        connection.setConnectTimeout(15000); connection.setReadTimeout(45000); connection.setUseCaches(false); connection.setInstanceFollowRedirects(false);
        return connection;
    }

    private String readResponse(HttpsURLConnection connection, int code, int limit) throws Exception {
        InputStream input = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (input == null) return "";
        try (InputStream stream = input) { return new String(readLimited(stream, limit), StandardCharsets.UTF_8); }
    }

    private void performAudioRequest(String endpoint, String headersJson, String body, String requestId) {
        int code = 0; String mime = "audio/mpeg", audio = "", message = ""; HttpsURLConnection connection = null;
        try {
            connection = openHttps(endpoint); connection.setRequestMethod("POST"); connection.setDoOutput(true);
            JSONObject headers = new JSONObject(headersJson == null ? "{}" : headersJson);
            java.util.Iterator<String> names = headers.keys(); while (names.hasNext()) { String name = names.next(); connection.setRequestProperty(name, headers.optString(name, "")); }
            byte[] bytes = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8); connection.setFixedLengthStreamingMode(bytes.length);
            try (java.io.OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            code = connection.getResponseCode(); mime = connection.getContentType() == null ? mime : connection.getContentType().split(";", 2)[0];
            InputStream input = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (input != null) try (InputStream stream = input) {
                byte[] data = readLimited(stream, 5 * 1024 * 1024);
                if (code >= 200 && code < 300) audio = Base64.encodeToString(data, Base64.NO_WRAP);
                else message = new String(data, StandardCharsets.UTF_8);
            }
        } catch (Exception e) { message = e.getMessage() == null ? "Audio request failed" : e.getMessage(); }
        finally { if (connection != null) connection.disconnect(); }
        final int status = code; final String type = mime, encoded = audio, error = message;
        runOnUiThread(() -> evaluate("window.onAudioResult && window.onAudioResult(" + JSONObject.quote(requestId) + "," + status + "," + JSONObject.quote(type) + "," + JSONObject.quote(encoded) + "," + JSONObject.quote(error) + ")"));
    }

    private void performWebDav(String method, String endpoint, String username, String password, String body, String requestId) {
        int code = 0; String response = ""; HttpsURLConnection connection = null;
        try {
            connection = openHttps(endpoint); connection.setRequestMethod(method); connection.setRequestProperty("Accept", "application/json");
            String auth = Base64.encodeToString(((username == null ? "" : username) + ":" + (password == null ? "" : password)).getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            connection.setRequestProperty("Authorization", "Basic " + auth);
            if ("PUT".equals(method)) { connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json; charset=utf-8"); byte[] bytes=(body == null ? "" : body).getBytes(StandardCharsets.UTF_8); connection.setFixedLengthStreamingMode(bytes.length); try (java.io.OutputStream out=connection.getOutputStream()) { out.write(bytes); } }
            code = connection.getResponseCode(); response = readResponse(connection, code, 20 * 1024 * 1024);
        } catch (Exception e) { response = e.getMessage() == null ? "Sync request failed" : e.getMessage(); }
        finally { if (connection != null) connection.disconnect(); }
        final int status=code; final String result=response;
        runOnUiThread(() -> evaluate("window.onSyncResult && window.onSyncResult(" + JSONObject.quote(requestId) + "," + status + "," + JSONObject.quote(result) + ")"));
    }

    private void playOnlineAudioFile(String encoded, String token) {
        new Thread(() -> {
            File file = null;
            try {
                byte[] data = Base64.decode(encoded, Base64.DEFAULT);
                File dir = new File(getCacheDir(), "tts");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Cannot create TTS cache");
                file = new File(dir, "chunk-" + UUID.randomUUID() + ".mp3");
                try (FileOutputStream out = new FileOutputStream(file)) { out.write(data); }
                final File audio = file;
                runOnUiThread(() -> {
                    Intent play = new Intent(MainActivity.this, OnlinePlaybackService.class)
                            .setAction(OnlinePlaybackService.ACTION_PLAY)
                            .putExtra(OnlinePlaybackService.EXTRA_PATH, audio.getAbsolutePath())
                            .putExtra(OnlinePlaybackService.EXTRA_TOKEN, token);
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ContextCompat.startForegroundService(MainActivity.this, play);
                        else startService(play);
                    } catch (Exception e) {
                        try { audio.delete(); } catch (Exception ignored) { }
                        evaluate("window.onOnlineAudioError && window.onOnlineAudioError(" + JSONObject.quote(token) + ")");
                    }
                });
            } catch (Exception e) {
                if (file != null) try { file.delete(); } catch (Exception ignored) { }
                runOnUiThread(() -> evaluate("window.onOnlineAudioError && window.onOnlineAudioError(" + JSONObject.quote(token) + ")"));
            }
        }, "paperisle-play-audio").start();
    }

    private void releaseOnlinePlayer() {
        stopService(new Intent(this, OnlinePlaybackService.class));
        File dir = new File(getCacheDir(), "tts");
        File[] files = dir.listFiles();
        if (files != null) for (File file : files) try { file.delete(); } catch (Exception ignored) { }
    }

    @Override protected void onResume() {
        super.onResume();
        updateReaderSystemBars(readerActive);
        notifyAppVisibility(true);
    }

    @Override protected void onPause() {
        notifyAppVisibility(false);
        super.onPause();
    }

    @Override @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_BOOK || resultCode != RESULT_OK || data == null) return;
        List<Uri> selected = new ArrayList<>();
        ClipData clip = data.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri uri = clip.getItemAt(i).getUri();
                if (uri != null) selected.add(uri);
            }
        } else if (data.getData() != null) selected.add(data.getData());
        if (selected.isEmpty()) return;
        final boolean batch = selected.size() > 1;
        Toast.makeText(this, batch ? "正在依次导入 " + selected.size() + " 本书…" : "正在导入书籍…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            int imported = 0;
            int truncated = 0;
            List<String> failures = new ArrayList<>();
            for (Uri uri : selected) {
                String name = queryDisplayName(uri);
                String error = importBook(uri, name, getContentResolver().getType(uri), batch);
                if (error == null || "__PAPERISLE_TRUNCATED__".equals(error)) {
                    imported++;
                    if ("__PAPERISLE_TRUNCATED__".equals(error)) truncated++;
                }
                else failures.add(name + "：" + error);
            }
            if (batch) {
                StringBuilder message = new StringBuilder("批量导入完成：成功 ").append(imported).append(" 本，失败 ").append(failures.size()).append(" 本");
                if (truncated > 0) message.append("\n其中 ").append(truncated).append(" 本超过 35 万字，已截取前 35 万字");
                for (int i = 0; i < Math.min(2, failures.size()); i++) message.append("\n").append(failures.get(i));
                if (failures.size() > 2) message.append("\n另有 ").append(failures.size() - 2).append(" 本失败");
                runOnUiThread(() -> Toast.makeText(this, message.toString(), Toast.LENGTH_LONG).show());
            } else if (!failures.isEmpty()) {
                String message = failures.get(0);
                runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
            }
        }, "paperisle-import").start();
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor cursor = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) return cursor.getString(index);
            }
        } catch (Exception ignored) { }
        String name = uri.getLastPathSegment();
        return name == null || name.trim().isEmpty() ? "导入的书" : name;
    }

    private String importBook(Uri uri, String name, String mime, boolean silent) {
        try {
            boolean epub = (name != null && name.toLowerCase(Locale.ROOT).endsWith(".epub")) || "application/epub+zip".equalsIgnoreCase(mime);
            int maxBytes = epub ? MAX_EPUB_BYTES : MAX_TEXT_BYTES;
            byte[] inputBytes;
            try (InputStream input = getContentResolver().openInputStream(uri)) {
                if (input == null) throw new IllegalStateException("无法打开所选文件");
                inputBytes = readLimited(input, maxBytes);
            }

            String title = stripExtension(name);
            String author = "本地导入";
            String format = epub ? "EPUB" : "TXT";
            String content;
            String coverData = "";
            JSONObject bookMetadata = new JSONObject();
            if (epub) {
                EpubText parsed = parseEpub(inputBytes, title);
                title = parsed.title;
                author = parsed.author;
                content = parsed.content;
                coverData = parsed.coverData;
                bookMetadata.put("description", parsed.description);
                bookMetadata.put("publisher", parsed.publisher);
                bookMetadata.put("publishedAt", parsed.publishedAt);
                bookMetadata.put("language", parsed.language);
                bookMetadata.put("subject", parsed.subject);
                bookMetadata.put("chapterCount", parsed.chapterCount);
                bookMetadata.put("toc", parsed.toc);
            } else {
                content = new String(inputBytes, StandardCharsets.UTF_8);
                if (!content.isEmpty() && content.charAt(0) == '\uFEFF') content = content.substring(1);
            }
            boolean truncated = content.length() > MAX_IMPORTED_CHARS;
            if (truncated) content = content.substring(0, MAX_IMPORTED_CHARS);
            if (content.trim().isEmpty()) return "文件中没有可读取的文字";
            final String safeTitle = title;
            final String safeAuthor = author;
            final String safeContent = content;
            final String safeFormat = format;
            final String safeCoverData = coverData;
            final String safeMetadata = bookMetadata.toString();
            final boolean safeTruncated = truncated;
            runOnUiThread(() -> {
                String js = "window.receiveImportedFile(" + JSONObject.quote(safeTitle) + "," + JSONObject.quote(safeContent) + "," + JSONObject.quote(safeAuthor) + "," + JSONObject.quote(safeFormat) + "," + JSONObject.quote(safeCoverData) + "," + safeMetadata + "," + silent + ")";
                evaluate(js);
                if (!silent && safeTruncated) Toast.makeText(this, "书籍文字较长，已导入前 35 万字以适配本机空间", Toast.LENGTH_LONG).show();
            });
            return truncated ? "__PAPERISLE_TRUNCATED__" : null;
        } catch (Exception e) { return e.getMessage() == null ? "导入失败，请检查文件格式" : e.getMessage(); }
    }

    private static byte[] readLimited(InputStream input, int limit) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) {
            if (output.size() + read > limit) throw new IllegalArgumentException("文件过大，请选择更小的文件");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static String stripExtension(String name) {
        if (name == null || name.trim().isEmpty()) return "导入的书";
        return name.replaceFirst("(?i)\\.(txt|text|epub)$", "");
    }

    private static class EpubText {
        final String title;
        final String author;
        final String content;
        final String coverData;
        final String description;
        final String publisher;
        final String publishedAt;
        final String language;
        final String subject;
        final int chapterCount;
        final JSONArray toc;
        EpubText(String title, String author, String content, String coverData, String description, String publisher, String publishedAt, String language, String subject, int chapterCount, JSONArray toc) {
            this.title = title; this.author = author; this.content = content; this.coverData = coverData;
            this.description = description; this.publisher = publisher; this.publishedAt = publishedAt; this.language = language; this.subject = subject; this.chapterCount = chapterCount;
            this.toc = toc;
        }
    }

    private static class EpubManifestItem {
        final String path;
        final String mediaType;
        final String properties;
        EpubManifestItem(String path, String mediaType, String properties) { this.path = path; this.mediaType = mediaType; this.properties = properties == null ? "" : properties; }
        boolean isImage() {
            String type = mediaType == null ? "" : mediaType.toLowerCase(Locale.ROOT);
            return (type.startsWith("image/") && !type.contains("svg")) || isImageArchiveEntry(path);
        }
    }

    private EpubText parseEpub(byte[] epubBytes, String fallbackTitle) throws Exception {
        Map<String, byte[]> textEntries = new HashMap<>();
        long expanded = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(epubBytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String path = normalizeZipPath(entry.getName());
                if (path == null || entry.isDirectory() || !isTextArchiveEntry(path)) { zip.closeEntry(); continue; }
                byte[] bytes = readLimited(zip, (int) Math.max(1, MAX_EPUB_EXPANDED_BYTES - expanded));
                expanded += bytes.length;
                if (expanded > MAX_EPUB_EXPANDED_BYTES) throw new IllegalArgumentException("EPUB 解压后的文字文件过大");
                textEntries.put(path, bytes);
                zip.closeEntry();
            }
        }

        String packagePath = null;
        byte[] container = textEntries.get("META-INF/container.xml");
        if (container != null) packagePath = parseRootfile(decodeUtf8Document(container));
        packagePath = normalizeZipPath(packagePath);
        if (packagePath == null || !textEntries.containsKey(packagePath)) {
            for (String path : textEntries.keySet()) if (path.toLowerCase(Locale.ROOT).endsWith(".opf")) { packagePath = path; break; }
        }
        if (packagePath == null || !textEntries.containsKey(packagePath)) throw new IllegalArgumentException("这不是有效的 EPUB 书籍文件");

        String opf = decodeUtf8Document(textEntries.get(packagePath));
        Map<String, EpubManifestItem> manifest = new HashMap<>();
        List<String> spine = new ArrayList<>();
        String title = null, author = null, legacyCoverId = null, coverPath = null;
        String description = null, publisher = null, publishedAt = null, language = null;
        StringBuilder subjects = new StringBuilder();
        XmlPullParser parser = Xml.newPullParser();
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_DOCDECL, false);
        parser.setInput(new StringReader(opf));
        int event;
        while ((event = parser.next()) != XmlPullParser.END_DOCUMENT) {
            if (event == XmlPullParser.START_TAG) {
                String tag = localXmlName(parser.getName());
                if ("item".equals(tag)) {
                    String id = parser.getAttributeValue(null, "id"), href = parser.getAttributeValue(null, "href");
                    String mediaType = parser.getAttributeValue(null, "media-type"), properties = parser.getAttributeValue(null, "properties");
                    String itemPath = resolveEpubPath(packagePath, href);
                    if (id != null && itemPath != null) {
                        EpubManifestItem item = new EpubManifestItem(itemPath, mediaType, properties);
                        manifest.put(id, item);
                        if (item.isImage() && properties != null && properties.matches("(?i).*\\bcover-image\\b.*")) coverPath = itemPath;
                    }
                } else if ("itemref".equals(tag)) {
                    String idref = parser.getAttributeValue(null, "idref");
                    if (idref != null) spine.add(idref);
                } else if ("meta".equals(tag) && "cover".equalsIgnoreCase(parser.getAttributeValue(null, "name"))) {
                    legacyCoverId = parser.getAttributeValue(null, "content");
                } else if ("title".equals(tag) && title == null) {
                    title = parser.nextText().trim();
                } else if ("creator".equals(tag) && author == null) {
                    author = parser.nextText().trim();
                } else if ("description".equals(tag) && description == null) {
                    description = parser.nextText().trim();
                } else if ("publisher".equals(tag) && publisher == null) {
                    publisher = parser.nextText().trim();
                } else if ("date".equals(tag) && publishedAt == null) {
                    publishedAt = parser.nextText().trim();
                } else if ("language".equals(tag) && language == null) {
                    language = parser.nextText().trim();
                } else if ("subject".equals(tag)) {
                    String value = parser.nextText().trim();
                    if (!value.isEmpty()) { if (subjects.length() > 0) subjects.append("、"); subjects.append(value); }
                }
            }
        }

        if (coverPath == null && legacyCoverId != null) {
            EpubManifestItem legacyCover = manifest.get(legacyCoverId);
            if (legacyCover != null && legacyCover.isImage()) coverPath = legacyCover.path;
        }
        if (coverPath == null) {
            for (EpubManifestItem item : manifest.values()) {
                String lowerPath = item.path.toLowerCase(Locale.ROOT);
                int slash = lowerPath.lastIndexOf('/');
                String filename = slash < 0 ? lowerPath : lowerPath.substring(slash + 1);
                if (item.isImage() && filename.matches(".*cover[^/]*")) { coverPath = item.path; break; }
            }
        }

        List<String> chapterPaths = new ArrayList<>();
        for (String id : spine) {
            EpubManifestItem item = manifest.get(id);
            String path = item == null ? null : item.path;
            if (path != null && textEntries.containsKey(path)) chapterPaths.add(path);
        }
        if (chapterPaths.isEmpty()) {
            for (String path : textEntries.keySet()) {
                String lower = path.toLowerCase(Locale.ROOT);
                if (lower.endsWith(".xhtml") || lower.endsWith(".html") || lower.endsWith(".htm")) chapterPaths.add(path);
            }
            Collections.sort(chapterPaths, Comparator.naturalOrder());
        }
        if (chapterPaths.isEmpty()) throw new IllegalArgumentException("EPUB 中没有找到可读取的正文");

        StringBuilder text = new StringBuilder();
        JSONArray toc = new JSONArray();
        for (String path : chapterPaths) {
            String html = decodeUtf8Document(textEntries.get(path))
                    .replaceAll("(?is)<script\\b[^>]*>.*?</script\\s*>", " ")
                    .replaceAll("(?is)<style\\b[^>]*>.*?</style\\s*>", " ");
            String chapter = Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY).toString()
                    .replace('\u00a0', ' ').replace('\u200b', ' ').replaceAll("[\\t\\x0B\\f\\r ]+", " ")
                    .replaceAll(" *\\n *", "\n").replaceAll("\\n{3,}", "\n\n").trim();
            if (!chapter.isEmpty()) {
                if (text.length() >= MAX_IMPORTED_CHARS) break;
                if (text.length() > 0) text.append("\n\n");
                String heading = chapter.split("\n", 2)[0].trim();
                if (heading.isEmpty() || heading.length() > 80) {
                    String leaf = path.substring(path.lastIndexOf('/') + 1).replaceFirst("(?i)\\.(xhtml|html|htm)$", "");
                    heading = leaf.isEmpty() ? "第 " + (toc.length() + 1) + " 节" : leaf;
                }
                if (toc.length() < 500) {
                    JSONObject entry = new JSONObject();
                    entry.put("title", heading);
                    entry.put("offset", text.length());
                    toc.put(entry);
                }
                text.append(chapter);
                if (text.length() > MAX_IMPORTED_CHARS) break;
            }
        }
        String finalTitle = title == null || title.trim().isEmpty() ? fallbackTitle : title;
        String finalAuthor = author == null || author.trim().isEmpty() ? "EPUB 导入" : author;
        String coverData = "";
        if (coverPath != null) {
            try { coverData = extractEpubCover(epubBytes, coverPath); } catch (Exception ignored) { }
        }
        return new EpubText(finalTitle, finalAuthor, text.toString(), coverData, description, publisher, publishedAt, language, subjects.toString(), chapterPaths.size(), toc);
    }

    private static String decodeUtf8Document(byte[] bytes) {
        String value = new String(bytes, StandardCharsets.UTF_8);
        return value.startsWith("\uFEFF") ? value.substring(1) : value;
    }

    private static String localXmlName(String name) {
        if (name == null) return "";
        int colon = name.lastIndexOf(':');
        return (colon >= 0 ? name.substring(colon + 1) : name).toLowerCase(Locale.ROOT);
    }

    private String extractEpubCover(byte[] epubBytes, String coverPath) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(epubBytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String path = normalizeZipPath(entry.getName());
                if (entry.isDirectory() || !coverPath.equals(path)) { zip.closeEntry(); continue; }
                byte[] imageBytes = readLimited(zip, MAX_EPUB_COVER_BYTES);
                return encodeCoverThumbnail(imageBytes);
            }
        }
        return "";
    }

    private String encodeCoverThumbnail(byte[] imageBytes) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || (long) bounds.outWidth * bounds.outHeight > 80_000_000L) return "";
        int sample = 1;
        while (Math.max(bounds.outWidth / sample, bounds.outHeight / sample) > 1200) sample *= 2;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        options.inPreferredConfig = Bitmap.Config.RGB_565;
        Bitmap decoded = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length, options);
        if (decoded == null) return "";
        Bitmap thumbnail = null;
        try {
            float scale = Math.min(1f, Math.min(480f / decoded.getWidth(), 720f / decoded.getHeight()));
            int width = Math.max(1, Math.round(decoded.getWidth() * scale));
            int height = Math.max(1, Math.round(decoded.getHeight() * scale));
            thumbnail = width == decoded.getWidth() && height == decoded.getHeight() ? decoded : Bitmap.createScaledBitmap(decoded, width, height, true);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            for (int quality = 82; quality >= 52; quality -= 10) {
                output.reset();
                thumbnail.compress(Bitmap.CompressFormat.JPEG, quality, output);
                if (output.size() <= MAX_COVER_STORED_BYTES) break;
            }
            if (output.size() > MAX_COVER_STORED_BYTES) return "";
            return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
        } finally {
            if (thumbnail != null && thumbnail != decoded) thumbnail.recycle();
            decoded.recycle();
        }
    }

    private static boolean isImageArchiveEntry(String path) {
        if (path == null) return false;
        String p = path.toLowerCase(Locale.ROOT);
        return p.endsWith(".jpg") || p.endsWith(".jpeg") || p.endsWith(".png") || p.endsWith(".webp") || p.endsWith(".gif") || p.endsWith(".bmp");
    }

    private static boolean isTextArchiveEntry(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        return p.endsWith(".xml") || p.endsWith(".opf") || p.endsWith(".xhtml") || p.endsWith(".html") || p.endsWith(".htm");
    }

    private static String parseRootfile(String xml) throws Exception {
        XmlPullParser parser = Xml.newPullParser();
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_DOCDECL, false);
        parser.setInput(new StringReader(xml != null && xml.startsWith("\uFEFF") ? xml.substring(1) : xml));
        int event;
        while ((event = parser.next()) != XmlPullParser.END_DOCUMENT) {
            if (event == XmlPullParser.START_TAG && "rootfile".equals(localXmlName(parser.getName()))) {
                String path = parser.getAttributeValue(null, "full-path");
                if (path != null) return path;
            }
        }
        return null;
    }

    private static String resolveEpubPath(String opfPath, String href) {
        if (href == null || href.contains("://")) return null;
        int cut = href.length();
        int query = href.indexOf('?'), fragment = href.indexOf('#');
        if (query >= 0) cut = Math.min(cut, query);
        if (fragment >= 0) cut = Math.min(cut, fragment);
        String cleanHref = Uri.decode(href.substring(0, cut));
        int slash = opfPath.lastIndexOf('/');
        String base = slash < 0 ? "" : opfPath.substring(0, slash + 1);
        return normalizeZipPath(base + cleanHref);
    }

    private static String normalizeZipPath(String path) {
        if (path == null || path.trim().isEmpty()) return null;
        String decoded = Uri.decode(path).replace('\\', '/');
        if (decoded.startsWith("/")) decoded = decoded.substring(1);
        Stack<String> parts = new Stack<>();
        for (String part : decoded.split("/")) {
            if (part.isEmpty() || ".".equals(part)) continue;
            if ("..".equals(part)) {
                if (parts.empty()) return null;
                parts.pop();
            } else parts.push(part);
        }
        if (parts.empty()) return null;
        StringBuilder result = new StringBuilder();
        for (String part : parts) {
            if (result.length() > 0) result.append('/');
            result.append(part);
        }
        return result.toString();
    }

    @Override @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("window.paperIsleBack ? window.paperIsleBack() : false", value -> {
            if (!"true".equals(value)) MainActivity.super.onBackPressed();
        });
    }

    @Override protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("Android");
            webView.destroy();
            webView = null;
        }
        stopSystemSpeech();
        releaseOnlinePlayer();
        if (audioReceiverRegistered && audioPlaybackReceiver != null) {
            try { unregisterReceiver(audioPlaybackReceiver); } catch (Exception ignored) { }
            audioReceiverRegistered = false;
        }
        if (tts != null) {
            tts.shutdown();
            tts = null;
        }
        super.onDestroy();
    }
}
