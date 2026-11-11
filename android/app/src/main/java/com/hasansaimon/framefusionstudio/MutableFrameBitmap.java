package com.hasansaimon.framefusionstudio;

import android.graphics.Bitmap;

/** Creates a mutable ARGB_8888 copy for repair routines that update pixels in place. */
final class MutableFrameBitmap {
    private MutableFrameBitmap() {}

    static Bitmap copyAndRecycle(Bitmap source) {
        if (source == null || source.isRecycled()) {
            throw new IllegalArgumentException("A decoded preview bitmap is required.");
        }
        Bitmap mutable = null;
        try {
            mutable = source.copy(Bitmap.Config.ARGB_8888, true);
            if (mutable == null || !mutable.isMutable()) {
                if (mutable != null && !mutable.isRecycled()) mutable.recycle();
                throw new IllegalStateException("Android could not create a mutable preview bitmap.");
            }
            return mutable;
        } finally {
            if (!source.isRecycled()) source.recycle();
        }
    }
}
