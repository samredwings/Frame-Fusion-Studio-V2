package com.hasansaimon.framefusionstudio;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register app-local native plugins before initializing the Capacitor bridge.
        registerPlugin(FrameExtractorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
