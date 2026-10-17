import { type NextRequest } from "next/server";

import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  ajukanPaket,
  ambilBlangko,
  BATAS_BERKAS_BLANGKO,
  buatDariBerkas,
  buatDariTeks,
  daftarBlangko,
  eksporKePutusanMandiri,
  eksporUntukAbt,
  hapusBlangko,
  pratinjauBlangko,
  putuskanPaket,
  riwayatBlangko,
  simpanIsi,
  simpanKeputusan,
  tarikPaket,
  unduhPaket,
  type AktorBlangko,
} from "@/server/modules/aleta-ecourt/blangko-sendiri";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Buat blangko sendiri (18 Okt 2026) - blangko pribadi hakim, panitera, konseptor.
 *
 *   GET                         daftar blangko milik sendiri (?semua=1 untuk Super Admin)
 *   GET ?id=                    rincian satu blangko
 *   GET ?id=&aksi=riwayat       jejak tindakan
 *   GET ?id=&aksi=unduh-abt&bagian=rtf|daftar     berkas untuk ABT (diunduh)
 *   GET ?id=&aksi=unduh-paket&bagian=rtf|daftar   cuplikan paket yang diajukan
 *
 *   POST multipart: berkas, nama?, jenis?          unggah RTF/DOCX/PDF
 *   POST JSON {tindakan}:
 *     buat-teks, simpan-isi, keputusan, pratinjau, ekspor-mandiri,
 *     ajukan-paket, tarik-paket, putuskan-paket, hapus
 *
 * Pemilik dan Super Admin saja yang dapat membuka sebuah blangko; mengubahnya
 * hanya pemilik. Tidak ada yang ditulis ke SIPP/ABT oleh rute ini.
 */

async function aktor(db: Awaited<ReturnType<typeof getDatabase>>, actorUserId: string | null): Promise<AktorBlangko> {
  const pengguna = await requireActorUser(db, actorUserId);
  return { id: String(pengguna.id), name: pengguna.name, roleId: String(getEffectiveRoleId(pengguna) ?? pengguna.roleId ?? "") };
}

function berkasUnduhan(isi: string, nama: string, jenis: string) {
  return new Response(isi, {
    status: 200,
    headers: {
      "Content-Type": `${jenis}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${nama.replace(/[^a-z0-9._-]/gi, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const pelaku = await aktor(db, actorUserId);
    const id = String(getSearchParam(request, "id") ?? "").trim();

    if (!id) {
      const semua = String(getSearchParam(request, "semua") ?? "") === "1";
      return ok({ ada: true, blangko: await daftarBlangko(db, pelaku, { semua }), superAdmin: pelaku.roleId === "super-admin" });
    }

    const aksi = String(getSearchParam(request, "aksi") ?? "").trim();
    const bagian = String(getSearchParam(request, "bagian") ?? "rtf").trim();
    if (aksi === "riwayat") return ok({ ada: true, riwayat: await riwayatBlangko(db, pelaku, id) });
    if (aksi === "unduh-abt") {
      const berkas = await eksporUntukAbt(db, pelaku, id);
      return bagian === "daftar"
        ? berkasUnduhan(berkas.daftarTxt, berkas.namaDaftar, "text/plain")
        : berkasUnduhan(berkas.rtf, berkas.namaBerkas, "application/rtf");
    }
    if (aksi === "unduh-paket") {
      const paket = await unduhPaket(db, pelaku, id);
      return bagian === "daftar"
        ? berkasUnduhan(paket.daftarTxt, paket.namaDaftar, "text/plain")
        : berkasUnduhan(paket.rtf, paket.namaBerkas, "application/rtf");
    }
    return ok({ ada: true, blangko: await ambilBlangko(db, pelaku, id) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_SENDIRI_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-sendiri",
    });
  }
}

type Masukan = {
  tindakan?: string;
  id?: string;
  nama?: string;
  jenis?: string;
  teks?: string;
  keputusan?: Array<{ id: string; status: "usulan" | "dikonfirmasi" | "diabaikan"; sasaran?: Record<string, string> }>;
  terimaYakin?: number;
  nomor?: string;
  perkaraId?: string;
  docx?: boolean;
  setuju?: boolean;
  catatan?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const pelaku = await aktor(db, actorUserId);

    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      let formulir: FormData;
      try {
        formulir = await request.formData();
      } catch {
        throw new ApiError(400, "Kirim berkas sebagai multipart/form-data.");
      }
      const berkas = formulir.get("berkas");
      if (!(berkas instanceof File)) throw new ApiError(400, "Berkasnya belum dipilih.");
      if (berkas.size > BATAS_BERKAS_BLANGKO) throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_BERKAS_BLANGKO / 1024 / 1024} MB.`);
      const rincian = await buatDariBerkas(db, pelaku, {
        bita: new Uint8Array(await berkas.arrayBuffer()),
        namaBerkas: berkas.name,
        nama: String(formulir.get("nama") ?? ""),
        jenis: formulir.get("jenis") ?? "",
      });
      return ok({ ok: true, blangko: rincian });
    }

    const masukan = (await request.json()) as Masukan;
    const tindakan = String(masukan.tindakan ?? "");
    const id = String(masukan.id ?? "");

    switch (tindakan) {
      case "buat-teks":
        return ok({ ok: true, blangko: await buatDariTeks(db, pelaku, { nama: masukan.nama, jenis: masukan.jenis, teks: masukan.teks }) });
      case "simpan-isi":
        return ok({ ok: true, blangko: await simpanIsi(db, pelaku, id, { nama: masukan.nama, jenis: masukan.jenis, teks: masukan.teks }) });
      case "keputusan":
        return ok({
          ok: true,
          blangko: await simpanKeputusan(db, pelaku, id, { keputusan: masukan.keputusan, terimaYakin: masukan.terimaYakin }),
        });
      case "pratinjau":
        // Pratinjau membaca data perkara: sama dengan menerbitkan naskah, butuh kemampuan panel.
        await pastikanKapabilitas(db, actorUserId, "panel");
        return ok({ ok: true, pratinjau: await pratinjauBlangko(db, pelaku, id, { nomor: masukan.nomor, perkaraId: masukan.perkaraId, docx: masukan.docx }) });
      case "ekspor-mandiri": {
        const hasil = await eksporKePutusanMandiri(db, pelaku, id);
        return ok({ ok: true, jumlahBagian: hasil.jumlahBagian, blangko: await ambilBlangko(db, pelaku, id) });
      }
      case "ajukan-paket":
        return ok({ ok: true, blangko: await ajukanPaket(db, pelaku, id) });
      case "tarik-paket":
        return ok({ ok: true, blangko: await tarikPaket(db, pelaku, id) });
      case "putuskan-paket":
        return ok({ ok: true, blangko: await putuskanPaket(db, pelaku, id, { setuju: Boolean(masukan.setuju), catatan: masukan.catatan }) });
      case "hapus":
        await hapusBlangko(db, pelaku, id);
        return ok({ ok: true });
      default:
        throw new ApiError(400, "Tindakan tidak dikenali.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_SENDIRI_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-sendiri",
    });
  }
}
