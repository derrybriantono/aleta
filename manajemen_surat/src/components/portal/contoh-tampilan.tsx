"use client";

/**
 * ============================================================================
 * CONTOH TAMPILAN TIAP SAKLAR - PANEL TAMPILAN JADWAL SIDANG (6 Okt 2026, butir 11)
 * ============================================================================
 *
 * Diminta pengguna: tiap saklar di panel Tampilan diberi ikon "i"; disorot =
 * sembulan yang memperlihatkan bentuknya SAAT TAMPIL dan SAAT DISEMBUNYIKAN
 * (mis. lencana "potensi verstek" ada vs tidak ada). Ditambah satu saklar di
 * atas daftar - "Tampilkan contoh" - yang memampangkan seluruh contoh itu
 * langsung di bawah tiap saklar.
 *
 * Contohnya GAMBAR TIRUAN dengan warna yang sama dengan penanda sungguhannya,
 * bukan komponen aslinya: komponen asli menuntut data perkara, dan panel ini
 * tidak boleh memanggil apa pun. Saklar tanpa contoh di daftar ini tetap
 * mendapat ikon "i" berisi keterangannya - tidak ada saklar yang tanpa bantuan.
 */
import { Info, Smartphone } from "lucide-react";
import type { ReactNode } from "react";

import { KELAS_PENANDA_JAWABAN } from "@/lib/penanda-jawaban";
import { cn } from "@/lib/utils";

const lencana = (kelas: string, isi: ReactNode) => (
  <span className={cn("inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold", kelas)}>
    {isi}
  </span>
);
const pil = (kelas: string, isi: ReactNode) => (
  <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", kelas)}>
    {isi}
  </span>
);
const tombol = (isi: ReactNode, kelas = "") => (
  <span className={cn("inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px]", kelas)}>{isi}</span>
);
const redup = (isi: ReactNode) => <span className="text-[11px] text-muted-foreground">{isi}</span>;

