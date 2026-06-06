package com.virtualgift;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UnityAdsPlugin.class);
        registerPlugin(ConsentPlugin.class);
        registerPlugin(IronSourcePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
