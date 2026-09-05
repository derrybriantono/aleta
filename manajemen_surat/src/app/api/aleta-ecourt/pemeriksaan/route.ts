import { type NextRequest } from "next/server";

import { susunPeta, periksaDaluwarsa } from "@/lib/peta-dalil";
import { periksaPanggilan, periksaVerstek } from "@/lib/tenggang-panggilan";
import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  catatSidik,
  daftarAturan,
  matikanAturan,
  periksa,
  perkaraSerupa,
  sahkanAturan,
  simpanAturan,
  type MasukanAturan,
} from "@/server/modules/aleta-ecourt/aturan-pemeriksaan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pemeriksaan perkara menurut aturan hukum (G1-G5).
 *
 * ============================================================================
 * INI BUKAN SAUDARA aleta-ecourt/analisa, MESKI NAMANYA TERDENGAR MIRIP
 * ============================================================================
 *
 * Tiga rute di folder ini menjawab pertanyaan tentang satu perkara, dan
 * ketiganya sengaja tetap terpisah:
 *
 *   status-perkara/  keterangan perkara dari SIPP; 31 kueri, dimuat di muka
 *   analisa/         sebelas hitungan dari register; dimuat saat diminta
 *   pemeriksaan/     INI - aturan hukum diadu dengan fakta perkara
 *
 * Dua yang pertama memang bersaudara: sumbernya sama (MySQL SIPP lewat
 * jembatan bot), kewenangannya sama (`panel`), dan dipisah SEMATA karena
 * beban. Menyatukannya kembali mengembalikan beban itu ke pembukaan perkara.
 *
 * Yang ini berbeda pada tiga hal yang menentukan: sumbernya pustaka hukum di
 * Postgres portal, bukan register; ia MENULIS - aturan dan sidik pola; dan
 * mengubah aturannya menuntut Super Admin, sebab satu aturan yang keliru
 * salah pada SETIAP perkara yang diperiksanya.
 *
 * Karena itu ia tidak boleh disatukan ke salah satu yang lain: satu
 * kewenangan harus menang, dan kedua arahnya salah. Bila `panel` yang menang,
 * aturan hukum dapat diubah siapa pun yang boleh membuka panel; bila
 * kewenangan admin yang menang, panel statistik yang sudah dipakai hari ini
 * berhenti bekerja.
 *
 * Yang disatukan adalah PINTU MASUKNYA: ketiganya sampai ke layar
 * /perkara, dan pemakainya tidak perlu tahu ada tiga.
 *
 *   GET                                   daftar aturan pemeriksaan
 *   GET ?aktif=1                          hanya yang sudah disahkan
 *
 *   POST {tindakan:"periksa", ...}        menjalankan aturan atas fakta perkara
 *   POST {tindakan:"peta", ...}           peta dalil-bukti-petitum dan risikonya
 *   POST {tindakan:"serupa", ...}         perkara berpola fakta sama
 *   POST {tindakan:"catatPola", ...}      menyimpan pola perkara ini
 *   POST {tindakan:"simpanAturan", ...}   aturan baru - selalu tidak aktif
 *   POST {tindakan:"sahkanAturan", ...}   mengaktifkan, WAJIB atas perintah siapa
 *   POST {tindakan:"matikanAturan", ...}  mematikan, wajib beralasan
 *
 * ============================================================================
 * MEMERIKSA BOLEH, MENGUBAH ATURANNYA TIDAK
 * ============================================================================
 *
 * Menjalankan pemeriksaan tidak mengubah apa pun dan terbuka bagi siapa pun
 * yang boleh membuka berkas. Mengubah aturannya menuntut kewenangan admin:
 * satu aturan yang keliru tidak salah sekali, melainkan salah pada SETIAP
 * perkara yang diperiksanya - dan salahnya dengan rapi.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hanyaAktif = String(getSearchParam(request, "aktif") ?? "").trim() === "1";
    const aturan = await daftarAturan(db, hanyaAktif);
    return ok({
      ada: true,
      jumlah: aturan.length,
      aktif: aturan.filter((item) => item.aktif).length,
      aturan,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PEMERIKSAAN_PERKARA_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "pemeriksaan-perkara",
    });
  }
}

