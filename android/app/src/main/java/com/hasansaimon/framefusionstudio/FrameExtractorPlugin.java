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

    private JSObject inspectVideo(Uri uri) throws Exception {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        MediaExtractor extractor = new MediaExtractor();
        try {
            retriever.setDataSource(getContext(), uri);
            extractor.setDataSource(getContext(), uri, null);

            long durationMs = parseLong(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
            int rotation = parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION));
            int width = parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
            int height = parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
            int bitrate = parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE));

            int metadataFrameCount = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                metadataFrameCount = parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT));
            }

            String videoMime = "";
            float nominalFps = 0f;
            int videoTrack = -1;
            boolean hasAudio = false;
            String audioMime = null;
            int audioChannels = 0;
            int audioSampleRate = 0;
            int audioBitrate = 0;
            long trackDurationUs = durationMs * 1000L;

            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime == null) continue;

                if (mime.startsWith("video/") && videoTrack < 0) {
                    videoTrack = i;
                    videoMime = mime;
                    if (format.containsKey(MediaFormat.KEY_FRAME_RATE)) {
                        nominalFps = format.getInteger(MediaFormat.KEY_FRAME_RATE);
                    }
                    if (format.containsKey(MediaFormat.KEY_DURATION)) {
                        trackDurationUs = Math.max(trackDurationUs, format.getLong(MediaFormat.KEY_DURATION));
                    }
                    if (width <= 0 && format.containsKey(MediaFormat.KEY_WIDTH)) width = format.getInteger(MediaFormat.KEY_WIDTH);
                    if (height <= 0 && format.containsKey(MediaFormat.KEY_HEIGHT)) height = format.getInteger(MediaFormat.KEY_HEIGHT);
                    if (bitrate <= 0 && format.containsKey(MediaFormat.KEY_BIT_RATE)) bitrate = format.getInteger(MediaFormat.KEY_BIT_RATE);
                } else if (mime.startsWith("audio/") && !hasAudio) {
                    hasAudio = true;
                    audioMime = mime;
                    if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) audioChannels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                    if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) audioSampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                    if (format.containsKey(MediaFormat.KEY_BIT_RATE)) audioBitrate = format.getInteger(MediaFormat.KEY_BIT_RATE);
                }
            }
            if (videoTrack < 0) throw new IllegalArgumentException("The selected file has no video track.");

            float captureFps = parseFloat(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE));
            JSObject value = new JSObject();
            value.put("uri", uri.toString());
            value.put("filename", queryDisplayName(uri));
            value.put("sizeBytes", querySize(uri));
            value.put("durationMs", durationMs);
            value.put("metadataFrameCount", metadataFrameCount);
            value.put("nominalFrameRate", nominalFps);
            value.put("averageFrameRate", 0);
            value.put("captureFrameRate", captureFps);
            value.put("width", width);
            value.put("height", height);
            value.put("rotation", rotation);
            value.put("videoMimeType", videoMime);
            value.put("videoBitrate", bitrate);
            value.put("hasAudio", hasAudio);
            if (audioMime != null) value.put("audioMimeType", audioMime);
            value.put("audioChannels", audioChannels);
            value.put("audioSampleRate", audioSampleRate);
            value.put("audioBitrate", audioBitrate);
            value.put("frameCountIsIndexed", false);
            return value;
        } finally {
            try { extractor.release(); } catch (RuntimeException ignored) { }
            try { retriever.release(); } catch (RuntimeException ignored) { }
        }
    }

    @PluginMethod
    public void buildFrameIndex(PluginCall call) {
        String uriText = call.getString("uri");
        if (uriText == null || uriText.trim().isEmpty()) {
            call.reject("uri is required.");
            return;
        }
        execute(call, () -> buildIndex(Uri.parse(uriText)));
    }

    private JSObject buildIndex(Uri uri) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        List<Long> timestamps = new ArrayList<>();
        long durationUs = 0;
        int metadataFrameCount = 0;
        int videoTrack = -1;
        float nominalFps = 0f;

        // Track duration may be missing for some containers. Use container metadata
        // as a second source so the final frame has a meaningful presentation interval.
        MediaMetadataRetriever metadata = new MediaMetadataRetriever();
        try {
            metadata.setDataSource(getContext(), uri);
            metadataFrameCount = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? parseInt(metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT))
                : 0;
            long metadataDurationMs = parseLong(metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
            if (metadataDurationMs > 0) durationUs = metadataDurationMs * 1000L;
        } finally {
            metadata.release();
        }

        try {
            extractor.setDataSource(getContext(), uri, null);
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("video/")) {
                    videoTrack = i;
                    if (format.containsKey(MediaFormat.KEY_DURATION)) durationUs = format.getLong(MediaFormat.KEY_DURATION);
                    if (format.containsKey(MediaFormat.KEY_FRAME_RATE)) nominalFps = format.getInteger(MediaFormat.KEY_FRAME_RATE);
                    break;
                }
            }
            if (videoTrack < 0) throw new IllegalArgumentException("No video track found.");

            extractor.selectTrack(videoTrack);
            while (true) {
                int sampleTrack = extractor.getSampleTrackIndex();
                long pts = extractor.getSampleTime();
                if (sampleTrack < 0 || pts < 0) break;
                if (sampleTrack == videoTrack) timestamps.add(pts);
                if (!extractor.advance()) break;
            }
        } finally {
            extractor.release();
        }

        if (timestamps.isEmpty()) throw new IllegalStateException("No video frame timestamps were found.");
        // A chronological index is required by the editor. Store presentation timestamps,
        // not decode-order positions or duration × FPS estimates.
        Collections.sort(timestamps);
        long lastPts = timestamps.get(timestamps.size() - 1);
        if (durationUs <= lastPts) {
            long fallbackDuration = 33_333L;
            if (timestamps.size() > 1) {
                fallbackDuration = Math.max(1L, lastPts - timestamps.get(timestamps.size() - 2));
            } else if (nominalFps > 0f) {
                fallbackDuration = Math.max(1L, Math.round(1_000_000.0 / nominalFps));
            }
            durationUs = lastPts + fallbackDuration;
        }

        String indexId = sha256(uri.toString());
        File indexDir = new File(getContext().getFilesDir(), "frame_fusion/indexes");
        if (!indexDir.exists() && !indexDir.mkdirs()) throw new IllegalStateException("Could not create the video index directory.");
        File indexFile = new File(indexDir, indexId + ".pts");
        File tempFile = new File(indexDir, indexId + ".pts.tmp");

        try (FileOutputStream fileOut = new FileOutputStream(tempFile);
             DataOutputStream out = new DataOutputStream(new BufferedOutputStream(fileOut))) {
            out.writeInt(timestamps.size());
            out.writeLong(durationUs);
            for (Long pts : timestamps) out.writeLong(pts);
            out.flush();
            fileOut.getFD().sync();
        }
        if (indexFile.exists() && !indexFile.delete()) throw new IllegalStateException("Could not replace the previous frame index.");
        if (!tempFile.renameTo(indexFile)) throw new IllegalStateException("Could not finalize the frame timestamp index.");

        int frameCount = timestamps.size();
        float averageFps = 0f;
        if (frameCount > 1) {
            long spanUs = timestamps.get(frameCount - 1) - timestamps.get(0);
            if (spanUs > 0) averageFps = (float) ((frameCount - 1) * 1_000_000.0 / spanUs);
        }
        boolean isVfr = detectVariableFrameRate(timestamps);
        boolean verified = metadataFrameCount > 0 && metadataFrameCount == frameCount;

        JSObject value = new JSObject();
        value.put("uri", uri.toString());
        value.put("indexId", indexId);
        value.put("frameCount", frameCount);
        value.put("durationUs", durationUs);
        value.put("nominalFrameRate", nominalFps);
        value.put("averageFrameRate", averageFps);
        value.put("hasVariableFrameRate", isVfr);
        value.put("indexVerified", verified);
        value.put("metadataFrameCount", metadataFrameCount);
        if (!verified) {
            String warning = metadataFrameCount <= 0
                ? "Android did not provide an independent metadata frame count. The sample index was built but has not been cross-checked."
                : "Android metadata reports " + metadataFrameCount + " frames but the timestamp index contains " + frameCount + " samples.";
            value.put("warning", warning + " Exact frame reconstruction should remain disabled until this source is validated.");
        }
        return value;
    }

    private boolean detectVariableFrameRate(List<Long> timestamps) {
        if (timestamps.size() < 4) return false;
        List<Long> deltas = new ArrayList<>();
        for (int i = 1; i < timestamps.size(); i++) {
            long delta = timestamps.get(i) - timestamps.get(i - 1);
            if (delta > 0) deltas.add(delta);
        }
        if (deltas.size() < 3) return false;
        Collections.sort(deltas);
        long median = deltas.get(deltas.size() / 2);
        long tolerance = Math.max(1000L, (long) (median * 0.02));
        for (Long delta : deltas) {
            if (Math.abs(delta - median) > tolerance) return true;
        }
        return false;
    }

    @PluginMethod
    public void getFrameTimestampPage(PluginCall call) {
        String uriText = call.getString("uri");
        int start = call.getInt("startFrameIndex", 0);
        int limit = call.getInt("limit", 500);
        if (uriText == null || start < 0 || limit < 1 || limit > MAX_PAGE_SIZE) {
            call.reject("uri, a non-negative startFrameIndex and limit between 1 and " + MAX_PAGE_SIZE + " are required.");
            return;
        }
        execute(call, () -> readTimestampPage(Uri.parse(uriText), start, limit));
    }

    private JSObject readTimestampPage(Uri uri, int start, int limit) throws Exception {
        String indexId = sha256(uri.toString());
        File indexFile = getIndexFile(indexId);
        try (RandomAccessFile index = new RandomAccessFile(indexFile, "r")) {
            int total = index.readInt();
            long durationUs = index.readLong();
            if (start >= total && total > 0) throw new IllegalArgumentException("Requested frame page starts beyond the video.");
            int count = Math.min(limit, Math.max(0, total - start));
            JSONArrayBuilder entries = new JSONArrayBuilder();
            for (int i = 0; i < count; i++) {
                int frameIndex = start + i;
                long pts = readPts(index, frameIndex);
                long nextPts = frameIndex + 1 < total ? readPts(index, frameIndex + 1) : durationUs;
                long frameDuration = Math.max(1L, nextPts - pts);
                JSObject entry = new JSObject();
                entry.put("frameIndex", frameIndex);
                entry.put("presentationTimeUs", pts);
                entry.put("durationUs", frameDuration);
                entries.add(entry);
            }
            JSObject value = new JSObject();
            value.put("indexId", indexId);
            value.put("totalFrameCount", total);
            value.put("startFrameIndex", start);
            value.put("entries", entries.toArray());
            return value;
        }
    }

    private static class JSONArrayBuilder {
        private final org.json.JSONArray array = new org.json.JSONArray();
        void add(JSObject value) { array.put(value); }
        org.json.JSONArray toArray() { return array; }
    }

    @PluginMethod
    public void extractFrame(PluginCall call) {
        String uriText = call.getString("uri");
        int frameIndex = call.getInt("frameIndex", -1);
        int targetWidth = call.getInt("targetWidth", 0);
        int quality = clamp(call.getInt("quality", 95), 1, 100);
        if (uriText == null || frameIndex < 0 || targetWidth < 0) {
            call.reject("uri, a non-negative frameIndex and non-negative targetWidth are required.");
            return;
        }
        execute(call, () -> {
            Uri uri = Uri.parse(uriText);
            File indexFile = getIndexFile(sha256(uriText));
            try (RandomAccessFile index = new RandomAccessFile(indexFile, "r")) {
                int total = index.readInt();
                long duration = index.readLong();
                if (frameIndex >= total) throw new IllegalArgumentException("Frame index is outside the video.");
                long pts = readPts(index, frameIndex);
                return extractOne(uri, sha256(uriText), frameIndex, pts, targetWidth, quality);
            }
        });
    }

    private JSObject extractOne(Uri uri, String indexId, int frameIndex, long pts, int targetWidth, int quality) throws Exception {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        Bitmap bitmap = null;
        try {
            retriever.setDataSource(getContext(), uri);
            boolean exact = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P;
            bitmap = exact ? retriever.getFrameAtIndex(frameIndex) :
                retriever.getFrameAtTime(pts, MediaMetadataRetriever.OPTION_CLOSEST);
            if (bitmap == null) throw new IllegalStateException("Android could not decode frame " + frameIndex + ".");

            if (targetWidth > 0 && bitmap.getWidth() > targetWidth) {
                int newHeight = Math.max(1, Math.round(bitmap.getHeight() * (targetWidth / (float) bitmap.getWidth())));
                Bitmap scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, newHeight, true);
                if (scaled != bitmap) bitmap.recycle();
                bitmap = scaled;
            }

            File outputDir = getOutputDir("frames", indexId);
            File output = new File(outputDir, String.format(Locale.US, "frame-%09d.jpg", frameIndex));
            writeBitmap(bitmap, output, quality);
            JSObject value = new JSObject();
            value.put("frameIndex", frameIndex);
            value.put("presentationTimeUs", pts);
            value.put("outputPath", output.getAbsolutePath());
            value.put("width", bitmap.getWidth());
            value.put("height", bitmap.getHeight());
            value.put("fileSize", output.length());
            value.put("exactFrameIndex", exact);
            return value;
        } finally {
            if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
            retriever.release();
        }
    }

    @PluginMethod
    public void extractFrameRange(PluginCall call) {
        String uriText = call.getString("uri");
        int start = call.getInt("startFrameIndex", -1);
        int end = call.getInt("endFrameIndex", -1);
        int targetWidth = call.getInt("targetWidth", 0);
        int quality = clamp(call.getInt("quality", 95), 1, 100);
        if (uriText == null || start < 0 || end < start || targetWidth < 0 || end - start + 1 > MAX_RANGE_SIZE) {
            call.reject("Provide a valid frame range of at most " + MAX_RANGE_SIZE + " frames.");
            return;
        }
        execute(call, () -> extractRange(Uri.parse(uriText), start, end, targetWidth, quality));
    }

    private JSObject extractRange(Uri uri, int start, int end, int targetWidth, int quality) throws Exception {
        String indexId = sha256(uri.toString());
        File indexFile = getIndexFile(indexId);
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        JSArray frames = new JSArray();
        int done = 0;
        try (RandomAccessFile index = new RandomAccessFile(indexFile, "r")) {
            int total = index.readInt();
            if (start < 0 || end >= total) throw new IllegalArgumentException("Frame range is outside the indexed video.");
            retriever.setDataSource(getContext(), uri);
            File outputDir = getOutputDir("frames", indexId);
            for (int frameIndex = start; frameIndex <= end; frameIndex++) {
                long pts = readPts(index, frameIndex);
                boolean exact = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P;
                Bitmap bitmap = exact ? retriever.getFrameAtIndex(frameIndex) :
                    retriever.getFrameAtTime(pts, MediaMetadataRetriever.OPTION_CLOSEST);
                if (bitmap == null) throw new IllegalStateException("Could not decode frame " + frameIndex + ".");
                try {
                    if (targetWidth > 0 && bitmap.getWidth() > targetWidth) {
                        int h = Math.max(1, Math.round(bitmap.getHeight() * (targetWidth / (float) bitmap.getWidth())));
                        Bitmap scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, h, true);
                        if (scaled != bitmap) {
                            bitmap.recycle();
                            bitmap = scaled;
                        }
                    }
                    File output = new File(outputDir, String.format(Locale.US, "frame-%09d.jpg", frameIndex));
                    writeBitmap(bitmap, output, quality);
                    JSObject frame = new JSObject();
                    frame.put("frameIndex", frameIndex);
                    frame.put("presentationTimeUs", pts);
                    frame.put("outputPath", output.getAbsolutePath());
                    frame.put("width", bitmap.getWidth());
                    frame.put("height", bitmap.getHeight());
                    frame.put("fileSize", output.length());
                    frame.put("exactFrameIndex", exact);
                    frames.put(frame);
                } finally {
                    if (!bitmap.isRecycled()) bitmap.recycle();
                }
                done++;
                if (done == 1 || done % 5 == 0 || done == end - start + 1) {
                    JSObject progress = new JSObject();
                    progress.put("operationId", indexId + ":" + start + "-" + end);
                    progress.put("currentFrame", done);
                    progress.put("totalFrames", end - start + 1);
                    progress.put("progressPercent", Math.round(done * 100f / (end - start + 1)));
                    notifyListeners("extractProgress", progress);
                }
            }
        } finally {
            retriever.release();
        }
        JSObject value = new JSObject();
        value.put("indexId", indexId);
        value.put("startFrameIndex", start);
        value.put("endFrameIndex", end);
        value.put("extractedCount", done);
        value.put("frames", frames);
        return value;
    }

    @PluginMethod
    public void generateThumbnails(PluginCall call) {
        String uriText = call.getString("uri");
        int requestedCount = call.getInt("count", 100);
        int width = call.getInt("width", DEFAULT_THUMB_WIDTH);
        int quality = clamp(call.getInt("quality", 80), 1, 100);
        if (uriText == null || requestedCount < 1 || requestedCount > 500 || width < 24) {
            call.reject("uri, count (1-500) and width (at least 24px) are required.");
            return;
        }
        execute(call, () -> generateThumbnails(Uri.parse(uriText), requestedCount, width, quality));
    }

    private JSObject generateThumbnails(Uri uri, int requestedCount, int targetWidth, int quality) throws Exception {
        String indexId = sha256(uri.toString());
        File indexFile = getIndexFile(indexId);
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        JSArray thumbnails = new JSArray();
        try (RandomAccessFile index = new RandomAccessFile(indexFile, "r")) {
            int total = index.readInt();
            if (total <= 0) throw new IllegalStateException("The source video has no indexed frames.");
            int count = Math.min(requestedCount, total);
            retriever.setDataSource(getContext(), uri);
            File outputDir = getOutputDir("thumbnails", indexId);

            for (int i = 0; i < count; i++) {
                int frameIndex = count == 1 ? 0 : Math.round(i * (total - 1f) / (count - 1f));
                long pts = readPts(index, frameIndex);
                Bitmap bitmap = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? retriever.getFrameAtIndex(frameIndex)
                    : retriever.getFrameAtTime(pts, MediaMetadataRetriever.OPTION_CLOSEST);
                if (bitmap == null) continue;
                try {
                    if (bitmap.getWidth() > targetWidth) {
                        int h = Math.max(1, Math.round(bitmap.getHeight() * (targetWidth / (float) bitmap.getWidth())));
                        Bitmap scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, h, true);
                        if (scaled != bitmap) {
                            bitmap.recycle();
                            bitmap = scaled;
                        }
                    }
                    File output = new File(outputDir, String.format(Locale.US, "thumb-%09d.jpg", frameIndex));
                    writeBitmap(bitmap, output, quality);
                    JSObject thumb = new JSObject();
                    thumb.put("frameIndex", frameIndex);
                    thumb.put("presentationTimeUs", pts);
                    thumb.put("timestampMs", pts / 1000.0);
                    thumb.put("outputPath", output.getAbsolutePath());
                    thumb.put("width", bitmap.getWidth());
                    thumb.put("height", bitmap.getHeight());
                    thumb.put("fileSize", output.length());
                    thumb.put("exactFrameIndex", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P);
                    thumbnails.put(thumb);
                } finally {
                    if (!bitmap.isRecycled()) bitmap.recycle();
                }
            }
        } finally {
            retriever.release();
        }
        JSObject value = new JSObject();
        value.put("indexId", indexId);
        value.put("generatedCount", thumbnails.length());
        value.put("thumbnails", thumbnails);
        return value;
    }

    @PluginMethod
    public void detectWatermark(PluginCall call) {
        String uri = call.getString("uri");
        int frameIndex = call.getInt("frameIndex", -1);
        JSArray methodsArray = call.getArray("detectionMethods");
        if (uri == null || uri.trim().isEmpty() || frameIndex < 0) {
            call.reject("uri and a non-negative frameIndex are required.");
            return;
        }
        try {
            String[] methods = new String[methodsArray == null ? 0 : methodsArray.length()];
            for (int i = 0; i < methods.length; i++) methods[i] = methodsArray.getString(i);
            execute(call, () -> detectWatermark(uri, frameIndex, methods));
        } catch (Exception error) {
            call.reject("Could not read detection methods.", error);
        }
    }

    private JSObject detectWatermark(String uriText, int frameIndex, String[] detectionMethods) throws Exception {
        Uri uri = Uri.parse(uriText);
        String indexId = sha256(uriText);
        File indexFile = getIndexFile(indexId);
        Bitmap bitmap;
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try (RandomAccessFile index = new RandomAccessFile(indexFile, "r")) {
            int count = index.readInt();
            if (frameIndex < 0 || frameIndex >= count) throw new IllegalArgumentException("Frame index is outside the timestamp map.");
            long pts = readPts(index, frameIndex);
            retriever.setDataSource(getContext(), uri);
            bitmap = getFrameAtIndex(retriever, frameIndex, pts);
            if (bitmap == null) throw new IllegalStateException("Could not decode frame " + frameIndex + " for detection.");
        } finally {
            retriever.release();
        }

        JSArray detections = new JSArray();
        JSArray unsupported = new JSArray();
        try {
            boolean staticScanRequested = detectionMethods == null || detectionMethods.length == 0;
            if (detectionMethods != null) {
                for (String method : detectionMethods) {
                    if ("static-region".equals(method)) staticScanRequested = true;
                    else if (method != null && !method.trim().isEmpty()) unsupported.put(method);
                }
            }
            if (staticScanRequested) {
                // Conservative candidate windows only. This compares edge density
                // in likely overlay areas with the surrounding border. It does not
                // identify logos, read text, or provide a trained detection model.
                double[][] candidates = new double[][] {
                    {0.02, 0.02, 0.30, 0.16},
                    {0.68, 0.02, 0.30, 0.16},
                    {0.02, 0.82, 0.36, 0.16},
                    {0.62, 0.82, 0.36, 0.16},
                    {0.30, 0.84, 0.40, 0.14}
                };
                for (int i = 0; i < candidates.length; i++) {
                    double[] bounds = candidates[i];
                    double score = measureOverlayContrast(bitmap, bounds);
                    if (score < 0.38) continue;
                    JSObject detection = new JSObject();
                    detection.put("id", sha256(uriText + ":" + frameIndex + ":" + i).substring(0, 24));
                    detection.put("type", "unknown");
                    detection.put("detectionMethod", "static-region");
                    JSObject rect = new JSObject();
                    rect.put("x", bounds[0]);
                    rect.put("y", bounds[1]);
                    rect.put("width", bounds[2]);
                    rect.put("height", bounds[3]);
                    detection.put("bounds", rect);
                    detection.put("confidence", score);
                    detection.put("detectedAtFrameIndex", frameIndex);
                    detection.put("isPersistent", false);
                    detections.put(detection);
                }
            }
        } finally {
            if (!bitmap.isRecycled()) bitmap.recycle();
        }
        JSObject result = new JSObject();
        result.put("uri", uriText);
        result.put("frameIndex", frameIndex);
        result.put("detections", detections);
        result.put("unsupportedMethods", unsupported);
        result.put("warning", "Heuristic static-region candidates only. No OCR, ML, logo recognition or persistence tracking is implemented.");
        return result;
    }

    private double measureOverlayContrast(Bitmap bitmap, double[] normalized) {
        int left = clamp((int) Math.floor(normalized[0] * bitmap.getWidth()), 0, bitmap.getWidth() - 1);
        int top = clamp((int) Math.floor(normalized[1] * bitmap.getHeight()), 0, bitmap.getHeight() - 1);
        int right = clamp((int) Math.ceil((normalized[0] + normalized[2]) * bitmap.getWidth()), left + 1, bitmap.getWidth());
        int bottom = clamp((int) Math.ceil((normalized[1] + normalized[3]) * bitmap.getHeight()), top + 1, bitmap.getHeight());
        int width = right - left;
        int height = bottom - top;
        int[] pixels = new int[width * height];
        bitmap.getPixels(pixels, 0, width, left, top, width, height);
        double edgeInside = 0;
        long edgeCountInside = 0;
        for (int y = 1; y < height; y++) {
            for (int x = 1; x < width; x++) {
                int a = luminance(pixels[y * width + x]);
                int b = luminance(pixels[y * width + x - 1]);
                int c = luminance(pixels[(y - 1) * width + x]);
                edgeInside += (Math.abs(a - b) + Math.abs(a - c)) / 510.0;
                edgeCountInside++;
            }
        }
        if (edgeCountInside == 0) return 0;
        double density = edgeInside / edgeCountInside;
        // Confidence is deliberately capped below a level that could be mistaken
        // for a statistically validated detector score.
        return Math.min(0.64, Math.max(0.0, 0.30 + density * 0.48));
    }

    private int luminance(int color) {
        return (int) (0.2126 * ((color >> 16) & 0xff) + 0.7152 * ((color >> 8) & 0xff) + 0.0722 * (color & 0xff));
    }

    @PluginMethod
    public void removeWatermark(PluginCall call) {
        String uri = call.getString("uri");
        String watermarkId = call.getString("watermarkId");
        JSObject bounds = call.getObject("bounds");
        int start = call.getInt("startFrameIndex", -1);
        int end = call.getInt("endFrameIndex", -1);
        JSObject settings = call.getObject("settings");
        if (uri == null || watermarkId == null || bounds == null || settings == null || start < 0 || end < start) {
            call.reject("uri, watermarkId, bounds, settings and a valid frame range are required.");
            return;
        }
        String operationId = "watermark-" + watermarkId + "-" + System.currentTimeMillis();
        executeRemoval(call, operationId, () -> {
            JSObject result = removeWatermark(uri, operationId, bounds, start, end, settings);
            result.put("watermarkId", watermarkId);
            return result;
        });
    }

    private JSObject removeWatermark(String uri, String operationId, JSObject bounds,
                                     int startFrameIndex, int endFrameIndex, JSObject settings) throws Exception {
        return removeVideoRegion(uri, operationId, bounds, startFrameIndex, endFrameIndex, settings, "watermark", null);
    }

    @PluginMethod
    public void removeText(PluginCall call) {
        String uri = call.getString("uri");
        JSObject bounds = call.getObject("bounds");
        int start = call.getInt("startFrameIndex", -1);
        int end = call.getInt("endFrameIndex", -1);
        JSObject settings = call.getObject("settings");
        String detectionMethod = call.getString("detectionMethod", "manual");
        if (uri == null || bounds == null || settings == null || start < 0 || end < start) {
            call.reject("uri, bounds, settings and a valid frame range are required.");
            return;
        }
        String operationId = "text-" + System.currentTimeMillis();
        executeRemoval(call, operationId, () -> removeText(uri, bounds, start, end, settings, detectionMethod, operationId));
    }

    private JSObject removeText(String uri, JSObject bounds, int startFrameIndex, int endFrameIndex,
                                JSObject settings, String detectionMethod, String operationId) throws Exception {
        JSObject result = removeVideoRegion(uri, operationId, bounds, startFrameIndex, endFrameIndex, settings, "text", detectionMethod);
        result.put("detectionMethod", detectionMethod);
        return result;
    }

    @PluginMethod
    public void previewRemoval(PluginCall call) {
        String uri = call.getString("uri");
        String framePath = call.getString("framePath");
        JSObject bounds = call.getObject("bounds");
        String algorithm = call.getString("algorithm", "naive-diffusion");
        String donorFramePath = call.getString("donorFramePath");
        int feather = clamp(call.getInt("featherPx", 8), 0, 512);
        int expansion = clamp(call.getInt("expansionPx", 4), 0, 512);
        if (uri == null || uri.trim().isEmpty() || framePath == null || bounds == null) {
            call.reject("uri, framePath and bounds are required.");
            return;
        }
        String operationId = "preview-" + System.currentTimeMillis();
        executeRemoval(call, operationId, () -> previewRemoval(uri, framePath, bounds, algorithm, donorFramePath, feather, expansion, operationId));
    }

    private JSObject previewRemoval(String uri, String framePath, JSObject bounds, String algorithm,
                                    String donorFramePath, int featherPx, int expansionPx,
                                    String operationId) throws Exception {
        validateRemovalAlgorithm(algorithm);
        Bitmap decoded = BitmapFactory.decodeFile(framePath);
        if (decoded == null) throw new IllegalArgumentException("Could not decode the selected frame path.");
        Bitmap target = MutableFrameBitmap.copyAndRecycle(decoded);
        Bitmap donor = donorFramePath == null || donorFramePath.trim().isEmpty() ? null : BitmapFactory.decodeFile(donorFramePath);
        if (donorFramePath != null && !donorFramePath.trim().isEmpty() && donor == null) {
            target.recycle();
            throw new IllegalArgumentException("Could not decode the donor frame path.");
        }
        try {
            applyNaiveRemoval(target, bounds, algorithm, donor, null, null, featherPx, expansionPx);
            String indexId = sha256(uri);
            File output = RepairStoragePaths.previewFile(
                getContext().getFilesDir(), indexId, sha256(operationId).substring(0, 16)
            );
            File previewDir = output.getParentFile();
            if (previewDir == null || (!previewDir.exists() && !previewDir.mkdirs())) {
                throw new IllegalStateException("Could not create the source-owned preview directory.");
            }
            writeBitmap(target, output, 95);
            JSObject result = new JSObject();
            result.put("operationId", operationId);
            result.put("uri", uri);
            result.put("previewPath", output.getAbsolutePath());
            result.put("width", target.getWidth());
            result.put("height", target.getHeight());
            result.put("implementation", "naive-diffusion");
            result.put("warning", "Preview uses naive spatial diffusion and optional same-coordinate donor blending; it is not OpenCV or motion-compensated repair.");
            return result;
        } finally {
            if (donor != null && !donor.isRecycled()) donor.recycle();
            if (!target.isRecycled()) target.recycle();
        }
    }

    private JSObject removeVideoRegion(String uriText, String operationId, JSObject bounds,
                                       int startFrameIndex, int endFrameIndex, JSObject settings,
                                       String removalType, String detectionMethod) throws Exception {
        Uri uri = Uri.parse(uriText);
        String indexId = sha256(uriText);
        File indexFile = getIndexFile(indexId);
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        int total = endFrameIndex - startFrameIndex + 1;
        JSArray outputs = new JSArray();
        Bitmap donor = null;
        Bitmap previous = null;
        int quality = clamp(settings.optInt("quality", 92), 1, 100);
        int feather = clamp(settings.optInt("featherPx", 8), 0, 512);
        int expansion = clamp(settings.optInt("expansionPx", 4), 0, 512);
        int donorFrameIndex = settings.optInt("donorFrameIndex", -1);
        String algorithm = settings.optString("algorithm", "naive-diffusion");
        validateRemovalAlgorithm(algorithm);
        try (RandomAccessFile index = new RandomAccessFile(indexFile, "r")) {
            int frameCount = index.readInt();
            RemovalFrameRange.validate(startFrameIndex, endFrameIndex, frameCount);
            retriever.setDataSource(getContext(), uri);
            if (donorFrameIndex >= 0) {
                if (donorFrameIndex >= frameCount) throw new IllegalArgumentException("The donor frame index is outside the timestamp map.");
                donor = getFrameAtIndex(retriever, donorFrameIndex, readPts(index, donorFrameIndex));
                if (donor == null) throw new IllegalStateException("Could not decode donor frame " + donorFrameIndex + ".");
            }
            File baseDir = getOutputDir("repairs", indexId);
            String safeId = sha256(operationId).substring(0, 16);
            File operationDir = new File(baseDir, safeId);
            if (!operationDir.exists() && !operationDir.mkdirs()) throw new IllegalStateException("Could not create the repair output directory.");

            for (int frameIndex = startFrameIndex; frameIndex <= endFrameIndex; frameIndex++) {
                long pts = readPts(index, frameIndex);
                Bitmap current = getFrameAtIndex(retriever, frameIndex, pts);
                if (current == null) throw new IllegalStateException("Could not decode frame " + frameIndex + " for removal.");
                try {
                    applyNaiveRemoval(current, bounds, algorithm, donor, previous, settings, feather, expansion);
                    File output = new File(operationDir, String.format(Locale.US, "repair-%09d.jpg", frameIndex));
                    writeBitmap(current, output, quality);
                    JSObject frameResult = new JSObject();
                    frameResult.put("frameIndex", frameIndex);
                    frameResult.put("presentationTimeUs", pts);
                    frameResult.put("outputPath", output.getAbsolutePath());
                    outputs.put(frameResult);
                    JSObject progress = new JSObject();
                    progress.put("operationId", operationId);
                    progress.put("removalType", removalType);
                    progress.put("currentFrame", frameIndex - startFrameIndex + 1);
                    progress.put("totalFrames", total);
                    progress.put("progressPercent", Math.round((frameIndex - startFrameIndex + 1) * 100f / total));
                    notifyListeners("removalProgress", progress);

                    if (previous != null && !previous.isRecycled()) previous.recycle();
                    previous = Bitmap.createBitmap(current);
                } finally {
                    if (!current.isRecycled()) current.recycle();
                }
            }
        } finally {
            if (previous != null && !previous.isRecycled()) previous.recycle();
            if (donor != null && !donor.isRecycled()) donor.recycle();
            retriever.release();
        }
        JSObject result = new JSObject();
        result.put("operationId", operationId);
        result.put("uri", uriText);
        result.put("removalType", removalType);
        result.put("startFrameIndex", startFrameIndex);
        result.put("endFrameIndex", endFrameIndex);
        result.put("outputs", outputs);
        result.put("implementation", "naive-diffusion");
        result.put("temporalBlend", settings.optDouble("temporalBlendRatio", 0.25) > 0);
        result.put("warning", "Temporal blending uses the previous repaired frame at identical pixel coordinates only. No optical flow, OCR, OpenCV or source-video reconstruction is implemented.");
        if (detectionMethod != null) result.put("detectionMethod", detectionMethod);
        return result;
    }

    private void executeRemoval(PluginCall call, String operationId, NativeTask task) {
        try {
            worker.execute(() -> {
                try {
                    JSObject result = task.run();
                    result.put("operationId", operationId);
                    notifyListeners("removalComplete", result);
                    call.resolve(result);
                } catch (Exception error) {
                    Log.e(TAG, "Native removal operation failed", error);
                    JSObject event = new JSObject();
                    event.put("operationId", operationId);
                    event.put("message", error.getMessage() == null ? "Native removal operation failed." : error.getMessage());
                    notifyListeners("removalError", event);
                    call.reject(error.getMessage() == null ? "Native removal operation failed." : error.getMessage());
                }
            });
        } catch (RejectedExecutionException error) {
            JSObject event = new JSObject();
            event.put("operationId", operationId);
            event.put("message", "The media worker is shutting down.");
            notifyListeners("removalError", event);
            call.reject("The media worker is shutting down. Reopen the app and try again.");
        }
    }

    private Bitmap getFrameAtIndex(MediaMetadataRetriever retriever, int frameIndex, long pts) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? retriever.getFrameAtIndex(frameIndex)
            : retriever.getFrameAtTime(pts, MediaMetadataRetriever.OPTION_CLOSEST);
    }

    private void validateRemovalAlgorithm(String algorithm) {
        if (!"naive-diffusion".equals(algorithm) && !"donor-patch".equals(algorithm)) {
            throw new IllegalArgumentException(
                "Algorithm " + algorithm + " is not implemented in this build. Use naive-diffusion or donor-patch. OpenCV, texture synthesis and frame interpolation are not available."
            );
        }
    }

    private void applyNaiveRemoval(Bitmap target, JSObject bounds, String algorithm,
                                   Bitmap donor, Bitmap temporal, JSObject settings,
                                   int featherPx, int expansionPx) throws Exception {
        int width = target.getWidth();
        int height = target.getHeight();
        double x = bounds.optDouble("x", 0d);
        double y = bounds.optDouble("y", 0d);
        double w = bounds.optDouble("width", bounds.optDouble("w", 0d));
        double h = bounds.optDouble("height", bounds.optDouble("h", 0d));
        if (!(w > 0d && h > 0d)) throw new IllegalArgumentException("Removal bounds must have positive width and height.");
        int originalLeft = clamp((int) Math.floor(x * width), 0, width - 1);
        int originalTop = clamp((int) Math.floor(y * height), 0, height - 1);
        int originalRight = clamp((int) Math.ceil((x + w) * width), originalLeft + 1, width);
        int originalBottom = clamp((int) Math.ceil((y + h) * height), originalTop + 1, height);
        int maskLeft = clamp(originalLeft - expansionPx, 0, width - 1);
        int maskTop = clamp(originalTop - expansionPx, 0, height - 1);
        int maskRight = clamp(originalRight + expansionPx, maskLeft + 1, width);
        int maskBottom = clamp(originalBottom + expansionPx, maskTop + 1, height);
        int padding = Math.max(8, featherPx + 2);
        int patchLeft = Math.max(0, maskLeft - padding);
        int patchTop = Math.max(0, maskTop - padding);
        int patchRight = Math.min(width, maskRight + padding);
        int patchBottom = Math.min(height, maskBottom + padding);
        int patchWidth = patchRight - patchLeft;
        int patchHeight = patchBottom - patchTop;
        if ((long) patchWidth * patchHeight > MAX_REPAIR_PATCH_PIXELS) {
            throw new IllegalArgumentException(
                "The selected repair region is too large for the conservative diffusion engine. Reduce the region and try again."
            );
        }
        int[] sourcePatch = new int[patchWidth * patchHeight];
        target.getPixels(sourcePatch, 0, patchWidth, patchLeft, patchTop, patchWidth, patchHeight);
        int[] donorPatch = donor == null ? null : scaledBitmapPatch(donor, width, height, patchLeft, patchTop, patchWidth, patchHeight);
        int[] temporalPatch = temporal == null ? null : scaledBitmapPatch(temporal, width, height, patchLeft, patchTop, patchWidth, patchHeight);
        float temporalRatio = settings == null ? 0f : (float) settings.optDouble("temporalBlendRatio", 0.25d);
        boolean colorMatch = settings != null && settings.optBoolean("colorMatch", true);
        float donorRatio = donor == null ? 0f : ("donor-patch".equals(algorithm) ? 0.85f : 0.25f);
        int[] repaired = NaiveInpainting.repairRegion(
            sourcePatch, donorPatch, temporalPatch,
            patchWidth, patchHeight,
            maskLeft - patchLeft, maskTop - patchTop,
            maskRight - maskLeft, maskBottom - maskTop,
            featherPx, temporalRatio, colorMatch, donorRatio
        );
        target.setPixels(repaired, 0, patchWidth, patchLeft, patchTop, patchWidth, patchHeight);
    }

    private int[] scaledBitmapPatch(Bitmap bitmap, int referenceWidth, int referenceHeight,
                                    int left, int top, int width, int height) {
        int mappedLeft = clamp(Math.round(left * (bitmap.getWidth() / (float) referenceWidth)), 0, bitmap.getWidth() - 1);
        int mappedTop = clamp(Math.round(top * (bitmap.getHeight() / (float) referenceHeight)), 0, bitmap.getHeight() - 1);
        int mappedRight = clamp(Math.round((left + width) * (bitmap.getWidth() / (float) referenceWidth)), mappedLeft + 1, bitmap.getWidth());
        int mappedBottom = clamp(Math.round((top + height) * (bitmap.getHeight() / (float) referenceHeight)), mappedTop + 1, bitmap.getHeight());
        int cropWidth = mappedRight - mappedLeft;
        int cropHeight = mappedBottom - mappedTop;
        int[] raw = new int[cropWidth * cropHeight];
        bitmap.getPixels(raw, 0, cropWidth, mappedLeft, mappedTop, cropWidth, cropHeight);
        if (cropWidth == width && cropHeight == height) return raw;
        Bitmap crop = Bitmap.createBitmap(raw, cropWidth, cropHeight, Bitmap.Config.ARGB_8888);
        Bitmap scaled = Bitmap.createScaledBitmap(crop, width, height, true);
        int[] result = new int[width * height];
        scaled.getPixels(result, 0, width, 0, 0, width, height);
        if (scaled != crop) scaled.recycle();
        crop.recycle();
        return result;
    }

    @PluginMethod
    public void deleteVideoData(PluginCall call) {
        String uriText = call.getString("uri");
        if (uriText == null || uriText.trim().isEmpty()) {
            call.reject("uri is required.");
            return;
        }
        execute(call, () -> {
            String indexId = sha256(uriText);
            File root = new File(getContext().getFilesDir(), "frame_fusion");
            deleteOwnedPath(new File(root, "indexes/" + indexId + ".pts"));
            deleteOwnedPath(new File(root, "frames/" + indexId));
            deleteOwnedPath(new File(root, "thumbnails/" + indexId));
            deleteOwnedPath(RepairStoragePaths.repairDirectory(getContext().getFilesDir(), indexId));
            try {
                getContext().getContentResolver().releasePersistableUriPermission(
                    Uri.parse(uriText), Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            } catch (SecurityException | IllegalArgumentException ignored) {
                // The provider may not have granted a persistable permission.
            }
            JSObject value = new JSObject();
            value.put("deleted", true);
            value.put("indexId", indexId);
            return value;
        });
    }

    private void deleteOwnedPath(File path) throws Exception {
        if (!path.exists()) return;
        if (path.isDirectory()) {
            File[] children = path.listFiles();
            if (children != null) {
                for (File child : children) deleteOwnedPath(child);
            }
        }
        if (!path.delete()) throw new IllegalStateException("Could not remove app-owned frame data: " + path.getName());
    }

    private File getIndexFile(String indexId) throws Exception {
        File file = new File(new File(getContext().getFilesDir(), "frame_fusion/indexes"), indexId + ".pts");
        if (!file.isFile()) throw new IllegalStateException("The timestamp index is missing. Re-index the source video.");
        return file;
    }

    private long readPts(RandomAccessFile index, int frameIndex) throws Exception {
        return TimestampIndexReader.readPts(index, frameIndex);
    }

    private File getOutputDir(String folder, String indexId) throws Exception {
        File dir = new File(new File(getContext().getFilesDir(), "frame_fusion/" + folder), indexId);
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Could not create frame output directory.");
        return dir;
    }

    private void writeBitmap(Bitmap bitmap, File output, int quality) throws Exception {
        File temp = new File(output.getParentFile(), output.getName() + ".tmp");
        try (FileOutputStream stream = new FileOutputStream(temp)) {
            if (!bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)) {
                throw new IllegalStateException("Android could not encode the extracted frame.");
            }
            stream.flush();
            stream.getFD().sync();
        }
        if (output.exists() && !output.delete()) throw new IllegalStateException("Could not replace an earlier extracted frame.");
        if (!temp.renameTo(output)) throw new IllegalStateException("Could not save the extracted frame.");
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) return cursor.getString(column);
            }
        } catch (Exception error) {
            Log.w(TAG, "Could not read display name.", error);
        }
        String name = uri.getLastPathSegment();
        return name == null ? "video" : name;
    }

    private long querySize(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (column >= 0) return cursor.getLong(column);
            }
        } catch (Exception error) {
            Log.w(TAG, "Could not read video size.", error);
        }
        return 0;
    }

    private String sha256(String input) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) result.append(String.format(Locale.US, "%02x", value));
        return result.toString();
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static int parseInt(String value) {
        try { return value == null ? 0 : Integer.parseInt(value); }
        catch (NumberFormatException error) { return 0; }
    }

    private static long parseLong(String value) {
        try { return value == null ? 0 : Long.parseLong(value); }
        catch (NumberFormatException error) { return 0L; }
    }

    private static float parseFloat(String value) {
        try { return value == null ? 0f : Float.parseFloat(value); }
        catch (NumberFormatException error) { return 0f; }
    }
}