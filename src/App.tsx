import { useEffect } from 'react';
import { sound } from './audio/SoundEngine';
import { useSoundSettings } from './audio/useBattleAudio';
import { useBattleStore } from './store/battleStore';
import { useProfileStore } from './store/profileStore';
import { useUIStore } from './store/uiStore';
import { Toast } from './ui/components/Bits';
import { HelpModal } from './ui/components/HelpModal';
import { SettingsModal } from './ui/components/SettingsModal';
import { BattleScreen } from './ui/screens/BattleScreen';
import { CustomizeScreen } from './ui/screens/CustomizeScreen';
import { LobbyScreen } from './ui/screens/LobbyScreen';
import { PassScreen } from './ui/screens/PassScreen';
import { ShopScreen } from './ui/screens/ShopScreen';

if (import.meta.env.DEV) {
  // 개발용 디버그 핸들 (콘솔에서 상태 조작)
  Object.assign(window, { __sbb: { battle: useBattleStore, profile: useProfileStore, ui: useUIStore } });
}

export function App() {
  const screen = useUIStore((s) => s.screen);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const toast = useUIStore((s) => s.toast);
  useSoundSettings();

  useEffect(() => {
    if (screen !== 'battle') sound.startBgm('lobby');
  }, [screen]);

  return (
    <>
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'customize' && <CustomizeScreen />}
      {screen === 'shop' && <ShopScreen />}
      {screen === 'pass' && <PassScreen />}
      {screen === 'battle' && <BattleScreen />}
      {helpOpen && <HelpModal />}
      {settingsOpen && <SettingsModal />}
      {toast && <Toast key={toast.id} text={toast.text} />}
    </>
  );
}
