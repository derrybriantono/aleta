import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { decryptCredentialSecret, encryptCredentialSecret } from "@/server/shared/security";
import { bacaJson, jalurSinkron, tulisJson } from "@/server/modules/sinkron/penyimpanan";

/**
 * Pengaturan "Sinkron & cadangan" (butir 29 dan 30, 30 September 2026).
 *
 * ============================================================================
 * RAHASIA TIDAK PERNAH KELUAR
 * ============================================================================
 *
 * Empat rahasia hidup di sini: kata sandi arsip, client secret OAuth, refresh
 * token Google, dan kunci JSON akun layanan. Keempatnya disimpan tersandi
 * (encryptCredentialSecret - AES-256-GCM dengan kunci dari env server), dan
 * TIDAK ADA satu jalur pun yang memulangkannya ke layar: untukLayar() hanya
 * menyebut ADA atau TIDAK. Token laptop disimpan sebagai sidik SHA-256 saja;
 * nilainya diperlihatkan SEKALI, saat dibuat.
 */

export type ModeJadwal = "manual" | "harian" | "mingguan";

export type Jadwal = {
  mode: ModeJadwal;
  /** "HH:MM" waktu pengadilan (WITA). */
  jam: string;
  /** 0 = Minggu ... 6 = Sabtu - hanya untuk mingguan. */
  hari: number;
};

export type KunciBasisData = "aleta" | "sipp" | "abt" | "antrian" | "aleta_bot";

export const SEBUTAN_BASIS_DATA: Record<KunciBasisData, string> = {
  aleta: "ALETA (PostgreSQL portal)",
  sipp: "SIPP (MySQL server)",
  abt: "ABT (aps_badilag)",
  antrian: "Antrian sidang",
  aleta_bot: "ALETA Bot (MySQL)",
};

export type TokenLaptop = {
  id: string;
  label: string;
  /** SHA-256 heksadesimal dari tokennya - bukan tokennya. */
  sidik: string;
  /** Empat aksara pertama, supaya admin dapat mengenali token mana yang dipakai laptop mana. */
  awalan: string;
  dibuatPada: string;
  dibuatOleh: string;
  terakhirDipakai: string;
  dicabutPada: string;
};

export type PengaturanSinkron = {
  versi: 1;
  cadangan: {
    aktif: boolean;
    jadwal: Jadwal;
    basisData: Record<KunciBasisData, boolean>;
    /** Berapa salinan terakhir yang disimpan di server. */
    simpanDiServer: number;
  };
  enkripsi: {
    sandiTersandi: string;
    petunjuk: string;
    diubahPada: string;
  };
  laptop: {
    aktif: boolean;
    token: TokenLaptop[];
  };
  drive: {
    aktif: boolean;
    metode: "oauth-perangkat" | "akun-layanan";
    oauth: {
      clientId: string;
      clientSecretTersandi: string;
      refreshTokenTersandi: string;
      akun: string;
      perangkat: {
        deviceCodeTersandi: string;
        userCode: string;
        alamatVerifikasi: string;
        kedaluwarsa: string;
        jedaDetik: number;
      } | null;
    };
    akunLayanan: {
      jsonTersandi: string;
      email: string;
    };
    /** Folder induk yang diisi admin; kosong = ALETA membuat "ALETA Sinkron" di My Drive akun itu. */
    folderIndukId: string;
    /** Folder yang dibuat ALETA sendiri (metode OAuth) - disimpan supaya tidak dibuat dua kali. */
    folderDibuatId: string;
    cadangan: {
      aktif: boolean;
      simpan: number;
    };
    berkasPerkara: {
      aktif: boolean;
      jadwal: Jadwal;
      tahunMulai: number;
      sertakanArsipFisik: boolean;
      perkaraPerJalan: number;
      ulangiSetelahHari: number;
      jedaMs: number;
      batasMbPerJalan: number;
    };
  };
  diubahPada: string;
  diubahOleh: string;
};

