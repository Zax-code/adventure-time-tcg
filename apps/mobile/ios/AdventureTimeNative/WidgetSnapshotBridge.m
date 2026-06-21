#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetSnapshotBridge, NSObject)

RCT_EXTERN_METHOD(setStepQuestSnapshot:(NSString *)snapshotJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setStepQuestSyncContext:(NSString *)contextJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

_RCT_EXTERN_REMAP_METHOD(clearStepQuestSnapshot,
                         clearStepQuestSnapshotWithResolver:(RCTPromiseResolveBlock)resolve
                         rejecter:(RCTPromiseRejectBlock)reject,
                         NO)

_RCT_EXTERN_REMAP_METHOD(startStepQuestBackgroundSync,
                         startStepQuestBackgroundSyncWithResolver:(RCTPromiseResolveBlock)resolve
                         rejecter:(RCTPromiseRejectBlock)reject,
                         NO)

@end
