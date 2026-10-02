import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  daftarCap,
  JENIS_PENETAPAN,
  type JenisPenetapan,
  kalimatEdoc,
  petaEdoc,
  PERUNTUKAN_UNTUK_JENIS,
  SEBUTAN_PENANDATANGAN,
  TAUTAN_BERKAS_TANDA_TANGAN,
} from "@/server/modules/aleta-ecourt/penetapan-edoc";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PETA EDOC PENETAPAN (butir 17, K6): PMH/PPP/PJS/PHS mana yang TERSEDIA
 * dari ABT untuk satu perkara - alamat blangko disetel, penetapannya sudah ada
 * di SIPP, cap untuk peruntukannya ada - beserta sumber TTE dan cap. Tidak
 * menulis apa pun. Bot lama (rute belum ada) = 404 "belum tersedia di server".
 *
 * Bentuk jawaban (dibaca s2BacaPetaEdoc panel SIPP):
 *   jenis: [{ jenis, tersedia, sebab, nama, penandatangan, sudahDiunggah, ... }]
 *   tte:   { nama, sumber, elektronik }
 *   cap:   { ada, nama, sumber }
 *   tautanCap, capPerJenis
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const nomor = String(request.nextUrl.searchParams.get("nomor") ?? "").trim();
    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") ?? "").trim();
    if (!nomor && !perkaraId) {
      return ok({ ok: false, alasan: "nomor_kosong", pesan: "Nomor perkara belum disebut.", sebab: "Nomor perkara belum disebut." });
    }

    const hasil = await petaEdoc({ nomor, perkaraId });
    if (!hasil.ok) {
      const pesan = kalimatEdoc(hasil.alasan);
      return ok(
        { ok: false, alasan: hasil.alasan, pesan, sebab: pesan, belumTersedia: Boolean(hasil.tidakAda) },
        hasil.tidakAda ? { status: 404 } : undefined
      );
    }

    const caps = await daftarCap(db, { hanyaAktif: true });
    const capUntuk = (j: JenisPenetapan) => {
      const cocok = caps.filter((c) => c.peruntukan === PERUNTUKAN_UNTUK_JENIS[j]);
      return cocok.length ? cocok : caps.filter((c) => c.peruntukan === "umum");
    };
    const capPerJenis = Object.fromEntries(
      JENIS_PENETAPAN.map((j) => [j, capUntuk(j).map((c) => ({ id: c.id, nama: c.nama, peruntukan: c.peruntukan }))])
    );

    const data = hasil.data;
    const tteElektronik = Boolean(data.tteElektronik);
    const jenis = (data.jenis ?? []).map((j) => {
      const capJenis = capUntuk(j.jenis);
      const alasan = j.tersedia && !capJenis.length ? "cap_belum_ada" : j.alasan;
      const tersedia = Boolean(j.tersedia && capJenis.length);
      return {
        ...j,
        jenis: j.jenis,
        kode: j.jenis.toUpperCase(),
        tersedia,
        alasan,
        sebab: tersedia ? "" : kalimatEdoc(alasan),
        nama: `${j.blangko.menu} · ${j.blangko.berkas}${j.blangko.berkas.startsWith("@ 0") ? ` (bagian ${j.blangko.bagianGabungan})` : ""}`,
        judul: j.judul,
        penandatangan: SEBUTAN_PENANDATANGAN[j.penandatangan] ?? j.penandatangan,
        penandatanganKode: j.penandatangan,
        cap: capJenis[0] ? { ada: true, nama: capJenis[0].nama } : { ada: false, nama: "" },
      };
    });
    const namaCap = [...new Set(jenis.map((j) => j.cap.nama).filter(Boolean))];

    return ok({
      ok: Boolean(data.ok),
      alasan: data.alasan ?? "",
      pesan: data.ok ? "" : kalimatEdoc(data.alasan),
      perkara: data.perkara,
      jenis,
      tte: tteElektronik
        ? {
            nama: "TTE elektronik pejabat penanda tangan (passphrase diketik tiap kali)",
            sumber: "penyedia TTE yang disetel di server ALETA",
            elektronik: true,
          }
        : {
            nama: "gambar tanda tangan pejabat yang sudah disahkan (TTE elektronik belum tersambung - passphrase tidak dipakai)",
            sumber: "ALETA e-Court > Berkas tanda tangan",
            elektronik: false,
          },
      cap: {
        ada: namaCap.length > 0,
        nama: namaCap.join(", "),
        sumber: "ALETA e-Court > Berkas tanda tangan > Cap pengadilan",
      },
      tautanCap: TAUTAN_BERKAS_TANDA_TANGAN,
      capPerJenis,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENETAPAN_EDOC_PETA_FAILED",
      feature: "aleta_ecourt",
      entityId: "penetapan-edoc-peta",
    });
  }
}
