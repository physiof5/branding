import { useEffect } from 'react';
import { sound } from './audio/SoundEngine';
import { useSoundSettings } from './audio/useBattleAudio';
import { Turnaround } from './dev/Turnaround';
import { useBattleStore } from './store/battleStore';
import { useProfileStore } from './store/profileStore';
import { useUIStore } from './store/uiStore';
import { Toast } from './ui/components/Bits';
import { BottomNav } from './ui/components/BottomNav';
import { GameModeSheet } from './ui/components/GameModeSheet';
import { HelpModal } from './ui/components/HelpModal';
import { LoadoutSheet } from './ui/components/LoadoutSheet';
import { SettingsModal } from './ui/components/SettingsModal';
import { BattleScreen } from './ui/screens/BattleScreen';
import { CustomizeScreen } from './ui/screens/CustomizeScreen';
import { LobbyScreen } from './ui/screens/LobbyScreen';
import { PassScreen } from './ui/screens/PassScreen';
import { ShopScreen } from './ui/screens/ShopScreen';
import { TrophyRoadScreen } from './ui/screens/TrophyRoadScreen';

if (import.meta.env.DEV) {
  // 개발용 디버그 핸들 (콘솔에서 상태 조작)
  Object.assign(window, { __sbb: { battle: useBattleStore, profile: useProfileStore, ui: useUIStore } });
}

export function App() {
  if (import.meta.env.DEV && location.search.includes('turnaround')) return <Turnaround />;
  return <GameApp />;
}

function GameApp() {
  const screen = useUIStore((s) => s.screen);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const modeSheetOpen = useUIStore((s) => s.modeSheetOpen);
  const loadoutOpen = useUIStore((s) => s.loadoutOpen);
  const toast = useUIStore((s) => s.toast);
  useSoundSettings();

  useEffect(() => {
    if (screen !== 'battle') sound.startBgm('lobby');
  }, [screen]);

  return (
    <>
      {screen === 'battle' ? (
        <BattleScreen />
      ) : (
        <div className="flex h-full flex-col">
          <main className={`min-h-0 flex-1 ${screen === 'lobby' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {screen === 'lobby' && <LobbyScreen />}
            {screen === 'customize' && <CustomizeScreen />}
            {screen === 'shop' && <ShopScreen />}
            {screen === 'pass' && <PassScreen />}
            {screen === 'road' && <TrophyRoadScreen />}
          </main>
          <BottomNav />
        </div>
      )}
      {modeSheetOpen && <GameModeSheet />}
      {loadoutOpen && <LoadoutSheet />}
      {helpOpen && <HelpModal />}
      {settingsOpen && <SettingsModal />}
      {toast && <Toast key={toast.id} text={toast.text} />}
    </>
  );
}
