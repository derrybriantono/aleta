import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksiAktor } from "@/server/modules/akses/hak-peran";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";
import {
  BLANGKO_RELAAS,
  SET_BLANGKO,
  blangkoRelaas,
  folderBlangkoRelaas,
  jalurBlangkoRelaas,
  pihakDipanggil,
  type KeadaanRelaas,
  type PihakDipanggil,
} from "@/lib/pohon-blangko";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * KATALOG BLANGKO RELAAS - SATU SUMBER UNTUK LAYAR DAN EKSTENSI
 * ============================================================================
 *
 * Ekstensi Chrome tidak dapat mengimpor TypeScript, jadi tanpa rute ini ia
 * harus MENYALIN nama berkas blangko ke dalam konten.js. Nama-nama itu tidak
 * dapat disalin dengan aman:
 *
 *   '[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan) .rtf'
 *                                                       ^ SATU SPASI
 *
 * Spasi itu tidak terlihat pada daftar folder mana pun, dan blangko yang
 * namanya kehilangan spasi itu tidak akan pernah ketemu - TANPA satu pun
 * galat, sebab "blangko tidak ada" adalah jawaban yang sah bagi pencari
 * berkas. Karena itu nama berkasnya hanya ditulis SEKALI, di
 * src/lib/pohon-blangko.ts, dan rute ini memulangkannya apa adanya.
 *
 * ============================================================================
 * ATURAN PIHAKNYA IKUT DIPULANGKAN, BUKAN DITINGGAL DI SISI PEMANGGIL
 * ============================================================================
 *
 * Yang menentukan blangko bukan hanya keadaan perkaranya, melainkan juga PIHAK
 * mana yang dipanggil - dan pihaknya diturunkan dari sandi dihadiri_oleh SIPP.
 * Sandi itu sudah punya penerjemah tunggal, pihakDipanggil(), dan rute ini
 * membukanya lewat ?dihadiriOleh= supaya ekstensi tidak menuliskan tabel
 * sandinya sendiri. Dua tabel sandi yang sedikit berbeda adalah cara paling
 * mudah mencetak panggilan untuk orang yang salah.
 *
 * ============================================================================
 * KEWENANGANNYA "panel" - SAMA DENGAN LAYAR RELAAS MASSAL
 * ============================================================================
 *
 * Bukan kapabilitas baru: menambah kunci ke KAPABILITAS_EKSTENSI membuat kunci
 * itu mati bawaannya bagi tiap peran, sehingga panel yang baru dibangun tampak
 * rusak bagi juru sita sampai ada administrator yang menyalakannya satu per
 * satu. "panel" bawaannya menyala bagi seluruh PERAN_PEMEGANG_PERKARA, dan
 * "jurusita" ada di dalam daftar itu. Alasan lengkapnya di route.ts induknya.
 *
 * ============================================================================
 * PEMERIKSAAN KE FOLDER ABT - DAN TIGA JAWABAN, BUKAN DUA
 * ============================================================================
 *
 * Katalog di atas adalah daftar yang DIHARAPKAN ada. Yang benar-benar ada di
 * folder ABT peladen hanya dapat dijawab dengan membacanya, lewat
 * blangko.katalog seperti src/app/api/aleta-ecourt/bas/blangko/route.ts dan
 * .../blangko/pohon/route.ts. Karena itu tiap blangko punya TIGA keadaan, bukan
 * dua:
 *
 *   adaDiAbt = true    terbaca di folder, namanya persis sama
 *   adaDiAbt = false   folder terbaca, namanya TIDAK ada di dalamnya
 *   adaDiAbt = null    foldernya sendiri belum terbaca - belum terukur
 *
 * Menjatuhkan yang ketiga ke false berarti layar berkata "blangkonya hilang"
 * padahal yang terjadi bot tidak dapat dihubungi; menjatuhkannya ke true
 * berarti layar menjanjikan berkas yang belum pernah dilihat siapa pun.
 * Terbukti di mesin setempat 25 September 2026: folder ABT tidak ada di sini
 * sama sekali (blangko.katalog menjawab "Folder blangko tidak ditemukan."),
 * jadi cabang null itu memang cabang yang jalan, bukan kehati-hatian teoretis.
 *
 * Kegagalan membaca folder TIDAK menggagalkan seluruh rute: katalognya sendiri
 * tetap sah sebab ia datang dari TypeScript, bukan dari peladen. Yang gagal
 * disebut gagal pada abt.sebab, dan tidak dikosongkan diam-diam.
 */

/** Keenam sandi keadaan - dibaca dari katalognya, bukan ditulis ulang. */
const KEADAAN_DIKENAL = BLANGKO_RELAAS.map((x) => x.keadaan);