export function pengaturanBawaan(): PengaturanSinkron {
  return {
    versi: 1,
    cadangan: {
      aktif: false,
      jadwal: { mode: "harian", jam: "02:00", hari: 0 },
      basisData: { aleta: true, sipp: true, abt: true, antrian: true, aleta_bot: false },
      simpanDiServer: 7,
    },
    enkripsi: { sandiTersandi: "", petunjuk: "", diubahPada: "" },
    laptop: { aktif: false, token: [] },
    drive: {
      aktif: false,
      metode: "oauth-perangkat",
      oauth: {
        clientId: "",
        clientSecretTersandi: "",
        refreshTokenTersandi: "",
        akun: "",
        perangkat: null,
      },
      akunLayanan: { jsonTersandi: "", email: "" },
      folderIndukId: "",
      folderDibuatId: "",
      cadangan: { aktif: true, simpan: 14 },
      berkasPerkara: {
        aktif: false,
        jadwal: { mode: "harian", jam: "22:00", hari: 0 },
        tahunMulai: new Date().getFullYear(),
        sertakanArsipFisik: false,
        perkaraPerJalan: 200,
        ulangiSetelahHari: 7,
        jedaMs: 300,
        batasMbPerJalan: 2048,
      },
    },
    diubahPada: "",
    diubahOleh: "",
  };
}

// ─── Penormal ────────────────────────────────────────────────────────────────

const angka = (nilai: unknown, bawaan: number, min: number, maks: number) => {
  const n = Math.round(Number(nilai));
  if (!Number.isFinite(n)) return bawaan;
  return Math.min(maks, Math.max(min, n));
};

const teks = (nilai: unknown, maks = 500) => String(nilai ?? "").trim().slice(0, maks);

export function normalkanJadwal(nilai: unknown, bawaan: Jadwal): Jadwal {
  const j = (nilai && typeof nilai === "object" ? nilai : {}) as Partial<Jadwal>;
  const mode: ModeJadwal = j.mode === "manual" || j.mode === "harian" || j.mode === "mingguan" ? j.mode : bawaan.mode;
  const jam = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(j.jam ?? "")) ? String(j.jam) : bawaan.jam;
  return { mode, jam, hari: angka(j.hari, bawaan.hari, 0, 6) };
}

/** Menggabungkan berkas tersimpan (mungkin versi lama/terpotong) dengan bawaan. */
export function normalkanPengaturan(mentah: unknown): PengaturanSinkron {
  const b = pengaturanBawaan();
  const m = (mentah && typeof mentah === "object" ? mentah : {}) as Partial<PengaturanSinkron>;
  const c = (m.cadangan ?? {}) as Partial<PengaturanSinkron["cadangan"]>;
  const e = (m.enkripsi ?? {}) as Partial<PengaturanSinkron["enkripsi"]>;
  const l = (m.laptop ?? {}) as Partial<PengaturanSinkron["laptop"]>;
  const d = (m.drive ?? {}) as Partial<PengaturanSinkron["drive"]>;
  const o = (d.oauth ?? {}) as Partial<PengaturanSinkron["drive"]["oauth"]>;
  const s = (d.akunLayanan ?? {}) as Partial<PengaturanSinkron["drive"]["akunLayanan"]>;
  const dc = (d.cadangan ?? {}) as Partial<PengaturanSinkron["drive"]["cadangan"]>;
  const bp = (d.berkasPerkara ?? {}) as Partial<PengaturanSinkron["drive"]["berkasPerkara"]>;
  const basis = (c.basisData ?? {}) as Partial<Record<KunciBasisData, unknown>>;
  const tahunIni = new Date().getFullYear();

  return {
    versi: 1,
    cadangan: {
      aktif: c.aktif === true,
      jadwal: normalkanJadwal(c.jadwal, b.cadangan.jadwal),
      basisData: {
        aleta: basis.aleta === undefined ? b.cadangan.basisData.aleta : basis.aleta === true,
        sipp: basis.sipp === undefined ? b.cadangan.basisData.sipp : basis.sipp === true,
        abt: basis.abt === undefined ? b.cadangan.basisData.abt : basis.abt === true,
        antrian: basis.antrian === undefined ? b.cadangan.basisData.antrian : basis.antrian === true,
        aleta_bot: basis.aleta_bot === undefined ? b.cadangan.basisData.aleta_bot : basis.aleta_bot === true,
      },
      simpanDiServer: angka(c.simpanDiServer, b.cadangan.simpanDiServer, 1, 60),
    },
    enkripsi: {
      sandiTersandi: teks(e.sandiTersandi, 4000),
      petunjuk: teks(e.petunjuk, 80),
      diubahPada: teks(e.diubahPada, 40),
    },
    laptop: {
      aktif: l.aktif === true,
      token: (Array.isArray(l.token) ? l.token : [])
        .filter((t) => t && typeof t === "object" && /^[0-9a-f]{64}$/.test(String(t.sidik)))
        .slice(0, 20)
        .map((t) => ({
          id: teks(t.id, 40),
          label: teks(t.label, 80),
          sidik: String(t.sidik),
          awalan: teks(t.awalan, 8),
          dibuatPada: teks(t.dibuatPada, 40),
          dibuatOleh: teks(t.dibuatOleh, 80),
          terakhirDipakai: teks(t.terakhirDipakai, 40),
          dicabutPada: teks(t.dicabutPada, 40),
        })),
    },
    drive: {
      aktif: d.aktif === true,
      metode: d.metode === "akun-layanan" ? "akun-layanan" : "oauth-perangkat",
      oauth: {
        clientId: teks(o.clientId, 300),
        clientSecretTersandi: teks(o.clientSecretTersandi, 4000),
        refreshTokenTersandi: teks(o.refreshTokenTersandi, 4000),
        akun: teks(o.akun, 200),
        perangkat:
          o.perangkat && typeof o.perangkat === "object"
            ? {
                deviceCodeTersandi: teks(o.perangkat.deviceCodeTersandi, 4000),
                userCode: teks(o.perangkat.userCode, 40),
                alamatVerifikasi: teks(o.perangkat.alamatVerifikasi, 200),
                kedaluwarsa: teks(o.perangkat.kedaluwarsa, 40),
                jedaDetik: angka(o.perangkat.jedaDetik, 5, 1, 60),
              }
            : null,
      },
      akunLayanan: { jsonTersandi: teks(s.jsonTersandi, 20000), email: teks(s.email, 200) },
      folderIndukId: bersihkanIdFolder(d.folderIndukId),
      folderDibuatId: bersihkanIdFolder(d.folderDibuatId),
      cadangan: { aktif: dc.aktif === undefined ? true : dc.aktif === true, simpan: angka(dc.simpan, 14, 1, 120) },
      berkasPerkara: {
        aktif: bp.aktif === true,
        jadwal: normalkanJadwal(bp.jadwal, b.drive.berkasPerkara.jadwal),
        tahunMulai: angka(bp.tahunMulai, tahunIni, 2000, tahunIni),
        sertakanArsipFisik: bp.sertakanArsipFisik === true,
        perkaraPerJalan: angka(bp.perkaraPerJalan, 200, 1, 5000),
        ulangiSetelahHari: angka(bp.ulangiSetelahHari, 7, 0, 365),
        jedaMs: angka(bp.jedaMs, 300, 0, 10_000),
        batasMbPerJalan: angka(bp.batasMbPerJalan, 2048, 10, 500_000),
      },
    },
    diubahPada: teks(m.diubahPada, 40),
    diubahOleh: teks(m.diubahOleh, 80),
  };
}

