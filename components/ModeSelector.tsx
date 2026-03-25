import { View, Text, TouchableOpacity, TextInput, StyleSheet, Image } from "react-native";
import { useState, useEffect, useRef } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Eye, EyeOff, LogIn, Play } from "lucide-react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolateColor, Easing } from "react-native-reanimated";

interface LoginScreenProps {
  onLogin: (username: string, password: string) => void;
  onDemoMode: () => void;
}

export function LoginScreen({ onLogin, onDemoMode }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const videoRef = useRef<Video>(null);
  
  // Color animation for iris logo
  const colorProgress = useSharedValue(0);

  useEffect(() => {
    // Play video on mount
    videoRef.current?.playAsync();
    
    // Start color animation - loop between 0 and 1 (blue to purple and back)
    colorProgress.value = withRepeat(
      withTiming(1, {
        duration: 3000, // 3 seconds to go from blue to purple
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // infinite repeats
      true // reverse animation (so it goes back and forth)
    );
  }, []);
  
  // Animated style for logo tint color (for image) and text color
  const logoColorStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      colorProgress.value,
      [0, 1],
      ['#67E3FF', '#A984FF'] // From iris blue to iris purple
    );
    return {
      tintColor: color, // For Image tintColor
      color: color, // For Text color
    };
  });

  const handleLogin = () => {
    if (username && password) {
      onLogin(username, password);
    }
  };

  return (
    <View className="flex-1 items-center justify-center p-8" style={styles.container}>
      {/* Background Video */}
      <Video
        ref={videoRef}
        source={require("@/assets/videos/login-background.mp4")} // Update with your video filename
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted
        shouldPlay
        positionMillis={0}
      />
      
      {/* Dark overlay for better text readability */}
      <View style={styles.overlay} />
      {/* Logo/Title */}
      <View className="mb-12 items-center">
        <Animated.Image
          source={require("@/assets/images/logo.png")}
          style={[
            {
              width: 120,
              height: 120,
              resizeMode: 'contain',
              marginBottom: 8,
            },
            logoColorStyle,
          ]}
        />
        <Text className="text-[#67E3FF] text-lg text-center">Vision-Driven Point of Sale</Text>
      </View>

      {/* Login Form */}
      <View className="w-full max-w-md">
        <GlassPanel className="p-8">
          <Text className="text-white text-2xl font-bold mb-6 text-center">Sign In</Text>

          {/* Username Input */}
          <View className="mb-4">
            <Text className="text-white/70 text-sm mb-2">Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor="#666"
              autoCapitalize="none"
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>

          {/* Password Input */}
          <View className="mb-6">
            <Text className="text-white/70 text-sm mb-2">Password</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#666"
                secureTextEntry={!showPassword}
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base pr-12"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3"
              >
                {showPassword ? (
                  <EyeOff size={20} color="#67E3FF" />
                ) : (
                  <Eye size={20} color="#67E3FF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={!username || !password}
            className={`py-4 rounded-xl flex-row items-center justify-center gap-2 mb-4 ${
              username && password
                ? "bg-[#67E3FF]"
                : "bg-white/5 border border-white/10"
            }`}
            style={
              username && password
                ? {
                    shadowColor: "#67E3FF",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                  }
                : {}
            }
          >
            <LogIn size={20} color={username && password ? "#000" : "#666"} />
            <Text
              className={`font-bold text-base ${
                username && password ? "text-black" : "text-white/30"
              }`}
            >
              Sign In
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-4">
            <View className="flex-1 h-px bg-white/20" />
            <Text className="text-white/40 mx-4 text-sm">or</Text>
            <View className="flex-1 h-px bg-white/20" />
          </View>

          {/* Demo Mode Button */}
          <TouchableOpacity
            onPress={onDemoMode}
            className="py-4 rounded-xl flex-row items-center justify-center gap-2 bg-[#A984FF]"
            style={{
              shadowColor: "#A984FF",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
            }}
          >
            <Play size={20} color="#fff" />
            <Text className="text-white font-bold text-base">Demo Mode</Text>
          </TouchableOpacity>
        </GlassPanel>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  video: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)", // Adjust opacity as needed (0-1)
  },
});