/**
 * "tidak-perlu" ikut dikenal: itu jawaban SIPP untuk sandi 1 (Semua Pihak),
 * bukan ketiadaan jawaban. Menolaknya sebagai "tidak dikenal" berarti rute ini
 * menolak keluaran penerjemah sandinya sendiri.
 */
const PIHAK_DIKENAL: PihakDipanggil[] = ["keduanya", "pertama", "kedua", "tidak-perlu", "tidak-diketahui"];

/**
 * Sebab penerjemahan satu sandi kehadiran - artinya dibaca dari BORANG SIPP
 * (application/views/perkara_tab/jadwal_sidang_p_edit.php, <select
 * name="dihadiri_oleh">), bukan dari komentar kolom yang memang kosong.
 */
function sebabSandi(sandi: string, pihak: PihakDipanggil): string {
  if (pihak === "tidak-perlu") {
    return (
      `Sandi kehadiran "${sandi}" = Semua Pihak hadir (blangko SIPP jadwal_sidang_p_edit.php). ` +
      "Yang hadir diperintahkan datang lagi di muka sidang, jadi tidak dipanggil dengan relaas."
    );
  }
  if (pihak !== "tidak-diketahui") return "";
  if (!sandi.trim() || Number(sandi) === 0) {
    return "Kehadiran sidang tidak tercatat di SIPP. Tanyakan kepada juru sitanya; jangan ditebak.";
  }
  return (
    `Sandi kehadiran "${sandi}" pada blangko SIPP berarti kombinasi dengan pihak intervensi atau ` +
    "turut tergugat, atau sebagian pihak saja - tidak dapat dipetakan ke satu blangko tanpa " +
    "melihat perkaranya. Tanyakan kepada juru sitanya; jangan ditebak."
  );
}

type BlangkoTerdaftar = {
  keadaan: KeadaanRelaas;
  /** APA ADANYA - termasuk spasi sebelum ".rtf" pada blangko sidang lanjutan. */
  berkas: string;
  label: string;
  pihak: PihakDipanggil;
  keterangan: string;
  /** Jalur relatif di dalam akar blangko, dari jalurBlangkoRelaas(). */
  jalur: string;
  /** Folder ABT blangko ini - tidak semua relaas satu folder (ikrar di menu 25). */
  folder: string;
  /** Menu ABT pemilik foldernya beserta rentang proses yang diterimanya. */
  menuAbt: { nama: string; prosesMin: number; prosesMax: number };
  /** true/false HANYA bila folder ABT terbaca; null bila belum terukur. */
  adaDiAbt: boolean | null;
  /** Q3 16 Okt: blangko set e-Court (hanya untuk perkara e-Court) / khusus putusan verstek. */
  ecourt: boolean;
  verstek: boolean;
};

/**
 * Folder relaas diambil dari SET_BLANGKO, bukan ditulis "derry_briantono/Relaas".
 *
 * Nama yang ditulis di dua tempat adalah nama yang kelak berselisih, dan yang
 * berselisih di sini tidak menimbulkan galat - hanya folder kosong yang terbaca
 * sebagai "tidak ada blangko relaas".
 */
function setRelaas() {
  return SET_BLANGKO.find((x) => x.jenis === "relaas") ?? null;
}

