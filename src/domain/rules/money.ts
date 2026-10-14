import type { Kobo } from '../entities';

export const naira = (amount: number): Kobo => Math.round(amount * 100);
export const toNaira = (kobo: Kobo): number => kobo / 100;
export const formatNaira = (kobo: Kobo): string => '₦' + Math.round(toNaira(kobo)).toLocaleString('en-NG');
export const parseNairaInput = (text: string): Kobo => naira(Number(text.replace(/\D/g, '')) || 0);
