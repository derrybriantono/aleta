import {
  NAMA_STATUS,
  SETELAN_PUTUS_BAWAAN,
  bersihkanSetelanPutus,
  pilihStatusPutusan,
  putuskanPutusOtomatis,
  type KeputusanPutusOtomatis,
  type SetelanPutusOtomatis,
  type StatusPutusOtomatis,
} from "@/lib/putus-otomatis";
import { rekomendasiPutusan } from "@/lib/rekomendasi-blangko";
import { jamPemicuHari, jatuhTempo } from "@/lib/tunda-otomatis";
import { hariLibur as tanggalLibur, petaLiburBerlaku } from "@/lib/hari-libur";
import { msKeWita } from "@/lib/putusan-terjadwal";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { getGatewayStatusPutusan, postGatewayPutusSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { pastikanBolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { buatJadwal, tahapkanBerkas } from "@/server/modules/putusan-terjadwal/layanan";
import { bacaHariLibur } from "@/server/modules/hari-libur/sumber";
import {
  SUMBER_BAWAAN as SUMBER_TUNDA,
  bacaKunci,
  kelilingAktif,
  masukanDariBahan,
  tulisKunci,
  type BahanSidang,
  type SumberTundaOtomatis,
} from "@/server/modules/tunda-otomatis/layanan";
import { catatPutusHari } from "@/server/modules/otomatis-jejak/jejak";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * PUTUS OTOMATIS GUGUR / TIDAK DAPAT DITERIMA (22 Okt 2026)
 * ============================================================================
 *
 * Saklar TERPISAH dari tunda otomatis: bawaan MATI dan mode kering, hanya Super
 * Admin. Aturannya @/lib/putus-otomatis (aturan 7/8 tunda otomatis). Jam pemicu
 * sama: 16.30 WITA, 14.00 pada hari sidang keliling aktif; satu jalan per tanggal.
 *
 *   PAGI (>= 07.00) hari sidang: daftar calon disusun dan disimpan; majelis & PP
 *     mendapat pemberitahuan MENDESAK "akan diputus otomatis pukul 16.30 bila
 *     tidak hadir" (sumber tugas /api/tasks). Tombol "jangan putus otomatis" per
 *     perkara berlaku sampai jam pemicu.
 *   JAM PEMICU: daftar dibekukan; tiap calon:
 *     (a) KETERANGAN PUTUS lewat PENULIS PUTUS yang sudah ada (/sidang/putus-sidang,
 *         sama dengan tombol Putus baris, atas akun PP perkara, jadwal saja - tanpa
 *         perkara_putusan), status gugur / tidak dapat diterima, otomatis: true
 *         (bot membaca ulang: hasil sudah diisi / sudah putus / pihak tercatat
 *         hadir / ikrar / verzet / eksekusi = ditolak), ditulis hari itu juga.
 *     (b) bila sub-pilihan "unggah e-Doc" menyala dan blangko Derry yang pas ada:
 *         putusan disusun dari blangko (bot blangko.isi, mesin yang sama dengan
 *         e-Doc ikrar), DITOLAK bila masih ada isian kosong; lalu dijadwalkan lewat
 *         Jadwalkan Putusan (isi Putusan Akhir + e-Doc putusan + anonimisasi) atas
 *         akun Super Admin yang menyalakan saklar. Tanpa blangko yang pas: hanya
 *         (a) dan majelis diberi tahu.
 *   Mode kering: (a) dikirim kering (rencana bot tanpa menulis), (b) hanya
 *     memeriksa blangko mana yang akan dipakai.
 *
 * Jejak: setelan (siapa, kapan, aturan) + jejak audit portal tiap perubahan
 * saklar; catatan hari menyimpan jalan (pukul berapa, mode, aturan 8 yang
 * berlaku) dan hasil tiap perkara.
 */

const teks = (x: unknown) => String(x ?? "").trim();
export const KUNCI_SETELAN_PUTUS = "sistem:putus-otomatis";
export const kunciHariPutus = (tanggal: string) => `sistem:putus-otomatis:hari:${tanggal}`;
const JAM_PAGI = "07:00";

export type HasilPutusTulis = {
  status: "kering-lolos" | "kering-ditolak" | "tertulis" | "ditolak" | "gagal" | "dilewati";
  pesan: string;
  atasNama?: string;
  pada: string;
};

export type HasilEdoc = {
  status: "kering-blangko" | "dijadwalkan" | "tanpa-blangko" | "blangko-belum-lengkap" | "gagal" | "mati";
  pesan: string;
  blangko?: string;
  pada: string;
};

export type ButirPutusOtomatis = {
  jadwalId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  agenda: string;
  majelis: string;
  panitera: string;
  urutanSidang: number;
  alurPerkaraId: number | null;
  keputusan: KeputusanPutusOtomatis;
  tulis?: HasilPutusTulis;
  edoc?: HasilEdoc;
};

export type CatatanHariPutus = {
  tanggal: string;
  batal: Record<string, { oleh: string; nama: string; pada: string }>;
  pagi: { pada: string; butir: ButirPutusOtomatis[] } | null;
  jalan: { pada: string; pemicu: "jadwal" | "tangan"; oleh: string; mode: "kering" | "tulis"; jam: string; hasilAturan8: StatusPutusOtomatis; unggahEdoc: boolean; galat: string } | null;
  butir: ButirPutusOtomatis[];
};

// ============================================================================
// SETELAN & SIMPANAN
// ============================================================================

export async function bacaSetelanPutus(db: AletaDatabase): Promise<SetelanPutusOtomatis> {
  return bersihkanSetelanPutus((await bacaKunci(db, KUNCI_SETELAN_PUTUS)) ?? SETELAN_PUTUS_BAWAAN);
}

/** Hanya dipanggil rute yang sudah memastikan Super Admin. Tiap perubahan dicatat di jejak audit portal. */
export async function simpanSetelanPutus(
  db: AletaDatabase,
  aktor: { id: string; name?: string | null },
  badan: Record<string, unknown>,
  ip: string
): Promise<SetelanPutusOtomatis> {
  const lama = await bacaSetelanPutus(db);
  const baru = bersihkanSetelanPutus({
    nyala: typeof badan.nyala === "boolean" ? badan.nyala : lama.nyala,
    kering: typeof badan.kering === "boolean" ? badan.kering : lama.kering,
    hasilAturan8: badan.hasilAturan8 === "gugur" || badan.hasilAturan8 === "tidak-dapat-diterima" ? badan.hasilAturan8 : lama.hasilAturan8,
    unggahEdoc: typeof badan.unggahEdoc === "boolean" ? badan.unggahEdoc : lama.unggahEdoc,
    jam: badan.jam ?? lama.jam,
    diubahOleh: teks(aktor.name) || aktor.id,
    diubahOlehId: aktor.id,
    diubahPada: new Date().toISOString(),
    ip: /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip : lama.ip,
  });
  await tulisKunci(db, KUNCI_SETELAN_PUTUS, baru);
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "PUTUS_OTOMATIS_SETELAN",
      entityType: "putus_otomatis",
      entityId: "setelan",
      payload: { lama: { ...lama, ip: undefined }, baru: { ...baru, ip: undefined } },
    });
  } catch {
    /* jejak audit gagal ditulis - setelan tetap tersimpan, jejaknya di setelan itu sendiri */
  }
  return baru;
}

