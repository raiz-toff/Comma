import { registerWebModule, NativeModule } from 'expo';

class CommaTrackerModule extends NativeModule {
  startTracking() {
    return false;
  }
  stopTracking() {}
}

export default registerWebModule(CommaTrackerModule, 'CommaTrackerModule');
