import { type NextRequest } from "next/server";

import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { roles as daftarPeran } from "@/lib/mock-data";
import { DIRILIS_EKSTENSI_TERBARU } from "@/lib/catatan-ekstensi";
import { bolehKasir } from "@/lib/kasir-jurnal";
import { golonganMenuEkstensi } from "@/lib/matriks-peran";
import {
  KETERANGAN_KAPABILITAS,
  bolehMenyuntingAkses,
  kapabilitasPengguna,
} from "@/server/modules/aleta-ecourt/akses";
import { bolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { susunMenuEkstensi } from "@/server/modules/aleta-ecourt/menu-ekstensi";
import { untukEkstensi } from "@/server/modules/aleta-ecourt/tipe-keluaran";
import { requireActorUser } from "@/server/modules/organization/service";
import { bacaRingkasanFiturKlien } from "@/server/modules/satker/fitur";
import { resolveActorUserId } from "@/server/shared/auth";
import { EKSTENSI_VERSI } from "@/server/shared/ekstensi-berkas";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Versi tipe keluaran efektif, atau null bila tabelnya tak terbaca.
 *
 * null, bukan versi cermin: versi cermin akan membuat ekstensi mengira
 * singgahannya (yang mungkin berisi tambahan sah) basi lalu menimpanya dengan
 * bawaan. Kegagalan membaca TIDAK menjatuhkan "siapa saya" - panel tetap
 * harus tahu kewenangan pemakainya - tetapi dicatat di log peladen.
 */
async function versiTipeKeluaran(db: AletaDatabase): Promise<string | null> {
  try {
    const hasil = await untukEkstensi(db);
    if (hasil.asal === "basis-data") return hasil.versi;
    console.error("[TIPE KELUARAN] versiTipe null: tabel tak terbaca.", hasil.kabar);
    return null;
  } catch (galat) {
    console.error("[TIPE KELUARAN] versiTipe null: gagal membaca tipe keluaran.", galat);
    return null;
  }
}

/**
 * "Siapa saya, dan saya boleh apa" - untuk panel ekstensi di halaman ALETA.
 *
 * Selalu tentang pemanggilnya sendiri; tidak ada ruas yang menyebut orang
 * lain. Menu pintasannya DISUSUN DI SINI menurut jabatan (lihat
 * menu-ekstensi.ts), supaya aturannya hidup di satu tempat - bukan di berkas
 * ekstensi yang berjalan dalam beberapa versi sekaligus di peramban orang.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    const roleId = String(actor.roleId || "");
    const additionalRoleIds = actor.additionalRoleIds ?? [];
    const peran = daftarPeran.find((x) => x.id === roleId);

    return ok({
      id: actor.id,
      nama: actor.name,
      peran: peran ? peran.name : roleId,
      roleId,
      peranTambahan: additionalRoleIds,
      kapabilitas: await kapabilitasPengguna(db, { id: actor.id, roleId, additionalRoleIds, positionId: actor.positionId, actingAssignment: actor.actingAssignment }),
      keterangan: KETERANGAN_KAPABILITAS,
      menu: susunMenuEkstensi(roleId, additionalRoleIds),
      bolehMengatur: bolehMenyuntingAkses(actor),
      // Hak unggah putusan ke SIPP/e-Court (9 Okt 2026) - peran, bukan kemampuan.
      bolehUnggahPutusan: bolehUnggahPutusan(actor),
      // Tab Kasir ekstensi (1.189.x): kasir/keuangan/panitera/admin - aturan Kasir 1.186.
      bolehKasir: bolehKasir(actor),
      // HAK-PERAN 12 Okt: golongan menu panel SIPP/ABT dari matriks peran
      // (jabatan + peran tambahan) - panel-alat.js memakainya lebih dulu.
      golonganMenu: golonganMenuEkstensi(actor),
      versiEkstensi: EKSTENSI_VERSI,
      dirilis: DIRILIS_EKSTENSI_TERBARU,
      // Versi tipe keluaran ikut di sini supaya ekstensi tahu singgahannya
      // basi TANPA permintaan tambahan (K5); isinya diambil lewat
      // /ekstensi/tipe-keluaran hanya bila versinya berubah.
      versiTipe: await versiTipeKeluaran(db),
      // Banyak satker (Tahap 0): saluran pembaruan dan status fitur satker ini.
      // Tambahan murni - ekstensi lama mengabaikannya; gagal baca = semua menyala.
      fiturSatker: await bacaRingkasanFiturKlien(db),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
