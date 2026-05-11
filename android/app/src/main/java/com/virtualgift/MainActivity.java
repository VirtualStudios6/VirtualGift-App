package com.virtualgift;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AdMobPlugin.class);
        registerPlugin(UnityAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
