import { useState } from 'react';
import { useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { Slider } from './Bits';
import { Button } from './Button';
import { Modal } from './Modal';

export function SettingsModal() {
  const close = () => useUIStore.getState().setSettingsOpen(false);
  const s = useSettingsStore();
  const reset = useProfileStore((p) => p.resetProfile);
  const nickname = useProfileStore((p) => p.nickname);
  const setNickname = useProfileStore((p) => p.setNickname);
  const [draft, setDraft] = useState(nickname);
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal title="⚙️ 설정" onClose={close}>
      <div className="space-y-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setNickname(draft);
            useUIStore.getState().showToast('닉네임을 바꿨어요');
          }}
        >
          <label className="min-w-0 flex-1" htmlFor="nickname">
            <span className="font-display mb-1 block text-lg">닉네임</span>
            <input
              id="nickname"
              value={draft}
              maxLength={12}
              onChange={(e) => setDraft(e.target.value)}
              className="font-display w-full rounded-xl bg-white/12 px-3 py-2 text-lg outline-none focus:ring-2 focus:ring-[#ffd23f]"
            />
          </label>
          <Button variant="gold" className="px-4 py-2 text-base" type="submit">
            저장
          </Button>
        </form>
        <Slider label="전체 볼륨" value={s.masterVolume} onChange={(v) => s.setVolume('masterVolume', v)} left="0" right="100" accent="#4da3ff" />
        <Slider label="배경음악" value={s.bgmVolume} onChange={(v) => s.setVolume('bgmVolume', v)} left="0" right="100" accent="#4da3ff" />
        <Slider label="효과음" value={s.sfxVolume} onChange={(v) => s.setVolume('sfxVolume', v)} left="0" right="100" accent="#4da3ff" />
        <Slider label="화면 흔들림 (카메라 쉐이크)" value={s.cameraShake} onChange={(v) => s.setCameraShake(v)} left="끄기" right="최대" accent="#ffc542" />
        <Button variant={s.muted ? 'primary' : 'ghost'} className="w-full" onClick={s.toggleMute}>
          {s.muted ? '🔇 음소거 중 — 소리 켜기' : '🔊 음소거'}
        </Button>
        <div className="border-t border-white/10 pt-4">
          {confirm ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  reset();
                  setConfirm(false);
                  useUIStore.getState().showToast('프로필을 초기화했어요');
                }}
              >
                정말 초기화
              </Button>
            </div>
          ) : (
            <Button variant="dark" className="w-full text-base" onClick={() => setConfirm(true)}>
              🗑️ 프로필 초기화 (골드·트로피·꾸미기)
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
