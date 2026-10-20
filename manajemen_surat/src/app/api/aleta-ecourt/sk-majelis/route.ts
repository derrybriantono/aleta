import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { gatewayPegawaiPenunjukan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import {
  bacaAkunUntukPeringatan,
  bacaBerlakuMulai,
  bacaHariSidang,
  bacaJejakSk,
  hapusMajelis,
  NAMA_HARI,
  simpanBerlakuMulai,
  simpanHariSidang,
  susunPeringatanSk,
} from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import { bacaSkMajelis } from "@/server/modules/pengaturan-abt/nomor-sk-sumber";
import { getPositionsFromDb } from "@/server/modules/organization/service";
import { listUsersFromDb } from "@/server/modules/users/service";
import { getRoleLabel } from "@/lib/permissions";
import type { RoleId } from "@/lib/types";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * SK SUSUNAN MAJELIS HAKIM DAN PANITERA SIDANG
 * ============================================================================
 *
 * Sampai sekarang susunan majelis yang ditawarkan panel diturunkan dari
 * PEMAKAIAN di SIPP - susunan yang paling sering muncul pada perkara tahun
 * berjalan. Itu bekerja, tetapi tidak dapat membedakan susunan yang ditetapkan
 * SK dari susunan darurat yang kebetulan pernah dipakai sekali karena seorang
 * hakim berhalangan.
 *
 * Layar ini menyimpan SK-nya sendiri, dan karena itu satu-satunya tempat
 * susunan majelis dapat DIUBAH tanpa menyentuh kode.
 *
 * ============================================================================
 * PANITERA DIIKAT KE ORANGNYA, BUKAN KE KODENYA
 * ============================================================================
 *
 * Daftar hakim dan panitera aktif ikut dikirim sebab pengikatan itu tidak
 * dapat dikerjakan mesin: kode panitera pada SIPP tabrakan - empat orang
 * berbagi kode "D" sementara SK membedakannya D, D1, D3, D4 - dan namanya pun
 * berbeda ejaan ("Munifah" pada SK, "Munifa" pada SIPP). Yang dapat
 * memutuskan siapa yang dimaksud SK hanya manusia.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const majelis = await bacaHariSidang(db);
    const pegawai = await gatewayPegawaiPenunjukan();

    // ========================================================================
    // DAFTAR AKUN PORTAL IKUT DIKIRIM
    // ========================================================================
    //
    // Layar ini sudah menerima daftar hakim dan panitera dari SIPP lewat bot.
    // Yang ditambahkan di sini daftar AKUN portal - dua hal yang berbeda:
    // yang pertama orang di SIPP, yang kedua orang yang dapat masuk ke ALETA.
    //
    // Keduanya perlu, dan keduanya tidak dapat saling menggantikan: SIPP tahu
    // siapa yang menyidangkan, portal tahu siapa yang boleh membuka layarnya.
    let akun: Array<Record<string, string>> = [];
    let akunAlasan = "";
    try {
      const [daftar, jabatan] = await Promise.all([
        listUsersFromDb(db, actorUserId),
        getPositionsFromDb(db),
      ]);
      const namaJabatan = new Map(jabatan.map((j) => [String(j.id), String(j.name ?? "")]));
      akun = (daftar ?? [])
        .filter((u) => u.isActive !== false)
        .map((u) => ({
          id: String(u.id),
          nama: String(u.name ?? ""),
          peran: String(u.roleId ?? ""),
          peranLabel: getRoleLabel(u.roleId),
          jabatan: namaJabatan.get(String(u.positionId ?? "")) ?? "",
          subPeran: (u.additionalRoleIds ?? []).map((r) => getRoleLabel(r as RoleId)).join(", "),
        }))
        .sort((a, b) => a.nama.localeCompare(b.nama));
    } catch (galat) {
      // Sama seperti gagalnya bot: susunan yang tersimpan tetap terbaca dan
      // tetap dapat disunting. Yang hilang hanya kemampuan menautkan akun.
      akunAlasan = galat instanceof Error ? galat.message : "Daftar akun portal tidak terbaca.";
    }

    return ok({
      majelis,
      akun,
      akunAlasan,
      namaHari: NAMA_HARI,
      skBerlaku: await bacaSkMajelis(db),
      // Tanggal SK mulai berlaku (kosong = tanggal SK sendiri), jejak perubahan, dan
      // peringatan: hakim/panitera di SK yang sudah tidak aktif, bermutasi, atau berganti jabatan.
      berlakuMulai: await bacaBerlakuMulai(db),
      jejak: await bacaJejakSk(db, 20),
      peringatan: susunPeringatanSk({
        majelis,
        hakimAktif: (pegawai.ok ? ((pegawai.data?.hakim ?? []) as Array<{ id: number; kode: string; nama: string }>) : []),
        paniteraAktif: (pegawai.ok ? ((pegawai.data?.panitera ?? []) as Array<{ id: number; kode: string; nama: string }>) : []),
        akun: await bacaAkunUntukPeringatan(db),
        pegawaiTerbaca: pegawai.ok === true,
      }),
      // Gagalnya bot TIDAK menggagalkan layar: susunan yang sudah tersimpan
      // tetap terbaca dan tetap dapat disunting hari/kodenya. Yang hilang
      // hanya kemampuan mengikat ke orang, dan itu disebutkan apa adanya.
      pegawaiTerbaca: pegawai.ok === true,
      pegawaiAlasan: pegawai.ok ? "" : String(pegawai.error || "aleta_bot tidak dapat dihubungi"),
      // SK majelis tetap yang tercatat di SIPP (baca saja) - pilihan pengecualian di layar.
      skTetap: (pegawai.ok ? (pegawai.data?.skTetap ?? []) : []) as unknown[],
      hakim: (pegawai.ok ? (pegawai.data?.hakim ?? []) : []) as unknown[],
      panitera: (pegawai.ok ? (pegawai.data?.panitera ?? []) : []) as unknown[],
    });
  } catch (galat) {
    return handleAdminRouteError(galat, request, {
      db,
      actorUserId,
      action: "SK_MAJELIS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

/**
 * Menyimpan satu majelis.
 *
 * Kewenangannya diperiksa di dalam simpanHariSidang - hanya Super Admin dan
 * Admin. Diperiksa di sana, bukan di sini, supaya satu-satunya jalan menulis
 * tabel ini melewati pemeriksaan yang sama.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const badan = (await request.json()) as Record<string, unknown>;

    // Tindakan lain di layar yang sama: hapus majelis dari SK, dan tanggal SK berlaku.
    // Tanpa "tindakan" = simpan satu majelis (bentuk lama, tidak berubah).
    if (badan.tindakan === "hapus") {
      const hasilHapus = await hapusMajelis(db, {
        actorUserId: String(actorUserId ?? ""),
        majelisKode: String(badan.majelisKode ?? ""),
      });
      return ok({ majelis: hasilHapus });
    }
    if (badan.tindakan === "berlaku-mulai") {
      const berlaku = await simpanBerlakuMulai(db, {
        actorUserId: String(actorUserId ?? ""),
        tanggal: String(badan.tanggal ?? ""),
      });
      return ok({ berlakuMulai: berlaku });
    }

    const hasil = await simpanHariSidang(db, {
      actorUserId: String(actorUserId ?? ""),
      majelisKode: String(badan.majelisKode ?? ""),
      hari: Number(badan.hari),
      paniteraKode: String(badan.paniteraKode ?? ""),
      hakimKode: String(badan.hakimKode ?? ""),
      paniteraId: String(badan.paniteraId ?? ""),
      // Tautan akun portal - hanya sampai ke sini bersama majelisnya, sebab
      // tidak ada alamat lain yang menerimanya. Itulah yang membuat "hanya
      // dapat ditautkan apabila masuk majelis" berlaku, bukan sekadar
      // dianjurkan.
      akunId: String(badan.akunId ?? ""),
      // Pengecualian SK per majelis: tidak dikirim = biarkan; "" keduanya = ikut SK bawaan.
      skNomor: badan.skNomor === undefined ? undefined : String(badan.skNomor ?? ""),
      skTanggal: badan.skTanggal === undefined ? undefined : String(badan.skTanggal ?? ""),
      keterangan: String(badan.keterangan ?? ""),
    });

    return ok({ majelis: hasil });
  } catch (galat) {
    return handleAdminRouteError(galat, request, {
      db,
      actorUserId,
      action: "SK_MAJELIS_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
