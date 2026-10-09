package app.paperisle.reader;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import java.io.File;

public class OnlinePlaybackService extends Service {
    public static final String ACTION_PLAY = "app.paperisle.reader.action.PLAY_AUDIO";
    public static final String ACTION_STOP = "app.paperisle.reader.action.STOP_AUDIO";
    public static final String ACTION_COMPLETED = "app.paperisle.reader.action.AUDIO_COMPLETED";
    public static final String EXTRA_PATH = "audio_path";
    public static final String EXTRA_TOKEN = "play_token";
    private static final String CHANNEL = "paperisle_reader_audio";
    private static final int NOTIFICATION_ID = 7431;
    private MediaPlayer player;
    private File activeFile;
    private String currentToken = "";

    @Override public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "纸屿后台朗读", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("在其他应用中继续播放阅读语音");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            String token = currentToken;
            stopPlayback();
            Intent stopped = new Intent(ACTION_COMPLETED).setPackage(getPackageName());
            stopped.putExtra(EXTRA_TOKEN, token).putExtra("play_stopped", true);
            sendBroadcast(stopped);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelfResult(startId);
            return START_NOT_STICKY;
        }
        if (!ACTION_PLAY.equals(action)) return START_NOT_STICKY;
        startForeground(NOTIFICATION_ID, buildNotification());
        String path = intent.getStringExtra(EXTRA_PATH);
        String token = intent.getStringExtra(EXTRA_TOKEN);
        if (path != null) play(path, token == null ? "" : token);
        return START_NOT_STICKY;
    }

    private Notification buildNotification() {
        Intent stop = new Intent(this, OnlinePlaybackService.class).setAction(ACTION_STOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent stopPending = PendingIntent.getService(this, 7432, stop, flags);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL)
                : new Notification.Builder(this);
        builder.setContentTitle("纸屿阅读")
                .setContentText("正在后台朗读")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause, "停止", stopPending).build());
        return builder.build();
    }

    private void play(String path, String token) {
        stopPlayerOnly();
        currentToken = token;
        activeFile = new File(path);
        try {
            MediaPlayer next = new MediaPlayer();
            player = next;
            next.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            next.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            next.setDataSource(path);
            next.setOnPreparedListener(MediaPlayer::start);
            next.setOnCompletionListener(mp -> {
                stopPlayerOnly();
                Intent completed = new Intent(ACTION_COMPLETED).setPackage(getPackageName());
                completed.putExtra(EXTRA_TOKEN, token);
                sendBroadcast(completed);
            });
            next.setOnErrorListener((mp, what, extra) -> {
                stopPlayerOnly();
                Intent completed = new Intent(ACTION_COMPLETED).setPackage(getPackageName());
                completed.putExtra(EXTRA_TOKEN, token);
                completed.putExtra("play_error", true);
                sendBroadcast(completed);
                return true;
            });
            next.prepareAsync();
        } catch (Exception e) {
            stopPlayerOnly();
            Intent completed = new Intent(ACTION_COMPLETED).setPackage(getPackageName());
            completed.putExtra(EXTRA_TOKEN, token);
            completed.putExtra("play_error", true);
            sendBroadcast(completed);
        }
    }

    private void stopPlayerOnly() {
        if (player != null) {
            try { player.setOnCompletionListener(null); player.setOnErrorListener(null); player.reset(); player.release(); }
            catch (Exception ignored) { }
            player = null;
        }
        if (activeFile != null) {
            try { activeFile.delete(); } catch (Exception ignored) { }
            activeFile = null;
        }
    }

    private void stopPlayback() { stopPlayerOnly(); }

    @Override public void onDestroy() {
        stopPlayback();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
