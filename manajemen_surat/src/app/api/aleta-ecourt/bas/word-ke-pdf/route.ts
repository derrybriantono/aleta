import { type NextRequest } from "next/server";

import { ukuranUntukBot } from "@/lib/ukuran-ttd-cap";
import { getDatabase } from "@/server/db/client";
import { ambilGambarTandaTangan, getGatewayTandaTangan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { BATAS_WORD_PDF, ubahKePdfLewatBot, wordKePdfBas } from "@/server/modules/aleta-ecourt/bas-word-pdf";
import { ukuranTtdCapBerlaku } from "@/server/modules/aleta-ecourt/ukuran-ttd-cap";
import { requireActorUser } from "@/server/modules/organization/service";
import { bacaOpsiBukti, peringatanZcross, sesuaikanZcrossOtomatis } from "@/server/modules/aleta-ecourt/zcross/pakai";
import { bacaKonteksBas, catatRunut, pasangRunut, type HasilPasangRunut } from "@/server/modules/aleta-ecourt/bas-halaman/layanan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * BAS dari Word ke PDF bertanda tangan scan (30 Okt 2026) - untuk jendela e-Doc BAS di SIPP, yang hanya menerima PDF.
 *
 *   POST multipart: berkas (RTF/DOCX/DOC, <= 20 MB), ttd ("0" = tanpa tanda tangan; bawaan ya)
 *   -> { pdfBase64, namaBerkas, bentukAsal, blokTtd, penandatangan[], peringatan[] }
 *
 * Hanya menghitung: tidak ada yang disimpan dan tidak ada tulisan ke SIPP/ABT (ekstensi yang menaruh PDF di kotak berkas SIPP,
 * SIPP sendiri yang mengunggah). Cukup akun yang MASUK - sama dengan konversi-naskah; hak atas gambar tanda tangan ditegakkan
 * di modules/aleta-ecourt/bas-word-pdf.ts (admin: semua yang sah; lainnya: milik sendiri).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await requireActorUser(db, actorUserId);

    let formulir: FormData;
    try {
      formulir = await request.formData();
    } catch {
      throw new ApiError(400, "Kirim multipart/form-data dengan ruas berkas.");
    }
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) throw new ApiError(400, "Berkasnya belum dipilih.");
    // Ukuran diperiksa SEBELUM dibaca ke memori.
    if (berkas.size > BATAS_WORD_PDF) throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_WORD_PDF / 1024 / 1024} MB.`);
    const denganTtd = String(formulir.get("ttd") ?? "1") !== "0";

    // Admin (kapabilitas "blangko-abt") boleh memasang tanda tangan siapa pun yang sah; akun lain hanya miliknya sendiri.
    let bolehSemuaTtd = true;
    try {
      await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    } catch (galat) {
      if (!(galat instanceof ApiError) || galat.status !== 403) throw galat;
      bolehSemuaTtd = false;
    }

    // 1 Nov 2026 (keputusan 71): nomor halaman BAS RUNUT. Perkara & sidang dari ruas perkaraId/sidangId bila dikirim; selainnya dikenali dari
    // naskah (nomor perkara + tanggal sidang). Halaman awal dipasang sebelum Z; halaman PDF akhir dicatat sesudah PDF jadi.
    const konteksRunut =
      bacaKonteksBas({ perkaraId: formulir.get("perkaraId"), nomorPerkara: formulir.get("nomorPerkara"), sidangId: formulir.get("sidangId"), tanggalSidang: formulir.get("tanggalSidang") }) ?? {};
    let runutPasang: HasilPasangRunut | null = null;
    let laporanZ: Awaited<ReturnType<typeof sesuaikanZcrossOtomatis>>["laporan"] | null = null;

    const hasil = await wordKePdfBas(
      {
        bita: new Uint8Array(await berkas.arrayBuffer()),
        namaBerkas: berkas.name,
        denganTtd,
        akun: { id: String(aktor.id), nama: String(aktor.name ?? "") },
        bolehSemuaTtd,
        // jumlah halaman bukti dari panel / berkas bukti; kosong = dihitung dari naskah, 1 halaman per bukti
        zcross: bacaOpsiBukti(formulir.get("jumlahBukti"), formulir.get("halamanBukti")),
      },
      {
        ubahKePdf: ubahKePdfLewatBot,
        // Z cross otomatis tiap unggah (tanpa tombol): garis Z, tanggal, ganti halaman, nomor halaman bagian berikutnya
        sesuaikanZ: async (bita, bentuk, opsi) => {
          runutPasang = db ? await pasangRunut(db, bita, bentuk, konteksRunut) : null;
          // DOC lama diubah ke DOCX oleh pasangRunut (keputusan 87); bentuk ikut berganti
          const bentukZ = runutPasang ? runutPasang.bentuk : bentuk;
          const r = await sesuaikanZcrossOtomatis(runutPasang ? runutPasang.bita : bita, bentukZ, { ...opsi, ...(runutPasang?.opsiZ ?? {}) });
          const l = r.laporan;
          laporanZ = l;
          return {
            bita: r.bita,
            peringatan: [...(runutPasang?.peringatan ?? []), ...peringatanZcross(l)],
            ringkas: { diubah: l.diubah, halamanZ: l.halamanTampilZ, jumlahHalamanBukti: l.jumlahHalamanBukti, nomorBagianBerikut: l.nomorBagianBerikut, bawaan: l.jumlahHalamanBuktiBawaan },
          };
        },
        daftarTtdSah: async () => {
          const r = (await getGatewayTandaTangan(true)) as { ok?: boolean; baris?: Array<Record<string, unknown>> } | null;
          if (!r || r.ok === false) throw new ApiError(502, "Daftar tanda tangan belum dapat dibaca.");
          return (r.baris ?? [])
            .filter((b) => b && b.disahkan !== false)
            .map((b) => ({
              id: Number(b.id),
              namaPejabat: String(b.namaPejabat ?? ""),
              disahkan: true,
              penggunaId: String(b.penggunaId ?? ""),
              disahkanPada: String(b.disahkanPada ?? ""),
            }));
        },
        gambarTtd: async (id) => {
          const respons = await ambilGambarTandaTangan(id);
          if (!respons.ok) return null;
          return new Uint8Array(await respons.arrayBuffer());
        },
        atur: ukuranUntukBot(await ukuranTtdCapBerlaku(db)),
      }
    );

    const pasang = runutPasang as HasilPasangRunut | null;
    let runut: { awal: number; akhir: number } | undefined;
    if (pasang?.rencana && db) {
      const c = await catatRunut(db, pasang.rencana, { pdf: hasil.pdf, z: laporanZ, sumber: "unggah", olehId: String(actorUserId ?? "") });
      runut = { awal: pasang.rencana.awal, akhir: c?.akhir ?? 0 };
      if (c?.peringatan.length) hasil.peringatan.push(...c.peringatan);
    }

    return ok({
      pdfBase64: Buffer.from(hasil.pdf).toString("base64"),
      byte: hasil.pdf.length,
      namaBerkas: hasil.namaBerkas,
      bentukAsal: hasil.bentukAsal,
      blokTtd: hasil.blokTtd,
      penandatangan: hasil.penandatangan,
      peringatan: hasil.peringatan,
      ...(hasil.zcross ? { zcross: hasil.zcross } : {}),
      ...(runut ? { runut } : {}),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_WORD_PDF_GAGAL",
      feature: "aleta_ecourt",
      entityId: "bas-word-ke-pdf",
    });
  }
}
