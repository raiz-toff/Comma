import { NativeModule, requireNativeModule } from 'expo';

declare class CommaTrackerModule extends NativeModule {
  startTracking(): void;
  stopTracking(): void;
}

export default requireNativeModule<CommaTrackerModule>('CommaTracker');
