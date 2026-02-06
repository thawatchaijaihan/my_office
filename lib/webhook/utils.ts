import { config } from "@/lib/config";

/**
 * Format date to dd/mm/yyyy HH:mm:ss (Christian Era)
 */
export function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  const HH = pad(date.getHours());
  const MI = pad(date.getMinutes());
  const SS = pad(date.getSeconds());
  return `${dd}/${mm}/${yyyy} ${HH}:${MI}:${SS}`;
}

export function isAdminUserId(userId: string | undefined): boolean {
  if (!userId) return false;
  return config.admin.lineUserIds.includes(userId);
}

export function isMyIdCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === "myid" ||
    t === "my id" ||
    t === "line_user_id" ||
    t === "line userid" ||
    t === "userid" ||
    t === "user id"
  );
}
