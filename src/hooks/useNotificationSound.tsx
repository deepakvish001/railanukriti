import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-1
}

interface SoundContextType {
  settings: SoundSettings;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  playSound: (type: 'critical' | 'warning' | 'success' | 'info') => void;
}

const SoundContext = createContext<SoundContextType | null>(null);

const STORAGE_KEY = 'railway-sound-settings';

// Sound generation using Web Audio API
const createOscillator = (
  audioContext: AudioContext,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  delay: number = 0
) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
  
  gainNode.gain.setValueAtTime(0, audioContext.currentTime + delay);
  gainNode.gain.linearRampToValueAtTime(volume * 0.3, audioContext.currentTime + delay + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + delay + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start(audioContext.currentTime + delay);
  oscillator.stop(audioContext.currentTime + delay + duration);
};

const playAlertSound = (type: 'critical' | 'warning' | 'success' | 'info', volume: number) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    switch (type) {
      case 'critical':
        // Urgent alarm - two descending tones repeated
        createOscillator(audioContext, 880, 0.15, volume, 'square', 0);
        createOscillator(audioContext, 660, 0.15, volume, 'square', 0.15);
        createOscillator(audioContext, 880, 0.15, volume, 'square', 0.35);
        createOscillator(audioContext, 660, 0.15, volume, 'square', 0.5);
        break;
        
      case 'warning':
        // Warning beep - two ascending tones
        createOscillator(audioContext, 440, 0.12, volume, 'triangle', 0);
        createOscillator(audioContext, 550, 0.12, volume, 'triangle', 0.15);
        break;
        
      case 'success':
        // Success chime - pleasant ascending
        createOscillator(audioContext, 523, 0.1, volume, 'sine', 0);
        createOscillator(audioContext, 659, 0.1, volume, 'sine', 0.1);
        createOscillator(audioContext, 784, 0.15, volume, 'sine', 0.2);
        break;
        
      case 'info':
        // Simple notification ping
        createOscillator(audioContext, 600, 0.1, volume, 'sine', 0);
        break;
    }
    
    // Clean up after sounds complete
    setTimeout(() => {
      audioContext.close();
    }, 1000);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

export const SoundProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SoundSettings>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return { enabled: true, volume: 0.5 };
        }
      }
    }
    return { enabled: true, volume: 0.5 };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, enabled }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  const playSound = useCallback((type: 'critical' | 'warning' | 'success' | 'info') => {
    if (settings.enabled && settings.volume > 0) {
      playAlertSound(type, settings.volume);
    }
  }, [settings.enabled, settings.volume]);

  return (
    <SoundContext.Provider value={{ settings, setEnabled, setVolume, playSound }}>
      {children}
    </SoundContext.Provider>
  );
};

export const useNotificationSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useNotificationSound must be used within a SoundProvider');
  }
  return context;
};
