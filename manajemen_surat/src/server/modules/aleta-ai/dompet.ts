import type { AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { pemakaianHariIni } from "@/server/modules/aleta-ai/batas";
import { pastikanKuotaBulanIni } from "@/server/modules/aleta-ai/kuota";
import { bacaPengaturan } from "@/server/modules/aleta-ai/pengaturan";
import { daftarMutasi, saldoPengguna, type JenisMutasi } from "@/server/modules/aleta-ai/saldo";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - DOMPET PENGGUNA (tahap 4)
 * ============================================================================
 *
 * Halaman Dompet: saldo, mutasi, rincian biaya per giliran, struk, dan
 * pemberitahuan saldo menipis. HANYA milik pelaku sendiri. Tidak memuat isi
 * pesan (struk pun hanya angka). Nama model hanya untuk Super Admin -
 * pengguna lain melihat label mode (Cepat/Teliti/Mendalam), sesuai rencana
 * bagian 2.
 */

const KETERANGAN_JENIS: Record<JenisMutasi, string> = {
  isi: "Isi saldo",
  kuota: "Kuota hibah",
  tahan: "Dana ditahan",
  lepas: "Tahanan dilepas",
  potong: "Biaya giliran",
  koreksi: "Koreksi",
};

export type GiliranDompet = {
  pesanId: string;
  percakapanId: string;
  waktu: string;
  mode: string;
  status: string;
  token: { masuk: number; keluar: number; cacheTulis: number; cacheBaca: number };
  /** Kurs yang dipakai (kurs dasar x penyangga), tanggal dan sumber kurs dasar. */
  kurs: number;
  kursDasar: number;
  kursTanggal: string;
  kursSumber: string;
  perkiraanRp: number;
  biayaRp: number;
  gratis: boolean;
  /** Hanya untuk Super Admin. */
  model?: string;
};

type BarisGiliran = {
  id: string;
  percakapan_id: string;
  dibuat_at: string;
  mode_label: string;
  status: string;
  model: string;
  token_masuk: number | string;
  token_keluar: number | string;
  token_cache_tulis: number | string;
  token_cache_baca: number | string;
  kurs: number | string;
  kurs_dasar: number | string;
  kurs_tanggal: string | null;
  kurs_sumber: string | null;
  perkiraan_rp: number | string;
  biaya_rp: number | string;
  gratis: number | string;
};

const KOLOM_GILIRAN = `id, percakapan_id, dibuat_at, mode_label, status, model, token_masuk, token_keluar, token_cache_tulis, token_cache_baca,
  kurs, kurs_dasar, kurs_tanggal, kurs_sumber, perkiraan_rp, biaya_rp, gratis`;

function keGiliran(b: BarisGiliran, superAdmin: boolean): GiliranDompet {
  return {
    pesanId: b.id,
    percakapanId: b.percakapan_id,
    waktu: b.dibuat_at,
    mode: b.mode_label,
    status: b.status,
    token: { masuk: Number(b.token_masuk), keluar: Number(b.token_keluar), cacheTulis: Number(b.token_cache_tulis), cacheBaca: Number(b.token_cache_baca) },
    kurs: Number(b.kurs),
    kursDasar: Number(b.kurs_dasar),
    kursTanggal: b.kurs_tanggal ?? "",
    kursSumber: b.kurs_sumber ?? "",
    perkiraanRp: Number(b.perkiraan_rp),
    biayaRp: Number(b.biaya_rp),
    gratis: Number(b.gratis) === 1,
    ...(superAdmin ? { model: b.model } : {}),
  };
}

export async function giliranPengguna(db: AletaDatabase, pelaku: PelakuAi, batas = 50): Promise<GiliranDompet[]> {
  const baris = await db.queryAll<BarisGiliran>(
    `SELECT ${KOLOM_GILIRAN} FROM aleta_ai_obrolan_pesan WHERE pemilik_id = ? AND peran = 'ai' AND status <> 'berjalan' ORDER BY dibuat_at DESC, id DESC LIMIT ?`,
    [pelaku.id, Math.min(200, Math.max(1, batas))]
  );
  return baris.map((b) => keGiliran(b, pelaku.superAdmin));
}

export async function tampilDompet(db: AletaDatabase, pelaku: PelakuAi, sekarang: Date = new Date()) {
  await pastikanKuotaBulanIni(db, pelaku, sekarang);
  const pengaturan = await bacaPengaturan(db);
  const saldoRp = await saldoPengguna(db, pelaku.id);
  const hari = await pemakaianHariIni(db, pelaku.id, sekarang);
  const mutasi = (await daftarMutasi(db, pelaku.id, 100)).map((m) => ({
    ...m,
    // Nama yang dipakai layar (kontrak.ts MutasiSaldo); bentuk lama tetap ada.
    keterangan: m.catatan || KETERANGAN_JENIS[m.jenis] || m.jenis,
    saldoSesudahRp: m.saldoSetelah,
  }));
  const menipis = !pelaku.superAdmin && pengaturan.ambangSaldoMenipisRp > 0 && saldoRp < pengaturan.ambangSaldoMenipisRp;
  return {
    saldoRp,
    gratis: pelaku.superAdmin,
    saldoMenipis: menipis,
    ambangSaldoMenipisRp: pengaturan.ambangSaldoMenipisRp,
    ...(menipis ? { pemberitahuan: `Saldo ALETA Ai Anda tinggal Rp${saldoRp.toLocaleString("id-ID")}. Hubungi Super Admin untuk mengisi saldo.` } : {}),
    hariIni: { terpakaiRp: hari.rp, batasRp: pengaturan.batasHarianRp, token: hari.token, batasToken: pengaturan.batasHarianToken },
    // Tahap 5 (QRIS) belum ada: isi saldo hanya manual oleh Super Admin.
    isiBerbayarAktif: false,
    caraIsi: "Saldo diisi manual oleh Super Admin.",
    mutasi,
    giliran: await giliranPengguna(db, pelaku, 50),
  };
}

const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const aman = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function waktuWita(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return `${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(t)} WITA`;
}

/**
 * Struk satu giliran (HTML siap cetak; "Simpan sebagai PDF" dari dialog
 * cetak peramban). Hanya milik pelaku; tanpa isi pesan.
 */
export async function strukGiliran(db: AletaDatabase, pelaku: PelakuAi, pesanId: string): Promise<string> {
  const b = await db.queryOne<BarisGiliran>(`SELECT ${KOLOM_GILIRAN} FROM aleta_ai_obrolan_pesan WHERE id = ? AND pemilik_id = ? AND peran = 'ai'`, [
    String(pesanId ?? "").trim(),
    pelaku.id,
  ]);
  if (!b) throw new ApiError(404, "Struk tidak ditemukan.");
  if (b.status === "berjalan") throw new ApiError(409, "Giliran ini masih berjalan; struk tersedia sesudah selesai.");
  const g = keGiliran(b, pelaku.superAdmin);
  const mutasi = await db.queryAll<{ jenis: string; jumlah_rp: number | string; saldo_setelah: number | string; dibuat_at: string }>(
    `SELECT jenis, jumlah_rp, saldo_setelah, dibuat_at FROM aleta_ai_mutasi WHERE pengguna_id = ? AND rujukan_id = ? AND jumlah_rp <> 0 ORDER BY dibuat_at, id`,
    [pelaku.id, g.pesanId]
  );
  const ditahan = mutasi.filter((m) => m.jenis === "tahan").reduce((n, m) => n - Number(m.jumlah_rp), 0);
  const saldoAkhir = mutasi.length ? Number(mutasi[mutasi.length - 1]?.saldo_setelah) : null;
  const totalToken = g.token.masuk + g.token.keluar + g.token.cacheTulis + g.token.cacheBaca;
  const baris: Array<[string, string]> = [
    ["Nomor struk", g.pesanId],
    ["Waktu", waktuWita(g.waktu)],
    ["Pengguna", pelaku.nama || pelaku.id],
    ["Mode", g.mode || "-"],
    ...(g.model ? ([["Model", g.model]] as Array<[string, string]>) : []),
    ["Status", g.status],
    ["Token", `${totalToken.toLocaleString("id-ID")} (masuk ${g.token.masuk.toLocaleString("id-ID")}, keluar ${g.token.keluar.toLocaleString("id-ID")}, cache ${(g.token.cacheTulis + g.token.cacheBaca).toLocaleString("id-ID")})`],
    ["Kurs dipakai", `${rupiah(g.kurs)} per USD (kurs ${g.kursTanggal || "-"}${g.kursSumber ? `, ${g.kursSumber}` : ""}, termasuk penyangga)`],
    ["Perkiraan sebelum jalan", rupiah(g.perkiraanRp)],
    ["Dana ditahan lalu dilepas", rupiah(ditahan)],
    ["Biaya dipotong", g.gratis ? "Rp0 (gratis)" : rupiah(g.biayaRp)],
    ...(saldoAkhir !== null ? ([["Saldo sesudahnya", rupiah(saldoAkhir)]] as Array<[string, string]>) : []),
  ];
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Struk ${aman(g.pesanId)}</title>
<style>
:root{color-scheme:light dark;--latar:#ffffff;--teks:#1f2937;--garis:#d1d5db;--redup:#6b7280}
@media (prefers-color-scheme:dark){:root{--latar:#111827;--teks:#f3f4f6;--garis:#374151;--redup:#9ca3af}}
body{font-family:system-ui,sans-serif;background:var(--latar);color:var(--teks);margin:0;padding:24px;font-size:14px}
main{max-width:34rem;margin:0 auto}
h1{font-size:18px;margin:0 0 4px}
p{margin:0 0 16px;color:var(--redup)}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:6px 4px;border-bottom:1px solid var(--garis);vertical-align:top}
th{width:42%;font-weight:600}
button{margin-top:16px;font:inherit;padding:6px 14px}
@media print{button{display:none}body{padding:0}}
</style></head>
<body><main>
<h1>Struk pemakaian ALETA Ai</h1>
<p>Rincian biaya satu giliran. Isi percakapan tidak dimuat.</p>
<table>${baris.map(([k, v]) => `<tr><th scope="row">${aman(k)}</th><td>${aman(v)}</td></tr>`).join("")}</table>
<button type="button" onclick="window.print()">Cetak / simpan PDF</button>
</main></body></html>`;
}
