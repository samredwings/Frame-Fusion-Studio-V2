package com.hasansaimon.framefusionstudio;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.util.Log;

import androidx.annotation.NonNull;

import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.RandomAccessFile;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/**
 * Native video inspection, full-resolution frame extraction and conservative
 * heuristic removal primitives. Repair uses a naive diffusion approximation;
 * it is not OpenCV inpainting, optical flow, OCR, AI/logo recognition or MP4
 * reconstruction.
 */
@CapacitorPlugin(name = "FrameExtractor")
public class FrameExtractorPlugin extends Plugin {
    private static final String TAG = "FrameExtractor";
    private static final int MAX_PAGE_SIZE = 5000;
    private static final int MAX_RANGE_SIZE = 250;
    private static final int DEFAULT_THUMB_WIDTH = 160;
    private static final long MAX_REPAIR_PATCH_PIXELS = 1_500_000L;

    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "FrameFusion-Media");
        thread.setPriority(Thread.NORM_PRIORITY);
        return thread;
    });

    private interface NativeTask {
        JSObject run() throws Exception;
    }

    private void execute(PluginCall call, NativeTask task) {
        try {
            worker.execute(() -> {
                try {
                    call.resolve(task.run());
                } catch (Exception error) {
                    Log.e(TAG, "Native media operation failed", error);
                    call.reject(error.getMessage() == null ? "Native media operation failed." : error.getMessage());
                }
            });
        } catch (RejectedExecutionException error) {
            call.reject("The media worker is shutting down. Reopen the app and try again.");
        }
    }

    @Override
    protected void handleOnDestroy() {
        worker.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void pickVideo(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("video/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "handleVideoPicked");
    }

    @ActivityCallback
    private void handleVideoPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Video selection was cancelled.");
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("The selected video did not provide a readable URI.");
            return;
        }

        boolean persisted = false;
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
            persisted = true;
        } catch (SecurityException error) {
            Log.w(TAG, "Provider did not grant persistable permission; current read grant remains usable.", error);
        }

        JSObject value = new JSObject();
        value.put("uri", uri.toString());
        value.put("filename", queryDisplayName(uri));
        value.put("sizeBytes", querySize(uri));
        value.put("mimeType", getContext().getContentResolver().getType(uri));
        value.put("persistablePermission", persisted);
        call.resolve(value);
    }

    @PluginMethod
    public void getVideoInfo(PluginCall call) {
        String uriText = call.getString("uri");
        if (uriText == null || uriText.trim().isEmpty()) {
            call.reject("uri is required.");
            return;
        }

        execute(call, () -> inspectVideo(Uri.parse(uriText)));
    }

    private JSObject insp