export async function bacaCatatanHariPutus(db: AletaDatabase, tanggal: string): Promise<CatatanHariPutus> {
  const c = await bacaKunci<Partial<CatatanHariPutus>>(db, kunciHariPutus(tanggal));
  return {
    tanggal,
    batal: c?.batal && typeof c.batal === "object" ? c.batal : {},
    pagi: c?.pagi ?? null,
    jalan: c?.jalan ?? null,
    butir: Array.isArray(c?.butir) ? c!.butir! : [],
  };
}

const simpanCatatan = async (db: AletaDatabase, c: CatatanHariPutus) => {
  await tulisKunci(db, kunciHariPutus(c.tanggal), c);
  // U19: jejak terstruktur berdampingan dengan blob; tidak pernah melempar.
  await catatPutusHari(db, c);
};

// ============================================================================
// SUMBER (dapat disuntik untuk uji)
// ============================================================================

export type SumberPutusOtomatis = Pick<SumberTundaOtomatis, "jadwal" | "bahan" | "libur" | "kehadiranRinci"> & {
  statusPutusan(): Promise<Array<{ id: unknown; nama: unknown; dipakai?: unknown }>>;
  tulisPutus(isi: Record<string, unknown>): Promise<{ ok: boolean; data?: Record<string, unknown>; galat?: string }>;
  /** Susun putusan dari blangko + jadwalkan e-Doc. kering = hanya memeriksa blangko. */
  edoc(db: AletaDatabase, b: ButirPutusOtomatis, status: StatusPutusOtomatis, setelan: SetelanPutusOtomatis, kering: boolean): Promise<HasilEdoc>;
};

