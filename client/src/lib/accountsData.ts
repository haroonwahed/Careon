// Mock data for Account Launcher

export interface VintedProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string; // Encrypted in real app
  avatar: string; // Letter for avatar
  
  // Connection state
  isConnected: boolean;
  
  // Session state
  isRunning: boolean;
  
  // Proxy settings (optional)
  proxy?: {
    host: string;
    port: string;
    user?: string;
    password?: string;
  };
  
  // VNC settings (optional)
  vncPassword?: string;
  
  // Metadata
  createdAt: Date;
  lastSessionStart?: Date;
}

export const mockProfiles: VintedProfile[] = [
  {
    id: "profile_001",
    name: "Boutique Alice",
    username: "antoine.reselll",
    email: "antoine@vintsy.com",
    password: "••••••••",
    avatar: "A",
    isConnected: true,
    isRunning: true,
    proxy: {
      host: "198.168.1.100",
      port: "44444",
      user: "proxyuser",
      password: "••••••••",
    },
    vncPassword: "••••••••",
    createdAt: new Date("2024-11-15"),
    lastSessionStart: new Date(),
  },
  {
    id: "profile_002",
    name: "Wexzo Store",
    username: "wexzo",
    email: "wexzo@vintsy.com",
    password: "••••••••",
    avatar: "W",
    isConnected: true,
    isRunning: false,
    proxy: {
      host: "203.45.67.89",
      port: "8080",
    },
    createdAt: new Date("2024-10-20"),
    lastSessionStart: new Date("2024-12-27"),
  },
  {
    id: "profile_003",
    name: "Anaïs Vintage",
    username: "anais.lmp",
    email: "anais@vintsy.com",
    password: "••••••••",
    avatar: "A",
    isConnected: false,
    isRunning: false,
    createdAt: new Date("2024-12-01"),
  },
];
