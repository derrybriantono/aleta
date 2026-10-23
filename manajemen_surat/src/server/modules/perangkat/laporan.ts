import { type AletaDatabase } from "@/server/db/client";
import { bacaSetelanJejak, PERISTIWA_MASUK, type SetelanJejak } from "@/server/modules/perangkat/jejak";
import { ipPribadi, subnetIp } from "@/server/modules/perangkat/jaringan";
import { ringkasPerangkat } from "@/server/modules/perangkat/batas";
import { daftarSesiAktif, kelompokkanPerPerangkat } from "@/server/modules/perangkat/sesi";

/**
 * Bacaan layar "Riwayat Masuk & Perangkat" dan bagian "Perangkat yang sedang
 * masuk" di halaman Akun (23 Okt 2026). Penjagaan hak ada di rutenya; modul
 * ini tidak memeriksa siapa yang bertanya.
 */

export type BarisJejak = {
  id: string;
  waktu: string;
  peristiwa: string;
  alasan: string;
  jalur: string;
  user_id: string;
  username: string;
  nama: string;
  peran: string;
  identitas_samar: string;
  sesi_ref: string;
  perangkat_id: string;
  ip: string;
  rantai_xff: string;
  agen: string;
  jenis_perangkat: string;
  os: string;
  peramban: string;
  model: string;
  ingat: string;
  nama_komputer: string;
  mac: string;
  mac_sumber: string;
  pelaku_id: string;
  pelaku_nama: string;
  rincian: string;
};

export type SaringanJejak = {
  dari?: string;
  sampai?: string;
  userId?: string;
  peran?: string;
  peristiwa?: string[];
  jalur?: string;
  ip?: string;
  perangkatId?: string;
  hanyaGagal?: boolean;
  halaman?: number;
  perHalaman?: number;
};

const PERISTIWA_GAGAL = ["MASUK_GAGAL", "MASUK_DITOLAK_BATAS_PERANGKAT"];

export async function cariJejak(db: AletaDatabase, s: SaringanJejak) {
  const syarat: string[] = [];
  const nilai: Array<string | number> = [];
  if (s.dari) {
    syarat.push("waktu >= ?");
    nilai.push(new Date(s.dari).toISOString());
  }
  if (s.sampai) {
    syarat.push("waktu <= ?");
    nilai.push(new Date(s.sampai).toISOString());
  }
  if (s.userId) {
    syarat.push("user_id = ?");
    nilai.push(s.userId);
  }
  if (s.peran) {
    syarat.push("peran = ?");
    nilai.push(s.peran);
  }
  const peristiwa = (s.hanyaGagal ? PERISTIWA_GAGAL : s.peristiwa ?? []).filter((p) => (PERISTIWA_MASUK as readonly string[]).includes(p));
  if (peristiwa.length) {
    syarat.push(`peristiwa IN (${peristiwa.map(() => "?").join(", ")})`);
    nilai.push(...peristiwa);
  }
  if (s.jalur) {
    syarat.push("jalur = ?");
    nilai.push(s.jalur);
  }
  if (s.ip) {
    // "192.168.9" atau "192.168.9." = subnet; alamat lengkap = persis.
    const ip = s.ip.trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || ip.includes(":")) {
      syarat.push("ip = ?");
      nilai.push(ip);
    } else {
      syarat.push("ip LIKE ?");
      nilai.push(`${ip.replace(/\.$/, "").replace(/[%_]/g, "")}.%`);
    }
  }
  if (s.perangkatId) {
    syarat.push("perangkat_id = ?");
    nilai.push(s.perangkatId);
  }
  const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";
  const perHalaman = Math.max(1, Math.min(Number(s.perHalaman) || 50, 5000));
  const halaman = Math.max(1, Math.floor(Number(s.halaman) || 1));
  const total = await db.queryOne<{ n: number | string }>(`SELECT COUNT(*) AS n FROM aleta_jejak_masuk ${where}`, nilai);
  const baris = await db.queryAll<BarisJejak>(
    `SELECT * FROM aleta_jejak_masuk ${where} ORDER BY waktu DESC, id DESC LIMIT ${perHalaman} OFFSET ${(halaman - 1) * perHalaman}`,
    nilai
  );
  return { total: Number(total?.n ?? 0), halaman, perHalaman, baris };
}

const KOLOM_CSV: Array<[keyof BarisJejak, string]> = [
  ["waktu", "Waktu (UTC)"],
  ["peristiwa", "Peristiwa"],
  ["alasan", "Alasan"],
  ["jalur", "Jalur"],
  ["username", "Username"],
  ["nama", "Nama"],
  ["peran", "Peran"],
  ["identitas_samar", "Identitas (tersamar)"],
  ["ip", "IP"],
  ["rantai_xff", "Rantai X-Forwarded-For"],
  ["jenis_perangkat", "Jenis"],
  ["os", "OS"],
  ["peramban", "Peramban"],
  ["model", "Model"],
  ["nama_komputer", "Nama komputer"],
  ["mac", "MAC"],
  ["mac_sumber", "Sumber MAC"],
  ["perangkat_id", "ID perangkat"],
  ["sesi_ref", "Rujukan sesi"],
  ["ingat", "Simpan login"],
  ["pelaku_nama", "Pelaku"],
  ["agen", "User-agent"],
];

