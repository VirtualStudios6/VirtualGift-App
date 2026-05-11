package com.virtualgift;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback;

@CapacitorPlugin(name = "AdMob")
public class AdMobPlugin extends Plugin {

    private static final String TAG = "AdMobPlugin";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // ── Banner ────────────────────────────────────────────────────────────────
    private AdView      bannerView;
    private FrameLayout bannerContainer;

    // ── MREC inline (300×250) ─────────────────────────────────────────────────
    private AdView      mrecView;
    private FrameLayout mrecContainer;

    // ── Interstitial ──────────────────────────────────────────────────────────
    private InterstitialAd interstitialAd;
    private String         interstitialUnitId;
    private boolean        interstitialLoading = false;

    // ── Rewarded Interstitial ─────────────────────────────────────────────────
    private RewardedInterstitialAd rewardedAd;
    private String                 rewardedUnitId;
    private boolean                rewardedLoading = false;
    private PluginCall             pendingRewardedCall;
    private boolean                wasRewarded = false;

    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void load() {
        Activity activity = getActivity();
        mainHandler.post(() ->
            MobileAds.initialize(activity, status ->
                Log.d(TAG, "SDK ready: " + status.getAdapterStatusMap())
            )
        );
    }

    // ── Banner ────────────────────────────────────────────────────────────────

