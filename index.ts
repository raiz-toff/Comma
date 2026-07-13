import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgets/widgetTaskHandler';

/**
 * Home-screen widgets are an Android feature, and so is the API that registers
 * them: registerWidgetTaskHandler reaches for AppRegistry.registerHeadlessTask,
 * which only exists in React Native's Android runtime. Called unconditionally it
 * throws "registerHeadlessTask is not a function" on web at startup.
 */
if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
}

/**
 * DO NOT import the theme (or anything that reaches NativeWind) from this file.
 *
 * `import` declarations hoist, so an import here lands in the graph AHEAD of
 * expo-router/entry — and NativeWind's runtime touches Appearance/AppState and
 * patches React Native's components as it loads. Initialising it before React
 * Native has set up its own environment kills the app at startup with
 * "TypeError: property is not writable", before the runtime is even ready.
 *
 * The theme boots dark from ThemeSync's effect instead: its preference defaults
 * to dark until the profile loads, so dark is applied on the first commit. See
 * src/theme/ThemeSync.tsx.
 */

import "expo-router/entry";