/** Blangko putusan gugur/NO yang pas untuk perkara itu (rekomendasi blangko Derry). */
export function blangkoUntuk(b: Pick<ButirPutusOtomatis, "jenisPerkara" | "nomorPerkara" | "urutanSidang" | "alurPerkaraId">, status: StatusPutusOtomatis) {
  const r = rekomendasiPutusan(
    {
      jenisPerkara: b.jenisPerkara,
      nomorPerkara: b.nomorPerkara,
      sudahPutus: true,
      statusPutusan: NAMA_STATUS[status],
      urutanSidang: b.urutanSidang,
      dihadiriOleh: 4,
      alurPerkaraId: b.alurPerkaraId,
    },
    ""
  );
  const utama = r.find((x) => x.utama && !x.perkiraan && /gugur|\[no\]|tidak dapat diterima/i.test(x.berkas));
  return utama ? { folder: utama.folder, berkas: utama.berkas } : null;
}

async function edocBawaan(db: AletaDatabase, b: ButirPutusOtomatis, status: StatusPutusOtomatis, setelan: SetelanPutusOtomatis, kering: boolean): Promise<HasilEdoc> {
  const pada = new Date().toISOString();
  const blangko = blangkoUntuk(b, status);
  if (!blangko) return { status: "tanpa-blangko", pesan: "Tidak ada blangko putusan yang pas untuk jenis perkara ini - hanya keterangan putus; majelis menyusun putusannya.", pada };
  const label = `${blangko.folder.replace(/^derry_briantono\//, "")} / ${blangko.berkas}`;
  if (kering) return { status: "kering-blangko", pesan: `Mode kering: putusan akan disusun dari blangko ${label}.`, blangko: label, pada };
  try {
    type Isi = { ok?: boolean; rtfBase64?: string; sebab?: string; kosong?: Array<{ noVar?: string; nama?: string }> };
    const j = await callAletaBotSippBridge<Isi>("blangko.isi", { folder: blangko.folder, berkas: blangko.berkas, perkaraId: b.perkaraId, sidangKe: 0 }, { timeoutMs: 90000 });
    const isi = j.ok ? j.data : null;
    if (!isi || isi.ok === false || !isi.rtfBase64) return { status: "gagal", pesan: `Blangko tidak dapat disusun: ${teks(isi?.sebab) || teks(j.ok ? "" : j.error) || "tidak terbaca"}.`, blangko: label, pada };
    const kosong = Array.isArray(isi.kosong) ? isi.kosong : [];
    if (kosong.length) {
      return {
        status: "blangko-belum-lengkap",
        pesan: `Putusan TIDAK diunggah: isian blangko masih kosong (${kosong.slice(0, 8).map((k) => `#${teks(k.noVar)}# ${teks(k.nama)}`.trim()).join("; ")}). Majelis melengkapinya.`,
        blangko: label,
        pada,
      };
    }
    if (!setelan.diubahOlehId) return { status: "gagal", pesan: "Akun penyala saklar tidak tercatat - jadwal e-Doc tidak dibuat.", blangko: label, pada };
    const pelaku = await pastikanBolehUnggahPutusan(db, setelan.diubahOlehId);
    const tahap = await tahapkanBerkas(db, pelaku, { nama: `${b.nomorPerkara.replace(/\//g, "-")} ${NAMA_STATUS[status]}.rtf`, bita: Buffer.from(isi.rtfBase64, "base64") });
    if (!tahap.ok) return { status: "gagal", pesan: `Berkas putusan ditolak: ${tahap.sebab}`, blangko: label, pada };
    await buatJadwal(db, pelaku, setelan.ip, {
      mulai: msKeWita(Date.now() + 3 * 60 * 1000).slice(0, 16),
      malamBoleh: true,
      catatan: `Putus otomatis ${NAMA_STATUS[status]} - jadwal sidang ${b.jadwalId}`,
      butir: [
        {
          perkaraId: b.perkaraId,
          nomorPerkara: b.nomorPerkara,
          jenisPerkara: b.jenisPerkara,
          berkasId: tahap.berkas.id,
          langkah: { isi: true, putusan: true, anonim: true },
          pilihan: { statusPutusan: NAMA_STATUS[status], verstek: "T" },
        },
      ],
    });
    return { status: "dijadwalkan", pesan: `Putusan disusun dari blangko ${label}; Putusan Akhir, e-Doc putusan dan anonimisasi dijadwalkan lewat Jadwalkan Putusan.`, blangko: label, pada };
  } catch (e) {
    return { status: "gagal", pesan: `E-Doc tidak dijadwalkan: ${teks((e as Error)?.message).slice(0, 200)}`, blangko: label, pada };
  }
}

