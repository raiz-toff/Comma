import { registerWebModule, NativeModule } from 'expo';

class CommaTrackerModule extends NativeModule<{}> {}

export default registerWebModule(CommaTrackerModule, 'CommaTrackerModule');
