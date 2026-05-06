package com.virtualgift;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsShowOptions;

@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {

    private static final String TAG      = "UnityAdsPlugin";
    private static final String GAME_ID  = "6108212";
    private static final boolean TEST_MODE = false;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // ── Rewarded state ────────────────────────────────────────────────────────
    private PluginCall pendingRewardedCall;
    private boolean    wasRewarded = false;

    // ── Interstitial state ────────────────────────────────────────────────────
    private String  interstitialPlacementId;
    private boolean interstitialLoaded = false;

    // ── SDK init ──────────────────────────────────────────────────────────────

    @Override
    public void load() {
        Activity activity = getActivity();
        mainHandler.post(() ->
            UnityAds.initialize(activity, GAME_ID, TEST_MODE, new IUnityAdsInitializationListener() {
                @Override
                public void onInitializationComplete() {
                    Log.d(TAG, "SDK initialized");
                }
                @Override
                public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                    Log.e(TAG, "SDK init failed: " + error + " — " + message);
                }
            })
        );
    }

    // ── Interstitial ──────────────────────────────────────────────────────────

    @PluginMethod
    public void loadInterstitial(PluginCall call) {
        String placementId = call.getString("placementId", "");
        if (placementId.isEmpty()) { call.reject("placementId is required"); return; }

        interstitialPlacementId = placementId;
        interstitialLoaded = false;

        mainHandler.post(() ->
            UnityAds.load(placementId, new IUnityAdsLoadListener() {
                @Override
                public void onUnityAdsAdLoaded(String id) {
                    Log.d(TAG, "Interstitial loaded: " + id);
                    interstitialLoaded = true;
                    call.resolve();
                }
                @Override
                public void onUnityAdsFailedToLoad(String id, UnityAds.UnityAdsLoadError error, String message) {
                    Log.w(TAG, "Interstitial load failed: " + error + " — " + message);
                    interstitialLoaded = false;
                    call.reject(message);
                }
            })
        );
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        JSObject result = new JSObject();

        if (!interstitialLoaded || interstitialPlacementId == null) {
            result.put("showed", false);
            call.resolve(result);
            return;
        }

        Activity activity = getActivity();
        final String placementId = interstitialPlacementId;
        interstitialLoaded = false; // prevent double-show

        mainHandler.post(() -> {
            UnityAds.show(activity, placementId, new UnityAdsShowOptions(), new IUnityAdsShowListener() {
                @Override
                public void onUnityAdsShowStart(String id) {
                    Log.d(TAG, "Interstitial show start: " + id);
                }
                @Override public void onUnityAdsShowClick(String id) {}
                @Override
                public void onUnityAdsShowComplete(String id, UnityAds.UnityAdsShowCompletionState state) {
                    Log.d(TAG, "Interstitial complete: " + id + " state=" + state);
                    notifyListeners("unityInterstitialDismissed", new JSObject());
                    reloadInterstitial(placementId);
                }
                @Override
                public void onUnityAdsShowFailure(String id, UnityAds.UnityAdsShowError error, String message) {
                    Log.w(TAG, "Interstitial show failed: " + error + " — " + message);
                    notifyListeners("unityInterstitialDismissed", new JSObject());
                    reloadInterstitial(placementId);
                }
            });
            result.put("showed", true);
            call.resolve(result);
        });
    }

    private void reloadInterstitial(String placementId) {
        UnityAds.load(placementId, new IUnityAdsLoadListener() {
            @Override
            public void onUnityAdsAdLoaded(String id) {
                Log.d(TAG, "Interstitial preloaded: " + id);
                interstitialLoaded = true;
            }
            @Override
            public void onUnityAdsFailedToLoad(String id, UnityAds.UnityAdsLoadError error, String message) {
                Log.w(TAG, "Interstitial preload failed: " + error + " — " + message);
                interstitialLoaded = false;
            }
        });
    }

    // ── Rewarded ──────────────────────────────────────────────────────────────

    @PluginMethod
    public void showRewarded(PluginCall call) {
        String placementId = call.getString("placementId", "");
        if (placementId.isEmpty()) { call.reject("placementId is required"); return; }

        pendingRewardedCall = call;
        wasRewarded = false;

        Activity activity = getActivity();
        mainHandler.post(() ->
            UnityAds.load(placementId, new IUnityAdsLoadListener() {
                @Override
                public void onUnityAdsAdLoaded(String id) {
                    Log.d(TAG, "Rewarded loaded: " + id);
                    UnityAds.show(activity, placementId, new UnityAdsShowOptions(), new IUnityAdsShowListener() {
                        @Override
                        public void onUnityAdsShowStart(String id) {
                            Log.d(TAG, "Rewarded show start: " + id);
                        }
                        @Override public void onUnityAdsShowClick(String id) {}
                        @Override
                        public void onUnityAdsShowComplete(String id, UnityAds.UnityAdsShowCompletionState state) {
                            wasRewarded = state.equals(UnityAds.UnityAdsShowCompletionState.COMPLETED);
                            Log.d(TAG, "Rewarded complete: rewarded=" + wasRewarded);
                            if (wasRewarded) {
                                notifyListeners("unityRewardedCompleted", new JSObject());
                            }
                            resolveRewardedCall(wasRewarded, null);
                            wasRewarded = false;
                        }
                        @Override
                        public void onUnityAdsShowFailure(String id, UnityAds.UnityAdsShowError error, String message) {
                            Log.w(TAG, "Rewarded show failed: " + error + " — " + message);
                            resolveRewardedCall(false, message);
                        }
                    });
                }
                @Override
                public void onUnityAdsFailedToLoad(String id, UnityAds.UnityAdsLoadError error, String message) {
                    Log.w(TAG, "Rewarded load failed: " + error + " — " + message);
                    resolveRewardedCall(false, message);
                }
            })
        );
    }

    private void resolveRewardedCall(boolean rewarded, String error) {
        if (pendingRewardedCall == null) return;
        JSObject result = new JSObject();
        result.put("rewarded", rewarded);
        if (error != null) result.put("error", error);
        pendingRewardedCall.resolve(result);
        pendingRewardedCall = null;
    }
}
