// The widget's background task registers before the app itself, so it runs even when the app is closed.
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './widget/handler';

if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);

import 'expo-router/entry';
