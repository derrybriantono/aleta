import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  ambilBerkasGateway,
  ambilBerkasSippGateway,
  getGatewayArsipRincian,
  getGatewayRincianSidang,
  type JenisBerkasSipp,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { susunZip, type BerkasZip } from "@/server/shared/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Seluruh berkas satu perkara - SIPP dan e-Court - dalam satu ZIP.
 *
 * ============================================================================
 * KENAPA DIPERLUKAN
 * ============================================================================
 *
 * Majelis yang menyiapkan sidang memerlukan SELURUH berkas perkara, bukan satu
 * per satu. Satu perkara dapat memuat belasan dokumen, dan menekan tombol unduh
 * belasan kali - lalu mencari belasan berkas di folder Downloads yang namanya
 * berdekatan - adalah pekerjaan yang tidak perlu ada.
 *
 * ============================================================================
 * DUA SUMBER, DAN SAMPAI 23 SEPTEMBER 2026 HANYA SATU YANG TERBACA
 * ============================================================================
 *
 * Rute ini dulu membaca arsip e-Court saja. Perkara yang tidak pernah lewat
 * e-Court dijawab 404 "tidak_ada_dokumen" - padahal 41 relaas dan 8 berita
 * acara sidangnya tersimpan rapi di cakram SIPP. Terukur di sipp_donggala:
 * gugatan tersimpan pada 10.119 dari 10.120 perkara, relaas 14.212 dari
 * 14.495, resi pos 8.351, BAS 15.248, putusan 9.903 dari 9.993.
 *
 * Sekarang keduanya dikemas, berkelompok menurut jenisnya:
 *
 *   01 Gugatan/     surat gugatan atau permohonan
 *   02 Relaas/      relaas panggilan, urut tanggal; resi pos di subfoldernya
 *   03 BAS/         berita acara sidang, urut sidang keberapa
 *   04 Putusan/     putusan dan salinan anonimnya
 *   05 Lampiran/    dokumen lain yang dicatat SIPP
 *   06 e-Court/     jawaban, replik, duplik, kesimpulan, alat bukti
 *
 * ============================================================================
 * ADA BATASNYA, DAN BATASNYA DISEBUTKAN
 * ============================================================================
 *
 * ZIP disusun di memori. Perkara dengan berkas sangat besar dapat menghabiskan
 * memori portal dan menjatuhkannya bagi SELURUH pengguna - bukan hanya bagi yang
 * menekan tombolnya. Karena itu ada batas jumlah dan batas ukuran, dan berkas
 * yang tidak masuk DISEBUTKAN di dalam ZIP-nya sendiri lewat berkas
 * KETERANGAN.txt - bukan dihilangkan diam-diam.
 *
 * ============================================================================
 * BERKAS DIAMBIL DARI ARSIP, BUKAN DARI e-COURT
 * ============================================================================
 *
 * Yang dikemas adalah berkas yang SUDAH tersimpan di server. Rute ini tidak
 * pernah menyentuh e-Court - menarik belasan berkas dari Mahkamah Agung karena
 * satu orang menekan satu tombol bukan perilaku yang pantas.
 */

/**
 * Batas jumlah berkas dalam satu ZIP.
 *
 * Dinaikkan dari 60 ke 150 pada 23 September 2026, sesudah dua sumber digabung.
 * Terukur di sipp_donggala: hanya SATU perkara yang relaas + resi + BAS-nya
 * melewati 60 - 273/Pdt.G/2026/PA.Dgl, dengan 41 relaas dan 8 sidang. Batas
 * lama akan memotongnya justru pada perkara yang paling membutuhkan arsip utuh.
 */
const BATAS_BERKAS = 150;

/** Batas jumlah byte seluruh isi ZIP sebelum dipadatkan. */
const BATAS_TOTAL_BYTE = 200 * 1024 * 1024;

