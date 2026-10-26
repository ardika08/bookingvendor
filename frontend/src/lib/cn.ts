import clsx, { type ClassValue } from 'clsx'

/** Penggabung className kecil; clsx cukup karena token styling memakai Tailwind murni. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
