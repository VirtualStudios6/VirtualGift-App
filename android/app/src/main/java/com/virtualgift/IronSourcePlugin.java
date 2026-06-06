package com.virtualgift;

import android.app.Activity;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.ironsource.mediationsdk.IronSource;
import com.ironsource.mediationsdk.IronSourceBannerLayout;
import com.ironsource.mediationsdk.ISBannerSize;
import com.ironsource.mediationsdk.logger.IronSourceError;
import com.ironsource.mediationsdk.model.Placement;
import com.ironsource.mediationsdk.sdk.BannerListener;
import com.ironsource.mediationsdk.sdk.InitializationListener;
import com.ironsource.mediationsdk.sdk.InterstitialListener;
import com.ironsource.mediationsdk.sdk.RewardedVideoListener;

@CapacitorPlugin(name = "IronSource")
public class IronSourcePlugin extends Plugin {
    private static final String TAG              = "VGIronSource";
    private static final String APP_KEY          = "26a0d0ced";
    private static final String REWARDED_ID      = "DefaultRewardedVideo";
    private static final String INTERSTITIAL_ID  = "DefaultInterstitial";
    private static final String BANNER_ID        = "DefaultBanner";

    private boolean initialized      = false;
    private IronSourceBannerLayout bannerLayout;
    private FrameLayout            bannerContainer;
    private PluginCall             pendingRewardedCall;
    private PluginCall             pendingInterstitialCall;

    // ── Inicialización ──────────────────────────────────────────────────────
    @PluginMethod
    public void initialize(PluginCall call) {
        if (initialized) {
            JSObject ret = new JSObject();
            ret.put("initialized", true);
            call.resolve(ret);
            return;
        }

        boolean gdprConsent = Boolean.TRUE.equals(call.getBoolean("gdprConsent", false));
        Activity activity = getActivity();
        if (activity == null) { call.reject("Activity no disponible"); return; }

        activity.runOnUiThread(() -> {
            Log.d(TAG, "initialize appKey=" + APP_KEY + " gdpr=" + gdprConsent);

            IronSource.setConsent(gdprConsent);
            IronSource.setMetaData("do_not_sell", gdprConsent ? "false" : "true");

            IronSource.init(activity, APP_KEY, () -> {
                initialized = true;
                Log.d(TAG, "IronSource init OK");
                setupListeners();
                IronSource.loadInterstitial();
                JSObject ret = new JSObject();
                ret.put("initialized", true);
                call.resolve(ret);
            }, IronSource.AD_UNIT.REWARDED_VIDEO,
               IronSource.AD_UNIT.INTERSTITIAL,
               IronSource.AD_UNIT.BANNER,
               IronSource.AD_UNIT.OFFERWALL);
        });
    }

    private void setupListeners() {
        // ── Rewarded ─────────────────────────────────────────────────────────
        IronSource.setRewardedVideoListener(new RewardedVideoListener() {
            @Override public void onRewardedVideoAdOpened() {}
            @Override public void onRewardedVideoAdStarted() {}
            @Override public void onRewardedVideoAdEnded() {}
            @Override public void onRewardedVideoAvailabilityChanged(boolean available) {
                Log.d(TAG, "rewarded available=" + available);
            }
            @Override public void onRewardedVideoAdRewarded(Placement placement) {
                Log.d(TAG, "rewarded: " + placement.getPlacementName());
                if (pendingRewardedCall != null) {
                    JSObject ret = new JSObject();
                    ret.put("completed",     true);
                    ret.put("rewarded",      true);
                    ret.put("rewardName",    placement.getRewardName());
                    ret.put("rewardAmount",  placement.getRewardAmount());
                    pendingRewardedCall.resolve(ret);
                    pendingRewardedCall = null;
                }
            }
            @Override public void onRewardedVideoAdClosed() {
                if (pendingRewardedCall != null) {
                    pendingRewardedCall.reject("Ad cerrado sin completar");
                    pendingRewardedCall = null;
                }
            }
            @Override public void onRewardedVideoAdShowFailed(IronSourceError error) {
                Log.e(TAG, "rewarded failed: " + error.getErrorMessage());
                if (pendingRewardedCall != null) {
                    pendingRewardedCall.reject("Rewarded failed: " + error.getErrorMessage());
                    pendingRewardedCall = null;
                }
            }
            @Override public void onRewardedVideoAdClicked(Placement placement) {}
        });

        // ── Interstitial ─────────────────────────────────────────────────────
        IronSource.setInterstitialListener(new InterstitialListener() {
            @Override public void onInterstitialAdReady() {
                Log.d(TAG, "interstitial ready");
                getActivity().runOnUiThread(() -> {
                    if (pendingInterstitialCall != null) {
                        IronSource.showInterstitial(INTERSTITIAL_ID);
                    }
                });
            }
            @Override public void onInterstitialAdLoadFailed(IronSourceError error) {
                Log.e(TAG, "interstitial load failed: " + error.getErrorMessage());
                if (pendingInterstitialCall != null) {
                    pendingInterstitialCall.reject("Interstitial load failed: " + error.getErrorMessage());
                    pendingInterstitialCall = null;
                }
            }
            @Override public void onInterstitialAdOpened() {}
            @Override public void onInterstitialAdShowSucceeded() {}
            @Override public void onInterstitialAdClosed() {
                Log.d(TAG, "interstitial closed");
                IronSource.loadInterstitial();
                if (pendingInterstitialCall != null) {
                    JSObject ret = new JSObject();
                    ret.put("completed", true);
                    pendingInterstitialCall.resolve(ret);
                    pendingInterstitialCall = null;
                }
            }
            @Override public void onInterstitialAdShowFailed(IronSourceError error) {
                Log.e(TAG, "interstitial show failed: " + error.getErrorMessage());
                if (pendingInterstitialCall != null) {
                    pendingInterstitialCall.reject("Interstitial show failed: " + error.getErrorMessage());
                    pendingInterstitialCall = null;
                }
            }
            @Override public void onInterstitialAdClicked() {}
        });
    }