/** ID folder Drive - atau tautan folder yang ditempel utuh dari peramban. */
export function bersihkanIdFolder(nilai: unknown) {
  const mentah = String(nilai ?? "").trim();
  const dariTautan = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(mentah);
  const id = dariTautan ? dariTautan[1] : mentah;
  return /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : "";
}

// ─── Baca / tulis ────────────────────────────────────────────────────────────

export async function bacaPengaturan(): Promise<PengaturanSinkron> {
  return normalkanPengaturan(await bacaJson<unknown>(jalurSinkron.pengaturan(), null));
}

export async function tulisPengaturan(p: PengaturanSinkron) {
  await tulisJson(jalurSinkron.pengaturan(), p);
}

// ─── Rahasia ─────────────────────────────────────────────────────────────────

export function sandiArsip(p: PengaturanSinkron) {
  return decryptCredentialSecret(p.enkripsi.sandiTersandi);
}

export function rahasiaDrive(p: PengaturanSinkron) {
  return {
    clientSecret: decryptCredentialSecret(p.drive.oauth.clientSecretTersandi),
    refreshToken: decryptCredentialSecret(p.drive.oauth.refreshTokenTersandi),
    akunLayananJson: decryptCredentialSecret(p.drive.akunLayanan.jsonTersandi),
    deviceCode: p.drive.oauth.perangkat ? decryptCredentialSecret(p.drive.oauth.perangkat.deviceCodeTersandi) : "",
  };
}

