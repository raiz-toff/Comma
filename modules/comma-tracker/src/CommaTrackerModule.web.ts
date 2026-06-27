import { registerWebModule, NativeModule } from 'expo';

class CommaTrackerModule extends NativeModule {
  startTracking() {}
  stopTracking() {}
}

export default registerWebModule(CommaTrackerModule, 'CommaTrackerModule');
