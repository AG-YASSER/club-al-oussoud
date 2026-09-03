import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clubaloussoud.app',
  appName: 'Club Al Oussoud',
  webDir: 'dist',
  backgroundColor: '#09090b',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#09090b'
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#09090b',
      style: 'DARK'
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#09090b',
      androidSplashResourceName: 'splash',
      showSpinner: false
    }
  }
};

export default config;
