/**
 * Pemeriksaan jadwal notifikasi terhadap jam kirim aman.
 *
 * Beberapa notifikasi bawaan dijadwalkan malam hari (misalnya pukul 19:00),
 * sedangkan Mode Risiko Minimal hanya mengizinkan pengiriman pukul 08:00-16:00.
 * ALETA tidak membuang pesan seperti itu — pesannya dipindahkan ke pembukaan
 * jam kirim berikutnya — tetapi akibatnya notifikasi baru sampai belasan jam
 * kemudian, dan admin tidak pernah diberi tahu.
 *
 * Berkas ini menyediakan pemeriksaannya supaya portal dapat memperingatkan
 * lebih dulu: geser jadwal cron-nya, atau lebarkan jam kirim dengan menaikkan
 * Mode Risiko.
 */

/**
 * Jam-jam saat sebuah jadwal cron akan berjalan.
 *
 * Hanya bagian jam yang dibaca; itu sudah cukup untuk memeriksa tabrakan dengan
 * jam kirim. Mendukung beberapa jadwal yang dipisah titik koma, daftar jam
 * ("0,12"), rentang ("8-10"), langkah ("asterisk/3"), dan jam bebas ("*").
 */
export function listCronHours(cronExpression: string): number[] {
  const hours = new Set<number>();

  for (const expression of String(cronExpression || "").split(";")) {
    const fields = expression.trim().split(/\s+/);
    if (fields.length < 2) continue;
    const hourField = fields[1];

    for (const part of hourField.split(",")) {
      const [rangePart, stepPart] = part.split("/");
      const step = Math.max(1, Number(stepPart || 1) || 1);

      let start: number;
      let end: number;
      if (rangePart === "*") {
        start = 0;
        end = 23;
      } else if (rangePart.includes("-")) {
        const [from, to] = rangePart.split("-").map((value) => Number(value));
        if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
        start = from;
        end = to;
      } else {
        const single = Number(rangePart);
        if (!Number.isFinite(single)) continue;
        start = single;
        end = single;
      }

      for (let hour = start; hour <= end; hour += step) {
        if (hour >= 0 && hour <= 23) hours.add(hour);
      }
    }
  }

  return [...hours].sort((a, b) => a - b);
}

/** Jam jadwal yang jatuh DI LUAR jam kirim aman. */
export function findCronHoursOutsideWindow(
  cronExpression: string,
  windowStart: string,
  windowEnd: string
): number[] {
  const startHour = Number(String(windowStart || "").split(":")[0]);
  const endHour = Number(String(windowEnd || "").split(":")[0]);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return [];

  return listCronHours(cronExpression).filter((hour) =>
    startHour <= endHour
      ? hour < startHour || hour > endHour
      : hour < startHour && hour > endHour
  );
}

export type AletaBotScheduleWarning = {
  notificationId: string;
  notificationName: string;
  cron: string;
  /** Jam jadwal yang berada di luar jam kirim, mis. [19]. */
  outsideHours: number[];
};

type ScheduleCheckInput = {
  id: string;
  name: string;
  isActive: boolean;
  scheduleConfig: { type: string; cron: string };
};

/**
 * Notifikasi AKTIF yang jadwalnya jatuh di luar jam kirim aman.
 *
 * Hanya notifikasi aktif berjadwal cron yang diperiksa: notifikasi manual dan
 * berbasis kejadian tidak punya jam tetap untuk dibandingkan.
 */
export function findNotificationsOutsideSendingWindow(
  notifications: ScheduleCheckInput[],
  windowStart: string,
  windowEnd: string
): AletaBotScheduleWarning[] {
  const warnings: AletaBotScheduleWarning[] = [];

  for (const notification of notifications) {
    if (!notification.isActive) continue;
    if (notification.scheduleConfig?.type !== "cron") continue;
    const cron = String(notification.scheduleConfig?.cron || "").trim();
    if (!cron) continue;

    const outsideHours = findCronHoursOutsideWindow(cron, windowStart, windowEnd);
    if (outsideHours.length === 0) continue;

    warnings.push({
      notificationId: notification.id,
      notificationName: notification.name,
      cron,
      outsideHours,
    });
  }

  return warnings;
}

/** "19:00" atau "19:00, 22:00" untuk ditampilkan ke admin. */
export function formatHoursLabel(hours: number[]): string {
  return hours.map((hour) => `${String(hour).padStart(2, "0")}:00`).join(", ");
}
