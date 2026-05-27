#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <WidgetKit/WidgetKit.h>

static NSString *const ATStepQuestWidgetAppGroup =
    @"group.love.leaetzak.adventuretime";
static NSString *const ATStepQuestWidgetSnapshotKey =
    @"stepQuestWidgetSnapshot";
static NSString *const ATStepQuestWidgetKind = @"StepQuestWidget";

@interface WidgetSnapshotBridge : NSObject <RCTBridgeModule>
@end

@implementation WidgetSnapshotBridge

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(setStepQuestSnapshot,
                 setStepQuestSnapshot:(NSString *)snapshotJson
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSUserDefaults *defaults =
      [[NSUserDefaults alloc] initWithSuiteName:ATStepQuestWidgetAppGroup];

  if (defaults == nil) {
    reject(@"WIDGET_SNAPSHOT_WRITE_FAILED",
           @"App group defaults are unavailable.",
           nil);
    return;
  }

  [defaults setObject:snapshotJson forKey:ATStepQuestWidgetSnapshotKey];
  [defaults synchronize];

  if (@available(iOS 14.0, *)) {
    [[WidgetCenter sharedCenter]
        reloadTimelinesOfKind:ATStepQuestWidgetKind];
  }

  resolve(nil);
}

RCT_REMAP_METHOD(clearStepQuestSnapshot,
                 clearStepQuestSnapshotWithResolver:
                     (RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSUserDefaults *defaults =
      [[NSUserDefaults alloc] initWithSuiteName:ATStepQuestWidgetAppGroup];

  if (defaults == nil) {
    reject(@"WIDGET_SNAPSHOT_CLEAR_FAILED",
           @"App group defaults are unavailable.",
           nil);
    return;
  }

  [defaults removeObjectForKey:ATStepQuestWidgetSnapshotKey];
  [defaults synchronize];

  if (@available(iOS 14.0, *)) {
    [[WidgetCenter sharedCenter]
        reloadTimelinesOfKind:ATStepQuestWidgetKind];
  }

  resolve(nil);
}

@end
