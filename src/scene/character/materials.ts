import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Appearance } from '../../data/appearance';
import { COSTUMES } from '../../data/costumes';

export interface CharacterMaterials {
  skin: THREE.MeshStandardMaterial;
  skinShade: THREE.MeshStandardMaterial;
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
  blush: THREE.MeshStandardMaterial;
  badge: THREE.MeshStandardMaterial;
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

/** 캐릭터 1명분 재질 (피격 플래시가 개별 적용되도록 인스턴스마다 생성) */
export function useCharacterMaterials(a: Appearance): CharacterMaterials {
  const costume = COSTUMES[a.costumeId];
  const mats = useMemo(() => {
    const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.78, metalness: 0, ...extra });
    const metal: THREE.MeshStandardMaterialParameters = costume.metallic ? { metalness: 0.55, roughness: 0.32 } : {};
    const m = {
      skin: std(a.skin),
      skinShade: std(shade(a.skin, 0.93)),
      top: std(costume.top, metal),
      topAccent: std(costume.topAccent),
      bottom: std(costume.bottom, metal),
      stripe: std(costume.bottomStripe ?? costume.topAccent),
      shoes: std(costume.shoes, { roughness: 0.5 }),
      hair: std(a.hairColor, { side: THREE.DoubleSide, roughness: 0.9 }),
      brow: std('#2e2e3c'),
      eye: std('#1b1a24', { roughness: 0.25 }),
      white: std('#ffffff', { roughness: 0.35 }),
      lipUpper: std('#c4554f', { roughness: 0.5 }),
      lipLower: std('#dc625e', { roughness: 0.45 }),
      blush: std('#f2959a', { transparent: true, opacity: 0.72, depthWrite: false }),
      badge: std('#dcd8d6'),
      dark: std('#3a3940'),
      red: std('#d8323a'),
      gold: std('#e8b93a', { metalness: 0.6, roughness: 0.3 }),
      orange: std('#f39a2b'),
      leaf: std('#4d9a43'),
      navy: std('#2c3e63'),
      glass: std('#7fe3ff', { transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 }),
      gatBrim: std('#16161b', { transparent: true, opacity: 0.86 }),
    };
    return { ...m, all: Object.values(m) } as CharacterMaterials;
  }, [a.skin, a.hairColor, costume]);

  useEffect(() => () => mats.all.forEach((m) => m.dispose()), [mats]);
  return mats;
}