export const SUMBER_PUTUS_BAWAAN: SumberPutusOtomatis = {
  jadwal: SUMBER_TUNDA.jadwal,
  bahan: SUMBER_TUNDA.bahan,
  libur: SUMBER_TUNDA.libur,
  kehadiranRinci: SUMBER_TUNDA.kehadiranRinci,
  async statusPutusan() {
    const h = await getGatewayStatusPutusan();
    const d = h.ok ? (h.data as { daftar?: unknown }).daftar : null;
    return Array.isArray(d) ? (d as Array<{ id: unknown; nama: unknown; dipakai?: unknown }>) : [];
  },
  async tulisPutus(isi) {
    const h = await postGatewayPutusSidang(isi);
    return h.ok ? { ok: true, data: h.data } : { ok: false, galat: h.error, data: h.badan };
  },
  edoc: edocBawaan,
};

// ============================================================================
// DAFTAR
// ============================================================================

export async function susunDaftarPutus(
  db: AletaDatabase,
  opsi: { tanggal: string; setelan: SetelanPutusOtomatis; sumber?: SumberPutusOtomatis; batal?: CatatanHariPutus["batal"] }
): Promise<{ butir: ButirPutusOtomatis[]; galat: string }> {
  const sumber = opsi.sumber ?? SUMBER_PUTUS_BAWAAN;
  const batal = opsi.batal ?? {};
  const j = await sumber.jadwal(opsi.tanggal);
  if (!j.ok) return { butir: [], galat: `Jadwal sidang tidak terbaca: ${j.galat}` };
  const peta = await sumber.libur(db).catch(() => petaLiburBerlaku());
  const butir: ButirPutusOtomatis[] = [];
  const lihat = new Set<string>();
  for (const b of j.sidang) {
    const id = teks(b.sidangId);
    if (teks(b.tanggalSidang).slice(0, 10) !== opsi.tanggal || !id || lihat.has(id)) continue;
    lihat.add(id);
    // Yang sudah ditunda/diputus/ikrar tidak perlu bahan - bukan sasaran.
    const alasan = teks(b.alasanDitunda);
    if (b.ditunda || b.sudahPutus || b.sidangIkrarTalak || (alasan !== "" && alasan !== "0")) continue;
    let bahan: BahanSidang | null = null;
    try {
      bahan = await sumber.bahan(id);
      if (bahan?.ok && sumber.kehadiranRinci) {
        const rinci = await sumber.kehadiranRinci(teks(b.perkaraId), opsi.tanggal).catch(() => null);
        bahan.hadirRinciPertama = Array.isArray(rinci) ? rinci.some((o) => o.sisi === "pihak_1") : null;
      }
    } catch (e) {
      bahan = { ok: false, alasan: teks((e as Error)?.message) };
    }
    const m = masukanDariBahan(opsi.tanggal, b, bahan, undefined);
    const k = putuskanPutusOtomatis({ ...m, dibatalkan: batal[id] ? { oleh: batal[id].nama || batal[id].oleh, pada: batal[id].pada } : null }, opsi.setelan, peta);
    // Hanya calon putus dan yang dibatalkan petugas yang masuk daftar (yang lain urusan tunda otomatis).
    if (k.jenis === "lewati" && k.sebab !== "dibatalkan-petugas") continue;
    butir.push({
      jadwalId: id,
      perkaraId: teks(b.perkaraId),
      nomorPerkara: m.nomorPerkara,
      jenisPerkara: teks(m.jenisPerkara),
      agenda: m.agenda,
      majelis: teks(b.majelisNama),
      panitera: teks(b.paniteraNama),
      urutanSidang: Array.isArray(m.riwayat) ? m.riwayat.filter((r) => !r.ikrar && r.tanggal <= opsi.tanggal).length : 0,
      alurPerkaraId: m.alurPerkaraId ?? null,
      keputusan: k,
    });
  }
  return { butir, galat: "" };
}

