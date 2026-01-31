
import { User } from '../types';

/**
 * Mocks the Ronin Waypoint login flow.
 * In production, you would use the @ronin-network/waypoint SDK.
 */
export const roninLogin = async (): Promise<User> => {
  console.log("Initializing Ronin Waypoint Login...");
  
  // Simulate delay
  await new Promise(r => setTimeout(r, 800));
  
  const mockAddress = `0x${Math.random().toString(16).slice(2, 42)}`;
  
  return {
    address: mockAddress,
    isLoggedIn: true,
    isGuest: false
  };
};

export const guestLogin = (): User => {
  return {
    address: `guest_${Math.random().toString(36).slice(2, 10)}`,
    isLoggedIn: true,
    isGuest: true
  };
};

export const logout = (): User => {
  return {
    address: '',
    isLoggedIn: false
  };
};
