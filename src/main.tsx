import { createRoot } from 'react-dom/client';
import { sound } from './audio/SoundEngine';
import { App } from './App';
import './index.css';

// 브라우저 정책상 첫 사용자 입력에서 오디오 컨텍스트를 깨운다
const unlockAudio = () => sound.unlock();
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);

// NOTE: StrictMode 는 쓰지 않는다 — 개발 모드의 effect 이중 실행이 drei <Html> 내부 React root 의
// unmount 와 경쟁해서 3D 말풍선/데미지 숫자가 비어 보이는 문제가 있다 (프로덕션과 동작을 맞춤).
createRoot(document.getElementById('root')!).render(<App />);
