#import "OrientationLockBridge.h"

#import "Orientation.h"

@implementation OrientationLockBridge

+ (UIInterfaceOrientationMask)supportedInterfaceOrientations
{
  return [Orientation getOrientation];
}

@end