export async function bacaDaftarPutus(db: AletaDatabase, opsi: { tanggal?: string; sumber?: SumberPutusOtomatis; kini?: Date } = {}) {
  const tanggal = opsi.tanggal || waktuPengadilan(opsi.kini).tanggal;
  const setelan = await bacaSetelanPutus(db);
  const keliling = await kelilingAktif(db, tanggal);
  const c = await bacaCatatanHariPutus(db, tanggal);
  const dasar = { tanggal, setelan, jamPemicu: jamPemicuHari(setelan, keliling), kelilingAktif: keliling };
  if (c.jalan) return { ...dasar, tahap: "jalan" as const, jalan: c.jalan, butir: c.butir, galat: c.jalan.galat };
  const d = await susunDaftarPutus(db, { tanggal, setelan, sumber: opsi.sumber, batal: c.batal });
  return { ...dasar, tahap: "pratinjau" as const, jalan: null, butir: d.butir, galat: d.galat };
}

export async function tandaiBatalPutus(db: AletaDatabase, opsi: { tanggal: string; jadwalId: string; oleh: string; nama: string; batal: boolean }) {
  const id = teks(opsi.jadwalId).replace(/\D/g, "");
  if (!id) return { ok: false, pesan: "Nomor jadwal sidang tidak sah." };
  const c = await bacaCatatanHariPutus(db, opsi.tanggal);
  if (c.jalan) return { ok: false, pesan: "Daftar hari ini sudah dijalankan - ubah lewat Jadwal Sidang/SIPP bila perlu." };
  if (opsi.batal) c.batal[id] = { oleh: opsi.oleh, nama: opsi.nama, pada: new Date().toISOString() };
  else delete c.batal[id];
  await simpanCatatan(db, c);
  return { ok: true, pesan: opsi.batal ? "Perkara ini tidak akan diputus otomatis hari ini." : "Perkara ini kembali mengikuti putus otomatis." };
}

// ============================================================================
// JALAN
// ============================================================================

const SIMPAN = globalThis as unknown as { __aletaPutusOtomatis?: { berjalan: Set<string>; detak: NodeJS.Timeout | null } };
const wadah = () => (SIMPAN.__aletaPutusOtomatis ??= { berjalan: new Set(), detak: null });

