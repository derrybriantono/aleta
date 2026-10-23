/**
 * Sisi peramban "masuk ALETA dengan akun SIPP" (7 Okt 2026).
 *
 * Dua pekerjaan, keduanya tidak pernah melempar:
 *
 *   1. masukLewatSipp - POST /api/auth/sign-in/sipp. Jawaban "bukan-sipp"
 *      (akun tanpa tautan SIPP), peladen lama yang belum mengenal jalurnya
 *      (404), gangguan 5xx, atau jaringan putus = layar melanjutkan jalur
 *      masuk LAMA apa adanya. Fitur lama tidak dikurangi.
 *
 *   2. titip/lupakan password di ekstensi ALETA - lewat jembatan aleta.js
 *      (window.postMessage ke asal halaman ini sendiri). Ekstensi menyimpannya
 *      HANYA di chrome.storage.session; portal tidak menyimpannya di mana pun.
 *      Dititipkan HANYA bila password SIPP-lah yang terbukti cocok.
 */

import { apiPath } from "@/lib/base-path";

/** Penolakan batas perangkat (23 Okt 2026): tiket sekali pakai + perangkat yang sedang masuk. */
export type InfoBatasPerangkat = {
  tiket: string;
  pesan: string;
  perangkat: Array<{ perangkatId: string; nama: string; terakhirAktif: string; ip: string }>;
};

/** Jawaban 403 code BATAS_PERANGKAT (Better Auth / better-fetch menyebar badannya) -> info, atau null. */
export function bacaBatasPerangkat(isi: unknown): InfoBatasPerangkat | null {
  const x = isi as { code?: unknown; tiket?: unknown; message?: unknown; perangkat?: unknown } | null;
  if (!x || x.code !== "BATAS_PERANGKAT" || typeof x.tiket !== "string" || !x.tiket) return null;
  const perangkat = Array.isArray(x.perangkat)
    ? x.perangkat.map((p: Record<string, unknown>) => ({
        perangkatId: String(p?.perangkatId ?? ""),
        nama: String(p?.nama ?? ""),
        terakhirAktif: String(p?.terakhirAktif ?? ""),
        ip: String(p?.ip ?? ""),
      }))
    : [];
  return { tiket: x.tiket, pesan: String(x.message ?? ""), perangkat };
}

export type HasilMasukSipp =
  | { jenis: "masuk"; lewat: "sipp" | "aleta"; usernameSipp: string; catatan: string }
  | { jenis: "bukan-sipp" }
  | { jenis: "tolak"; status: number; pesan: string; batas?: InfoBatasPerangkat | null };

export const KUNCI_ISI_OTOMATIS_SIPP = "aleta:isi-otomatis-sipp";

export async function masukLewatSipp(
  identifier: string,
  password: string,
  rememberMe: boolean,
  ambil: typeof fetch = fetch
): Promise<HasilMasukSipp> {
  let jawaban: Response;
  try {
    jawaban = await ambil(apiPath("/api/auth/sign-in/sipp"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password, rememberMe }),
    });
  } catch {
    return { jenis: "bukan-sipp" };
  }

  // Jawaban Better Auth tidak berbungkus { ok, data }: { ok, jenis, ... } bila
  // berhasil, { message, code } bila ditolak.
  const isi = (await jawaban.json().catch(() => null)) as
    | { jenis?: string; lewat?: string; usernameSipp?: string; catatan?: string; message?: string }
    | null;

  if (jawaban.ok) {
    if (isi?.jenis === "masuk") {
      return {
        jenis: "masuk",
        lewat: isi.lewat === "sipp" ? "sipp" : "aleta",
        usernameSipp: String(isi.usernameSipp ?? ""),
        catatan: String(isi.catatan ?? ""),
      };
    }
    return { jenis: "bukan-sipp" };
  }

  // Hanya penolakan yang memang diputuskan jalur SIPP yang menghentikan masuk.
  // Selebihnya - 404 server lama, 5xx, bentuk jawaban yang tidak dikenal -
  // menempuh jalur lama, supaya jalur baru tidak pernah menutup jalur lama.
  if (![400, 401, 403, 429].includes(jawaban.status)) return { jenis: "bukan-sipp" };

  return {
    jenis: "tolak",
    status: jawaban.status,
    pesan: String(isi?.message || "Login belum berhasil. Silakan coba lagi."),
    batas: bacaBatasPerangkat(isi),
  };
}

