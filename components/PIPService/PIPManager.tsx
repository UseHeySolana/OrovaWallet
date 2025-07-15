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
import { useAi } from '@/misc/context/AiContext';
import AppSettings from '@/misc/store/settingsstore';
import PIPOverlay from './PIPOverlay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PIPContextType {
  isPIPActive: boolean;
  showPIP: () => void;
  hidePIP: () => void;
  togglePIP: () => void;
  pipPosition: { x: number; y: number };
  setPipPosition: (position: { x: number; y: number }) => void;
}

const PIPContext = createContext<PIPContextType | null>(null);

interface PIPManagerProps {
  children: React.ReactNode;
}

const PIP_STORAGE_KEY = 'heysolana_pip_position';
const PIP_SIZE = 80;
const SCREEN_EDGE_PADDING = 20;

export const PIPManager: React.FC<PIPManagerProps> = ({ children }) => {
  const [isPIPActive, setIsPIPActive] = useState(false);
  const [pipPosition, setPipPosition] = useState({ 
    x: screenWidth - PIP_SIZE - SCREEN_EDGE_PADDING, 
    y: screenHeight / 2 
  });
  
  const translateX = useRef(new Animated.Value(pipPosition.x)).current;
  const translateY = useRef(new Animated.Value(pipPosition.y)).current;
  const scale = useRef(new Animated.Value(1)).current;
  
  const { isSessionActive, sessionManager } = useAi();
  const { setLoading } = AppSettings();

  // Load saved PIP position
  useEffect(() => {
    loadPIPPosition();
  }, []);

  // Update animated values when position changes
  useEffect(() => {
    translateX.setValue(pipPosition.x);
    translateY.setValue(pipPosition.y);
  }, [pipPosition]);

  const loadPIPPosition = async () => {
    try {
      const savedPosition = await AsyncStorage.getItem(PIP_STORAGE_KEY);
      if (savedPosition) {
        const position = JSON.parse(savedPosition);
        setPipPosition(position);
      }
    } catch (error) {
      console.error('Error loading PIP position:', error);
    }
  };

  const savePIPPosition = async (position: { x: number; y: number }) => {
    try {
      await AsyncStorage.setItem(PIP_STORAGE_KEY, JSON.stringify(position));
    } catch (error) {
      console.error('Error saving PIP position:', error);
    }
  };

  const snapToEdge = (x: number, y: number) => {
    const centerX = screenWidth / 2;
    const snapX = x < centerX 
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

  const showPIP = () => {
    if (Platform.OS === 'android') {
      // For Android, we can request PIP mode
      setIsPIPActive(true);
    } else {
      // For iOS, show our custom floating overlay
      setIsPIPActive(true);
    }
  };

  const hidePIP = () => {
    setIsPIPActive(false);
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
  };

  return (
    <PIPContext.Provider value={contextValue}>
      {children}
      {isPIPActive && (
        <PIPOverlay 
          pipPosition={pipPosition}
          panGesture={panGesture}
        />
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