type Masukan = {
  tindakan?: string;
  perkaraId?: string;
  nomorPerkara?: string;
  jenisPerkara?: string;
  fakta?: Record<string, unknown>;
  // peta dalil
  petitum?: Array<{ nomor: number; teks: string; dalilKe?: number[] }>;
  dalil?: Array<{ nomor: number; teks: string; buktiKe?: number[] }>;
  bukti?: Array<{ nomor: number; kode: string; teks: string }>;
  pihak?: string[];
  daluwarsa?: { tanggalPeristiwa: string; tanggalDaftar: string; tenggangHari: number | null; jangkar: string };
  // panggilan
  relaas?: Array<{ pihak: string; tanggalPanggilan: string; tanggalSidang: string; jalur?: string; diterima?: boolean }>;
  tenggang?: Array<{ jalur: string; hari: number; hariKerja: boolean; perluDiterima: boolean; jangkar: string }>;
  liburan?: string[];
  tergugatHadir?: boolean | null;
  alasanTidakHadir?: string | null;
  // aturan
  aturan?: MasukanAturan;
  kode?: string;
  atasPerintah?: string;
  alasan?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const masukan = (await request.json()) as Masukan;
    const tindakan = String(masukan.tindakan ?? "");
    const mengubahAturan = tindakan.endsWith("Aturan");

    if (mengubahAturan) {
      await pastikanAdminIstimewa(db, actorUserId, "mengubah aturan pemeriksaan perkara");
    } else {
      await pastikanKapabilitas(db, actorUserId, "panel");
    }
    const aktor = String(actorUserId ?? "");

    switch (tindakan) {
      case "periksa": {
        const hasil = await periksa(db, String(masukan.jenisPerkara ?? ""), masukan.fakta ?? {});

        // Panggilan diperiksa di sini karena tenggangnya datang dari
        // pengaturan, bukan dari tabel aturan - bentuknya memang berbeda.
        const panggilan = (masukan.relaas ?? []).map((item) =>
          periksaPanggilan(item, masukan.tenggang ?? [], masukan.liburan ?? [])
        );
        const verstek = periksaVerstek({
          tergugatHadir: masukan.tergugatHadir,
          panggilan,
          alasanTidakHadir: masukan.alasanTidakHadir,
        });

        return ok({ ok: true, ...hasil, panggilan, verstek });
      }

      case "peta": {
        const peta = susunPeta({
          petitum: masukan.petitum ?? [],
          dalil: masukan.dalil ?? [],
          bukti: masukan.bukti ?? [],
          pihak: masukan.pihak ?? [],
        });
        const daluwarsa = masukan.daluwarsa ? periksaDaluwarsa(masukan.daluwarsa) : null;
        return ok({
          ok: true,
          ...peta,
          risiko: daluwarsa ? [...peta.risiko, daluwarsa] : peta.risiko,
        });
      }

      case "serupa":
        return ok({
          ok: true,
          ...(await perkaraSerupa(db, {
            perkaraId: String(masukan.perkaraId ?? ""),
            nomorPerkara: String(masukan.nomorPerkara ?? ""),
            jenisPerkara: String(masukan.jenisPerkara ?? ""),
            fakta: (masukan.fakta ?? {}) as Record<string, string | number | boolean | null>,
          })),
        });

      case "catatPola": {
        const sidik = await catatSidik(db, {
          perkaraId: String(masukan.perkaraId ?? ""),
          nomorPerkara: String(masukan.nomorPerkara ?? ""),
          jenisPerkara: String(masukan.jenisPerkara ?? ""),
          fakta: (masukan.fakta ?? {}) as Record<string, string | number | boolean | null>,
        });
        return sidik
          ? ok({ ok: true, sidik })
          : ok({ ok: false, sebab: "Tidak ada satu pun fakta pola yang dapat dicatat." });
      }

      case "simpanAturan":
        if (!masukan.aturan) return ok({ ok: false, sebab: "Isi aturannya belum disebut." });
        return ok(await simpanAturan(db, aktor, masukan.aturan));

      case "sahkanAturan":
        return ok(
          await sahkanAturan(db, aktor, {
            kode: String(masukan.kode ?? ""),
            atasPerintah: String(masukan.atasPerintah ?? ""),
          })
        );

      case "matikanAturan":
        return ok(
          await matikanAturan(db, { kode: String(masukan.kode ?? ""), alasan: String(masukan.alasan ?? "") })
        );

      default:
        return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PEMERIKSAAN_PERKARA_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "pemeriksaan-perkara",
    });
  }
}