export async function jalankanPutusOtomatis(
  db: AletaDatabase,
  opsi: { pemicu: "jadwal" | "tangan"; oleh?: string; tanggal?: string; sumber?: SumberPutusOtomatis; kini?: Date } = { pemicu: "jadwal" }
): Promise<CatatanHariPutus> {
  const w = wadah();
  const sumber = opsi.sumber ?? SUMBER_PUTUS_BAWAAN;
  const tanggal = opsi.tanggal || waktuPengadilan(opsi.kini).tanggal;
  const setelan = await bacaSetelanPutus(db);
  const c = await bacaCatatanHariPutus(db, tanggal);
  // Satu jalan per tanggal - 14.00 dan 16.30 tidak pernah menjalankannya dua kali.
  if (c.jalan || w.berjalan.has(tanggal)) return c;
  w.berjalan.add(tanggal);
  try {
    const jam = jamPemicuHari(setelan, await kelilingAktif(db, tanggal));
    c.jalan = { pada: new Date().toISOString(), pemicu: opsi.pemicu, oleh: teks(opsi.oleh) || "Putus otomatis", mode: setelan.kering ? "kering" : "tulis", jam, hasilAturan8: setelan.hasilAturan8, unggahEdoc: setelan.unggahEdoc, galat: "" };
    await simpanCatatan(db, c);
    const d = await susunDaftarPutus(db, { tanggal, setelan, sumber, batal: c.batal });
    c.butir = d.butir;
    c.jalan.galat = d.galat;
    await simpanCatatan(db, c);
    const daftarStatus = await sumber.statusPutusan().catch(() => []);
    for (const b of c.butir) {
      const k = b.keputusan;
      if (k.jenis !== "putus") continue;
      const pada = new Date().toISOString();
      const st = pilihStatusPutusan(daftarStatus, k.status);
      if (!st) {
        b.tulis = { status: "gagal", pesan: `Status putusan "${NAMA_STATUS[k.status]}" tidak dikenal SIPP - tidak ditulis.`, pada };
        continue;
      }
      const r = await sumber
        .tulisPutus({
          jadwalId: b.jadwalId,
          perkaraId: b.perkaraId,
          statusPutusanId: st.id,
          tanggalPutus: tanggal,
          verstek: "T",
          dihadiriOleh: k.kehadiran,
          operator: "putus-otomatis",
          operatorNama: `Putus otomatis ${jam} - saklar oleh ${setelan.diubahOleh || "Super Admin"}`,
          operatorAkunSipp: "",
          ip: setelan.ip,
          kering: setelan.kering,
          otomatis: true,
          tanggalSidangHarap: tanggal,
          // Keputusan 22 Okt: keterangan putus ditulis hari itu juga.
          jamKerja: "sekarang",
        })
        .catch((e): { ok: boolean; data?: Record<string, unknown>; galat?: string } => ({ ok: false, galat: teks((e as Error)?.message) || "ALETA Bot tidak menjawab." }));
      const data = (r.data ?? {}) as Record<string, unknown>;
      const atas = data.atasNama && typeof data.atasNama === "object" ? teks((data.atasNama as Record<string, unknown>).namaLengkap) : "";
      b.tulis = r.ok
        ? { status: setelan.kering ? "kering-lolos" : "tertulis", pesan: setelan.kering ? `Mode kering: keterangan putus ${st.nama} lolos pemeriksaan, TIDAK ditulis.` : `Keterangan putus ${st.nama} tertulis di SIPP.`, atasNama: atas, pada }
        : { status: setelan.kering ? "kering-ditolak" : "ditolak", pesan: teks(r.galat) || "Ditolak.", atasNama: atas, pada };
      if (setelan.unggahEdoc && (setelan.kering || b.tulis.status === "tertulis")) {
        b.edoc = await sumber.edoc(db, b, k.status, setelan, setelan.kering).catch((e) => ({ status: "gagal" as const, pesan: teks((e as Error)?.message), pada }));
      } else if (!setelan.unggahEdoc) {
        b.edoc = { status: "mati", pesan: "Unggah e-Doc dimatikan di setelan - hanya keterangan putus.", pada };
      }
      await simpanCatatan(db, c);
    }
    await simpanCatatan(db, c);
  } catch (e) {
    if (c.jalan) {
      c.jalan.galat = teks((e as Error)?.message).slice(0, 300) || "Putus otomatis gagal.";
      await simpanCatatan(db, c).catch(() => undefined);
    }
  } finally {
    w.berjalan.delete(tanggal);
  }
  return c;
}

