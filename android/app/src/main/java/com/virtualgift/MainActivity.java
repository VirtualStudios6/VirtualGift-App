package com.virtualgift;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WortiseAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
