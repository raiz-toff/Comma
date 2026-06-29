import { registerWebModule, NativeModule } from 'expo';

class CommaTrackerModule extends NativeModule {
  startTracking() {
    return false;
  }
  stopTracking() {}
  requestBatteryOptimizationExemption() {}
  hasOverlayPermission() {
    return false;
  }
  requestOverlayPermission() {}
  setDistanceUnit(_unit: string) {}
  setShiftTiming(_startTimeMs: number, _pausedSeconds: number, _isPaused: boolean, _frozenElapsed: number) {}
  consumeOpenConsole() {
    return false;
  }
}

export default registerWebModule(CommaTrackerModule, 'CommaTrackerModule');
