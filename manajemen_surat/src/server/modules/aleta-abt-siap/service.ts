import { GOLONGAN_ALUR, susunDaftarSiap, type ButirSiap, type BlangkoSaran, type PeranAlur } from "@/lib/aleta-abt-siap";
import { folderArsip, periksaTahapan, labelJenis, labelTahapan, type TingkatHak } from "@/lib/aleta-abt-hak-folder";
import { idBlangkoSah } from "@/lib/id-blangko-abt";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { bacaKeadaanHakFolder, putusanHakFolder } from "@/server/modules/aleta-abt-alur/hak-folder";
import { susunNaskah } from "@/server/modules/aleta-abt-cetak/naskah";
import { getGatewayJadwalSidangSinggah } from "@/server/modules/aleta-bot/jadwal-sidang-singgah";
import { ApiError } from "@/server/shared/errors";

/**
 * "Siap diperiksa" (5 Nov 2026, Tahap 6): daftar pekerjaan per peran dari jadwal sidang, dengan blangko yang disarankan.
 * HANYA MEMBACA (jadwal lewat jalur yang sudah ada, pustaka ALETA, hak folder). Tidak ada tulisan ke SIPP/ABT/e-Court.
 * Yang memanggil (rute) memastikan Super Admin; berkas ini tidak menilai akun.
 */

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
/** Panitera menagih perkara yang sudah diputus pada tiga pekan terakhir; peran lain hanya sidang pada tanggal yang dipilih. */
const MUNDUR_PANITERA_HARI = 21;

export type SaranSiap = BlangkoSaran & {
  berkasId: string;
  diPustaka: boolean;
  tingkatHak: TingkatHak | "belum-berlaku" | "tanpa-aturan";
  hakBoleh: boolean | null;
  peringatan: string;
  aturan: string;
};

export type ButirSiapLengkap = Omit<ButirSiap, "saran"> & { saran: SaranSiap[] };

export type JawabanSiap = {
  peran: PeranAlur;
  tanggal: string;
  tersedia: boolean;
  keterangan: string;
  butir: ButirSiapLengkap[];
  jumlahBaris: number;
  hakFolder: { berlaku: boolean; disetujui: boolean };
};

type Jadwal = (p: { dari: string; sampai: string; batas: number }) => Promise<{ ok: boolean; error?: string; data?: { sidang?: Array<Record<string, unknown>>; keterangan?: string } }>;

const jadwalBawaan: Jadwal = async (p) => {
  const h = await getGatewayJadwalSidangSinggah({ dari: p.dari, sampai: p.sampai, cari: "", batas: p.batas, daruratCermin: true } as never);
  return h as unknown as Awaited<ReturnType<Jadwal>>;
};

