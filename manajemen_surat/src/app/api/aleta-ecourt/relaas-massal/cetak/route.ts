import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { petaPemetaanBerlaku } from "@/server/modules/aleta-ecourt/pemetaan-blangko";
import {
  getGatewayRelaasCetak,
  type DokumenRelaasCetakGateway,
  type DokumenRelaasCetakPortal,
  type RelaasCetakGateway,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

import { nilaiCetakDokumen } from "./nilai-cetak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * DOKUMEN RELAAS YANG LAHIR PADA SATU TANGGAL - BAHAN TOMBOL CETAK RELAAS
 * ============================================================================
 *
 * Diminta pengguna 25 September 2026: tombol cetak relaas di Antrian Sidang
 * "untuk cetak relaas dan pemberitahuan putusan (disini otomatis juga
 * mengambil hari itu yang baru daftar)". Bot yang menentukan dokumen apa saja
 * yang lahir pada tanggal itu (GET /internal/aleta-bot/sipp/relaas-cetak);
 * rute ini menambahkan BLANGKONYA - dari pohon-blangko.ts, satu-satunya tempat
 * nama berkas blangko ditulis - beserta jawaban "dapat dicetak atau tidak" dan
 * sebabnya.
 *
 * ============================================================================
 * KEWENANGANNYA SAMA DENGAN RUTE INDUKNYA - "panel"
 * ============================================================================
 *
 * Juru sita lolos karena "panel" menyala bawaannya bagi seluruh
 * PERAN_PEMEGANG_PERKARA; admin dan super admin lolos lewat pulang-awal
 * isPrivilegedAdmin(). Alasan tidak membuat kapabilitas baru tertulis di
 * relaas-massal/route.ts.
 *
 * ============================================================================
 * TANGGAL SALAH BENTUK DITOLAK; JAWABAN BOT YANG CACAT TIDAK DIKOSONGKAN
 * ============================================================================
 *
 * Tanggal yang tidak berbentuk YYYY-MM-DD dijawab 400, tidak diganti hari ini.
 * Jawaban bot tanpa larik dokumen dijawab 502 beserta sebabnya - bukan daftar
 * kosong, sebab daftar kosong terbaca "hari ini tidak ada yang dipanggil", dan
 * itu keadaan yang berbeda dari "bot menjawab sesuatu yang tidak terbaca".
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const tanggal = (request.nextUrl.searchParams.get("tanggal") || "").trim();
    if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return Response.json(
        { ok: false, alasan: `Tanggal "${tanggal}" tidak berbentuk YYYY-MM-DD.` },
        { status: 400 }
      );
    }

    const hasil = await getGatewayRelaasCetak({ tanggal });
    if (!hasil.ok) {
      // Sebab dari bot diteruskan apa adanya - termasuk "halaman 404" ketika
      // rutenya belum terpasang di bot yang sedang berjalan.
      return Response.json(
        { ok: false, alasan: hasil.error || "relaas_cetak_belum_dapat_dibaca" },
        { status: 502 }
      );
    }

    const data = hasil.data as Partial<RelaasCetakGateway> | null | undefined;
    if (!data || !Array.isArray(data.dokumen)) {
      return Response.json(
        {
          ok: false,
          alasan:
            "Jawaban bot untuk relaas-cetak tidak memuat larik dokumen - tidak dapat dinilai, dan tidak dianggap kosong.",
        },
        { status: 502 }
      );
    }

    // Pemetaan blangko admin (2 Okt sore, butir 1): dibaca sekali per permintaan.
    // Tabel tak terbaca = peta kosong, jadi blangko bawaan dipakai seperti dulu.
    const [petaRelaas, petaPbt] = await Promise.all([petaPemetaanBerlaku(db, "relaas"), petaPemetaanBerlaku(db, "pbt")]);
    const petaBlangko = { relaas: petaRelaas, pbt: petaPbt };
    const nilaiSatu = (satu: DokumenRelaasCetakGateway): DokumenRelaasCetakPortal => {
      // Peta ikut dinilai (6 Okt, butir 10) - layar memakai peta yang sama.
      const nilai = nilaiCetakDokumen(satu, null, petaBlangko);
      const blangko = nilai.blangko;
      return {
        ...satu,
        blangko,
        bisaDicetak: nilai.bisaDicetak,
        sebabTidakBisa: nilai.sebabTidakBisa,
        // Tambahan di luar K2 (tidak mengubah ruas kontraknya): dokumen yang
        // dapat dicetak tetapi perlu konfirmasi atau memuat sebagian pihak
        // saja - lihat kepala nilai-cetak.ts.
        peringatan: nilai.peringatan,
        ikutPilihSemua: nilai.ikutPilihSemua,
      };
    };
    const dokumen: DokumenRelaasCetakPortal[] = data.dokumen.map(nilaiSatu);

    // Kelompok "dari hari kerja sebelumnya" (tambahan bot di luar K1) dinilai
    // dengan aturan yang SAMA. Bot lama tanpa ruas ini -> tidak ada kelompoknya.
    const kemarin = data.hariKerjaSebelumnya;
    const hariKerjaSebelumnya =
      kemarin && Array.isArray(kemarin.dokumen)
        ? { tanggal: String(kemarin.tanggal || ""), dokumen: kemarin.dokumen.map(nilaiSatu) }
        : undefined;

    // Dokumen "keduanya" TIDAK dipecah di sini: panel massal ekstensi membaca
    // daftar ini dan sudah memilih blangko per sisi yang dicentang. Dialog
    // Cetak relaas portal memecahnya sendiri (pecahDokumenPerPihak) dengan
    // `petaBlangko` di bawah - 6 Okt, butir 10.
    return ok({ ...data, dokumen, hariKerjaSebelumnya, petaBlangko });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "RELAAS_CETAK_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "relaas-massal-cetak",
    });
  }
}
