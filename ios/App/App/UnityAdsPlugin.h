#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>
#import <UnityAds/UnityAds.h>

@interface UnityAdsPlugin : CAPPlugin <UnityAdsInitializationDelegate, UnityAdsLoadDelegate, UnityAdsShowDelegate>
@end
