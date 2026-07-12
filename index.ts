import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgets/widgetTaskHandler';
import { applyThemePref } from './src/theme/scheme';

registerWidgetTaskHandler(widgetTaskHandler);

/**
 * Comma boots dark. This has to happen here, at the entry, and not from inside
 * the app tree.
 *
 * NativeWind otherwise starts on the OS scheme, so a dark-by-default driver on a
 * light phone would get a light flash lasting until the profile finishes loading
 * out of SQLite. But it cannot be done from any module in the router's import
 * graph either: Expo Router requires route modules *during render*, and
 * colorScheme.set() synchronously updates every styled component — a side-effect
 * mid-render, which is exactly what React warns about.
 *
 * Here it runs as the entry bundle evaluates: Appearance's listeners already
 * exist, but AppRegistry has not rendered anything yet, so there is nothing to
 * update and nothing to warn about.
 */
applyThemePref('dark');

import "expo-router/entry";
