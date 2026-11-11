package com.hasansaimon.framefusionstudio;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.ByteArrayOutputStream;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class MutableFrameBitmapTest {
    @Test
    public void makesBitmapFactoryDecodedPreviewMutableBeforeInPlaceRepair() {
        Bitmap original = Bitmap.createBitmap(4, 4, Bitmap.Config.ARGB_8888);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        assertTrue(original.compress(Bitmap.CompressFormat.PNG, 100, png));
        original.recycle();

        Bitmap decoded = BitmapFactory.decodeByteArray(png.toByteArray(), 0, png.size());
        assertTrue(decoded != null);
        assertFalse(decoded.isMutable());

        Bitmap repairTarget = MutableFrameBitmap.copyAndRecycle(decoded);
        assertTrue(repairTarget.isMutable());
        assertTrue(decoded.isRecycled());
        repairTarget.recycle();
    }
}
