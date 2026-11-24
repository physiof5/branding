import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Appearance } from '../../data/appearance';
import { COSTUMES } from '../../data/costumes';
import { REF_COLORS } from './profiles';

export interface CharacterMaterials {
  skin: THREE.MeshStandardMaterial;
  skinShade: THREE.MeshStandardMaterial;
  /** 턱 그늘 속 목 */
  neck: THREE.MeshStandardMaterial;
  top: THREE.MeshStandardMaterial;
  topAccent: THREE.MeshStandardMaterial;
  bottom: THREE.MeshStandardMaterial;
  stripe: THREE.MeshStandardMaterial;
  shoes: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  brow: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  lipUpper: THREE.MeshStandardMaterial;
  lipLower: THREE.MeshStandardMaterial;
  mouth: THREE.MeshStandardMaterial;
  blush: THREE.MeshStandardMaterial;
  nostril: THREE.MeshStandardMaterial;
  badge: THREE.MeshStandardMaterial;
  badgeInk: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  orange: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  navy: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  gatBrim: THREE.MeshStandardMaterial;
  /** 피격 플래시(emissive)를 일괄 적용하기 위한 목록 */
  all: THREE.MeshStandardMaterial[];
}

const shade = (hex: string, k: number): string => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

/**
 * 표면 처리 (레퍼런스 렌더 기준)
 *  · 피부/옷: 무광(roughness .9+) + flatShading → 큼직한 로우폴리 면이 부드러운 조명에 은은하게 드러남
 *  · 입술: 매끈한 셰이딩 + 약한 광택 (레퍼런스에서 유일하게 반질한 부위)
 *  · 눈: 유광 + 흰 하이라이트
 */
export function useCharacterMaterials(a: Appearance): CharacterMaterials {
  const costume = COSTUMES[a.costumeId];
  const mats = useMemo(() => {
    const matte = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0, ...extra });
    const smooth = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, flatShading: false, roughness: 0.45, metalness: 0, ...extra });
    const metal: THREE.MeshStandardMaterialParameters = costume.metallic ? { metalness: 0.55, roughness: 0.32 } : { roughness: 0.95 };
    const m = {
      skin: matte(a.skin),
      skinShade: matte(shade(a.skin, 0.95)),
      neck: matte(shade(a.skin, 0.6)),
      top: matte(costume.top, metal),
      topAccent: matte(costume.topAccent),
      bottom: matte(costume.bottom, metal),
      stripe: matte(costume.bottomStripe ?? costume.topAccent),
      shoes: matte(costume.shoes, { roughness: 0.8 }),
      hair: matte(a.hairColor, { side: THREE.DoubleSide, roughness: 0.95 }),
      brow: matte(REF_COLORS.brow),
      eye: smooth(REF_COLORS.eye, { roughness: 0.18 }),
      white: smooth('#ffffff', { roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.25 }),
      lipUpper: smooth(REF_COLORS.lipUpper, { roughness: 0.42 }),
      lipLower: smooth(REF_COLORS.lipLower, { roughness: 0.38 }),
      mouth: matte(REF_COLORS.mouth),
      blush: smooth(REF_COLORS.blush, { transparent: true, opacity: 0.78, depthWrite: false, roughness: 0.9 }),
      nostril: matte(REF_COLORS.nostril),
      badge: matte(REF_COLORS.badge, { roughness: 0.6 }),
      badgeInk: matte(REF_COLORS.badgeInk),
      dark: matte('#34333b'),
      red: matte('#d8323a'),
      gold: matte('#e8b93a', { metalness: 0.6, roughness: 0.3 }),
      orange: matte('#f39a2b'),
      leaf: matte('#4d9a43'),
      navy: matte('#2c3e63'),
      glass: smooth('#7fe3ff', { transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 }),
      gatBrim: matte('#16161b', { transparent: true, opacity: 0.86 }),
    };
    return { ...m, all: Object.values(m) } as CharacterMaterials;
  }, [a.skin, a.hairColor, costume]);

  useEffect(() => () => mats.all.forEach((m) => m.dispose()), [mats]);
  return mats;
}
