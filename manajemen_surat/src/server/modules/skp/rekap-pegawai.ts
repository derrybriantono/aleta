import { LABEL_JABATAN_SKP, type AktorSkp, type JabatanSkp } from "@/lib/skp-jabatan-tipe";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { type AletaDatabase } from "@/server/db/client";
import { getGatewaySkpAkun, type AkunSippSkp } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { bolehLihatSkp } from "@/server/modules/skp/hak";
import { bacaPemetaan } from "@/server/modules/skp/pemetaan";
import { bacaKeadaanPegawai, hakPegawai } from "@/server/modules/skp/pegawai";
import { rentangBertumpang } from "@/server/modules/skp/umum";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * HALAMAN REKAP PETUGAS -> PEGAWAI -> JENIS SKP (tombol "Unduh eviden SKP")
 * ============================================================================
 *
 * Halaman Rekap Petugas dibuka dengan ?peran=&id= (id SIPP panitera_pn, jurusita,
 * atau mediator). Eviden SKP jabatan dibuat per PEGAWAI (pengguna ALETA), jadi
 * orang di halaman itu ditautkan ke pegawainya lewat jalur yang tidak menebak
 * dari nama:
 *
 *   id SIPP -> akun SIPP (user_panitera / user_jurusita / user_hakim+mediator)
 *           -> tautan akun-pegawai bertanggal (Pemetaan) -> pegawai ALETA.
 *
 * Mediator tanpa akun SIPP ditautkan di Pemetaan memakai nama akun
 * "mediator:<id>" (id tabel mediator).
 *
 * Yang tidak ditawarkan (tombol tidak muncul, alasannya disebut):
 *   - tidak ada tautan ke pegawai mana pun;
 *   - pegawainya nonaktif (mutasi/pensiun);
 *   - jabatannya belum dipetakan sebagai jabatan halaman itu;
 *   - aktor tidak berhak (bukan dirinya, atasan langsungnya, pimpinan, Panitera,
 *     Admin, atau Super Admin) - hak yang sama dengan layar SKP.
 */

export const PERAN_REKAP_EVIDEN = ["panitera", "jurusita", "mediator"] as const;
export type PeranRekapEviden = (typeof PERAN_REKAP_EVIDEN)[number];

export function peranRekapEvidenSah(nilai: unknown): nilai is PeranRekapEviden {
  return (PERAN_REKAP_EVIDEN as readonly string[]).includes(String(nilai));
}

/** Jabatan SKP yang dicari untuk halaman rekap sebuah peran (urut prioritas). */
export const JABATAN_REKAP: Readonly<Record<PeranRekapEviden, readonly JabatanSkp[]>> = {
  panitera: ["pp"],
  jurusita: ["jurusita", "jurusita-pengganti"],
  mediator: ["mediator"],
};

export type HasilRekapPegawai =
  | {
      tersedia: true;
      jenis: JabatanSkp;
      labelJenis: string;
      pegawai: { userId: string; nama: string; nip: string | null };
      alasanHak: string;
    }
  | { tersedia: false; alasan: string };

const tidak = (alasan: string): HasilRekapPegawai => ({ tersedia: false, alasan });

/** Akun SIPP milik orang di halaman rekap itu (nama akun dipakai mencocokkan Pemetaan). */
export function akunDariRekap(akun: readonly AkunSippSkp[], peran: PeranRekapEviden, id: number): string[] {
  const cocok = akun.filter((a) => {
    if (peran === "panitera") return a.paniteraId === id;
    if (peran === "jurusita") return a.jurusitaId === id;
    return Array.isArray(a.mediatorIds) && a.mediatorIds.includes(id);
  });
  const nama = cocok.map((a) => a.username);
  // Mediator tanpa akun SIPP: akun tiruan "mediator:<id>".
  if (peran === "mediator") nama.push(`mediator:${id}`);
  return [...new Set(nama)];
}

/**
 * Pegawai di balik halaman rekap itu, dan jenis SKP yang diunduh. `akun`
 * disuntikkan supaya dapat diuji tanpa bot.
 */
export async function pegawaiDariRekap(
  db: AletaDatabase,
  aktor: AktorSkp,
  p: { peran: PeranRekapEviden; id: number },
  akunSipp?: readonly AkunSippSkp[]
): Promise<HasilRekapPegawai> {
  let akun = akunSipp;
  if (!akun) {
    const jawaban = await getGatewaySkpAkun({ semua: true });
    if (!jawaban.ok) {
      // Bot belum terjangkau: tanpa tombol, bukan galat di halaman rekap.
      return tidak("Akun SIPP orang ini belum dapat dibaca dari ALETA Bot; coba lagi beberapa saat lagi.");
    }
    akun = jawaban.data.akun ?? [];
  }
  const namaAkun = akunDariRekap(akun, p.peran, p.id).map((n) => n.toLowerCase());
  if (namaAkun.length === 0) return tidak("Orang ini belum tertaut ke akun SIPP.");

  const hariIni = waktuPengadilan().tanggal;
  const pemetaan = (await bacaPemetaan(db)).filter((t) => namaAkun.includes(t.usernameSipp.toLowerCase()));
  if (pemetaan.length === 0) {
    return tidak("Akun SIPP orang ini belum ditautkan ke pegawai di layar Pemetaan SKP.");
  }
  // Tautan yang berlaku hari ini lebih dahulu; bila tidak ada, yang terbaru.
  const urut = [...pemetaan].sort((a, b) => {
    const aktifA = rentangBertumpang({ dari: a.berlakuDari, sampai: a.berlakuSampai }, { dari: hariIni, sampai: hariIni });
    const aktifB = rentangBertumpang({ dari: b.berlakuDari, sampai: b.berlakuSampai }, { dari: hariIni, sampai: hariIni });
    if (aktifA !== aktifB) return aktifA ? -1 : 1;
    return b.berlakuDari.localeCompare(a.berlakuDari);
  });

  for (const tautan of urut) {
    const pegawai = await bacaKeadaanPegawai(db, tautan.userId, { mulai: hariIni, selesai: hariIni });
    if (!pegawai) continue;
    // Pejabat mutasi/nonaktif tidak ditawarkan.
    if (!pegawai.aktif) return tidak("Pegawai ini sudah tidak aktif (mutasi atau pensiun); eviden SKP tidak ditawarkan.");
    const jenis = JABATAN_REKAP[p.peran].find((j) => pegawai.jenisTersedia.includes(j));
    if (!jenis) {
      return tidak(
        `Pegawai ini belum dipetakan sebagai ${LABEL_JABATAN_SKP[JABATAN_REKAP[p.peran][0]]}; petakan jabatannya di layar Pemetaan SKP.`
      );
    }
    const hak = bolehLihatSkp(aktor, hakPegawai(pegawai));
    if (!hak.boleh) return tidak("Eviden SKP hanya untuk pemiliknya, atasan langsungnya, pimpinan, Panitera, dan administrator.");
    return {
      tersedia: true,
      jenis,
      labelJenis: LABEL_JABATAN_SKP[jenis],
      pegawai: { userId: pegawai.userId, nama: pegawai.nama, nip: pegawai.nip },
      alasanHak: hak.alasan,
    };
  }
  throw new ApiError(404, "Pegawai yang tertaut ke akun SIPP ini tidak ditemukan.");
}