/** Sebab pemilihan blangko - keputusannya disebut, bukan disembunyikan. */
function sebabPilihan(keadaan: KeadaanRelaas, pihak: PihakDipanggil, terpilih: string) {
  if (keadaan === "pencegahan-perkawinan" || /Pencegahan Perkawinan/.test(terpilih)) {
    return `Pencegahan perkawinan (jenis 342): panggilan sidang pertama dan lanjutan memakai blangko khusus pencegahan perkawinan: ${terpilih}`;
  }
  // 6 Okt (butir 10): blangko per pihak; gabungan hanya untuk SATU dokumen dua pihak.
  if ((keadaan === "sidang-ditunda" || keadaan === "sidang-pertama") && pihak === "keduanya") {
    return (
      "Satu dokumen untuk kedua pihak memakai blangko gabungan P dan T - hanya blangko itu yang " +
      "memuat dua pihak sekaligus. Dialog Cetak relaas memecahnya menjadi blangko P dan blangko T " +
      "per pihak."
    );
  }
  if (pihak === "pertama" || pihak === "kedua") {
    return `Blangko ${pihak === "pertama" ? "pihak pertama (P)" : "pihak kedua (T)"} untuk keadaan "${keadaan}": ${terpilih}`;
  }
  if (pihak === "tidak-diketahui" && keadaan === "sidang-ditunda") {
    return (
      "Pihak yang dipanggil belum diketahui, jadi yang dipulangkan blangko bawaan keadaan " +
      "ini (untuk Pihak Pertama). Periksa dahulu kehadiran sidang sebelumnya - terukur 1.354 " +
      "dari 20.109 baris jadwal sidang tidak mencatat kehadirannya."
    );
  }
  return `Blangko tunggal untuk keadaan "${keadaan}": ${terpilih}`;
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    // 16 Okt malam (keputusan pengguna): relaas HANYA juru sita/juru sita pengganti, Super Admin, Admin.
    pastikanAksiAktor(aktor, "sidang.cetak-relaas");

    const keadaanMinta = String(getSearchParam(request, "keadaan") ?? "").trim();
    const pihakMinta = String(getSearchParam(request, "pihak") ?? "").trim();
    const dihadiriMinta = String(getSearchParam(request, "dihadiriOleh") ?? "").trim();
    // Q3 16 Okt: ?ecourt=1 (perkara terdaftar lewat e-Court) dan ?verstek=1 (putusan verstek) memilih set e-Court ([JS] 5.1, 5.2, 6.2, 7).
    const ecourtMinta = getSearchParam(request, "ecourt") === "1";
    const verstekMinta = getSearchParam(request, "verstek") === "1";
    // I14 18 Okt: ?jenis=342 (jenis_perkara_id Pencegahan Perkawinan) memilih relaas Pemohon [JS] 11.1 untuk sidang pertama/lanjutan.
    const jenisMintaMentah = Number(String(getSearchParam(request, "jenis") ?? "").trim());
    const jenisMinta = Number.isInteger(jenisMintaMentah) && jenisMintaMentah > 0 ? jenisMintaMentah : null;
    // Pemeriksaan folder ABT menyala bawaannya - itulah yang menangkap nama
    // berkas yang berselisih. Dapat dimatikan dengan ?periksaAbt=0 oleh
    // pemanggil yang hanya butuh daftarnya.
    const periksaAbt = String(getSearchParam(request, "periksaAbt") ?? "1").trim() !== "0";

    // Ruas yang salah bentuk DITOLAK, bukan diganti nilai bawaan. Mengganti
    // keadaan yang salah tulis dengan "sidang-pertama" berarti memulangkan
    // blangko yang tidak diminta siapa pun, dengan tampilan yang meyakinkan.
    if (keadaanMinta && !KEADAAN_DIKENAL.includes(keadaanMinta as KeadaanRelaas)) {
      return Response.json(
        {
          ok: false,
          alasan: `Keadaan "${keadaanMinta}" tidak dikenal.`,
          keadaanDikenal: KEADAAN_DIKENAL,
        },
        { status: 400 }
      );
    }
    if (pihakMinta && !PIHAK_DIKENAL.includes(pihakMinta as PihakDipanggil)) {
      return Response.json(
        {
          ok: false,
          alasan: `Pihak "${pihakMinta}" tidak dikenal.`,
          pihakDikenal: PIHAK_DIKENAL,
        },
        { status: 400 }
      );
    }

    const set = setRelaas();
    const folder = set?.folder ?? "";

    // ---- Folder ABT: TIAP folder dibaca sekali ---------------------------
    //
    // Sejak 26 September 2026 blangko ikrar berada di folder menu ABT 25
    // (_ikrar_talak/2 Relaas Ikrar Talak), bukan di Relaas. Satu folder yang
    // tidak terbaca tidak membuat blangko di folder lain ikut "belum terukur".
    type KeadaanFolder = { folder: string; terbaca: boolean; sebab: string; berkas: string[] | null };
    const perFolder: KeadaanFolder[] = [];
    for (const f of folderBlangkoRelaas()) {
      const keadaan: KeadaanFolder = {
        folder: f,
        terbaca: false,
        sebab: periksaAbt
          ? ""
          : "Tidak diperiksa - pemanggil meminta ?periksaAbt=0, jadi keberadaan berkasnya belum terukur.",
        berkas: null,
      };
      if (periksaAbt) {
        const katalog = await callAletaBotSippBridge("blangko.katalog", { folder: f });
        if (!katalog.ok) {
          // Sebab dari jembatan apa adanya - "bot tidak merespons" dan "folder
          // tidak ada" menuntut tindakan yang berbeda.
          keadaan.sebab = String(katalog.error ?? "Katalog blangko tidak terbaca.");
        } else {
          const data = (katalog.data ?? {}) as {
            ada?: boolean;
            sebab?: string;
            blangko?: Array<{ berkas?: string }>;
          };
          const daftar = Array.isArray(data.blangko)
            ? data.blangko.map((x) => String(x?.berkas ?? "")).filter(Boolean)
            : [];
          if (data.ada && daftar.length > 0) {
            keadaan.terbaca = true;
            keadaan.berkas = daftar;
          } else {
            keadaan.sebab = String(data.sebab ?? "") || "Folder blangko relaas terbaca tetapi kosong.";
          }
        }
      }
      perFolder.push(keadaan);
    }
    const isiFolder = new Map(perFolder.map((x) => [x.folder, x.berkas]));
    const abtTerbaca = perFolder.length > 0 && perFolder.every((x) => x.terbaca);
    // Sebab yang SAMA untuk semua folder (bot mati, folder akar tidak ada)
    // disebut sekali apa adanya; yang berbeda-beda disebut per folder.
    const gagalBaca = perFolder.filter((x) => !x.terbaca && x.sebab);
    const sebabUnik = [...new Set(gagalBaca.map((x) => x.sebab))];
    const abtSebab =
      sebabUnik.length === 1 && gagalBaca.length === perFolder.length
        ? sebabUnik[0]
        : gagalBaca.map((x) => `${x.folder}: ${x.sebab}`).join(" | ");
    const berkasDiAbt = perFolder.some((x) => x.terbaca)
      ? perFolder.flatMap((x) => x.berkas ?? [])
      : null;

    const blangko: BlangkoTerdaftar[] = BLANGKO_RELAAS.map((x) => {
      const daftar = isiFolder.get(x.folder) ?? null;
      return {
        keadaan: x.keadaan,
        berkas: x.berkas,
        label: x.label,
        pihak: x.pihak,
        keterangan: x.keterangan,
        jalur: jalurBlangkoRelaas(x.berkas),
        folder: x.folder,
        menuAbt: x.menuAbt,
        // Perbandingan PERSIS, termasuk spasinya, dan HANYA di folder blangko
        // itu sendiri. Menormalkan spasi di sini akan menyembunyikan justru
        // selisih yang rute ini dibangun untuk menangkap.
        adaDiAbt: daftar ? daftar.includes(x.berkas) : null,
        ecourt: x.ecourt === true,
        verstek: x.verstek === true,
      };
    });

    const tidakDitemukan = berkasDiAbt
      ? blangko.filter((x) => x.adaDiAbt === false).map((x) => x.berkas)
      : null;

    // ---- Satu pilihan, bila keadaannya disebut ------------------------------
    const pihakPilihan: PihakDipanggil = pihakMinta
      ? (pihakMinta as PihakDipanggil)
      : dihadiriMinta
        ? pihakDipanggil(dihadiriMinta)
        : "tidak-diketahui";

    const terpilih = keadaanMinta
      ? blangkoRelaas(keadaanMinta as KeadaanRelaas, pihakPilihan, { lewatEcourt: ecourtMinta, verstek: verstekMinta, jenisPerkaraId: jenisMinta })
      : null;

    const pilihan = keadaanMinta
      ? {
          keadaan: keadaanMinta,
          pihak: pihakPilihan,
          ada: Boolean(terpilih),
          berkas: terpilih?.berkas ?? "",
          jalur: terpilih ? jalurBlangkoRelaas(terpilih.berkas) : "",
          label: terpilih?.label ?? "",
          adaDiAbt: terpilih
            ? (blangko.find((x) => x.berkas === terpilih.berkas)?.adaDiAbt ?? null)
            : null,
          sebab: terpilih
            ? sebabPilihan(keadaanMinta as KeadaanRelaas, pihakPilihan, terpilih.berkas)
            : pihakPilihan === "tidak-perlu"
              ? "Semua pihak hadir - tidak ada yang dipanggil maupun diberi tahu, jadi tidak ada blangko."
              : `Keadaan "${keadaanMinta}" tidak punya blangko terdaftar di BLANGKO_RELAAS.`,
        }
      : null;

    // ---- Penerjemahan sandi kehadiran, bila diminta -------------------------
    const sandi = dihadiriMinta
      ? {
          dihadiriOleh: dihadiriMinta,
          pihak: pihakDipanggil(dihadiriMinta),
          sebab: sebabSandi(dihadiriMinta, pihakDipanggil(dihadiriMinta)),
        }
      : null;

    return ok({
      set: set ? { id: set.id, nama: set.nama, folder: set.folder } : null,
      folder,
      jumlah: blangko.length,
      keadaanDikenal: KEADAAN_DIKENAL,
      pihakDikenal: PIHAK_DIKENAL,
      blangko,
      abt: {
        diperiksa: periksaAbt,
        terbaca: abtTerbaca,
        sebab: abtSebab,
        jumlahDiFolder: berkasDiAbt ? berkasDiAbt.length : null,
        tidakDitemukan,
        perFolder: perFolder.map((x) => ({
          folder: x.folder,
          terbaca: x.terbaca,
          sebab: x.sebab,
          jumlah: x.berkas ? x.berkas.length : null,
        })),
      },
      pilihan,
      sandi,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "RELAAS_MASSAL_BLANGKO_FAILED",
      feature: "aleta_ecourt",
      entityId: "relaas-massal-blangko",
    });
  }
}