/** Tempat di layar + gambar tiruannya. */
export const CONTOH_TAMPILAN: Record<string, { letak: string; contoh: ReactNode }> = {
  retur: { letak: "kolom Perkara, di samping nomor", contoh: lencana("bg-rose-600 text-white", "retur") },
  "belum-dipanggil": { letak: "kolom Perkara, di samping nomor", contoh: lencana("bg-rose-600 text-white", "belum dipanggil") },
  "tenggang-mepet": { letak: "kolom Perkara, di samping nomor", contoh: lencana("bg-orange-500 text-white", "sidang hari ini") },
  "belum-tunda-lewat-batas": { letak: "baris sidang, tepi merah", contoh: lencana("bg-rose-100 text-rose-900 ring-1 ring-rose-400", "belum ditunda · lewat 15:00") },
  "belum-minutasi": { letak: "kolom Putusan", contoh: lencana("bg-rose-600 text-white", "belum minutasi") },
  "belum-unggah-putusan": { letak: "kotak saring di atas tabel", contoh: pil("border-rose-400 text-rose-700", "1 Belum unggah") },
  "hari-putusan": { letak: "kolom Perkara, di bawah jenis perkara", contoh: lencana("bg-amber-700 text-amber-50", "Hari Putusan") },
  "ikrar-talak": { letak: "kolom Perkara, di bawah jenis perkara", contoh: lencana("bg-sky-700 text-white", "Ikrar Talak") },
  "agenda-elitigasi": { letak: "kolom Agenda", contoh: <span className="text-sm font-semibold text-red-700 dark:text-red-400">Replik</span> },
  "verifikasi-majelis": {
    letak: "kolom Perkara, di samping nomor (sidang e-Litigasi hari ini)",
    contoh: (
      <span className="inline-flex flex-wrap gap-1">
        {lencana("bg-emerald-600 text-white", "sudah diverifikasi")}
        {lencana("bg-amber-400 text-amber-950", "belum diverifikasi")}
        {lencana("bg-orange-600 text-white", "belum upload")}
        {lencana("bg-slate-300 text-slate-800", "tidak konek")}
      </span>
    ),
  },
  "cc-tidak-sinkron": {
    letak: "kolom Perkara, di samping nomor (perkara e-Litigasi)",
    contoh: lencana("bg-rose-600 text-white", "court calendar tidak sinkron"),
  },
  "penanda-mediasi": {
    letak: "kolom Agenda",
    contoh: lencana("bg-sky-100 text-sky-900 ring-1 ring-sky-300 dark:bg-sky-900/60 dark:text-sky-100", "Mediasi"),
  },
  "hasil-mediasi": {
    letak: "kolom Agenda (agenda laporan hasil mediasi)",
    contoh: (
      <span className="inline-flex flex-wrap gap-1">
        {lencana("bg-emerald-600 text-white", "mediasi berhasil dengan perdamaian")}
        {lencana("bg-lime-500 text-lime-950", "berhasil sebagian")}
        {lencana("bg-teal-600 text-white", "berhasil dengan pencabutan")}
        {lencana("bg-rose-600 text-white", "tidak berhasil")}
        {lencana("bg-slate-500 text-white", "tidak dapat dilaksanakan")}
      </span>
    ),
  },
  "penanda-jawaban": {
    letak: "kolom Agenda (dari jawaban/duplik Tergugat)",
    contoh: (
      <span className="inline-flex flex-wrap gap-1">
        {lencana(KELAS_PENANDA_JAWABAN.eksepsi, "eksepsi")}
        {lencana(KELAS_PENANDA_JAWABAN.rekonvensi, "rekonvensi")}
      </span>
    ),
  },
  "pembebanan-ikrar": { letak: "kolom Putusan (sidang ikrar talak)", contoh: lencana("bg-violet-600 text-white", "pembebanan Rp 14,5 jt") },
  "umur-perkara": { letak: "kolom Agenda, di bawah sidang ke-N", contoh: pil("border-emerald-500 text-emerald-700 dark:text-emerald-300", "35 hari") },
  "menunggu-lama": { letak: "kolom Antrian / Jam", contoh: lencana("bg-amber-100 text-amber-900", "menunggu 45 menit") },
  "tanda-antrian-online": { letak: "kolom Antrian / Jam", contoh: <Smartphone className="h-4 w-4 text-sky-600" aria-label="antrian online" /> },
  "potensi-verstek": { letak: "kolom Perkara, di bawah jenis perkara", contoh: pil("border-amber-600 bg-amber-950/80 text-amber-200", "potensi verstek") },
  kehadiran: { letak: "kolom Perkara", contoh: lencana("bg-emerald-100 text-emerald-900", "contradictoir · P & T hadir") },
  "belum-bas": { letak: "kolom Perkara (mode Ringkas)", contoh: lencana("bg-amber-100 text-amber-900", "belum BAS") },
  "tidak-dipanggil": { letak: "kolom Perkara (mode Ringkas)", contoh: lencana("bg-muted text-muted-foreground", "tidak perlu dipanggil") },
  petugas: { letak: "di bawah nomor perkara (mode Ringkas)", contoh: redup("Majelis B-C2-C3 · PP Munifa · JS Mustini") },
  kuasa: { letak: "kolom Perkara", contoh: lencana("bg-indigo-100 text-indigo-900", "kuasa P") },
  saksi: { letak: "kolom Perkara, di bawah pihak", contoh: redup("Saksi P (2): Wawan, Setiawan") },
  "jarak-sidang": { letak: "kolom Antrian / Jam", contoh: lencana("bg-muted text-foreground", "Tunggu ● 32:51") },
  "urutan-sidang": { letak: "kolom Agenda", contoh: redup("sidang ke-2") },
  "hasil-tundaan": { letak: "kolom Perkara, di bawah pihak", contoh: lencana("bg-amber-100 text-amber-900", "Ditunda sampai 13-10-2026") },
  "rincian-antrian": { letak: "kolom Antrian / Jam", contoh: <span className="text-[11px] font-semibold text-emerald-600">P 08:33 · Saksi 08:39</span> },
  "kolom-siap": { letak: "kolom tersendiri (mode Lengkap)", contoh: pil("border-emerald-500 text-emerald-700", "Siap 92") },
  "catatan-cara-hitung": { letak: "di bawah penanda", contoh: redup("Tenggang dihitung dari tanggal relaas sampai hari sidang…") },
  "tombol-tunda-putus": {
    letak: "kolom Perkara, di samping jenis perkara",
    contoh: (
      <span className="inline-flex">
        {tombol("tunda", "rounded-r-none border-amber-500 text-amber-700")}
        {tombol("putus", "rounded-l-none border-sky-500 text-sky-700")}
      </span>
    ),
  },
  "tombol-mediator": { letak: "kolom Perkara (kedua pihak hadir pertama kali)", contoh: tombol("Mediator", "border-emerald-500 text-emerald-700") },
  "court-calendar": { letak: "dasar kolom Agenda", contoh: tombol("Court Calendar (3)") },
  // 7 Okt 2026: penanda "belum upload" yang dapat ditekan + kemajuan tarikannya.
  "tarik-belum-upload": {
    letak: "kolom Perkara, penanda \"belum upload\" (ditekan = periksa e-Court perkara itu)",
    contoh: (
      <span className="inline-flex flex-wrap items-center gap-1">
        {lencana("bg-orange-600 text-white underline decoration-dotted underline-offset-2", "belum upload")}
        {redup("2 dokumen baru: Duplik Tergugat, Bukti T-1")}
      </span>
    ),
  },
  /* === 12OKT-B: contoh saklar penanda perkara & pihak, panggil saksi === */
  "penanda-perkara": {
    letak: "kolom Perkara, di samping nomor (dan di rincian)",
    contoh: (
      <span className="inline-flex flex-wrap gap-1">
        {lencana("bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200", "Ghaib")}
        {lencana("bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200", "Prodeo")}
        {lencana("border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300", "Non e-Court")}
      </span>
    ),
  },
  "penanda-pekerjaan": {
    letak: "kolom Perkara, di samping nama pihak (dan di rincian)",
    contoh: (
      <span className="inline-flex flex-wrap gap-1">
        {["PNS", "PPPK", "TNI", "POLRI", "BUMN/BUMD"].map((k) => (
          <span key={k}>{lencana("bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200", k)}</span>
        ))}
      </span>
    ),
  },
  "panggil-saksi": { letak: "kolom Perkara, nama saksi (Saksi P / Saksi T)", contoh: tombol("Saksi Satu, Saksi Dua", "border-dotted") },
  /* === AKHIR 12OKT-B === */
  "ambil-antrian": { letak: "kolom Antrian / Jam", contoh: tombol("☰ Antrian") },
  "tunjuk-konseptor": { letak: "kolom Putusan", contoh: tombol("✎ tunjuk konseptor", "border-dashed") },
  "keterangan-perkara": { letak: "kolom Putusan", contoh: tombol("▢ keterangan", "border-dashed") },
  "skor-kesiapan": { letak: "deretan tombol di atas tabel", contoh: tombol("Hitung skor") },
  cetak: { letak: "deretan tombol di atas tabel", contoh: tombol("Cetak") },
  "daftar-antrian": { letak: "deretan tombol di atas tabel", contoh: tombol("Daftarkan ke antrian") },
  "saring-ruang": { letak: "ujung kanan deretan tombol", contoh: tombol("Ruang Sidang 1 · 17") },
  // === 12OKT-C: contoh untuk saklar kartu ruang, mediator, dan hasil audit butir 7 ===
  "kartu-ruang": {
    letak: "di bawah deretan tombol (bawaan diciutkan)",
    contoh: (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-3xl border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-50">
          Ruang Sidang 1 · 17 perkara
        </span>
        <span className="inline-flex items-center gap-1 rounded-3xl border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-50">
          Ruang Sidang 2 · 4 perkara
        </span>
        {lencana("bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", "2 perlu diperiksa")}
      </span>
    ),
  },
  "mediator-majelis": {
    letak: "kolom Majelis & Petugas, di bawah JS dan di atas ruang",
    contoh: redup("Mediator Massadi, S.Ag., M.H."),
  },
  "penanda-verzet": { letak: "kolom Perkara, di samping nomor", contoh: lencana("bg-red-600 text-white", "verzet") },
  "lencana-putusan-ecourt": {
    letak: "kolom Perkara, baris penanda di bawah jenis perkara",
    contoh: lencana("bg-amber-400 text-amber-950", "putusan belum diunggah"),
  },
  "pihak-turut-intervensi": { letak: "kolom Perkara, di bawah P dan T", contoh: redup("Turut T: Kepala Desa Contoh · Int: Fulan") },
  "tombol-status-perkara": { letak: "kolom paling kanan, di bawah Rincian", contoh: tombol("Status") },
  "tombol-ruang-sidang": { letak: "kolom paling kanan", contoh: tombol("Skors · Lanjutkan · Tandai berjalan") },
  "tombol-selesai-sidang": { letak: "kolom paling kanan, paling bawah", contoh: tombol("Selesai") },
  "tombol-cetak-relaas": { letak: "deretan tombol di atas tabel", contoh: tombol("Cetak relaas") },
  // === AKHIR 12OKT-C ===
  "ciutkan-selesai": { letak: "di atas tabel", contoh: redup("5 perkara yang sudah selesai diciutkan · tampilkan") },
  "tombol-penetapan-kembali": { letak: "deretan tombol di atas tabel", contoh: tombol("Penetapan kembali") },
  "tombol-kasir": { letak: "deretan tombol di atas tabel", contoh: tombol("Kasir") },
  "tombol-kasir-harian": { letak: "deretan tombol di atas tabel", contoh: tombol("Kasir harian") },
  "layar-antrian": { letak: "deretan tombol di atas tabel", contoh: tombol("Layar antrian") },
};