// ---------------------------------------------------------------------------
// Ekstensi ALETA
// ---------------------------------------------------------------------------

type JawabanEkstensi = { ok: boolean; sebab?: string };

/** aleta.js menandai <html data-aleta-masuk-sipp="1"> bila jembatannya mengenal pesan masuk. */
export function ekstensiMengenalMasukSipp(dokumen: Document | undefined = globalThis.document) {
  return dokumen?.documentElement?.dataset?.aletaMasukSipp === "1";
}

let nomorPesan = 0;

function kirimKeEkstensi(jenis: "masuk-titip" | "masuk-lupakan", muatan: Record<string, unknown>, batasMs: number) {
  return new Promise<JawabanEkstensi>((selesai) => {
    if (typeof window === "undefined") {
      selesai({ ok: false, sebab: "bukan peramban" });
      return;
    }
    nomorPesan += 1;
    const idPesan = `ms-${Date.now().toString(36)}-${nomorPesan}`;
    let jam = 0;
    const dengar = (peristiwa: MessageEvent) => {
      if (peristiwa.source !== window || peristiwa.origin !== window.location.origin) return;
      const data = peristiwa.data as { sumber?: unknown; balasan?: unknown; jawaban?: unknown } | null;
      if (!data || typeof data !== "object" || data.sumber !== "aleta-ekstensi" || data.balasan !== idPesan) return;
      window.removeEventListener("message", dengar);
      window.clearTimeout(jam);
      const j = data.jawaban as JawabanEkstensi | null;
      selesai(j && typeof j === "object" ? { ok: j.ok === true, sebab: j.sebab } : { ok: false });
    };
    window.addEventListener("message", dengar);
    jam = window.setTimeout(() => {
      window.removeEventListener("message", dengar);
      selesai({ ok: false, sebab: "ekstensi tidak menjawab" });
    }, batasMs);
    window.postMessage({ sumber: "aleta-portal", jenis, idPesan, muatan }, window.location.origin);
  });
}

/**
 * Menitipkan username + password SIPP ke ekstensi untuk isi otomatis halaman
 * masuk SIPP dan ABT. Tanpa ekstensi (atau ekstensi lama) = tidak terjadi apa
 * pun. Jawabannya tidak pernah memuat password.
 */
export async function titipSandiKeEkstensi(usernameSipp: string, sandi: string, batasMs = 1500) {
  if (!usernameSipp || !sandi || !ekstensiMengenalMasukSipp()) return { ok: false, sebab: "ekstensi tidak siap" };
  return kirimKeEkstensi("masuk-titip", { username: usernameSipp, sandi }, batasMs);
}

/** Dipanggil saat keluar ALETA - titipan di ekstensi dihapus. */
export async function lupakanSandiDiEkstensi(batasMs = 1000) {
  if (!ekstensiMengenalMasukSipp()) return { ok: false, sebab: "ekstensi tidak siap" };
  return kirimKeEkstensi("masuk-lupakan", {}, batasMs);
}

/** Pilihan petugas di layar masuk; bawaannya menyala. */
export function bacaPilihanIsiOtomatis(): boolean {
  try {
    return globalThis.localStorage?.getItem(KUNCI_ISI_OTOMATIS_SIPP) !== "0";
  } catch {
    return true;
  }
}

export function simpanPilihanIsiOtomatis(nyala: boolean) {
  try {
    globalThis.localStorage?.setItem(KUNCI_ISI_OTOMATIS_SIPP, nyala ? "1" : "0");
  } catch {
    // Penyimpanan peramban tidak tersedia; pilihan berlaku untuk sesi ini saja.
  }
}
