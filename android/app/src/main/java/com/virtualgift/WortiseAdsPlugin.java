package com.virtualgift;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.wortise.ads.AdError;
import com.wortise.ads.RevenueData;
import com.wortise.ads.WortiseSdk;
import com.wortise.ads.rewarded.RewardedAd;
import com.wortise.ads.rewarded.models.Reward;

@CapacitorPlugin(name = "WortiseAds")
public class WortiseAdsPlugin extends Plugin {

    private static final String APP_ID = "86f3e34b-8224-43bd-9e86-7587072ca2a6";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private RewardedAd rewardedAd;
    private PluginCall pendingCall;
    private boolean wasRewarded = false;

    @Override
    public void load() {
        Activity activity = getActivity();
        mainHandler.post(() -> WortiseSdk.initialize(activity, APP_ID));
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        String unitId = call.getString("unitId", "");
        if (unitId.isEmpty()) {
            call.reject("unitId is required");
            return;
        }

        pendingCall = call;
        wasRewarded = false;

        Activity activity = getActivity();
        mainHandler.post(() -> {
            rewardedAd = new RewardedAd(activity, unitId);
            rewardedAd.setListener(new RewardedAd.Listener() {

                @Override
                public void onRewardedLoaded(RewardedAd ad) {
                    ad.showAd(activity);
                }

                @Override
                public void onRewardedImpression(RewardedAd ad) {}

                @Override
                public void onRewardedClicked(RewardedAd ad) {}

                @Override
                public void onRewardedShown(RewardedAd ad) {}

                @Override
                public void onRewardedCompleted(RewardedAd ad, Reward reward) {
                    wasRewarded = true;
                    notifyListeners("rewardedCompleted", new JSObject());
                }

                @Override
                public void onRewardedDismissed(RewardedAd ad) {
                    resolveCall(wasRewarded, null);
                    wasRewarded = false;
                }

                @Override
                public void onRewardedFailedToLoad(RewardedAd ad, AdError error) {
                    resolveCall(false, error.getMessage());
                }

                @Override
                public void onRewardedFailedToShow(RewardedAd ad, AdError error) {
                    resolveCall(false, error.getMessage());
                }

                @Override
                public void onRewardedRevenuePaid(RewardedAd ad, RevenueData data) {}
            });
            rewardedAd.loadAd();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (rewardedAd != null) {
            rewardedAd.destroy();
            rewardedAd = null;
        }
    }

    private void resolveCall(boolean rewarded, String error) {
        if (pendingCall == null) return;
        JSObject result = new JSObject();
        result.put("rewarded", rewarded);
        if (error != null) result.put("error", error);
        pendingCall.resolve(result);
        pendingCall = null;
    }
}