    // ── Status ──────────────────────────────────────────────────────────────
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("initialized",        initialized);
        ret.put("rewardedAvailable",  IronSource.isRewardedVideoAvailable());
        ret.put("interstitialReady",  IronSource.isInterstitialReady());
        call.resolve(ret);
    }

    // ── Rewarded ────────────────────────────────────────────────────────────
    @PluginMethod
    public void showRewarded(PluginCall call) {
        if (!initialized) { call.reject("IronSource no inicializado"); return; }
        Activity activity = getActivity();
        if (activity == null) { call.reject("Activity no disponible"); return; }

        pendingRewardedCall = call;
        activity.runOnUiThread(() -> {
            if (IronSource.isRewardedVideoAvailable()) {
                IronSource.showRewardedVideo(REWARDED_ID);
            } else {
                pendingRewardedCall = null;
                call.reject("Rewarded video no disponible ahora. Intenta de nuevo.");
            }
        });
    }

    // ── Interstitial ────────────────────────────────────────────────────────
    @PluginMethod
    public void showInterstitial(PluginCall call) {
        if (!initialized) { call.reject("IronSource no inicializado"); return; }
        Activity activity = getActivity();
        if (activity == null) { call.reject("Activity no disponible"); return; }

        pendingInterstitialCall = call;
        activity.runOnUiThread(() -> {
            if (IronSource.isInterstitialReady()) {
                IronSource.showInterstitial(INTERSTITIAL_ID);
            } else {
                IronSource.loadInterstitial();
            }
        });
    }

    // ── Banner ──────────────────────────────────────────────────────────────
    @PluginMethod
    public void showBanner(PluginCall call) {
        if (!initialized) { call.reject("IronSource no inicializado"); return; }
        Activity activity = getActivity();
        if (activity == null) { call.reject("Activity no disponible"); return; }

        String position = call.getString("position", "bottom");

        activity.runOnUiThread(() -> {
            hideBannerInternal();

            ViewGroup root = activity.findViewById(android.R.id.content);
            bannerLayout = IronSource.createBanner(activity, ISBannerSize.BANNER);
            if (bannerLayout == null) {
                call.reject("No se pudo crear banner de IronSource");
                return;
            }

            FrameLayout container = new FrameLayout(activity);
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            );
            params.gravity = "top".equalsIgnoreCase(position)
                ? Gravity.TOP    | Gravity.CENTER_HORIZONTAL
                : Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            container.setLayoutParams(params);

            bannerLayout.setBannerListener(new BannerListener() {
                @Override public void onBannerAdLoaded() {
                    Log.d(TAG, "banner loaded");
                    activity.runOnUiThread(() -> {
                        bannerContainer = container;
                        if (container.getParent() == null) root.addView(container);
                    });
                    JSObject ret = new JSObject();
                    ret.put("loaded", true);
                    call.resolve(ret);
                }
                @Override public void onBannerAdLoadFailed(IronSourceError error) {
                    Log.e(TAG, "banner failed: " + error.getErrorMessage());
                    activity.runOnUiThread(() -> { bannerLayout = null; });
                    call.reject("Banner failed: " + error.getErrorMessage());
                }
                @Override public void onBannerAdClicked() {}
                @Override public void onBannerAdScreenPresented() {}
                @Override public void onBannerAdScreenDismissed() {}
                @Override public void onBannerAdLeftApplication() {}
            });

            container.addView(bannerLayout);
            IronSource.loadBanner(activity, bannerLayout, BANNER_ID);
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        if (getActivity() != null) getActivity().runOnUiThread(this::hideBannerInternal);
        call.resolve();
    }

    private void hideBannerInternal() {
        if (bannerLayout != null) {
            IronSource.destroyBanner(bannerLayout);
            bannerLayout = null;
        }
        if (bannerContainer != null) {
            ViewGroup parent = (ViewGroup) bannerContainer.getParent();
            if (parent != null) parent.removeView(bannerContainer);
            bannerContainer = null;
        }
    }

    // ── Offerwall ───────────────────────────────────────────────────────────
    @PluginMethod
    public void showOfferwall(PluginCall call) {
        if (!initialized) { call.reject("IronSource no inicializado"); return; }
        Activity activity = getActivity();
        if (activity == null) { call.reject("Activity no disponible"); return; }

        activity.runOnUiThread(() -> {
            if (IronSource.isOfferwallAvailable()) {
                IronSource.showOfferwall();
                JSObject ret = new JSObject();
                ret.put("opened", true);
                call.resolve(ret);
            } else {
                call.reject("Offerwall no disponible ahora");
            }
        });
    }

    // ── Ciclo de vida (requerido por IronSource) ─────────────────────────────
    @Override
    protected void handleOnResume() {
        IronSource.onResume(getActivity());
        super.handleOnResume();
    }

    @Override
    protected void handleOnPause() {
        IronSource.onPause(getActivity());
        super.handleOnPause();
    }
}
