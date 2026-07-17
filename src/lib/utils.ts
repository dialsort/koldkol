import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(phone: string): string {
  if (phone.startsWith("+33") && phone.length === 12) {
    const local = "0" + phone.slice(3);
    return local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return phone;
}

export function formatHour(hour: number): string {
  return `${hour}h00`;
}