/**
 * Batas waktu menunggu SATU berkas.
 *
 * ambilBerkasSippGateway memakai fetch polos tanpa batas waktu. Satu berkas
 * yang menggantung - dan di peladen ini ada satu inode XFS rusak yang membuat
 * pembacaan menggantung dengan EUCLEAN - akan menggantungkan seluruh
 * permintaan, bukan hanya berkas itu.
 */
const BATAS_SATU_BERKAS_MS = Number(process.env.ALETA_ZIP_TIMEOUT_BERKAS_MS || 30_000);

/** Membersihkan judul dokumen menjadi nama berkas yang aman di semua sistem. */
function namaAman(teks: string, cadangan: string) {
  const bersih = String(teks || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return bersih || cadangan;
}

/** "01", "02", ... - supaya urutannya bertahan di penjelajah berkas mana pun. */
function duaAngka(n: number) {
  return String(n).padStart(2, "0");
}

/** Ekstensi dari nama berkas yang tersimpan SIPP; pdf bila tidak terbaca. */
function ekstensiDari(nama: string, cadangan = "pdf") {
  const cocok = /\.([a-z0-9]{2,5})$/i.exec(String(nama || "").trim());
  return cocok ? cocok[1].toLowerCase() : cadangan;
}

/** Satu baris pada DAFTAR ISI.txt. */
type BarisDaftar = {
  nama: string;
  jenis: string;
  tanggal: string;
  asal: string;
  byte: number;
};

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "berkas");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) {
      return Response.json({ ok: false, alasan: "nomor_perkara_kosong" }, { status: 400 });
    }

    const sumberMinta = String(request.nextUrl.searchParams.get("sumber") || "semua").toLowerCase();
    const sumber = sumberMinta === "ecourt" || sumberMinta === "sipp" ? sumberMinta : "semua";
    const ambilEcourt = sumber !== "sipp";
    const ambilSipp = sumber !== "ecourt";

    const isiZip: BerkasZip[] = [];
    const daftar: BarisDaftar[] = [];
    const dilewati: string[] = [];
    let totalByte = 0;

    /**
     * Menaruh satu berkas ke dalam ZIP, atau menyebutkan sebab ia tidak masuk.
     *
     * Seluruh pemeriksaan batas terkumpul di sini supaya tidak ada satu jalur
     * pun yang melewatkannya - dan supaya tiap yang dilewati tercatat SEKALI,
     * bukan sekali per bentuk berkas seperti dulu.
     */
    const taruh = (
      nama: string,
      isi: Buffer,
      keterangan: { jenis: string; tanggal: string; asal: string }
    ): boolean => {
      if (isi.byteLength === 0) {
        dilewati.push(`${nama}: berkasnya kosong`);
        return false;
      }
      if (isiZip.length >= BATAS_BERKAS) {
        dilewati.push(`${nama}: melewati batas ${BATAS_BERKAS} berkas`);
        return false;
      }
      if (totalByte + isi.byteLength > BATAS_TOTAL_BYTE) {
        dilewati.push(`${nama}: melewati batas ukuran ZIP`);
        return false;
      }
      isiZip.push({ nama, isi });
      daftar.push({ nama, byte: isi.byteLength, ...keterangan });
      totalByte += isi.byteLength;
      return true;
    };

    /** Menarik satu berkas SIPP, dengan batas waktu sendiri. */
    const tarikSipp = async (jenis: JenisBerkasSipp, id: string): Promise<Buffer | null> => {
      const pembatal = new AbortController();
      const jam = setTimeout(() => pembatal.abort(), BATAS_SATU_BERKAS_MS);
      try {
        const respons = await ambilBerkasSippGateway(jenis, id, pembatal.signal);
        if (!respons.ok) {
          dilewati.push(`${jenis} #${id}: HTTP ${respons.status}`);
          return null;
        }
        return Buffer.from(await respons.arrayBuffer());
      } catch (galat) {
        // Satu berkas yang tidak terbaca tidak menggagalkan seluruh ZIP - dan
        // di peladen ini ada satu inode XFS rusak yang memang begitu.
        dilewati.push(`${jenis} #${id}: ${String((galat as Error)?.message || galat).slice(0, 120)}`);
        return null;
      } finally {
        clearTimeout(jam);
      }
    };

    // ========================================================================
    // SUMBER 1 - BERKAS YANG TERSIMPAN DI SIPP
    // ========================================================================
    let jumlahSippTercatat = 0;
    if (ambilSipp) {
      const sidang = await getGatewayRincianSidang(nomor, "");
      if (!sidang.ok) {
        dilewati.push(`Berkas SIPP: ${sidang.error || "tidak terbaca"}`);
      } else if (!sidang.data.ok) {
        dilewati.push(`Berkas SIPP: ${sidang.data.alasan || "tidak terbaca"}`);
      } else {
        const r = sidang.data;
        const perkaraId = String(r.perkaraId || "");

        // 01 Gugatan - berkas yang paling sering dicari, dan tempatnya bukan
        // perkara_dokumen melainkan kolom petitum_dok pada tabel perkara.
        if (r.petitum?.ada && perkaraId) {
          jumlahSippTercatat += 1;
          const isi = await tarikSipp("petitum", perkaraId);
          if (isi) {
            taruh(`01 Gugatan/01 - Surat Gugatan atau Permohonan.${ekstensiDari(r.petitum.berkas, "rtf")}`, isi, {
              jenis: "Gugatan/Permohonan",
              tanggal: "",
              asal: "perkara.petitum_dok",
            });
          }
        }

        // 02 Relaas - urut tanggal panggilan, sebab urutan itulah yang
        // dibaca ketika kepatutan panggilan dipersoalkan.
        const relaas = [...(r.relaas ?? [])].sort((a, b) =>
          String(a.tanggalRelaas || "").localeCompare(String(b.tanggalRelaas || "")) ||
          String(a.id).localeCompare(String(b.id))
        );
        let nomorRelaas = 0;
        let nomorResi = 0;
        for (const baris of relaas) {
          if (baris.adaDokumen) {
            jumlahSippTercatat += 1;
            nomorRelaas += 1;
            const isi = await tarikSipp("relaas", String(baris.id));
            if (isi) {
              const judul = namaAman(
                `${baris.tanggalRelaas || "tanpa tanggal"} - ${baris.peran || "pihak"} - ${baris.namaPihak || ""}`,
                `relaas-${baris.id}`
              );
              taruh(`02 Relaas/${duaAngka(nomorRelaas)} - ${judul}.pdf`, isi, {
                jenis: "Relaas panggilan",
                tanggal: baris.tanggalRelaas || "",
                asal: "perkara_pelaksanaan_relaas.doc_relaas",
              });
            }
          }
          if (baris.adaResi) {
            jumlahSippTercatat += 1;
            nomorResi += 1;
            const isi = await tarikSipp("resi", String(baris.id));
            if (isi) {
              const judul = namaAman(
                `${baris.tanggalKirimPos || baris.tanggalRelaas || "tanpa tanggal"} - ${baris.namaPihak || ""}`,
                `resi-${baris.id}`
              );
              taruh(`02 Relaas/Resi pos/${duaAngka(nomorResi)} - ${judul}.pdf`, isi, {
                jenis: "Resi pos",
                tanggal: baris.tanggalKirimPos || "",
                asal: "perkara_pelaksanaan_relaas.doc_resi",
              });
            }
          }
        }

        // 03 BAS - urut sidang keberapa, bukan urutan baris yang kebetulan
        // terbaca lebih dulu. Perkara yang sidangnya pernah dijadwalkan ulang
        // menyimpan barisnya tidak berurutan di SIPP.
        const jadwal = [...(r.jadwalPerkara ?? [])].sort(
          (a, b) =>
            (Number(a.urutanSidang) || 0) - (Number(b.urutanSidang) || 0) ||
            String(a.tanggalSidang || "").localeCompare(String(b.tanggalSidang || ""))
        );
        let nomorBas = 0;
        for (const s of jadwal) {
          if (!s.adaBas) continue;
          jumlahSippTercatat += 1;
          nomorBas += 1;
          const isi = await tarikSipp("bas", String(s.sidangId));
          if (isi) {
            const judul = namaAman(
              `Sidang ke-${s.urutanSidang || nomorBas} - ${s.tanggalSidang || ""} - ${s.agenda || ""}`,
              `bas-${s.sidangId}`
            );
            taruh(`03 BAS/${duaAngka(nomorBas)} - ${judul}.rtf`, isi, {
              jenis: "Berita acara sidang",
              tanggal: s.tanggalSidang || "",
              asal: "perkara_jadwal_sidang.edoc_bas",
            });
          }
        }

        // 04 Putusan dan salinan anonimnya.
        if (r.putusan?.adaBerkasPutusan && perkaraId) {
          jumlahSippTercatat += 1;
          const isi = await tarikSipp("putusan", perkaraId);
          if (isi) {
            taruh("04 Putusan/01 - Putusan.rtf", isi, {
              jenis: "Putusan",
              tanggal: r.putusan.tanggalPutusan || "",
              asal: "perkara_putusan.amar_putusan_dok",
            });
          }
        }
        if (r.putusan?.adaBerkasAnonim && perkaraId) {
          jumlahSippTercatat += 1;
          const isi = await tarikSipp("putusan-anonim", perkaraId);
          if (isi) {
            taruh("04 Putusan/02 - Putusan anonimisasi.rtf", isi, {
              jenis: "Putusan anonimisasi",
              tanggal: r.putusan.tanggalPutusan || "",
              asal: "perkara_putusan.amar_putusan_anonimisasi_dok",
            });
          }
        }

        // 05 Lampiran lain. Kosong di satker ini - perkara_dokumen nol baris
        // dari 10.120 perkara - dan kekosongan itu bukan tanda kodenya rusak.
        let nomorLampiran = 0;
        for (const d of r.dokumenSipp ?? []) {
          jumlahSippTercatat += 1;
          nomorLampiran += 1;
          const isi = await tarikSipp("dokumen", String(d.id));
          if (!isi) continue;
          const judul = namaAman(d.namaDokumen || d.namaFile, `lampiran-${d.id}`);
          taruh(`05 Lampiran/${duaAngka(nomorLampiran)} - ${judul}.${ekstensiDari(d.namaFile)}`, isi, {
            jenis: "Lampiran",
            tanggal: "",
            asal: "perkara_dokumen.lokasi_file",
          });
        }
      }
    }

    // ========================================================================
    // SUMBER 2 - ARSIP e-COURT
    // ========================================================================
    let jumlahEcourtTercatat = 0;
    if (ambilEcourt) {
      const rincian = await getGatewayArsipRincian(nomor);
      if (!rincian.ok) {
        dilewati.push(`Arsip e-Court: ${rincian.error || "tidak terbaca"}`);
      } else {
        const dokumen = rincian.data?.dokumen ?? [];
        jumlahEcourtTercatat = dokumen.length;
        let urutan = 0;
        for (const item of dokumen) {
          const format: Array<"pdf" | "word"> = [];
          if (item.adaPdf) format.push("pdf");
          if (item.adaWord) format.push("word");
          if (format.length === 0) {
            dilewati.push(`${item.judulDokumen || item.documentKey}: berkasnya belum tersimpan`);
            continue;
          }

          urutan += 1;
          for (const bentuk of format) {
            const respons = await ambilBerkasGateway(item.documentKey, bentuk);
            if (!respons.ok) {
              // Satu berkas gagal tidak menggagalkan seluruh ZIP: yang lain
              // tetap berguna, dan yang gagal disebutkan namanya.
              dilewati.push(
                `${item.judulDokumen || item.documentKey} (${bentuk}): HTTP ${respons.status}`
              );
              continue;
            }
            const isi = Buffer.from(await respons.arrayBuffer());
            const ekstensi = bentuk === "word" ? "docx" : "pdf";
            const judul = namaAman(item.judulDokumen, item.documentKey);
            taruh(`06 e-Court/${duaAngka(urutan)} - ${judul}.${ekstensi}`, isi, {
              jenis: "Dokumen e-Court",
              tanggal: String(item.tanggalSidang || item.diunggahPada || "").slice(0, 10),
              asal: "aleta_bot_ecourt_files",
            });
          }
        }
      }
    }

    if (isiZip.length === 0) {
      return Response.json(
        { ok: false, alasan: "tidak_ada_berkas_tersimpan", keterangan: dilewati.slice(0, 20) },
        { status: 404 }
      );
    }

    // ========================================================================
    // DAFTAR ISI - yang dibaca lebih dulu saat minutasi dan banding
    // ========================================================================
    const lebarNama = Math.min(78, Math.max(...daftar.map((b) => b.nama.length), 20));
    const daftarIsi = [
      `DAFTAR ISI - perkara ${nomor}`,
      `Disusun ${new Date().toISOString()}`,
      "",
      `${"BERKAS".padEnd(lebarNama)}  ${"JENIS".padEnd(22)}  ${"TANGGAL".padEnd(10)}  ASAL`,
      `${"-".repeat(lebarNama)}  ${"-".repeat(22)}  ${"-".repeat(10)}  ----`,
      ...daftar.map(
        (b) =>
          `${b.nama.padEnd(lebarNama)}  ${b.jenis.padEnd(22)}  ${(b.tanggal || "-").padEnd(10)}  ${b.asal}`
      ),
      "",
      `Jumlah berkas: ${daftar.length}`,
      `Jumlah byte  : ${totalByte.toLocaleString("id-ID")}`,
    ].join("\r\n");
    isiZip.push({ nama: "DAFTAR ISI.txt", isi: Buffer.from(daftarIsi, "utf8") });

    // Keterangan SELALU ikut, juga ketika tidak ada yang dilewati - penerima
    // ZIP perlu tahu berapa yang seharusnya ada, bukan hanya berapa yang ada.
    const keterangan = [
      `Arsip berkas perkara ${nomor}`,
      `Disusun ${new Date().toISOString()}`,
      `Sumber yang diminta: ${sumber}`,
      `Berkas dalam arsip ini: ${daftar.length}`,
      `Berkas SIPP yang tercatat: ${jumlahSippTercatat}`,
      `Dokumen e-Court yang tercatat: ${jumlahEcourtTercatat}`,
      "",
      dilewati.length > 0 ? "TIDAK IKUT DIKEMAS:" : "Seluruh berkas yang tersimpan ikut dikemas.",
      ...dilewati.map((baris) => `- ${baris}`),
      "",
      "Berkas e-Court yang belum tersimpan dapat ditarik dari menu Kendali Berkas di ALETA.",
      "Berkas SIPP yang tidak terbaca berarti berkasnya tidak ada di cakram peladen,",
      "walaupun barisnya tercatat di basis data.",
      "",
      "PERHATIAN: arsip ini memuat identitas para pihak, alamat pada resi pos, dan",
      "putusan yang belum dianonimkan. Perlakukan sebagaimana berkas perkara asli.",
    ].join("\r\n");
    isiZip.push({ nama: "KETERANGAN.txt", isi: Buffer.from(keterangan, "utf8") });

    const zip = susunZip(isiZip);
    const awalan = sumber === "ecourt" ? "ecourt" : "berkas";
    const namaZip = `${awalan}-${namaAman(nomor, "perkara").replace(/[^\w.-]+/g, "-")}.zip`;

    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(namaZip)}"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_BERKAS_ZIP_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
