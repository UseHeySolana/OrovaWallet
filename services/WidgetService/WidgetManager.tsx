import React, { useEffect, useCallback } from 'react';
import { AppState, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAi } from '@/context/AiContext';
import { usePIP } from '../PIPService/PIPManager';
import { router } from 'expo-router';
import AppSettings from '@/misc/store/settingsstore';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface WidgetManagerProps {
  children: React.ReactNode;
}

export const WidgetManager: React.FC<WidgetManagerProps> = ({ children }) => {
  const { startSession, stopSession, isSessionActive } = useAi();
  const { showPIP, hidePIP, isPIPActive } = usePIP();
  const { setLoading } = AppSettings();

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('Deep link received:', url);
      
      if (url.includes('heysolana://ai/start')) {
        handleStartAI();
      } else if (url.includes('heysolana://ai/stop')) {
        handleStopAI();
      } else if (url.includes('heysolana://pip/show')) {
        handleShowPIP();
        router.push("/dashboard");
      } else if (url.includes('heysolana://pip/hide')) {
        handleHidePIP();
        router.push("/dashboard");
      } else if (url.includes('heysolana://dashboard')) {
        router.push('/dashboard');
      }
    };

    // Check if app was opened with a deep link
    const getInitialURL = async () => {
      const initialURL = await Linking.getInitialURL();
      console.log("Initial URL:", initialURL);
      if (initialURL) {
        handleDeepLink(initialURL);
      }
    };

    getInitialURL();

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Handle notification responses
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        
        if (data?.action === 'start_ai') {
          handleStartAI();
        } else if (data?.action === 'stop_ai') {
          handleStopAI();
        } else if (data?.action === 'show_pip') {
          handleShowPIP();
        }
      }
    );

    return () => subscription.remove();
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && isSessionActive) {
        // When app goes to background with active session, show persistent notification
        showPersistentNotification();
      } else if (nextAppState === 'active') {
        // When app becomes active, hide notification
        Notifications.dismissAllNotificationsAsync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isSessionActive]);

  const handleStartAI = useCallback(async () => {
    try {
      setLoading(true);
      
      // Navigate to dashboard if not already there
      router.push('/dashboard');
      
      // Small delay to ensure navigation completes
      setTimeout(() => {
        startSession();
        setLoading(false);
      }, 500);
      
    } catch (error) {
      console.error('Error starting AI session:', error);
      setLoading(false);
    }
  }, [startSession, setLoading]);

  const handleStopAI = useCallback(() => {
    try {
      stopSession();
      Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Error stopping AI session:', error);
    }
  }, [stopSession]);

  const handleShowPIP = useCallback(() => {
    try {
      showPIP();
    } catch (error) {
      console.error('Error showing PIP:', error);
    }
  }, [showPIP]);

  const handleHidePIP = useCallback(() => {
    try {
      hidePIP();
    } catch (error) {
      console.error('Error hiding PIP:', error);
    }
  }, [hidePIP]);

  const showPersistentNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'HeySolana AI Active',
          body: 'Your AI assistant is listening. Tap to return to app.',
          data: { action: 'open_app' },
          sticky: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  // Register background task for widget updates
  useEffect(() => {
    const registerWidgetData = async () => {
      try {
        const widgetData = {
          isSessionActive,
          isPIPActive,
          lastUpdated: new Date().toISOString(),
        };
        
        await AsyncStorage.setItem('widget_data', JSON.stringify(widgetData));
      } catch (error) {
        console.error('Error saving widget data:', error);
      }
    };

    registerWidgetData();
  }, [isSessionActive, isPIPActive]);

  return <>{children}</>;
};

// Export functions for use in widget configuration
export const WidgetActions = {
  startAI: () => Linking.openURL('heysolana://ai/start'),
  stopAI: () => Linking.openURL('heysolana://ai/stop'),
  showPIP: () => Linking.openURL('heysolana://pip/show'),
  hidePIP: () => Linking.openURL('heysolana://pip/hide'),
  openDashboard: () => Linking.openURL('heysolana://dashboard'),
};

export default WidgetManager; 