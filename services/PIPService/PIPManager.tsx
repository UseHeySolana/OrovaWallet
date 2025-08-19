import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { 
  View, 
  Dimensions, 
  Animated,
  Platform,
  Alert
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAi } from '@/context/AiContext';
import AppSettings from '@/utils/store/settingsstore.store';
import PIPOverlay from './PIPOverlay';
import { NativePIPModule } from "./NativePIPModule";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PIPContextType {
  isPIPActive: boolean;
  showPIP: () => void;
  hidePIP: () => void;
  togglePIP: () => void;
  pipPosition: { x: number; y: number };
  setPipPosition: (position: { x: number; y: number }) => void;
  hasOverlayPermission: boolean;
  requestPermission: () => Promise<void>;
}

const PIPContext = createContext<PIPContextType | null>(null);

interface PIPManagerProps {
  children: React.ReactNode;
}

const PIP_STORAGE_KEY = "heysolana_pip_position";
const PIP_SIZE = 80;
const SCREEN_EDGE_PADDING = 20;

export const PIPManager: React.FC<PIPManagerProps> = ({ children }) => {
  const [isPIPActive, setIsPIPActive] = useState(false);
  const [hasOverlayPermission, setHasOverlayPermission] = useState(false);
  const [pipPosition, setPipPosition] = useState({
    x: screenWidth - PIP_SIZE - SCREEN_EDGE_PADDING,
    y: screenHeight / 2,
  });

  const translateX = useRef(new Animated.Value(pipPosition.x)).current;
  const translateY = useRef(new Animated.Value(pipPosition.y)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const { isSessionActive, sessionManager } = useAi();
  const { setLoading } = AppSettings();

  // Check overlay permission on mount
  useEffect(() => {
    checkOverlayPermission();
    loadPIPPosition();
  }, []);

  // Update animated values when position changes
  useEffect(() => {
    translateX.setValue(pipPosition.x);
    translateY.setValue(pipPosition.y);
  }, [pipPosition]);

  const checkOverlayPermission = async () => {
    try {
      const canDraw = await NativePIPModule.canDrawOverlays();
      setHasOverlayPermission(canDraw);
    } catch (error) {
      console.error("Error checking overlay permission:", error);
      setHasOverlayPermission(false);
    }
  };

  const requestPermission = async () => {
    try {
      setLoading(true);
      await NativePIPModule.requestOverlayPermission();

      // Check again after a delay to see if permission was granted
      setTimeout(async () => {
        await checkOverlayPermission();
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Error requesting overlay permission:", error);
      setLoading(false);
      Alert.alert(
        "Permission Required",
        "Please grant overlay permission in settings to use the floating AI assistant."
      );
    }
  };

  const loadPIPPosition = async () => {
    try {
      const savedPosition = await AsyncStorage.getItem(PIP_STORAGE_KEY);
      if (savedPosition) {
        const position = JSON.parse(savedPosition);
        setPipPosition(position);
      }
    } catch (error) {
      console.error("Error loading PIP position:", error);
    }
  };

  const savePIPPosition = async (position: { x: number; y: number }) => {
    try {
      await AsyncStorage.setItem(PIP_STORAGE_KEY, JSON.stringify(position));
    } catch (error) {
      console.error("Error saving PIP position:", error);
    }
  };

  const snapToEdge = (x: number, y: number) => {
    const centerX = screenWidth / 2;
    const snapX =
      x < centerX
        ? SCREEN_EDGE_PADDING
        : screenWidth - PIP_SIZE - SCREEN_EDGE_PADDING;

    const boundedY = Math.max(
      SCREEN_EDGE_PADDING,
      Math.min(y, screenHeight - PIP_SIZE - SCREEN_EDGE_PADDING)
    );

    return { x: snapX, y: boundedY };
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      Animated.spring(scale, {
        toValue: 1.1,
        useNativeDriver: true,
      }).start();
    })
    .onUpdate((event) => {
      translateX.setValue(event.translationX + pipPosition.x);
      translateY.setValue(event.translationY + pipPosition.y);
    })
    .onEnd((event) => {
      const newX = event.translationX + pipPosition.x;
      const newY = event.translationY + pipPosition.y;

      const snappedPosition = snapToEdge(newX, newY);

      Animated.parallel([
        Animated.spring(translateX, {
          toValue: snappedPosition.x,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: snappedPosition.y,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();

      setPipPosition(snappedPosition);
      savePIPPosition(snappedPosition);
    });

  const showPIP = async () => {
    try {
      if (Platform.OS === "android") {
        // Check permission first
        const canDraw = await NativePIPModule.canDrawOverlays();
        if (!canDraw) {
          Alert.alert(
            "Permission Required",
            "Please grant overlay permission to use the floating AI assistant.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Grant Permission", onPress: requestPermission },
            ]
          );
          return;
        }

        // Start native PIP overlay
        const success = await NativePIPModule.startPIP();
        if (success) {
          setIsPIPActive(true);
        } else {
          Alert.alert("Error", "Failed to start floating AI assistant.");
        }
      } else {
        // For iOS, use the React Native overlay (within app)
        setIsPIPActive(true);
      }
    } catch (error) {
      console.error("Error starting PIP:", error);
      Alert.alert("Error", "Failed to start floating AI assistant.");
    }
  };

  const hidePIP = async () => {
    try {
      if (Platform.OS === "android") {
        await NativePIPModule.stopPIP();
      }
      setIsPIPActive(false);
    } catch (error) {
      console.error("Error stopping PIP:", error);
      setIsPIPActive(false);
    }
  };

  const togglePIP = () => {
    if (isPIPActive) {
      hidePIP();
    } else {
      showPIP();
    }
  };

  const contextValue: PIPContextType = {
    isPIPActive,
    showPIP,
    hidePIP,
    togglePIP,
    pipPosition,
    setPipPosition,
    hasOverlayPermission,
    requestPermission,
  };

  return (
    <PIPContext.Provider value={contextValue}>
      {children}
      {/* Only show React Native overlay on iOS or when native PIP is not available */}
      {isPIPActive && Platform.OS === "ios" && (
        <PIPOverlay pipPosition={pipPosition} panGesture={panGesture} />
      )}
    </PIPContext.Provider>
  );
};

export const usePIP = (): PIPContextType => {
  const context = useContext(PIPContext);
  if (!context) {
    throw new Error('usePIP must be used within a PIPManager');
  }
  return context;
};

export default PIPManager; 