    @PluginMethod
    public void showBanner(PluginCall call) {
        String unitId = call.getString("unitId", "");
        if (unitId.isEmpty()) { call.reject("unitId required"); return; }

        Activity activity = getActivity();
        mainHandler.post(() -> {
            destroyBanner();

            ViewGroup root = (ViewGroup) activity.getWindow().getDecorView().getRootView();
            float density = activity.getResources().getDisplayMetrics().density;

            // Detectar altura de la barra de navegación del sistema (botones / gestos)
            int sysNavPx = 0;
            android.view.WindowInsets rootInsets = root.getRootWindowInsets();
            if (rootInsets != null) {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                    sysNavPx = rootInsets.getInsets(android.view.WindowInsets.Type.navigationBars()).bottom;
                } else {
                    //noinspection deprecation
                    sysNavPx = rootInsets.getSystemWindowInsetBottom();
                }
            }

            int bannerHeightPx = Math.round(50 * density);
            int navHeightPx    = Math.round(62 * density);
            // Posicionamos el banner encima del bottom-nav HTML (nav + sistema en px)
            int bannerBottomMargin = sysNavPx + navHeightPx;
            // Offset total que JS usa para el paddingBottom del body
            int totalOffsetDp = 50 + 62 + Math.round(sysNavPx / density);

            bannerContainer = new FrameLayout(activity);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, bannerHeightPx, Gravity.BOTTOM);
            lp.bottomMargin = bannerBottomMargin; // encima del bottom-nav HTML
            root.addView(bannerContainer, lp);

            bannerView = new AdView(activity);
            bannerView.setAdUnitId(unitId);
            bannerView.setAdSize(AdSize.BANNER);
            bannerView.setAdListener(new AdListener() {
                @Override
                public void onAdLoaded() {
                    bannerContainer.removeAllViews();
                    FrameLayout.LayoutParams adLp = new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.CENTER_HORIZONTAL);
                    bannerContainer.addView(bannerView, adLp);
                    // Devolver el offset total para que JS ajuste el bottom-nav exactamente
                    JSObject result = new JSObject();
                    result.put("offsetDp", totalOffsetDp);
                    call.resolve(result);
                }
                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError e) {
                    Log.w(TAG, "Banner failed: " + e.getMessage());
                    call.reject(e.getMessage());
                }
            });
            bannerContainer.addView(bannerView);
            bannerView.loadAd(new AdRequest.Builder().build());
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        mainHandler.post(() -> { destroyBanner(); call.resolve(); });
    }

    private void destroyBanner() {
        if (bannerContainer != null) {
            Activity a = getActivity();
            if (a != null) {
                ViewGroup root = (ViewGroup) a.getWindow().getDecorView().getRootView();
                root.removeView(bannerContainer);
            }
            bannerContainer = null;
        }
        if (bannerView != null) { bannerView.destroy(); bannerView = null; }
    }

    // ── MREC inline 300×250 ───────────────────────────────────────────────────

    @PluginMethod
    public void showMrecAt(PluginCall call) {
        String unitId = call.getString("unitId", "");
        if (unitId.isEmpty()) { call.reject("unitId required"); return; }

        int xDp = call.getInt("x", 0);
        int yDp = call.getInt("y", 0);

        Activity activity = getActivity();
        mainHandler.post(() -> {
            float density = activity.getResources().getDisplayMetrics().density;
            int xPx = Math.round(xDp * density);
            int yPx = Math.round(yDp * density);
            int wPx = Math.round(300 * density);
            int hPx = Math.round(250 * density);

            ViewGroup root = (ViewGroup) activity.getWindow().getDecorView().getRootView();

            if (mrecContainer == null) {
                mrecView = new AdView(activity);
                mrecView.setAdUnitId(unitId);
                mrecView.setAdSize(AdSize.MEDIUM_RECTANGLE);

                mrecContainer = new FrameLayout(activity);
                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(wPx, hPx);
                lp.gravity = Gravity.TOP | Gravity.START;
                lp.leftMargin = xPx;
                lp.topMargin  = yPx;
                root.addView(mrecContainer, lp);
                mrecContainer.addView(mrecView, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT));
                mrecView.loadAd(new AdRequest.Builder().build());
            } else {
                FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) mrecContainer.getLayoutParams();
                lp.leftMargin = xPx;
                lp.topMargin  = yPx;
                mrecContainer.setLayoutParams(lp);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void hideMrec(PluginCall call) {
        mainHandler.post(() -> { destroyMrec(); call.resolve(); });
    }

    private void destroyMrec() {
        if (mrecContainer != null) {
            Activity a = getActivity();
            if (a != null) {
                ViewGroup root = (ViewGroup) a.getWindow().getDecorView().getRootView();
                root.removeView(mrecContainer);
            }
            mrecContainer = null;
        }
        if (mrecView != null) { mrecView.destroy(); mrecView = null; }
    }

    // ── Interstitial ──────────────────────────────────────────────────────────

    @PluginMethod
    public void loadInterstitial(PluginCall call) {
        String unitId = call.getString("unitId", "");
        if (unitId.isEmpty()) { call.reject("unitId required"); return; }
        interstitialUnitId = unitId;
        loadInterstitialInternal(getActivity(), call);
    }

    private void loadInterstitialInternal(Activity activity, PluginCall callToResolve) {
        if (interstitialLoading) {
            if (callToResolve != null) callToResolve.resolve();
            return;
        }
        interstitialLoading = true;
        interstitialAd = null;

        mainHandler.post(() ->
            InterstitialAd.load(activity, interstitialUnitId,
                new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd ad) {
                        interstitialAd = ad;
                        interstitialLoading = false;
                        Log.d(TAG, "Interstitial ready");
                        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                            @Override public void onAdDismissedFullScreenContent() {
                                interstitialAd = null;
                                notifyListeners("interstitialDismissed", new JSObject());
                                loadInterstitialInternal(activity, null);
                            }
                            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) {
                                interstitialAd = null;
                                notifyListeners("interstitialDismissed", new JSObject());
                            }
                        });
                        if (callToResolve != null) callToResolve.resolve();
                    }
                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError e) {
                        interstitialLoading = false;
                        Log.w(TAG, "Interstitial load failed: " + e.getMessage());
                        if (callToResolve != null) callToResolve.reject(e.getMessage());
                    }
                }
            )
        );
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        JSObject result = new JSObject();
        if (interstitialAd == null) {
            result.put("showed", false);
            call.resolve(result);
            return;
        }
        Activity activity = getActivity();
        mainHandler.post(() -> {
            interstitialAd.show(activity);
            result.put("showed", true);
            call.resolve(result);
        });
    }

    // ── Rewarded Interstitial ─────────────────────────────────────────────────

    @PluginMethod
    public void loadRewarded(PluginCall call) {
        String unitId = call.getString("unitId", "");
        if (unitId.isEmpty()) { call.reject("unitId required"); return; }
        rewardedUnitId = unitId;
        loadRewardedInternal(getActivity(), call);
    }

    private void loadRewardedInternal(Activity activity, PluginCall callToResolve) {
        if (rewardedLoading) {
            if (callToResolve != null) callToResolve.resolve();
            return;
        }
        if (rewardedAd != null) {
            if (callToResolve != null) callToResolve.resolve();
            return;
        }
        rewardedLoading = true;

        mainHandler.post(() ->
            RewardedInterstitialAd.load(activity, rewardedUnitId,
                new AdRequest.Builder().build(),
                new RewardedInterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedInterstitialAd ad) {
                        rewardedAd = ad;
                        rewardedLoading = false;
                        Log.d(TAG, "Rewarded Interstitial ready");
                        if (callToResolve != null) callToResolve.resolve();
                    }
                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError e) {
                        rewardedLoading = false;
                        Log.w(TAG, "Rewarded load failed: " + e.getMessage());
                        if (callToResolve != null) callToResolve.reject(e.getMessage());
                    }
                }
            )
        );
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        String unitId = call.getString("unitId", "");
        if (!unitId.isEmpty()) rewardedUnitId = unitId;

        pendingRewardedCall = call;
        wasRewarded = false;

        if (rewardedAd != null) {
            showRewardedInternal(getActivity());
            return;
        }

        if (rewardedUnitId == null || rewardedUnitId.isEmpty()) {
            call.reject("Provide unitId or call loadRewarded first");
            return;
        }

        // Load on demand then show
        rewardedLoading = false;
        mainHandler.post(() ->
            RewardedInterstitialAd.load(getActivity(), rewardedUnitId,
                new AdRequest.Builder().build(),
                new RewardedInterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedInterstitialAd ad) {
                        rewardedAd = ad;
                        rewardedLoading = false;
                        showRewardedInternal(getActivity());
                    }
                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError e) {
                        rewardedLoading = false;
                        resolveRewardedCall(false, e.getMessage());
                    }
                }
            )
        );
    }

    private void showRewardedInternal(Activity activity) {
        RewardedInterstitialAd ad = rewardedAd;
        rewardedAd = null;

        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() {
                resolveRewardedCall(wasRewarded, null);
                loadRewardedInternal(activity, null);
            }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) {
                resolveRewardedCall(false, e.getMessage());
            }
        });
        ad.show(activity, item -> {
            wasRewarded = true;
            notifyListeners("rewardedCompleted", new JSObject());
        });
    }

    private void resolveRewardedCall(boolean rewarded, String error) {
        if (pendingRewardedCall == null) return;
        JSObject res = new JSObject();
        res.put("rewarded", rewarded);
        if (error != null) res.put("error", error);
        pendingRewardedCall.resolve(res);
        pendingRewardedCall = null;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    protected void handleOnDestroy() {
        destroyBanner();
        destroyMrec();
        interstitialAd = null;
        rewardedAd = null;
    }
}
