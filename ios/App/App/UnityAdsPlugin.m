#import "UnityAdsPlugin.h"

CAP_PLUGIN(UnityAdsPlugin, "UnityAds",
           CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(showRewarded, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(showInterstitial, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(showBanner, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(hideBanner, CAPPluginReturnPromise);
)

@interface UnityAdsPlugin ()
@property (nonatomic, strong) CAPPluginCall *initCall;
@property (nonatomic, strong) CAPPluginCall *showCall;
@property (nonatomic, copy) NSString *pendingPlacementId;
@property (nonatomic, assign) BOOL pendingRewarded;
@property (nonatomic, assign) BOOL initialized;
@end

@implementation UnityAdsPlugin

- (void)initialize:(CAPPluginCall *)call {
    NSString *gameId = [call getString:@"gameId" defaultValue:@"6127954"];
    NSNumber *testModeValue = [call getBool:@"testMode" defaultValue:@NO];
    BOOL testMode = [testModeValue boolValue];

    if ([UnityAds isInitialized]) {
        self.initialized = YES;
        [call resolve:@{ @"initialized": @YES }];
        return;
    }

    self.initCall = call;
    [UnityAds initialize:gameId testMode:testMode initializationDelegate:self];
}

- (void)showInterstitial:(CAPPluginCall *)call {
    NSString *placementId = [call getString:@"placementId" defaultValue:@"Interstitial_iOS"];
    [self showFullScreenAd:call placementId:placementId rewarded:NO];
}

- (void)showRewarded:(CAPPluginCall *)call {
    NSString *placementId = [call getString:@"placementId" defaultValue:@"Rewarded_iOS"];
    NSString *serverId = [call getString:@"serverId" defaultValue:@""];
    if (serverId.length > 0) {
        UADSPlayerMetaData *playerMetaData = [[UADSPlayerMetaData alloc] init];
        [playerMetaData setServerId:serverId];
        [playerMetaData commit];
    }
    [self showFullScreenAd:call placementId:placementId rewarded:YES];
}

- (void)showFullScreenAd:(CAPPluginCall *)call placementId:(NSString *)placementId rewarded:(BOOL)rewarded {
    if (!self.initialized && ![UnityAds isInitialized]) {
        [call reject:@"Unity Ads no esta inicializado"];
        return;
    }

    self.showCall = call;
    self.pendingPlacementId = placementId;
    self.pendingRewarded = rewarded;
    [UnityAds load:placementId loadDelegate:self];
}

- (void)showBanner:(CAPPluginCall *)call {
    [call reject:@"Unity Ads banner iOS pendiente de validar en Xcode"];
}

- (void)hideBanner:(CAPPluginCall *)call {
    [call resolve];
}

- (void)initializationComplete {
    self.initialized = YES;
    [self.initCall resolve:@{ @"initialized": @YES }];
    self.initCall = nil;
}

- (void)initializationFailed:(UnityAdsInitializationError)error withMessage:(NSString *)message {
    self.initialized = NO;
    [self.initCall reject:[NSString stringWithFormat:@"Unity Ads init failed: %ld %@", (long)error, message ?: @""]];
    self.initCall = nil;
}

- (void)unityAdsAdLoaded:(NSString *)placementId {
    UIViewController *viewController = self.bridge.viewController;
    if (!viewController) {
        [self.showCall reject:@"ViewController no disponible"];
        self.showCall = nil;
        return;
    }
    [UnityAds show:viewController placementId:placementId showDelegate:self];
}

- (void)unityAdsAdFailedToLoad:(NSString *)placementId withError:(UnityAdsLoadError)error withMessage:(NSString *)message {
    [self.showCall reject:[NSString stringWithFormat:@"Unity Ads load failed: %ld %@", (long)error, message ?: @""]];
    self.showCall = nil;
}

- (void)unityAdsShowComplete:(NSString *)placementId withFinishState:(UnityAdsShowCompletionState)state {
    BOOL completed = state == kUnityShowCompletionStateCompleted;
    BOOL rewarded = self.pendingRewarded && completed;
    [self.showCall resolve:@{
        @"placementId": placementId ?: @"",
        @"completed": @(completed),
        @"rewarded": @(rewarded)
    }];
    self.showCall = nil;
}

- (void)unityAdsShowFailed:(NSString *)placementId withError:(UnityAdsShowError)error withMessage:(NSString *)message {
    [self.showCall reject:[NSString stringWithFormat:@"Unity Ads show failed: %ld %@", (long)error, message ?: @""]];
    self.showCall = nil;
}

- (void)unityAdsShowStart:(NSString *)placementId {
}

- (void)unityAdsShowClick:(NSString *)placementId {
}

@end
