import { type NextRequest } from "next/server";

import { samaLonggar } from "@/lib/jejak-isian";
import { getDatabase } from "@/server/db/client";
import { bacaRiwayat, catatRiwayat } from "@/server/modules/aleta-ecourt/abt-riwayat";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { catatJejakIsian } from "@/server/modules/aleta-ecourt/jejak-isian";
import { catatKoreksi } from "@/server/modules/aleta-ecourt/kamus-deteksi";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * JEJAK PERUBAHAN ABT
 * ============================================================================
 *
 * Riwayat perubahan ABT selama ini hanya ada di chrome.storage peramban yang
 * dipakai - hilang bila data peramban dibersihkan, tidak ada pada peramban
 * lain milik orang yang sama, dan tidak terlihat oleh siapa pun selain yang
 * menyuntingnya.
 *
 * Rute ini memberinya tempat yang bertahan. Salinan di peramban TETAP ada dan
 * tetap yang menggerakkan tombol Urungkan: ia lengkap, ada seketika, dan tetap
 * bekerja ketika peladen mati - dan justru saat sesuatu baru saja salah
 * diterapkanlah tombol itu paling dibutuhkan.
 *
 * ============================================================================
 * KEWENANGANNYA "panel", SAMA DENGAN YANG MENYUNTING
 * ============================================================================
 *
 * Yang mencatat di sini adalah ekstensi, atas perbuatan yang BARU SAJA
 * dikerjakan orang yang sama di halaman ABT. Menuntut kewenangan yang lebih
 * tinggi daripada yang dituntut untuk menyuntingnya berarti sebagian
 * penyuntingan tercatat dan sebagian tidak - dan jejak yang berlubang lebih
 * menyesatkan daripada tidak ada jejak, sebab yang membacanya menyangka
 * lubangnya berarti tidak ada perubahan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    if (!perkaraId) return ok({ ada: false, daftar: [], sebab: "Perkara tidak disebutkan." });

    const daftar = await bacaRiwayat(db, perkaraId);
    return ok({ ada: daftar.length > 0, daftar });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_RIWAYAT_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "abt-riwayat",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Ekstensi boleh mengirim beberapa sekaligus - satu penerapan usulan dapat
    // mengubah beberapa variabel sekaligus, dan mengirimkannya satu per satu
    // berarti sebagiannya hilang ketika jaringan putus di tengah.
    const daftarMentah = Array.isArray(badan.daftar) ? badan.daftar : [badan];

    const tercatat = [];
    let koreksi = 0;
    // C1 (25 Okt): salinan LENGKAP perubahan panel untuk Urungkan lintas PC - hanya bila saklar "jejak-isian" menyala.
    const untukJejak: Array<Record<string, unknown>> = [];
    for (const satu of daftarMentah.slice(0, 50)) {
      const isi = (satu ?? {}) as Record<string, unknown>;
      const baris = await catatRiwayat(db, String(actorUserId ?? ""), {
        perkaraId: String(isi.perkaraId ?? ""),
        nomorPerkara: String(isi.nomorPerkara ?? ""),
        kode: String(isi.kode ?? ""),
        nama: String(isi.nama ?? ""),
        sebelum: String(isi.sebelum ?? ""),
        sesudah: String(isi.sesudah ?? ""),
        cara: String(isi.cara ?? ""),
        pada: String(isi.pada ?? ""),
      });
      if (baris) tercatat.push(baris.id);

      /* === KAMUS-DB 10 Okt === D2 jejak koreksi: usulan ALETA vs nilai akhir.
         Ekstensi melampirkan {koreksi} pada catatan dari terapkanUsulanBerurutan
         ("Input ke ABT", "Input semua yang pasti", dst.). Gagal mencatat
         koreksi TIDAK menggagalkan riwayat - jejak ini tambahan. */
      if (baris && isi.koreksi && typeof isi.koreksi === "object" && !Array.isArray(isi.koreksi)) {
        const k = isi.koreksi as Record<string, unknown>;
        try {
          const jejak = await catatKoreksi(db, String(actorUserId ?? ""), {
            perkaraId: String(isi.perkaraId ?? ""),
            nomorPerkara: String(isi.nomorPerkara ?? ""),
            variabel: String(isi.kode ?? ""),
            namaVariabel: String(isi.nama ?? ""),
            nilaiUsulan: String(k.usulan ?? ""),
            sumber: String(k.sumber ?? ""),
            kodePola: String(k.kodePola ?? ""),
            keyakinan: String(k.keyakinan ?? ""),
            kalimatSumber: String(k.kalimatSumber ?? ""),
            nilaiAkhir: String(isi.sesudah ?? ""),
            hasil: String(k.hasil ?? ""),
            jalur: String(k.jalur ?? ""),
            pada: String(isi.pada ?? ""),
          });
          if (jejak) koreksi += 1;
        } catch {
          /* jejak koreksi tertinggal - riwayatnya tetap tercatat */
        }
      }
      /* === AKHIR KAMUS-DB === */

      // tanpaJejak: pemanggil (Blangko Derry) sudah mencatat jejaknya sendiri langsung ke rute jejak-isian.
      if (baris && isi.tanpaJejak !== true) {
        const k = isi.koreksi && typeof isi.koreksi === "object" && !Array.isArray(isi.koreksi) ? (isi.koreksi as Record<string, unknown>) : null;
        const hasilKoreksi = String(k?.hasil ?? "");
        const caraPanel = String(isi.cara ?? "");
        untukJejak.push({
          perkaraId: String(isi.perkaraId ?? ""),
          nomorPerkara: String(isi.nomorPerkara ?? ""),
          jenisBlangko: "panel",
          kode: String(isi.kode ?? ""),
          namaVariabel: String(isi.nama ?? ""),
          nilaiUsulan: k ? String(k.usulan ?? "") : "",
          asalUsulan: k ? "panel" : "",
          keyakinan: k ? String(k.keyakinan ?? "") : "",
          kodePola: k ? String(k.kodePola ?? "") : "",
          nilaiSebelum: String(isi.sebelum ?? ""),
          nilaiFinal: String(isi.sesudah ?? ""),
          // Cara dihitung dari usulan vs nilai akhir (sama dengan aturan koreksi), bukan dipercaya dari ekstensi;
          // "dipilih" (bunyi dipilih petugas dari pilihan) dianggap saran diterima.
          cara: /^dikembalikan/i.test(caraPanel)
            ? "diurungkan"
            : k
              ? hasilKoreksi === "dipilih"
                ? "saran-diterima"
                : !String(k.usulan ?? "").trim()
                  ? "diketik"
                  : samaLonggar(String(k.usulan ?? ""), String(isi.sesudah ?? ""))
                    ? "saran-diterima"
                    : "diubah"
              : "sunting-panel",
          jalur: /^dikembalikan/i.test(caraPanel) ? "urungkan" : "panel-abt",
          blangko: `panel: ${caraPanel}`.slice(0, 300),
          urungkanDari: String(isi.urungkanDari ?? ""),
          pada: String(isi.pada ?? ""),
        });
      }
    }

    if (untukJejak.length) {
      try {
        await catatJejakIsian(db, { id: String(actorUserId ?? "") }, untukJejak, { tanpaKoreksi: true });
      } catch {
        /* jejak lengkap tertinggal - riwayat (dipotong) dan salinan peramban tetap ada */
      }
    }

    return ok({ ok: true, tercatat: tercatat.length, koreksi });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_RIWAYAT_CATAT_FAILED",
      feature: "aleta_ecourt",
      entityId: "abt-riwayat",
    });
  }
}
