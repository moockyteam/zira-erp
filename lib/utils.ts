// Fichier : lib/utils.ts

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- NOUVELLE FONCTION SIMPLE ---
export function getPeriodDates(period: string) {
  const now = new Date();
  // Pour les tests, on peut forcer la date à être en 2025
  // const now = new Date('2025-12-07T10:00:00');
  
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Janvier, 11 = Décembre

  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case 'last_month':
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
      break;
    case 'this_year':
      startDate = new Date(year, 0, 1); // 1er Janvier de l'année en cours
      endDate = new Date(year, 11, 31); // 31 Décembre de l'année en cours
      break;
    case 'last_year':
      startDate = new Date(year - 1, 0, 1);
      endDate = new Date(year - 1, 11, 31);
      break;
    case 'this_month':
    default:
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0);
      break;
  }
  
  // Fonction pour formater en YYYY-MM-DD
  const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];

  return {
    startDate: toYYYYMMDD(startDate),
    endDate: toYYYYMMDD(endDate)
  };
}