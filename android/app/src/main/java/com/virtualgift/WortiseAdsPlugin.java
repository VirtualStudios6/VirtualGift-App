package com.virtualgift;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.wortise.ads.AdError;
import com.wortise.ads.AdSize;
import com.wortise.ads.RevenueData;
import com.wortise.ads.WortiseSdk;
import com.wortise.ads.banner.BannerAd;
import com.wortise.ads.interstitial.InterstitialAd;
import com.wortise.ads.rewarded.RewardedAd;
import com.wortise.ads.rewarded.models.Reward;

@CapacitorPlugin(name = "WortiseAds")
public class WortiseAdsPlugin extends Plugin {

    private static final String APP_ID = "86f3e34b-8224-43bd-9e86-7587072ca2a6";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Rewarded
    private RewardedAd rewardedAd;
    private PluginCall pendingRewardedCall;
    private boolean wasRewarded = false;

    // Banner
    private BannerAd bannerAd;
    private FrameLayout bannerContainer;

    // Interstitial
    private InterstitialAd interstitialAd;
    private String interstitialUnitId;
    private boolean interstitialReady = false;

    @Override
    public void load() {
        Activity activity = getActivity();
        mainHandler.post(() -> WortiseSdk.initialize(activity, APP_ID));
    }

    // ── Rewarded ─────────────────────────────────────────────────────────────

    @PluginMethod
    public void showRewarded(PluginCall call) {
        String unitId = call.getString("unitId", "");
        if (unitId.isEmpty()) { call.reject("unitId is required"); return; }

        pendingRewardedCall = call;
        wasRewarded = false;

        Activity activity = getActivity();
        mainHandler.post(() -> {
            rewardedAd = new RewardedAd(activity, unitId);
            rewardedAd.setListener(new RewardedAd.Listener() {
                @Override public void onRewardedLoaded(RewardedAd ad)     { ad.showAd(activity); }
                @Override public void onRewardedImpression(RewardedAd ad) {}
                @Override public void onRewardedClicked(RewardedAd ad)    {}
                @Override public void onRewardedShown(RewardedAd ad)      {}
                @Override public void onRewardedCompleted(RewardedAd ad, Reward reward) {
                    wasRewarded = true;
                    notifyListeners("rewardedCompleted", new JSObject());
                }
                @Override public void onRewardedDismissed(RewardedAd ad) {
                    resolveRewardedCall(wasRewarded, null);
                    wasRewarded = false;
                }
                @Override public void onRewardedFailedToLoad(RewardedAd ad, AdError error) {
                    resolveRewardedCall(false, error.getMessage());
                }
                @Override public void onRewardedFailedToShow(RewardedAd ad, AdError error) {
                    resolveRewardedCall(false, error.getMessage());
                }
                @Override public void onRewardedRevenuePaid(RewardedAd ad, RevenueData data) {}
            });
            rewardedAd.loadAd();
        });
    }

    private void resolveRewardedCall(boolean rewarded, String error) {
        if (pendingRewardedCall == null) return;
        JSObject result = new JSObject();
        result.put("rewarded", rewarded);
        if (error != null) result.put("error", error);
        pendingRewardedCall.resolve(result);
        pendingRewardedCall = null;
    }

    // ── Banner ────────────────────────────────────────────────────────────────