function tambahHari(tanggal: string, n: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const kunciBerkas = (nama: string) => String(nama ?? "").replace(/\s+/g, " ").trim().replace(/\.rtf$/i, "").toLowerCase();
/** Folder saran: "derry_briantono/1 Perceraian CG" -> "1 Perceraian CG" (nama folder di pustaka). */
const folderPustaka = (f: string) => String(f ?? "").replace(/^derry_briantono\//i, "").trim();

export async function bacaDaftarSiap(db: AletaDatabase, p: { peran: PeranAlur; tanggal?: string }, deps: { jadwal?: Jadwal } = {}): Promise<JawabanSiap> {
  const tanggal = p.tanggal && TANGGAL.test(p.tanggal) ? p.tanggal : waktuPengadilan().tanggal;
  const dari = p.peran === "panitera" ? tambahHari(tanggal, -MUNDUR_PANITERA_HARI) : tanggal;
  const hasil = await (deps.jadwal ?? jadwalBawaan)({ dari, sampai: tanggal, batas: 300 });
  const keadaanHak = await bacaKeadaanHakFolder(db);
  const dasar = { peran: p.peran, tanggal, hakFolder: { berlaku: keadaanHak.berlaku, disetujui: keadaanHak.persetujuan.disetujui } };
  if (!hasil.ok) return { ...dasar, tersedia: false, keterangan: String(hasil.error || "Jadwal sidang belum dapat dibaca."), butir: [], jumlahBaris: 0 };
  const daftar = susunDaftarSiap(hasil.data?.sidang ?? [], p.peran);

  const berkasDb = await db
    .queryAll<{ id: string; folder: string; nama: string; arsip: number | string }>("SELECT id, folder, nama, arsip FROM aleta_abt_berkas WHERE status <> 'hilang'")
    .catch(() => [] as Array<{ id: string; folder: string; nama: string; arsip: number | string }>);
  const peta = new Map<string, string>();
  for (const b of berkasDb) peta.set(`${String(b.folder).trim().toLowerCase()}|${kunciBerkas(b.nama)}`, String(b.id));

  const golongan = [GOLONGAN_ALUR[p.peran]];
  // Keputusan 5 Nov 2026: folder arsip disembunyikan dari semua peran selain Super Admin; daftar ini selalu dilihat sebagai peran lain.
  const arsipFolder = (f: string) => {
    const k = f.trim().toLowerCase();
    const m = keadaanHak.menu.find((x) => x.id.trim().toLowerCase() === k);
    return (m ? folderArsip(m) : false) || keadaanHak.folder.some((x) => x.folder.trim().toLowerCase() === k && x.arsip);
  };
  const butir: ButirSiapLengkap[] = daftar.butir.map((x) => ({
    ...x,
    saran: x.saran.filter((s) => !arsipFolder(folderPustaka(s.folder))).map((s) => {
      const folder = folderPustaka(s.folder);
      const id = peta.get(`${folder.toLowerCase()}|${kunciBerkas(s.berkas)}`) ?? "";
      const menu = keadaanHak.menu.find((m) => m.id.trim().toLowerCase() === folder.toLowerCase()) ?? null;
      const tahap = menu ? periksaTahapan(menu, x.keadaan) : { sesuai: null, alasan: "" };
      const hak = putusanHakFolder(keadaanHak, folder, golongan, { ditunjuk: null });
      return {
        ...s,
        berkasId: id,
        diPustaka: Boolean(id),
        tingkatHak: hak ? (hak.tingkat ?? "tanpa-aturan") : "belum-berlaku",
        hakBoleh: hak ? hak.boleh : null,
        // Peringatan untuk Super Admin: blangko di luar tahapan atau jenis folder (ABT sendiri meloloskan Super Admin tanpa memberi tahu).
        peringatan: tahap.sesuai === false ? tahap.alasan : "",
        aturan: menu ? `${labelTahapan(menu)}; ${labelJenis(menu)}` : "",
      } satisfies SaranSiap;
    }),
  }));
  return { ...dasar, tersedia: true, keterangan: String(hasil.data?.keterangan ?? ""), butir, jumlahBaris: daftar.jumlahBaris };
}

export type HasilPeriksa = {
  nama: string;
  jumlahTerisi: number;
  jumlahKosong: number;
  periksaKembali: number;
  pasti: number;
  lolosCetak: boolean;
  mesinGalat: string;
  dapatDicetak: boolean;
};

/** Memeriksa satu naskah (tanpa mencetak, tanpa menyimpan): berapa isian pasti, perlu diperiksa, dan kosong. */
export async function periksaNaskahSiap(db: AletaDatabase, p: { berkasId: string; perkaraId: string; sidangKe?: number }): Promise<HasilPeriksa> {
  if (!idBlangkoSah(p.berkasId)) throw new ApiError(400, "Blangko ini belum ada di pustaka ALETA ABT.");
  if (!/^\d{1,12}$/.test(p.perkaraId)) throw new ApiError(400, "Pilih perkara.");
  const n = await susunNaskah(db, { berkasId: p.berkasId, perkaraId: p.perkaraId, sidangKe: Math.max(0, Math.min(99, Math.trunc(Number(p.sidangKe) || 0))), cetakFinal: false });
  if (!n.ok) throw new ApiError(n.status >= 400 && n.status < 600 ? n.status : 502, n.alasan);
  const k = n.ringkasanKeyakinan ?? {};
  return {
    nama: n.nama,
    jumlahTerisi: n.jumlahTerisi,
    jumlahKosong: n.kosong.length,
    periksaKembali: Number(k.periksa ?? 0),
    pasti: Number(k.pasti ?? 0),
    lolosCetak: n.lolosCetak,
    mesinGalat: n.mesinGalat,
    dapatDicetak: n.lolosCetak,
  };
}