/** Dua keadaan berdampingan: tampil dan disembunyikan; yang berlaku sekarang ditandai. */
export function DuaKeadaan({ kunci, keterangan, menyala }: { kunci: string; keterangan: string; menyala: boolean }) {
  const c = CONTOH_TAMPILAN[kunci];
  return (
    <div className="space-y-1.5 text-xs" data-contoh-tampilan={kunci}>
      {c ? <p className="text-muted-foreground">Letak: {c.letak}</p> : null}
      <div className={cn("rounded-md border p-1.5", menyala && "border-primary ring-1 ring-primary")}>
        <p className="mb-1 font-semibold">Tampil{menyala ? " (sekarang)" : ""}</p>
        {c ? c.contoh : <p className="text-muted-foreground">{keterangan}</p>}
      </div>
      <div className={cn("rounded-md border p-1.5", !menyala && "border-primary ring-1 ring-primary")}>
        <p className="mb-1 font-semibold">Disembunyikan{!menyala ? " (sekarang)" : ""}</p>
        <p className="italic text-muted-foreground">tidak digambar - datanya tetap ada</p>
      </div>
    </div>
  );
}

/**
 * Ikon "i" di samping saklar. Disorot ATAU difokus (papan ketik) = sembulan
 * dua keadaan. bg-card, bukan token popover (tidak ada di tema ini).
 */
export function InfoContohSaklar({ kunci, label, keterangan, menyala }: { kunci: string; label: string; keterangan: string; menyala: boolean }) {
  return (
    <div className="group relative inline-flex shrink-0 pt-1" data-info-saklar={kunci}>
      <button
        type="button"
        aria-label={`Contoh tampilan: ${label}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:text-foreground focus:outline-none"
        onClick={(e) => e.preventDefault()}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-6 z-50 w-72 rounded-lg border bg-card p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        <p className="mb-1 text-xs font-semibold">{label}</p>
        <p className="mb-1.5 text-[11px] text-muted-foreground">{keterangan}</p>
        <DuaKeadaan kunci={kunci} keterangan={keterangan} menyala={menyala} />
      </div>
    </div>
  );
}
