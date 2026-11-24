import type { ButtonHTMLAttributes } from 'react';
import { sound } from '../../audio/SoundEngine';

export type ButtonVariant = 'primary' | 'blue' | 'gold' | 'green' | 'ghost' | 'dark';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-[#ff6f91] text-white shadow-[0_5px_0_#b8395c]',
  blue: 'bg-[#4da3ff] text-white shadow-[0_5px_0_#2563b8]',
  gold: 'bg-[#ffc542] text-[#3b2600] shadow-[0_5px_0_#c48a00]',
  green: 'bg-[#3ccf8e] text-[#06301c] shadow-[0_5px_0_#1f8a5a]',
  ghost: 'bg-white/12 text-white shadow-[0_5px_0_rgba(0,0,0,0.35)] backdrop-blur',
  dark: 'bg-[#2a2350] text-white shadow-[0_5px_0_#120e26]',
};

export function Button({
  variant = 'primary',
  className = '',
  silent = false,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; silent?: boolean }) {
  return (
    <button
      {...rest}
      onClick={(e) => {
        if (!silent) sound.play('ui');
        onClick?.(e);
      }}
      className={`font-display rounded-2xl px-5 py-3 text-lg leading-tight transition-transform active:translate-y-[3px] active:shadow-none disabled:opacity-40 disabled:active:translate-y-0 ${VARIANTS[variant]} ${className}`}
    />
  );
}
