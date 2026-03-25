import {
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Appearance, Text as RNText, TextInput, Platform } from "react-native";
import { RobotoCondensed_400Regular } from "@expo-google-fonts/roboto-condensed";
import "react-native-reanimated";
import "../global.css";

// Set default font for TextInput components globally
if (!TextInput.defaultProps) {
  TextInput.defaultProps = {};
}
// Note: defaultProps.style may not work reliably in all cases
// We'll also need to ensure styles explicitly include fontFamily where needed

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    RobotoCondensed_400Regular,
  });

  useEffect(() => {
    const setupApp = async () => {
      // Lock screen orientation to landscape (skip on web)
      if (Platform.OS !== 'web') {
        try {
          // Lock to landscape (allows both left and right landscape)
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          
          // For iPad, retry after a short delay to ensure it sticks
          // Sometimes the lock needs to be applied after the app fully loads
          setTimeout(async () => {
            try {
              await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            } catch (retryErr) {
              // Silently fail retry
            }
          }, 1000);
        } catch (err) {
          console.log("Orientation lock not supported:", err);
        }
      }
      
      // Force light appearance mode for keyboard styling (skip on web)
      if (Platform.OS !== 'web') {
        Appearance.setColorScheme('light');
      }
      
      if (loaded) {
        SplashScreen.hideAsync();
      }
    };
    
    setupApp();
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DefaultTheme}>
        <Stack
          screenOptions={({ route }) => ({
            headerShown: !route.name.startsWith("tempobook"),
          })}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="light" hidden={true} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