    @PluginMethod
    public void showBanner(PluginCall call) {
        String unitId = call.getString("unitId", "");
        if (unitId.isEmpty()) { call.reject("unitId is required"); return; }

        Activity activity = getActivity();
        mainHandler.post(() -> {
            destroyBanner();

            ViewGroup root = (ViewGroup) activity.getWindow().getDecorView().getRootView();
            bannerContainer = new FrameLayout(activity);

            // Altura fija: 50dp → evita que el banner renderice enorme
            int bannerHeightPx = Math.round(50 * activity.getResources().getDisplayMetrics().density);
            FrameLayout.LayoutParams containerLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                bannerHeightPx,
                Gravity.BOTTOM
            );
            root.addView(bannerContainer, containerLp);

            bannerAd = new BannerAd(activity);
            bannerAd.setAdUnitId(unitId);
            bannerAd.setAdSize(AdSize.HEIGHT_50); // banner estándar 320×50
            bannerAd.setListener(new BannerAd.Listener() {
                @Override
                public void onBannerLoaded(BannerAd ad) {
                    bannerContainer.removeAllViews();
                    FrameLayout.LayoutParams adLp = new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.CENTER_HORIZONTAL
                    );
                    bannerContainer.addView(ad, adLp);
                    call.resolve();
                }
                @Override public void onBannerImpression(BannerAd ad)                {}
                @Override public void onBannerClicked(BannerAd ad)                   {}
                @Override public void onBannerRevenuePaid(BannerAd ad, RevenueData d) {}
                @Override public void onBannerFailedToLoad(BannerAd ad, AdError error) {
                    call.reject(error.getMessage());
                }
            });
            bannerContainer.addView(bannerAd);
            bannerAd.loadAd();
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        mainHandler.post(() -> {
            destroyBanner();
            call.resolve();
        });
    }

    private void destroyBanner() {
        if (bannerContainer != null) {
            Activity activity = getActivity();
            if (activity != null) {
                ViewGroup root = (ViewGroup) activity.getWindow().getDecorView().getRootView();
                root.removeView(bannerContainer);
            }
            bannerContainer = null;
        }
        if (bannerAd != null) {
            bannerAd.destroy();
            bannerAd = null;
        }
    }

    // ── Interstitial ──────────────────────────────────────────────────────────

    @PluginMethod
    public void loadInterstitial(PluginCall call) {
        String unitId = call.getString("unitId", "");
        if (unitId.isEmpty()) { call.reject("unitId is required"); return; }

        interstitialUnitId = unitId;
        Activity activity = getActivity();
        mainHandler.post(() -> buildInterstitial(activity, call));
    }

    private void buildInterstitial(Activity activity, PluginCall callToResolve) {
        if (interstitialAd != null) { interstitialAd.destroy(); }
        interstitialAd = new InterstitialAd(activity, interstitialUnitId);
        interstitialAd.setListener(new InterstitialAd.Listener() {
            @Override
            public void onInterstitialLoaded(InterstitialAd ad) {
                interstitialReady = true;
                if (callToResolve != null) callToResolve.resolve();
            }
            @Override public void onInterstitialImpression(InterstitialAd ad) {}
            @Override public void onInterstitialClicked(InterstitialAd ad)    {}
            @Override public void onInterstitialShown(InterstitialAd ad)      {}
            @Override
            public void onInterstitialDismissed(InterstitialAd ad) {
                interstitialReady = false;
                notifyListeners("interstitialDismissed", new JSObject());
                buildInterstitial(activity, null); // preload next
            }
            @Override
            public void onInterstitialFailedToLoad(InterstitialAd ad, AdError error) {
                interstitialReady = false;
                if (callToResolve != null) callToResolve.reject(error.getMessage());
            }
            @Override
            public void onInterstitialFailedToShow(InterstitialAd ad, AdError error) {
                notifyListeners("interstitialDismissed", new JSObject());
            }
            @Override public void onInterstitialRevenuePaid(InterstitialAd ad, RevenueData d) {}
        });
        interstitialAd.loadAd();
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        JSObject result = new JSObject();
        if (!interstitialReady || interstitialAd == null) {
            result.put("showed", false);
            call.resolve(result);
            return;
        }
        Activity activity = getActivity();
        mainHandler.post(() -> {
            interstitialAd.showAd(activity);
            result.put("showed", true);
            call.resolve(result);
        });
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    protected void handleOnDestroy() {
        if (rewardedAd     != null) { rewardedAd.destroy();     rewardedAd     = null; }
        if (interstitialAd != null) { interstitialAd.destroy(); interstitialAd = null; }
        destroyBanner();
    }
}
