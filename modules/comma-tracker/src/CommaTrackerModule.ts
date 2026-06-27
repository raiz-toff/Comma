import { NativeModule, requireNativeModule } from 'expo';

declare class CommaTrackerModule extends NativeModule<{}> {}

export default requireNativeModule<CommaTrackerModule>('CommaTracker');