function selCsv(v: unknown) {
  let t = String(v ?? "");
  // Pencegah formula spreadsheet (=, +, -, @ di awal sel).
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function jejakKeCsv(baris: BarisJejak[]) {
  const kepala = KOLOM_CSV.map(([, judul]) => selCsv(judul)).join(",");
  const isi = baris.map((b) => KOLOM_CSV.map(([k]) => selCsv(b[k])).join(","));
  return `﻿${[kepala, ...isi].join("\r\n")}\r\n`;
}

// ─── Perangkat ───────────────────────────────────────────────────────────────

export type BarisPerangkat = {
  perangkat_id: string;
  user_id: string;
  nama_terbaca: string;
  jenis: string;
  os: string;
  os_rinci: string;
  peramban: string;
  model: string;
  nama_komputer: string;
  akun_windows: string;
  mac: string;
  mac_sumber: string;
  mac_catatan: string;
  label: string;
  ip_terakhir: string;
  pertama_dilihat: string;
  terakhir_dilihat: string;
  username?: string;
  nama?: string;
  role_id?: string;
};

export async function daftarPerangkat(db: AletaDatabase, s: { userId?: string; batas?: number }) {
  const nilai: string[] = [];
  let where = "";
  if (s.userId) {
    where = "WHERE p.user_id = ?";
    nilai.push(s.userId);
  }
  return db.queryAll<BarisPerangkat>(
    `SELECT p.perangkat_id, p.user_id, p.nama_terbaca, p.jenis, p.os, p.os_rinci, p.peramban, p.model, p.nama_komputer,
            p.akun_windows, p.mac, p.mac_sumber, p.mac_catatan, p.label, p.ip_terakhir, p.pertama_dilihat, p.terakhir_dilihat,
            u.username, u.name AS nama, u.role_id
     FROM aleta_perangkat p LEFT JOIN users u ON u.id = p.user_id
     ${where}
     ORDER BY p.terakhir_dilihat DESC
     LIMIT ${Math.max(1, Math.min(Number(s.batas) || 500, 2000))}`,
    nilai
  );
}

// ─── Sesi aktif ──────────────────────────────────────────────────────────────

export async function sesiAktifAkun(db: AletaDatabase, userId: string) {
  const kelompok = kelompokkanPerPerangkat(await daftarSesiAktif(db, userId));
  const ringkas = await ringkasPerangkat(db, userId, kelompok);
  return ringkas.map((r, i) => ({ ...r, sesiRef: kelompok[i].sesi.map((s) => s.sesiRef), jalur: kelompok[i].sesi[0]?.jalur ?? "" }));
}

export async function sesiAktifSemua(db: AletaDatabase, s: { userId?: string }) {
  const akun = s.userId
    ? [{ id: s.userId }]
    : await db.queryAll<{ id: string }>("SELECT DISTINCT user_id AS id FROM sessions", []);
  const hasil = [];
  for (const a of akun) {
    const daftar = await sesiAktifAkun(db, a.id);
    if (!daftar.length) continue;
    const u = await db.queryOne<{ username: string; name: string; role_id: string }>("SELECT username, name, role_id FROM users WHERE id = ?", [a.id]);
    for (const d of daftar) hasil.push({ userId: a.id, username: u?.username ?? "", namaAkun: u?.name ?? "", peran: u?.role_id ?? "", ...d });
  }
  return hasil.sort((a, b) => (a.terakhirAktif < b.terakhirAktif ? 1 : -1));
}

// ─── Peringatan ──────────────────────────────────────────────────────────────

export type Peringatan = { jenis: string; tingkat: "tinggi" | "sedang"; judul: string; rincian: string; waktu: string; userId?: string; ip?: string };

const PERAN_PENTING = ["super-admin", "admin", "ketua", "wakil-ketua"];

/** Jam & hari WITA (UTC+8) dari ISO. */
function waktuWita(iso: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000);
  return { hari: d.getUTCDay(), menit: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function menitDari(jam: string) {
  const [j, m] = jam.split(":").map(Number);
  return j * 60 + m;
}

export function diLuarJamKerja(iso: string, setelan: Pick<SetelanJejak, "jamKerjaMulai" | "jamKerjaSelesai" | "hariKerja">) {
  const w = waktuWita(iso);
  if (!setelan.hariKerja.includes(w.hari)) return true;
  return w.menit < menitDari(setelan.jamKerjaMulai) || w.menit > menitDari(setelan.jamKerjaSelesai);
}

/** Peringatan dari jejak N hari terakhir. Ambang sengaja sederhana dan tertulis di layar. */
export function susunPeringatan(baris: BarisJejak[], setelan: SetelanJejak): Peringatan[] {
  const hasil: Peringatan[] = [];
  const urut = [...baris].sort((a, b) => (a.waktu < b.waktu ? -1 : 1));

  // 1. Banyak gagal dari satu IP / ke satu akun dalam satu jam (>= 5).
  const gagal = urut.filter((b) => b.peristiwa === "MASUK_GAGAL");
  const kelompokGagal = (kunci: (b: BarisJejak) => string, jenis: string, judul: (k: string, n: number) => string) => {
    const peta = new Map<string, BarisJejak[]>();
    for (const b of gagal) {
      const k = kunci(b);
      if (!k) continue;
      const daftar = peta.get(k) ?? [];
      daftar.push(b);
      peta.set(k, daftar);
    }
    for (const [k, daftar] of peta) {
      for (let i = 0; i < daftar.length; i++) {
        const jendela = daftar.filter((x) => {
          const t = new Date(x.waktu).getTime() - new Date(daftar[i].waktu).getTime();
          return t >= 0 && t <= 3600_000;
        });
        if (jendela.length >= 5) {
          hasil.push({
            jenis,
            tingkat: "tinggi",
            judul: judul(k, jendela.length),
            rincian: `${jendela.length} percobaan gagal dalam satu jam sejak ${daftar[i].waktu}.`,
            waktu: jendela[jendela.length - 1].waktu,
            ...(jenis === "gagal-ip" ? { ip: k } : { userId: daftar[i].user_id }),
          });
          break;
        }
      }
    }
  };
  kelompokGagal((b) => b.ip, "gagal-ip", (k) => `Banyak percobaan gagal dari ${k}`);
  kelompokGagal((b) => b.user_id || b.identitas_samar, "gagal-akun", (_k, n) => `${n} percobaan gagal ke satu akun`);

  const masuk = urut.filter((b) => b.peristiwa === "MASUK");
  for (const b of masuk) {
    // 2. Dari luar jaringan kantor.
    if (b.ip && !ipPribadi(b.ip)) {
      hasil.push({ jenis: "luar-kantor", tingkat: "tinggi", judul: `${b.nama || b.username} masuk dari luar jaringan kantor`, rincian: `Alamat ${b.ip}.`, waktu: b.waktu, userId: b.user_id, ip: b.ip });
    }
    // 5. Di luar jam kerja.
    if (diLuarJamKerja(b.waktu, setelan)) {
      hasil.push({ jenis: "luar-jam", tingkat: "sedang", judul: `${b.nama || b.username} masuk di luar jam kerja`, rincian: `Jam kerja ${setelan.jamKerjaMulai}-${setelan.jamKerjaSelesai} WITA.`, waktu: b.waktu, userId: b.user_id, ip: b.ip });
    }
  }

  // 3. Akun yang sama dari dua subnet berbeda dalam 15 menit.
  const perAkun = new Map<string, BarisJejak[]>();
  for (const b of masuk) {
    if (!b.user_id || !b.ip) continue;
    const d = perAkun.get(b.user_id) ?? [];
    d.push(b);
    perAkun.set(b.user_id, d);
  }
  for (const [userId, daftar] of perAkun) {
    for (let i = 1; i < daftar.length; i++) {
      const a = daftar[i - 1];
      const b = daftar[i];
      const selisih = new Date(b.waktu).getTime() - new Date(a.waktu).getTime();
      if (selisih <= 15 * 60_000 && subnetIp(a.ip) !== subnetIp(b.ip)) {
        hasil.push({
          jenis: "dua-tempat",
          tingkat: "tinggi",
          judul: `${b.nama || b.username} masuk dari dua jaringan berbeda dalam ${Math.max(1, Math.round(selisih / 60_000))} menit`,
          rincian: `${a.ip} lalu ${b.ip}.`,
          waktu: b.waktu,
          userId,
        });
      }
    }
  }

  // 4. Perangkat baru untuk pimpinan/admin.
  for (const b of urut.filter((x) => x.peristiwa === "PERANGKAT_BARU" && PERAN_PENTING.includes(x.peran))) {
    hasil.push({ jenis: "perangkat-baru", tingkat: "sedang", judul: `Perangkat baru untuk ${b.nama || b.username}`, rincian: [b.peramban, b.os, b.ip].filter(Boolean).join(" · "), waktu: b.waktu, userId: b.user_id, ip: b.ip });
  }

  return hasil.sort((a, b) => (a.waktu < b.waktu ? 1 : -1));
}

export async function peringatanTerbaru(db: AletaDatabase, hari = 7) {
  const setelan = await bacaSetelanJejak(db);
  const dari = new Date(Date.now() - hari * 86_400_000).toISOString();
  const baris = await db.queryAll<BarisJejak>(
    "SELECT * FROM aleta_jejak_masuk WHERE waktu >= ? AND peristiwa IN ('MASUK', 'MASUK_GAGAL', 'PERANGKAT_BARU') ORDER BY waktu",
    [dari]
  );
  return susunPeringatan(baris, setelan);
}
