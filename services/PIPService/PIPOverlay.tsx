import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
  StyleSheet,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { usePIP } from './PIPManager';
import { useAi } from '@/context/AiContext';
import { useThemeContext } from '@/context/ThemeContext';
import IconLibrary from "@/utils/icons";
import CText from '@/components/TextComp';
import LottieView from 'lottie-react-native';
import { BlurView } from 'expo-blur';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const colors = {
  loading: {
    color1: "#971BB2", // main purple
    color2: "#D98BEA", // lighter purple for shimmer effect
  },
  aispeaking: {
    color1: "#4B00E0", // electric violet
    color2: "#00F0FF", // neon cyan
  },
  human: {
    color1: "#1BB296", // teal
    color2: "#A3F3E4", // minty highlight
  },
};

interface PIPOverlayProps {
  pipPosition: { x: number; y: number };
  panGesture: any;
}

const PIPOverlay: React.FC<PIPOverlayProps> = ({ pipPosition, panGesture }) => {
  const { hidePIP } = usePIP();
  const { 
    sessionManager, 
    isSessionActive, 
    startSession, 
    stopSession, 
    currentMode 
  } = useAi();
  const { isDarkMode } = useThemeContext();
  
  const animation = useRef<LottieView>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (currentMode === "aispeaking" || currentMode === "human") {
      animation.current?.play();
    } else if (currentMode === "loading") {
      animation.current?.pause();
    }
  }, [currentMode]);

  const handlePress = () => {
    console.log("handlePress");
    if (isSessionActive) {
      stopSession();
    } else {
      startSession();
    }
  };

  const handleLongPress = () => {
    hidePIP();
  };

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={[styles.container, { zIndex: 9999 }]}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.pipWindow,
            {
              transform: [
                { translateX: pipPosition.x },
                { translateY: pipPosition.y },
                { scale: scaleAnim },
              ],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Background blur effect */}
          <BlurView intensity={80} style={styles.blurBackground} />

          <CText>This is Moses</CText>
          {/* AI Animation */}
          <View style={styles.animationContainer}>
            <LottieView
              autoPlay={isSessionActive}
              loop
              speed={8}
              ref={animation}
              style={styles.lottieAnimation}
              resizeMode="cover"
              colorFilters={[
                {
                  keypath: "Shape Layer 2",
                  color: colors[currentMode].color1,
                },
                {
                  keypath: "Shape Layer 1",
                  color: colors[currentMode].color2,
                },
              ]}
              source={require("@/assets/anim/lower.json")}
            />
          </View>

          {/* Main AI Button */}
          <TouchableOpacity
            style={[
              styles.aiButton,
              {
                backgroundColor: isSessionActive
                  ? colors[currentMode].color1
                  : isDarkMode
                  ? "#333"
                  : "#f0f0f0",
              },
            ]}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={handleLongPress}
            activeOpacity={0.8}
          >
            <Image
              source={require("@/assets/images/ai.png")}
              style={styles.aiImage}
              contentFit="cover"
            />
          </TouchableOpacity>

          {/* Status Indicator */}
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: isSessionActive
                  ? colors[currentMode].color1
                  : "#666",
              },
            ]}
          >
            <View style={styles.statusDot} />
          </View>

          {/* Mode Text */}
          <View style={styles.modeContainer}>
            <CText
              style={[
                styles.modeText,
                { color: isDarkMode ? "white" : "black" },
              ]}
            >
              {isSessionActive
                ? currentMode === "aispeaking"
                  ? "AI"
                  : currentMode === "human"
                  ? "You"
                  : "..."
                : "Tap"}
            </CText>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={hidePIP}>
            <IconLibrary.cancel
              color={isDarkMode ? "white" : "black"}
              size={12}
            />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  pipWindow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  blurBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
  },
  animationContainer: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 50,
    overflow: 'hidden',
  },
  lottieAnimation: {
    width: '100%',
    height: '100%',
  },
  aiButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  aiImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  statusIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
  },
  modeContainer: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PIPOverlay; 