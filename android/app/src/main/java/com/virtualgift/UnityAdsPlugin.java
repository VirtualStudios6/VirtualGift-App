package com.virtualgift;

import android.app.Activity;
import android.content.Context;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
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
import com.unity3d.ads.metadata.MetaData;
import com.unity3d.ads.metadata.PlayerMetaData;
import com.unity3d.services.banners.BannerErrorInfo;
import com.unity3d.services.banners.BannerView;
import com.unity3d.services.banners.UnityBannerSize;

import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {
    private static final String TAG = "VGUnityAds";
    private static final String DEFAULT_ANDROID_GAME_ID = "6127955";
    private static final String DEFAULT_INTERSTITIAL = "Interstitial_Android";
    private static final String DEFAULT_REWARDED     = "Rewarded_Android";
    private static final String DEFAULT_BANNER       = "Banner_Android";

    private boolean initialized = false;
    private String  gameId      = DEFAULT_ANDROID_GAME_ID;
    private boolean testMode    = false;
    private FrameLayout bannerContainer;
    private BannerView  bannerView;
    private final Set<String> loadedPlacements = new HashSet<>();

    // ── Inicialización ──────────────────────────────────────────────────────
    @PluginMethod
    public void initialize(PluginCall call) {
        gameId   = call.getString("gameId",   DEFAULT_ANDROID_GAME_ID);
        testMode = Boolean.TRUE.equals(call.getBoolean("testMode", false));

        if (UnityAds.isInitialized()) {
            initialized = true;
            preloadAd(DEFAULT_INTERSTITIAL);
            preloadAd(DEFAULT_REWARDED);
            JSObject ret = new JSObject();
            ret.put("initialized", true);
            call.resolve(ret);
            return;
        }

        Context appContext = getContext().getApplicationContext();

        boolean gdprConsent = Boolean.TRUE.equals(call.getBoolean("gdprConsent", false));

        getActivity().runOnUiThread(() -> {
            Log.d(TAG, "initialize gameId=" + gameId + " testMode=" + testMode + " gdpr=" + gdprConsent);
            UnityAds.setDebugMode(false); // nunca mostrar overlay de debug

            // Aplicar consentimiento GDPR antes de inicializar
            MetaData gdprMeta = new MetaData(appContext);
            gdprMeta.set("gdpr.consent", gdprConsent);
            gdprMeta.commit();

            // Consentimiento de privacidad adicional (CCPA / App Tracking)
            MetaData privacyMeta = new MetaData(appContext);
            privacyMeta.set("privacy.consent", gdprConsent);
            privacyMeta.commit();
            UnityAds.initialize(appContext, gameId, testMode,
                new IUnityAdsInitializationListener() {
                    @Override
                    public void onInitializationComplete() {
                        initialized = true;
                        Log.d(TAG, "init OK");
                        preloadAd(DEFAULT_INTERSTITIAL);
                        preloadAd(DEFAULT_REWARDED);
                        JSObject ret = new JSObject();
                        ret.put("initialized", true);
                        call.resolve(ret);
                    }

                    @Override
                    public void onInitializationFailed(
                            UnityAds.UnityAdsInitializationError error, String message) {
                        initialized = false;
                        Log.e(TAG, "init failed: " + error + " " + message);
                        call.reject("Unity Ads init failed: " + error + " - " + message);
                    }
                });
        });
    }

    // ── Pre-carga en segundo plano ──────────────────────────────────────────
    private void preloadAd(String placementId) {
        loadedPlacements.remove(placementId);
        UnityAds.load(placementId, new IUnityAdsLoadListener() {
            @Override public void onUnityAdsAdLoaded(String placement) {
                Log.d(TAG, "pre-loaded: " + placement);
                loadedPlacements.add(placement);
            }
            @Override public void onUnityAdsFailedToLoad(
                    String placement, UnityAds.UnityAdsLoadError error, String msg) {
                Log.w(TAG, "pre-load failed: " + placement + " " + error);
            }
        });
    }

    // ── Status ──────────────────────────────────────────────────────────────
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("initialized",       initialized);
        ret.put("unityInitialized",  UnityAds.isInitialized());
        ret.put("gameId",            gameId);
        ret.put("testMode",          testMode);
        ret.put("sdkVersion",        UnityAds.getVersion());
        ret.put("loadedPlacements",  loadedPlacements.toString());
        call.resolve(ret);
    }

    // ── Interstitial / Rewarded ─────────────────────────────────────────────
    @PluginMethod
    public void showInterstitial(PluginCall call) {
        showFullScreenAd(call, call.getString("placementId", DEFAULT_INTERSTITIAL), false);
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        String serverId = call.getString("serverId", "");
        if (serverId != null && !serverId.trim().isEmpty()) {
            PlayerMetaData meta = new PlayerMetaData(getContext());
            meta.setServerId(serverId.trim());
            meta.commit();
        }
        showFullScreenAd(call, call.getString("placementId", DEFAULT_REWARDED), true);
    }

    private void showFullScreenAd(PluginCall call, String placementId, boolean rewarded) {
        if (!initialized && !UnityAds.isInitialized()) {
            call.reject("Unity Ads no esta inicializado. Intenta de nuevo.");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) { call.reject("Activity no disponible"); return; }

        IUnityAdsShowListener showListener = new IUnityAdsShowListener() {
            @Override
            public void onUnityAdsShowFailure(
                    String placement, UnityAds.UnityAdsShowError error, String message) {
                Log.e(TAG, "show failed: " + error + " " + message);
                preloadAd(placement);
                call.reject("Unity Ads show failed: " + error + " - " + message);
            }
            @Override public void onUnityAdsShowStart(String placement) {}
            @Override public void onUnityAdsShowClick(String placement) {}
            @Override
            public void onUnityAdsShowComplete(
                    String placement, UnityAds.UnityAdsShowCompletionState state) {
                Log.d(TAG, "show complete: " + placement + " state=" + state);
                preloadAd(placement);
                JSObject ret = new JSObject();
                ret.put("placementId", placement);
                ret.put("completed", state == UnityAds.UnityAdsShowCompletionState.COMPLETED);
                ret.put("rewarded",  rewarded && state == UnityAds.UnityAdsShowCompletionState.COMPLETED);
                call.resolve(ret);
            }
        };

        activity.runOnUiThread(() -> {
            if (loadedPlacements.contains(placementId)) {
                Log.d(TAG, "show pre-loaded: " + placementId);
                loadedPlacements.remove(placementId);
                UnityAds.show(activity, placementId, new UnityAdsShowOptions(), showListener);
                return;
            }
            Log.d(TAG, "load+show: " + placementId + " rewarded=" + rewarded);
            UnityAds.load(placementId, new IUnityAdsLoadListener() {
                @Override public void onUnityAdsAdLoaded(String placement) {
                    Log.d(TAG, "loaded, showing: " + placement);
                    UnityAds.show(activity, placement, new UnityAdsShowOptions(), showListener);
                }
                @Override public void onUnityAdsFailedToLoad(
                        String placement, UnityAds.UnityAdsLoadError error, String message) {
                    Log.e(TAG, "load failed: " + placement + " " + error + " " + message);
                    call.reject("Unity Ads load failed: " + error + " - " + message);
                }
            });
        });
    }

    // ── Banner ──────────────────────────────────────────────────────────────
    @PluginMethod
    public void showBanner(PluginCall call) {
        if (!initialized && !UnityAds.isInitialized()) {
            call.reject("Unity Ads no esta inicializado");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) { call.reject("Activity no disponible"); return; }

        String placementId = call.getString("placementId", DEFAULT_BANNER);
        String position    = call.getString("position", "bottom");

        activity.runOnUiThread(() -> {
            hideBannerInternal();
            Log.d(TAG, "prepare banner: " + placementId);

            // Crear contenedor PERO no añadirlo al root todavía
            // Se añade solo cuando el banner carga exitosamente (evita espacio en blanco)
            ViewGroup root = activity.findViewById(android.R.id.content);

            FrameLayout container = new FrameLayout(activity);
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            );
            params.gravity = "top".equalsIgnoreCase(position)
                ? Gravity.TOP    | Gravity.CENTER_HORIZONTAL
                : Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            container.setLayoutParams(params);

            BannerView bv = new BannerView(activity, placementId, new UnityBannerSize(320, 50));
            bv.setListener(new BannerView.IListener() {
                @Override
                public void onBannerLoaded(BannerView bannerAdView) {
                    Log.d(TAG, "banner loaded: " + placementId);
                    // Solo ahora añadir al layout (el banner tiene contenido)
                    activity.runOnUiThread(() -> {
                        bannerContainer = container;
                        bannerView      = bv;
                        if (container.getParent() == null) {
                            root.addView(container);
                        }
                    });
                    JSObject ret = new JSObject();
                    ret.put("loaded", true);
                    ret.put("placementId", placementId);
                    call.resolve(ret);
                }

                @Override
                public void onBannerFailedToLoad(BannerView bannerAdView, BannerErrorInfo errorInfo) {
                    Log.e(TAG, "banner failed: " + errorInfo.errorCode + " " + errorInfo.errorMessage);
                    // Limpiar — el contenedor nunca se añadió, nada que remover
                    activity.runOnUiThread(() -> {
                        bannerContainer = null;
                        bannerView      = null;
                    });
                    call.reject("Unity Ads banner failed: "
                        + errorInfo.errorCode + " - " + errorInfo.errorMessage);
                }

                @Override public void onBannerClick(BannerView bannerAdView) {}
                @Override public void onBannerShown(BannerView bannerAdView) {}
                @Override public void onBannerLeftApplication(BannerView bannerAdView) {}
            });

            container.addView(bv);
            bv.load(); // cargar — el container se añade al root en onBannerLoaded
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
        bannerView      = null;
        bannerContainer = null;
    }
}