/** Bentuk yang boleh dilihat layar - rahasia hanya disebut ada/tidak. */
export function untukLayar(p: PengaturanSinkron) {
  return {
    cadangan: p.cadangan,
    enkripsi: {
      sandiAda: Boolean(p.enkripsi.sandiTersandi),
      sandiTerbaca: Boolean(p.enkripsi.sandiTersandi) && Boolean(sandiArsip(p)),
      petunjuk: p.enkripsi.petunjuk,
      diubahPada: p.enkripsi.diubahPada,
    },
    laptop: {
      aktif: p.laptop.aktif,
      token: p.laptop.token.map((t) => ({
        id: t.id,
        label: t.label,
        awalan: t.awalan,
        dibuatPada: t.dibuatPada,
        dibuatOleh: t.dibuatOleh,
        terakhirDipakai: t.terakhirDipakai,
        dicabutPada: t.dicabutPada,
      })),
    },
    drive: {
      aktif: p.drive.aktif,
      metode: p.drive.metode,
      oauth: {
        clientId: p.drive.oauth.clientId,
        clientSecretAda: Boolean(p.drive.oauth.clientSecretTersandi),
        tersambung: Boolean(p.drive.oauth.refreshTokenTersandi),
        akun: p.drive.oauth.akun,
        menungguPersetujuan: p.drive.oauth.perangkat
          ? {
              userCode: p.drive.oauth.perangkat.userCode,
              alamatVerifikasi: p.drive.oauth.perangkat.alamatVerifikasi,
              kedaluwarsa: p.drive.oauth.perangkat.kedaluwarsa,
            }
          : null,
      },
      akunLayanan: { ada: Boolean(p.drive.akunLayanan.jsonTersandi), email: p.drive.akunLayanan.email },
      folderIndukId: p.drive.folderIndukId,
      folderDibuatId: p.drive.folderDibuatId,
      cadangan: p.drive.cadangan,
      berkasPerkara: p.drive.berkasPerkara,
    },
    diubahPada: p.diubahPada,
    diubahOleh: p.diubahOleh,
  };
}

export type PengaturanLayar = ReturnType<typeof untukLayar>;

/**
 * Menerapkan isian layar. Rahasia hanya berubah lewat ruas "baru" yang
 * disengaja (sandiBaru, clientSecretBaru, akunLayananJsonBaru) atau
 * penghapusan eksplisit - mengirim ulang bentuk layar tidak pernah
 * menghapus rahasia yang tersimpan.
 */
export function terapkanIsian(
  lama: PengaturanSinkron,
  isian: Record<string, unknown>,
  oleh: string,
  kini = new Date()
): { pengaturan: PengaturanSinkron; catatan: string[] } {
  const catatan: string[] = [];
  const g = (isian ?? {}) as Record<string, any>;
  const baru = normalkanPengaturan({
    ...lama,
    cadangan: g.cadangan ? { ...lama.cadangan, ...g.cadangan, basisData: { ...lama.cadangan.basisData, ...(g.cadangan.basisData ?? {}) } } : lama.cadangan,
    laptop: { ...lama.laptop, aktif: g.laptop?.aktif === undefined ? lama.laptop.aktif : g.laptop.aktif === true },
    drive: g.drive
      ? {
          ...lama.drive,
          aktif: g.drive.aktif === undefined ? lama.drive.aktif : g.drive.aktif === true,
          metode: g.drive.metode ?? lama.drive.metode,
          oauth: {
            ...lama.drive.oauth,
            clientId: g.drive.oauth?.clientId === undefined ? lama.drive.oauth.clientId : g.drive.oauth.clientId,
          },
          folderIndukId: g.drive.folderIndukId === undefined ? lama.drive.folderIndukId : g.drive.folderIndukId,
          cadangan: { ...lama.drive.cadangan, ...(g.drive.cadangan ?? {}) },
          berkasPerkara: {
            ...lama.drive.berkasPerkara,
            ...(g.drive.berkasPerkara ?? {}),
            jadwal: g.drive.berkasPerkara?.jadwal ?? lama.drive.berkasPerkara.jadwal,
          },
        }
      : lama.drive,
  });

  // Kata sandi arsip.
  if (g.hapusSandi === true) {
    baru.enkripsi = { sandiTersandi: "", petunjuk: "", diubahPada: kini.toISOString() };
    catatan.push("Kata sandi arsip dihapus: arsip berikutnya TIDAK tersandi dan tidak akan diunggah ke Drive.");
  } else if (typeof g.sandiBaru === "string" && g.sandiBaru.length > 0) {
    if (g.sandiBaru.length < 12) throw new Error("Kata sandi arsip minimal 12 aksara.");
    if (g.sandiBaru.length > 200) throw new Error("Kata sandi arsip terlalu panjang (maksimal 200 aksara).");
    baru.enkripsi = {
      sandiTersandi: encryptCredentialSecret(g.sandiBaru),
      petunjuk: teks(g.petunjukSandi, 80),
      diubahPada: kini.toISOString(),
    };
    catatan.push("Kata sandi arsip diganti. Arsip lama tetap memakai sandi lamanya - simpan keduanya.");
  } else if (g.petunjukSandi !== undefined && baru.enkripsi.sandiTersandi) {
    baru.enkripsi.petunjuk = teks(g.petunjukSandi, 80);
  }

  // Client secret OAuth.
  if (g.hapusClientSecret === true) baru.drive.oauth.clientSecretTersandi = "";
  else if (typeof g.clientSecretBaru === "string" && g.clientSecretBaru.trim()) {
    baru.drive.oauth.clientSecretTersandi = encryptCredentialSecret(g.clientSecretBaru.trim());
  }

  // Kunci JSON akun layanan.
  if (g.hapusAkunLayanan === true) {
    baru.drive.akunLayanan = { jsonTersandi: "", email: "" };
  } else if (typeof g.akunLayananJsonBaru === "string" && g.akunLayananJsonBaru.trim()) {
    let kunci: { client_email?: unknown; private_key?: unknown; type?: unknown };
    try {
      kunci = JSON.parse(g.akunLayananJsonBaru);
    } catch {
      throw new Error("Berkas kunci akun layanan bukan JSON yang sah.");
    }
    if (kunci.type !== "service_account" || typeof kunci.client_email !== "string" || typeof kunci.private_key !== "string") {
      throw new Error("Berkas JSON bukan kunci akun layanan Google (type service_account, client_email, private_key).");
    }
    baru.drive.akunLayanan = {
      // Hanya dua ruas yang diperlukan yang disimpan - bukan seluruh berkasnya.
      jsonTersandi: encryptCredentialSecret(
        JSON.stringify({ client_email: kunci.client_email, private_key: kunci.private_key })
      ),
      email: kunci.client_email,
    };
  }

  // Mengganti client id membatalkan sambungan lama: refresh token milik client lama.
  if (baru.drive.oauth.clientId !== lama.drive.oauth.clientId) {
    baru.drive.oauth.refreshTokenTersandi = "";
    baru.drive.oauth.akun = "";
    baru.drive.oauth.perangkat = null;
    if (lama.drive.oauth.refreshTokenTersandi) catatan.push("Client ID berganti: sambungan Google Drive harus disetujui ulang.");
  }

  baru.diubahPada = kini.toISOString();
  baru.diubahOleh = oleh;
  return { pengaturan: baru, catatan };
}

