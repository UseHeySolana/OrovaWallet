import { NativeModules, Platform } from 'react-native';

interface PIPModuleInterface {
  canDrawOverlays(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  startPIP(): Promise<boolean>;
  stopPIP(): Promise<boolean>;
}

const { PIPModule } = NativeModules;

export const NativePIPModule: PIPModuleInterface = {
  canDrawOverlays: () => {
    if (Platform.OS === 'android') {
      return PIPModule?.canDrawOverlays() ?? Promise.resolve(false);
    }
    return Promise.resolve(false);
  },
  
  requestOverlayPermission: () => {
    if (Platform.OS === 'android') {
      return PIPModule?.requestOverlayPermission() ?? Promise.resolve(false);
    }
    return Promise.resolve(false);
  },
  
  startPIP: () => {
    if (Platform.OS === 'android') {
      return PIPModule?.startPIP() ?? Promise.resolve(false);
    }
    return Promise.resolve(false);
  },
  
  stopPIP: () => {
    if (Platform.OS === 'android') {
      return PIPModule?.stopPIP() ?? Promise.resolve(false);
    }
    return Promise.resolve(false);
  },
};

export default NativePIPModule; 