/** Detak: pagi hari (>= 07.00) menyusun calon + pemberitahuan; jam pemicu menjalankan. Saklar mati = tidak apa-apa. */
export async function detakPutusOtomatis(db: AletaDatabase, opsi: { kini?: Date; sumber?: SumberPutusOtomatis; env?: Record<string, string | undefined> } = {}) {
  const env = opsi.env ?? process.env;
  if (env.ALETA_PUTUS_OTOMATIS === "0") return null;
  const setelan = await bacaSetelanPutus(db);
  if (!setelan.nyala) return null;
  const { tanggal, jam } = waktuPengadilan(opsi.kini);
  await bacaHariLibur(db).catch(() => undefined);
  if (tanggalLibur(tanggal)) return null;
  const c = await bacaCatatanHariPutus(db, tanggal);
  const pemicu = jamPemicuHari(setelan, await kelilingAktif(db, tanggal));
  if (jatuhTempo(pemicu, jam, Boolean(c.jalan))) return jalankanPutusOtomatis(db, { pemicu: "jadwal", tanggal, sumber: opsi.sumber, kini: opsi.kini });
  if (!c.jalan && !c.pagi && jam.slice(0, 5) >= JAM_PAGI) {
    const d = await susunDaftarPutus(db, { tanggal, setelan, sumber: opsi.sumber, batal: c.batal });
    c.pagi = { pada: new Date().toISOString(), butir: d.butir };
    await simpanCatatan(db, c);
    return c;
  }
  return null;
}

export function mulaiPutusOtomatisBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_PUTUS_OTOMATIS === "0") return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakPutusOtomatis(await getDb(), { env });
    } catch (e) {
      console.error("[PUTUS OTOMATIS] detak gagal:", e);
    }
  };
  w.detak = setInterval(() => void detak(), 5 * 60 * 1000);
  setTimeout(() => void detak(), 2 * 60 * 1000);
}

// ============================================================================
// PEMBERITAHUAN
// ============================================================================

export async function pemberitahuanPutusOtomatis(
  db: AletaDatabase,
  opsi: { nama: string; lihatSemua: boolean; cocokNama: (nama: string, baris: string) => boolean; kini?: Date }
): Promise<Array<{ id: string; judul: string; uraian: string; waktu: string; penting: boolean }>> {
  const tanggal = waktuPengadilan(opsi.kini).tanggal;
  const setelan = await bacaSetelanPutus(db);
  const c = await bacaCatatanHariPutus(db, tanggal);
  const milik = (b: ButirPutusOtomatis) => opsi.lihatSemua || opsi.cocokNama(opsi.nama, b.majelis) || opsi.cocokNama(opsi.nama, b.panitera);
  const hasil: Array<{ id: string; judul: string; uraian: string; waktu: string; penting: boolean }> = [];
  const jam = jamPemicuHari(setelan, await kelilingAktif(db, tanggal)).replace(":", ".");
  if (c.jalan) {
    for (const b of c.butir.filter(milik)) {
      if (b.keputusan.jenis !== "putus") continue;
      hasil.push({
        id: `putus-otomatis:${tanggal}:${b.jadwalId}`,
        judul: `${c.jalan.mode === "kering" ? "Mode kering - akan diputus" : "Diputus otomatis"} ${NAMA_STATUS[b.keputusan.status]}: ${b.nomorPerkara}`,
        uraian: [b.tulis?.pesan, b.edoc?.pesan].filter(Boolean).join(" "),
        waktu: c.jalan.pada,
        penting: true,
      });
    }
  } else if (c.pagi && setelan.nyala) {
    for (const b of c.pagi.butir.filter(milik)) {
      if (b.keputusan.jenis !== "putus" || c.batal[b.jadwalId]) continue;
      hasil.push({
        id: `putus-otomatis-pagi:${tanggal}:${b.jadwalId}`,
        judul: `Akan diputus otomatis pukul ${jam} bila tidak hadir: ${b.nomorPerkara} (${NAMA_STATUS[b.keputusan.status]})`,
        uraian: `${b.keputusan.penjelasan} Batalkan lewat Jadwal Sidang > Putus otomatis bila tidak dikehendaki.`,
        waktu: c.pagi.pada,
        penting: true,
      });
    }
  }
  return hasil.slice(0, 30);
}
