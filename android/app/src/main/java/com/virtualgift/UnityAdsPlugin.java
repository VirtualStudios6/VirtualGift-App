package com.virtualgift;

import android.app.Activity;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;

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
import com.unity3d.ads.metadata.PlayerMetaData;
import com.unity3d.services.banners.BannerErrorInfo;
import com.unity3d.services.banners.BannerView;
import com.unity3d.services.banners.UnityBannerSize;

@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {
    private static final String DEFAULT_ANDROID_GAME_ID = "6127955";
    private static final String DEFAULT_INTERSTITIAL = "Interstitial_Android";
    private static final String DEFAULT_REWARDED = "Rewarded_Android";
    private static final String DEFAULT_BANNER = "Banner_Android";

    private boolean initialized = false;
    private String gameId = DEFAULT_ANDROID_GAME_ID;
    private boolean testMode = false;
    private FrameLayout bannerContainer;
    private BannerView bannerView;

    @PluginMethod
    public void initialize(PluginCall call) {
        gameId = call.getString("gameId", DEFAULT_ANDROID_GAME_ID);
        testMode = Boolean.TRUE.equals(call.getBoolean("testMode", false));

        if (UnityAds.isInitialized()) {
            initialized = true;
            JSObject ret = new JSObject();
            ret.put("initialized", true);
            call.resolve(ret);
            return;
        }

        UnityAds.initialize(getContext(), gameId, testMode, new IUnityAdsInitializationListener() {
            @Override
            public void onInitializationComplete() {
                initialized = true;
                JSObject ret = new JSObject();
                ret.put("initialized", true);
                call.resolve(ret);
            }

            @Override
            public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                initialized = false;
                call.reject("Unity Ads init failed: " + error + " " + message);
            }
        });
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        showFullScreenAd(call, call.getString("placementId", DEFAULT_INTERSTITIAL), false);
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        String serverId = call.getString("serverId", "");
        if (serverId != null && !serverId.trim().isEmpty()) {
            PlayerMetaData playerMetaData = new PlayerMetaData(getContext());
            playerMetaData.setServerId(serverId.trim());
            playerMetaData.commit();
        }
        showFullScreenAd(call, call.getString("placementId", DEFAULT_REWARDED), true);
    }

    private void showFullScreenAd(PluginCall call, String placementId, boolean rewarded) {
        if (!initialized && !UnityAds.isInitialized()) {
            call.reject("Unity Ads no esta inicializado");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity no disponible");
            return;
        }

        IUnityAdsShowListener showListener = new IUnityAdsShowListener() {
            @Override
            public void onUnityAdsShowFailure(String placement, UnityAds.UnityAdsShowError error, String message) {
                call.reject("Unity Ads show failed: " + error + " " + message);
            }

            @Override
            public void onUnityAdsShowStart(String placement) {
            }

            @Override
            public void onUnityAdsShowClick(String placement) {
            }

            @Override
            public void onUnityAdsShowComplete(String placement, UnityAds.UnityAdsShowCompletionState state) {
                JSObject ret = new JSObject();
                ret.put("placementId", placement);
                ret.put("completed", state == UnityAds.UnityAdsShowCompletionState.COMPLETED);
                ret.put("rewarded", rewarded && state == UnityAds.UnityAdsShowCompletionState.COMPLETED);
                call.resolve(ret);
            }
        };

        UnityAds.load(placementId, new IUnityAdsLoadListener() {
            @Override
            public void onUnityAdsAdLoaded(String placement) {
                UnityAds.show(activity, placement, new UnityAdsShowOptions(), showListener);
            }

            @Override
            public void onUnityAdsFailedToLoad(String placement, UnityAds.UnityAdsLoadError error, String message) {
                call.reject("Unity Ads load failed: " + error + " " + message);
            }
        });
    }

    @PluginMethod
    public void showBanner(PluginCall call) {
        if (!initialized && !UnityAds.isInitialized()) {
            call.reject("Unity Ads no esta inicializado");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity no disponible");
            return;
        }

        String placementId = call.getString("placementId", DEFAULT_BANNER);
        String position = call.getString("position", "bottom");

        activity.runOnUiThread(() -> {
            hideBannerInternal();

            ViewGroup root = activity.findViewById(android.R.id.content);
            bannerContainer = new FrameLayout(activity);
            FrameLayout.LayoutParams containerParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            );
            containerParams.gravity = "top".equalsIgnoreCase(position)
                ? Gravity.TOP | Gravity.CENTER_HORIZONTAL
                : Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            bannerContainer.setLayoutParams(containerParams);

            bannerView = new BannerView(activity, placementId, new UnityBannerSize(320, 50));
            bannerView.setListener(new BannerView.IListener() {
                @Override
                public void onBannerLoaded(BannerView bannerAdView) {
                    JSObject ret = new JSObject();
                    ret.put("loaded", true);
                    ret.put("placementId", placementId);
                    call.resolve(ret);
                }

                @Override
                public void onBannerFailedToLoad(BannerView bannerAdView, BannerErrorInfo errorInfo) {
                    call.reject("Unity Ads banner failed: " + errorInfo.errorCode + " " + errorInfo.errorMessage);
                }

                @Override
                public void onBannerClick(BannerView bannerAdView) {
                }

                @Override
                public void onBannerShown(BannerView bannerAdView) {
                }

                @Override
                public void onBannerLeftApplication(BannerView bannerAdView) {
                }
            });

            bannerContainer.addView(bannerView);
            root.addView(bannerContainer);
            bannerView.load();
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        getActivity().runOnUiThread(this::hideBannerInternal);
        call.resolve();
    }

    private void hideBannerInternal() {
        if (bannerContainer != null) {
            ViewGroup parent = (ViewGroup) bannerContainer.getParent();
            if (parent != null) parent.removeView(bannerContainer);
        }
        bannerView = null;
        bannerContainer = null;
    }
}