// ─── Token laptop ────────────────────────────────────────────────────────────

export function sidikToken(token: string) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function buatTokenLaptop(p: PengaturanSinkron, label: string, oleh: string, kini = new Date()) {
  const aktif = p.laptop.token.filter((t) => !t.dicabutPada);
  if (aktif.length >= 10) throw new Error("Paling banyak 10 token laptop aktif. Cabut yang tidak dipakai lebih dulu.");
  const token = `aletasnk_${randomBytes(32).toString("base64url")}`;
  const catatanToken: TokenLaptop = {
    id: `tkn-${randomBytes(6).toString("hex")}`,
    label: teks(label, 80) || "Laptop",
    sidik: sidikToken(token),
    awalan: token.slice(9, 13),
    dibuatPada: kini.toISOString(),
    dibuatOleh: oleh,
    terakhirDipakai: "",
    dicabutPada: "",
  };
  // Yang sudah dicabut hanya disimpan sembilan terakhir - cukup untuk jejak, tidak menumpuk.
  const lama = p.laptop.token.filter((t) => !t.dicabutPada).concat(p.laptop.token.filter((t) => t.dicabutPada).slice(-9));
  return { token, pengaturan: { ...p, laptop: { ...p.laptop, token: [...lama, catatanToken] } } };
}

export function cabutTokenLaptop(p: PengaturanSinkron, id: string, kini = new Date()) {
  let ada = false;
  const token = p.laptop.token.map((t) => {
    if (t.id !== id || t.dicabutPada) return t;
    ada = true;
    return { ...t, dicabutPada: kini.toISOString() };
  });
  if (!ada) throw new Error("Token tidak ditemukan atau sudah dicabut.");
  return { ...p, laptop: { ...p.laptop, token } };
}

/** Token laptop yang cocok dan belum dicabut, atau null. Perbandingan waktu-tetap. */
export function cocokkanTokenLaptop(p: PengaturanSinkron, token: string): TokenLaptop | null {
  if (!p.laptop.aktif || !token || !token.startsWith("aletasnk_")) return null;
  const sidik = Buffer.from(sidikToken(token), "hex");
  for (const t of p.laptop.token) {
    if (t.dicabutPada) continue;
    const tersimpan = Buffer.from(t.sidik, "hex");
    if (tersimpan.length === sidik.length && timingSafeEqual(tersimpan, sidik)) return t;
  }
  return null;
}
