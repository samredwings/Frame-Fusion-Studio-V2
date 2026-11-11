package com.hasansaimon.framefusionstudio;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
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
 * Native foundation for exact video inspection and full-resolution frame extraction.
 *
 * Deliberately does not claim to implement watermark inpainting or video reconstruction.
 * Those require separate, tested processing pipelines.
 */
@CapacitorPlugin(name = "FrameExtractor")
public class FrameExtractorPlugin extends Plugin {
    private static final String TAG = "FrameExtractor";
    private static final int INDEX_HEADER_BYTES = 12;
    private static final int MAX_PAGE_SIZE = 5000;
    private static final int MAX_RANGE_SIZE = 250;
    private static final int DEFAULT_THUMB_WIDTH = 160;

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
        int count = index.readInt();
        if (frameIndex < 0 || frameIndex >= count) throw new IllegalArgumentException("Frame index is outside the timestamp map.");
        index.seek(INDEX_HEADER_BYTES + (long) frameIndex * Long.BYTES);
        return index.readLong();
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