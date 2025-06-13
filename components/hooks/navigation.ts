import { useEffect } from 'react';
import { useRootNavigationState, useNavigationContainerRef } from 'expo-router';

export function useRouteTracking(callback:any) {
  const navState = useRootNavigationState();
  const navRef = useNavigationContainerRef();

  useEffect(() => {
    if (!navRef.isReady()) return;
    const route = navRef.getCurrentRoute();
    if (route?.name) {
      callback(route.name, route);
    }
  }, [navState]);
}
