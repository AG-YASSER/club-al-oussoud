export interface GymThemeConfig {
  brand: {
    name: string;
    tagline: string;
    shortName: string;
    logoType: 'lion' | 'dumbbell' | 'custom';
    customLogoUrl?: string;
    currency: string;
    currencySymbol: string;
  };
  colors: {
    primary: string;         // Vibrant Orange (#f97316)
    primaryHover: string;    // #ea580c
    primaryLight: string;    // rgba(249, 115, 22, 0.15)
    primaryForeground: string;
    background: string;
    surface: string;
    surfaceLight: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    status: {
      active: string;
      expiring: string;
      expired: string;
      unpaid: string;
    };
  };
  contact: {
    phone?: string;
    address?: string;
    city?: string;
  };
}

export const defaultTheme: GymThemeConfig = {
  brand: {
    name: 'Club Al Oussoud',
    tagline: 'Lions Gym & Fitness Club',
    shortName: 'Al Oussoud',
    logoType: 'lion',
    currency: 'MAD',
    currencySymbol: 'DH',
  },
  colors: {
    primary: '#f97316',         // Vibrant Orange
    primaryHover: '#ea580c',    // Deep Orange
    primaryLight: 'rgba(249, 115, 22, 0.15)',
    primaryForeground: '#ffffff',
    background: '#09090b',      // Deep zinc/black
    surface: '#121216',         // Card surface
    surfaceLight: '#18181f',    // Secondary surface
    border: '#27272a',          // Border zinc-800
    textPrimary: '#f4f4f5',
    textSecondary: '#a1a1aa',
    status: {
      active: '#22c55e',        // Green
      expiring: '#f97316',      // Vibrant Orange
      expired: '#ef4444',       // Red
      unpaid: '#ef4444',        // Red badge for non payé / dettes
    }
  },
  contact: {
    phone: '+212 6 12 34 56 78',
    city: 'Casablanca, Morocco'
  }
};
