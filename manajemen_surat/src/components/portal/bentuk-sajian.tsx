"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { tanggalHariPanjang, tanggalRingkas } from "@/lib/tanggal-indonesia";
import type { PerjalananSidang, TitikPerjalanan } from "@/lib/perjalanan-sidang";
import type { PitaWaktuPutus } from "@/lib/pita-waktu-putus";

/**
 * ============================================================================
 * SEPULUH BENTUK SAJIAN - DITULIS SEKALI, DIPAKAI SERATUS DELAPAN PULUH LIMA
 * ============================================================================
 *
 * Tiap butir katalog menyebut bentuk sajiannya sebagai huruf: "NTBGR" berarti
 * angka pokok, tabel rincian, diagram batang, diagram garis, dan kesimpulan.
 * Berkas ini yang menerjemahkan huruf itu menjadi gambar.
 *
 * Ditulis sendiri, bukan memakai pustaka diagram. Bukan karena pustakanya
 * buruk, melainkan karena diagram penilaian menuntut tiga hal yang tidak
 * disediakan pustaka umum: garis ambang beserta dasar hukumnya, batas kendali
 * yang dihitung dari datanya sendiri, dan rentang keyakinan pada nilai
 * berpenyebut kecil. Menambal ketiganya di atas pustaka menghasilkan kode yang
 * lebih rumit daripada menggambarnya langsung.
 *
 * ============================================================================
 * ATURAN YANG BERLAKU PADA SEMUA BENTUK
 * ============================================================================
 *
 *   1. Sumbu nilai selalu bermula dari nol. Memotong sumbu membuat selisih
 *      kecil tampak besar - itu cara paling tua menyesatkan orang dengan
 *      gambar yang "benar".
 *
 *   2. Data yang terlalu sedikit TIDAK digambar sebagai kecenderungan. Dua
 *      titik selalu membentuk garis lurus, dan garis lurus terbaca seperti
 *      pola padahal belum tentu ada polanya.
 *
 *   3. Yang dipotong dikatakan. Diagram pai yang menyatukan sisa irisan
 *      menyebut berapa yang disatukan; tabel yang dipotong menyebut jumlah
 *      sebenarnya.
 *
 *   4. Kosong bukan nol. Data yang belum ada digambar sebagai keterangan,
 *      bukan sebagai batang setinggi nol.
 */

/* ==========================================================================
 * BENTUK DATA
 * ========================================================================== */

export type TitikData = { label: string; nilai: number | null; keterangan?: string };

export type UbinAngka = {
  label: string;
  nilai: string;
  satuan?: string;
  keadaan?: "baik" | "perhatian" | "buruk" | "netral";
  /** D10 - dihitung dari berapa persen populasi. */
  cakupan?: string;
  /** D17 - rentang keyakinan bagi nilai berpenyebut kecil. */
  rentang?: string;
};

export type KolomTabel = { kunci: string; label: string; angka?: boolean };

const WARNA_KEADAAN: Record<string, string> = {
  baik: "text-emerald-700 dark:text-emerald-300",
  perhatian: "text-amber-700 dark:text-amber-300",
  buruk: "text-rose-700 dark:text-rose-300",
  netral: "text-foreground",
};

/** Nilai yang benar-benar ada. null berarti belum dapat dihitung, bukan nol. */
function ada(t: TitikData[]): TitikData[] {
  return t.filter((x) => typeof x.nilai === "number" && Number.isFinite(x.nilai));
}

function Kosong({ pesan }: { pesan: string }) {
  return (
    <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 text-center text-sm text-muted-foreground">
      {pesan}
    </div>
  );
}

function Kepala({ judul, catatan }: { judul?: string; catatan?: string }) {
  if (!judul && !catatan) return null;
  return (
    <div className="mb-2">
      {judul ? <p className="text-sm font-semibold">{judul}</p> : null}
      {catatan ? <p className="text-xs leading-5 text-muted-foreground">{catatan}</p> : null}
    </div>
  );
}

/* ==========================================================================
 * N - ANGKA POKOK
 * ========================================================================== */

export function AngkaPokok({ ubin, judul }: { ubin: UbinAngka[]; judul?: string }) {
  if (!ubin.length) return <Kosong pesan="Belum ada angka pokok untuk periode ini." />;
  return (
    <div>
      <Kepala judul={judul} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ubin.map((u) => (
          <div key={u.label} className="rounded-lg border border-border/80 bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{u.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${WARNA_KEADAAN[u.keadaan || "netral"]}`}>
              {u.nilai}
              {u.satuan ? <span className="ml-1 text-sm font-normal text-muted-foreground">{u.satuan}</span> : null}
            </p>
            {u.rentang ? (
              <p className="mt-0.5 text-xs text-muted-foreground">rentang {u.rentang}</p>
            ) : null}
            {u.cakupan ? (
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{u.cakupan}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
 * T - TABEL RINCIAN
 * ========================================================================== */

export function TabelRincian({
  kolom,
  baris,
  judul,
  jumlahSebenarnya,
}: {
  kolom: KolomTabel[];
  baris: Array<Record<string, unknown>>;
  judul?: string;
  jumlahSebenarnya?: number;
}) {
  const dipotong = typeof jumlahSebenarnya === "number" && jumlahSebenarnya > baris.length;
  if (!baris.length) return <Kosong pesan="Tidak ada baris pada periode ini." />;

  return (
    <div>
      <Kepala
        judul={judul}
        catatan={
          dipotong
            ? `${baris.length} dari ${jumlahSebenarnya} baris ditampilkan`
            : `${baris.length} baris, seluruhnya`
        }
      />
      <div className="overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr>
              {kolom.map((k) => (
                <th key={k.kunci} className={`whitespace-nowrap px-3 py-2 font-semibold ${k.angka ? "text-right" : ""}`}>
                  {k.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <tr key={String(b.kunci ?? i)} className="border-t border-border/70">
                {kolom.map((k) => (
                  <td
                    key={k.kunci}
                    className={`whitespace-nowrap px-3 py-2 ${k.angka ? "text-right tabular-nums" : ""}`}
                  >
                    {b[k.kunci] === null || b[k.kunci] === undefined || b[k.kunci] === ""
                      ? "-"
                      : String(b[k.kunci])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==========================================================================
 * R - KESIMPULAN
 * ========================================================================== */

export function Kesimpulan({
  isi,
  keadaan = "netral",
}: {
  isi: string;
  keadaan?: "baik" | "perhatian" | "buruk" | "netral";
}) {
  const gaya: Record<string, string> = {
    baik: "border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-200",
    perhatian: "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200",
    buruk: "border-rose-300/70 bg-rose-50 text-rose-900 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-200",
    netral: "border-border/80 bg-muted/30",
  };
  return <div className={`rounded-lg border p-3 text-sm leading-6 ${gaya[keadaan]}`}>{isi}</div>;
}

/* ==========================================================================
 * B - DIAGRAM BATANG
 * ========================================================================== */

export function DiagramBatang({
  data,
  judul,
  satuan,
  ambang,
}: {
  data: TitikData[];
  judul?: string;
  satuan?: string;
  ambang?: { nilai: number; label: string };
}) {
  const isi = ada(data);
  if (!isi.length) return <Kosong pesan="Belum ada data untuk digambar." />;

  // Sumbu selalu bermula dari nol. Memotongnya membuat selisih kecil tampak
  // besar - cara paling tua menyesatkan orang dengan gambar yang benar.
  const puncak = Math.max(...isi.map((d) => d.nilai as number), ambang?.nilai ?? 0, 1);

  return (
    <div>
      <Kepala judul={judul} catatan={ambang ? `Garis ambang: ${ambang.label}` : undefined} />
      <div className="space-y-1.5">
        {isi.map((d) => {
          const n = d.nilai as number;
          const lebar = Math.max(0, (n / puncak) * 100);
          const lewat = ambang ? n < ambang.nilai : false;
          return (
            <div key={d.label} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-xs text-muted-foreground" title={d.label}>
                {d.label}
              </span>
              <span className="relative h-5 flex-1 overflow-hidden rounded bg-muted/60">
                <span
                  className={`absolute inset-y-0 left-0 rounded ${lewat ? "bg-rose-500/70" : "bg-primary/70"}`}
                  style={{ width: `${lebar}%` }}
                />
                {ambang ? (
                  <span
                    className="absolute inset-y-0 w-px bg-foreground/50"
                    style={{ left: `${(ambang.nilai / puncak) * 100}%` }}
                  />
                ) : null}
              </span>
              <span className="w-20 shrink-0 text-right text-xs tabular-nums">
                {n.toLocaleString("id-ID")}
                {satuan ? <span className="text-muted-foreground"> {satuan}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
 * G dan A - DIAGRAM GARIS DAN AREA
 * ========================================================================== */

type PenandaPeristiwa = { label: string; padaIndeks: number };

function jalurGaris(isi: TitikData[], lebar: number, tinggi: number, puncak: number) {
  const langkah = isi.length > 1 ? lebar / (isi.length - 1) : 0;
  return isi.map((d, i) => {
    const x = isi.length > 1 ? i * langkah : lebar / 2;
    const y = tinggi - ((d.nilai as number) / puncak) * tinggi;
    return { x, y, d };
  });
}

function GarisAtauArea({
  data,
  judul,
  area,
  sasaran,
  peristiwa,
}: {
  data: TitikData[];
  judul?: string;
  area: boolean;
  sasaran?: { nilai: number; label: string };
  peristiwa?: PenandaPeristiwa[];
}) {
  const isi = ada(data);
  const W = 640;
  const H = 180;

  const puncak = useMemo(
    () => Math.max(...isi.map((d) => d.nilai as number), sasaran?.nilai ?? 0, 1),
    [isi, sasaran]
  );
  const titik = useMemo(() => jalurGaris(isi, W, H, puncak), [isi, puncak]);

  if (!isi.length) return <Kosong pesan="Belum ada data untuk digambar." />;

  // Dua titik selalu membentuk garis lurus, dan garis lurus terbaca seperti
  // pola padahal belum tentu ada polanya.
  if (isi.length < 3) {
    return (
      <div>
        <Kepala judul={judul} />
        <Kosong
          pesan={`Baru ${isi.length} titik. Kecenderungan tidak digambar di bawah tiga titik - dua titik selalu membentuk garis lurus.`}
        />
      </div>
    );
  }

  const d = titik.map((t, i) => `${i === 0 ? "M" : "L"} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`).join(" ");
  const dArea = `${d} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div>
      <Kepala judul={judul} catatan={sasaran ? `Garis sasaran: ${sasaran.label}` : undefined} />
      <div className="overflow-x-auto rounded-lg border border-border/80 bg-card/40 p-3">
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="h-auto w-full min-w-[24rem]" role="img">
          <line x1="0" y1={H} x2={W} y2={H} className="stroke-border" strokeWidth="1" />
          {sasaran ? (
            <line
              x1="0"
              y1={H - (sasaran.nilai / puncak) * H}
              x2={W}
              y2={H - (sasaran.nilai / puncak) * H}
              className="stroke-amber-500"
              strokeWidth="1"
              strokeDasharray="5 4"
            />
          ) : null}
          {(peristiwa || []).map((p) =>
            p.padaIndeks >= 0 && p.padaIndeks < titik.length ? (
              <g key={`${p.label}-${p.padaIndeks}`}>
                <line
                  x1={titik[p.padaIndeks].x}
                  y1="0"
                  x2={titik[p.padaIndeks].x}
                  y2={H}
                  className="stroke-foreground/25"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <title>{p.label}</title>
              </g>
            ) : null
          )}
          {area ? <path d={dArea} className="fill-primary/15" /> : null}
          <path d={d} className="fill-none stroke-primary" strokeWidth="2" />
          {titik.map((t) => (
            <circle key={t.d.label} cx={t.x} cy={t.y} r="2.5" className="fill-primary">
              <title>{`${t.d.label}: ${(t.d.nilai as number).toLocaleString("id-ID")}`}</title>
            </circle>
          ))}
          <text x="0" y={H + 16} className="fill-muted-foreground text-[10px]">
            {isi[0].label}
          </text>
          <text x={W} y={H + 16} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {isi[isi.length - 1].label}
          </text>
        </svg>
      </div>
    </div>
  );
}

export function DiagramGaris(p: {
  data: TitikData[];
  judul?: string;
  sasaran?: { nilai: number; label: string };
  peristiwa?: PenandaPeristiwa[];
}) {
  return <GarisAtauArea {...p} area={false} />;
}

export function DiagramArea(p: { data: TitikData[]; judul?: string; sasaran?: { nilai: number; label: string } }) {
  return <GarisAtauArea {...p} area />;
}

/* ==========================================================================
 * PERJALANAN SIDANG - UMUR PERKARA PADA TIAP SIDANG
 * ========================================================================== */

/**
 * ============================================================================
 * KENAPA TIDAK MEMAKAI DiagramGaris
 * ============================================================================
 *
 * DiagramGaris dibuat untuk deret per periode, sengaja tanpa angka pada
 * sumbunya - yang dicari bentuknya. Dipakai untuk perjalanan sidang, pengguna
 * melaporkannya "terlalu datar dan tidak memberi informasi" (24 Sep 2026).
 * Diukur pada 385/Pdt.G/2026/PA.Dgl, sebabnya lima:
 *
 *   1. sumbu tegak dipaksa sampai 150 oleh garis sasaran, sehingga sidang hari
 *      ke-15 sampai ke-86 terhimpit di separuh bawah;
 *   2. tidak satu pun angka pada sumbu tegak - tingginya tidak dapat dibaca;
 *   3. hanya tanggal pertama dan terakhir yang tertulis;
 *   4. agenda dikirim sebagai `keterangan`, tetapi TIDAK PERNAH digambar;
 *   5. jarak antar sidang - pertanyaan yang sebenarnya - tidak tampak.
 *
 * Sumbu mendatarnya SENGAJA per sidang, bukan per tanggal. Dengan sumbu
 * tanggal, umur perkara hanyalah garis diagonal lurus yang sama pada tiap
 * perkara. Dengan sumbu per sidang, kemiringan tiap ruas ADALAH jaraknya - ruas
 * yang curam berarti penundaan yang panjang - dan jaraknya ditulis pula sebagai
 * angka, sebab kemiringan hanya menjawab "lebih lama atau tidak".
 *
 * Tetap SATU sumbu tegak. Pita latar memakai satuan yang sama - hari yang
 * dihitung - jadi tidak ada sumbu kedua yang harus dicocokkan mata.
 *
 * Bukan huruf katalog: HURUF_DIKENALI tidak bertambah.
 */

/**
 * Nada pita memakai SEBUTAN WARNA yang sama dengan pita waktu putus
 * (lib/pita-waktu-putus.ts) - lencana umur perkara di Antrian Sidang. Diminta
 * pengguna 24 September 2026: hijau sampai 3 bulan, kuning 4 bulan, oranye 5
 * bulan, merah lewat 5 bulan. Satu perkara yang hijau di lencananya tidak boleh
 * berdiri di pita berwarna lain pada grafik ini, dan tipe yang dipinjam
 * membuat sebutan keempatnya tidak dapat menyimpang diam-diam.
 */
type NadaPita = PitaWaktuPutus["warna"];

export type PitaUmur = {
  /** Batas atas pita, dalam hari yang DIHITUNG. */
  sampai: number;
  /** Sebutan pendek di tepi kanan gambar, mis. "3 bln". */
  singkat: string;
  /** Sebutan lengkap beserta dasarnya - untuk keterangan warna. */
  label: string;
  /** Di atas pita terakhir selalu merah - karena itu merah tidak dapat dipilih. */
  nada: Exclude<NadaPita, "merah">;
};

/**
 * Hijau, kuning, oranye, merah - keluarga warna yang SAMA dengan kelas pita
 * waktu putus (emerald, yellow, orange, red; dijaga bentuk-sajian.test.tsx).
 * Kuning memakai yellow, bukan amber, dengan alasan yang sama di sana: amber
 * dan oranye nyaris tak terbedakan.
 *
 * LATARNYA sengaja tipis: pita adalah keterangan, bukan data - garis dan titik
 * harus tetap yang paling menonjol. Tiap mode punya langkahnya sendiri; portal
 * ini bertema gelap secara bawaan.
 */
const WARNA_PITA: Record<NadaPita, { latar: string; garis: string; teks: string; contoh: string }> = {
  hijau: {
    latar: "fill-emerald-500/10 dark:fill-emerald-400/10",
    garis: "stroke-emerald-600/60 dark:stroke-emerald-400/60",
    teks: "fill-emerald-700 dark:fill-emerald-300",
    contoh: "bg-emerald-500/30 dark:bg-emerald-400/30",
  },
  kuning: {
    latar: "fill-yellow-400/15 dark:fill-yellow-300/10",
    garis: "stroke-yellow-600/70 dark:stroke-yellow-300/60",
    teks: "fill-yellow-700 dark:fill-yellow-300",
    contoh: "bg-yellow-400/40 dark:bg-yellow-300/30",
  },
  oranye: {
    latar: "fill-orange-500/15 dark:fill-orange-400/15",
    garis: "stroke-orange-600/70 dark:stroke-orange-400/70",
    teks: "fill-orange-700 dark:fill-orange-300",
    contoh: "bg-orange-500/35 dark:bg-orange-400/35",
  },
  merah: {
    latar: "fill-red-500/15 dark:fill-red-400/15",
    garis: "stroke-red-600/70 dark:stroke-red-400/70",
    teks: "fill-red-700 dark:fill-red-300",
    contoh: "bg-red-500/35 dark:bg-red-400/35",
  },
};

/** Rincian satu sidang - untuk tooltip dan baris rincian di bawah gambar. */
function rincianTitik(t: TitikPerjalanan): string[] {
  return [
    `Sidang ke-${t.ke} · ${tanggalHariPanjang(t.tanggal)}${t.hariPutus ? " · hari putusan" : ""}${
      t.akanDatang ? " · belum berlangsung" : ""
    }`,
    `Agenda: ${t.agenda || "tanpa agenda"}`,
    t.potonganMediasi > 0
      ? `Dihitung ${t.hari} hari - ${t.hariKalender} hari kalender sejak pendaftaran, mediasi ${t.potonganMediasi} hari tidak dihitung`
      : `Dihitung ${t.hari} hari - ${t.hariKalender} hari kalender sejak pendaftaran, hari pendaftaran ikut dihitung`,
    t.jeda === null ? "Sidang pertama" : `+${t.jeda} hari dari sidang sebelumnya`,
    t.alasanTunda ? `Ditunda: ${t.alasanTunda}` : t.keterangan ? `Keterangan: ${t.keterangan}` : "",
  ].filter(Boolean);
}

type LapisanPita = { dari: number; sampai: number; nada: NadaPita; label: string };

/** "sampai 90 hari · ...", "91-120 hari · ...", "lebih dari 150 hari". */
function sebutanPita(l: LapisanPita) {
  if (l.nada === "merah") return `lebih dari ${l.dari} hari`;
  const rentang = l.dari === 0 ? `sampai ${l.sampai} hari` : `${l.dari + 1}-${l.sampai} hari`;
  return `${rentang} · ${l.label}`;
}

/**
 * Tempat sebuah TANGGAL pada sumbu yang berjarak per sidang - untuk arsiran
 * mediasi. Di antara dua sidang tempatnya sebanding harinya; di luar sidang
 * pertama dan terakhir ia dijepit ke tepi.
 */
function xDariTanggal(iso: string, waktuTitik: number[], xTitik: number[]) {
  const w = Date.parse(`${iso}T00:00:00Z`);
  const akhir = waktuTitik.length - 1;
  if (Number.isNaN(w) || w <= waktuTitik[0]) return xTitik[0];
  if (w >= waktuTitik[akhir]) return xTitik[akhir];
  for (let i = 0; i < akhir; i += 1) {
    if (w <= waktuTitik[i + 1]) {
      const rentang = waktuTitik[i + 1] - waktuTitik[i];
      return rentang > 0
        ? xTitik[i] + ((w - waktuTitik[i]) / rentang) * (xTitik[i + 1] - xTitik[i])
        : xTitik[i];
    }
  }
  return xTitik[akhir];
}

export function DiagramPerjalananSidang({
  perjalanan,
  pita,
  judul,
  hariIniDihitung = null,
  ghaib = false,
}: {
  perjalanan: PerjalananSidang;
  /** Urut naik. Di atas pita terakhir: merah. */
  pita: PitaUmur[];
  judul?: string;
  /** Umur perkara HARI INI dalam hari yang dihitung; null bila sudah putus. */
  hariIniDihitung?: number | null;
  /**
   * Perkara ghaib - status.penanda.ghaib di layar Status Perkara.
   *
   * Hanya menyalakan satu kalimat catatan; garis, titik, dan pita TIDAK
   * berubah. Lihat catatan berkelonggaran di bawah: inilah satu-satunya tempat
   * yang menerangkan mengapa grafik ini dan lencana Antrian Sidang dapat
   * berselisih sampai 120 hari untuk perkara yang sama.
   */
  ghaib?: boolean;
}) {
  const { titik } = perjalanan;
  const cukup = titik.length >= 3;

  // Lebar DIUKUR, bukan diregangkan lewat viewBox. SVG yang diregangkan ikut
  // membesarkan tulisannya: huruf 10 piksel menjadi 16 piksel di layar lebar
  // dan 6 piksel di layar sempit. Diukur, huruf tetap 10 piksel di mana pun, dan
  // yang terlalu sempit digulir mendatar alih-alih ditumpuk.
  const kotak = useRef<HTMLDivElement>(null);
  const [lebarKotak, setLebarKotak] = useState(0);
  const [pilihan, setPilihan] = useState<number | null>(null);

  useEffect(() => {
    const el = kotak.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Tanpa pengukuran serentak di badan efek (react-hooks/set-state-in-effect):
    // ResizeObserver sendiri memanggil sekali begitu mulai mengamati.
    const pengamat = new ResizeObserver((catat) => {
      const lebar = catat[0]?.contentRect.width ?? 0;
      if (lebar > 0) setLebarKotak(Math.round(lebar));
    });
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [cukup]);

  // Aturan 2: dua titik selalu membentuk garis lurus.
  if (!cukup) {
    return (
      <div>
        <Kepala judul={judul} />
        <Kosong
          pesan={`Baru ${titik.length} sidang. Perjalanan tidak digambar di bawah tiga sidang - dua titik selalu membentuk garis lurus.`}
        />
      </div>
    );
  }

  const n = titik.length;
  const KIRI = 34; // angka sumbu tegak
  const KANAN = 42; // sebutan pita, mis. "5 bln"
  const ATAS = 26; // keterangan batas, dan angka di atas titik tertinggi
  const TINGGI = 200; // bidang gambar
  const BAWAH = 50; // tiga baris: sidang ke-, tanggal, jarak
  const TEPI = 16; // titik pertama dan terakhir tidak menempel ke tepi
  const JARAK_MIN = 46; // di bawah ini tulisan dua sidang saling menimpa

  const W = Math.max(lebarKotak > 0 ? lebarKotak : 640, KIRI + KANAN + 2 * TEPI + (n - 1) * JARAK_MIN);
  const H = ATAS + TINGGI + BAWAH;
  const dasarY = ATAS + TINGGI;
  const kananPlot = W - KANAN;
  const xAwal = KIRI + TEPI;
  const langkah = (kananPlot - TEPI - xAwal) / (n - 1);
  const xTitik = titik.map((_, i) => xAwal + i * langkah);
  const waktuTitik = titik.map((t) => Date.parse(`${t.tanggal}T00:00:00Z`));

  // Aturan 1: sumbu bermula dari NOL. Puncaknya batas pita terdekat di atas data
  // beserta ruang kepala 8 persen - bukan selalu 150. Batas yang jauh di atas
  // tetap DISEBUT di kepala gambar, tidak dihilangkan.
  const puncakData = Math.max(1, ...titik.map((t) => t.hari));
  const berkepala = puncakData * 1.08;
  const atas = pita.map((p) => p.sampai).find((b) => b >= berkepala) ?? Math.ceil(berkepala / 30) * 30;
  const y = (v: number) => dasarY - (Math.min(Math.max(v, 0), atas) / atas) * TINGGI;
  // Kelipatan 30 - satu bulan menurut SK - kecuali pada skala sempit.
  const langkahTik = atas <= 90 ? 15 : 30 * Math.ceil(atas / 180);
  const tik: number[] = [];
  for (let v = 0; v <= atas; v += langkahTik) tik.push(v);

  const lapisan: LapisanPita[] = [];
  let dari = 0;
  for (const p of pita) {
    lapisan.push({ dari, sampai: p.sampai, nada: p.nada, label: p.label });
    dari = p.sampai;
  }
  lapisan.push({ dari, sampai: Number.POSITIVE_INFINITY, nada: "merah", label: "" });
  const lapisanTampak = lapisan.filter((l) => l.dari < atas);

  const batasAkhir = pita.length > 0 ? pita[pita.length - 1] : null;
  const batasDiAtas = batasAkhir && batasAkhir.sampai > atas ? batasAkhir : null;

  const arsir = perjalanan.rentangMediasi
    .map((r) => ({
      ...r,
      x1: xDariTanggal(r.mulai, waktuTitik, xTitik),
      x2: xDariTanggal(r.selesai, waktuTitik, xTitik),
    }))
    .filter((r) => r.x2 - r.x1 >= 1);

  const jedaTerpanjang = Math.max(0, ...titik.map((t) => t.jeda ?? 0));
  const ruasTerpanjang = jedaTerpanjang > 0 ? titik.findIndex((t) => t.jeda === jedaTerpanjang) : -1;
  const sisa = hariIniDihitung !== null && batasAkhir ? batasAkhir.sampai - hariIniDihitung : null;

  // Aturan 3: yang dipotong dikatakan - dan yang tidak dapat dipastikan pun.
  // Titik hari putusan memotong mediasi yang jatuh SEBELUM putusan saja.
  // "Lama perkara" di kepala layar memotong angka SIPP (v_durasi_mediasi),
  // yang menghitung mediasi tanpa laporan mediator sampai HARI INI - juga
  // pada perkara yang sudah lama putus. Bila keduanya berbeda, dikatakan -
  // bukan diaku sama (tinjauan 24 September 2026; terukur 52 perkara putus).
  const titikPutus = titik.find((t) => t.hariPutus) ?? null;
  const selisihDenganKepala =
    titikPutus && !perjalanan.potonganTakTerletak && perjalanan.hariMediasi > titikPutus.potonganMediasi
      ? perjalanan.hariMediasi - titikPutus.potonganMediasi
      : 0;

  const catatan = [
    `${n} sidang${
      perjalanan.sesudahPutus > 0
        ? ` sampai putusan. ${perjalanan.sesudahPutus} sidang sesudah putusan (mis. ikrar talak) tidak digambar - bukan bagian jangka penyelesaian perkara`
        : ""
    }.`,
    "Tinggi titik: hari yang dihitung - hari pendaftaran hari ke-1, hari mediasi tidak dihitung (PERMA 1/2016 Pasal 24), dengan cara Lama perkara. Angka di bawah sumbu: jarak dari sidang sebelumnya.",
    selisihDenganKepala > 0
      ? `Lama perkara di kepala layar memotong ${perjalanan.hariMediasi} hari mediasi menurut SIPP, yang menghitung mediasi tanpa laporan mediator sampai hari ini; grafik hanya memotong ${titikPutus?.potonganMediasi ?? 0} hari yang jatuh sebelum putusan - karena itu titik putusannya ${selisihDenganKepala} hari lebih tinggi.`
      : "",
    ruasTerpanjang > 0
      ? `Jeda terpanjang +${jedaTerpanjang} hari, dari sidang ke-${titik[ruasTerpanjang - 1].ke} ke sidang ke-${titik[ruasTerpanjang].ke}${
          titik[ruasTerpanjang - 1].alasanTunda ? ` (ditunda: ${titik[ruasTerpanjang - 1].alasanTunda})` : ""
        }.`
      : "",
    sisa !== null && batasAkhir
      ? sisa >= 0
        ? `Hari ini hari ke-${hariIniDihitung} yang dihitung - ${sisa} hari lagi sampai batas ${batasAkhir.label}.`
        : `Hari ini hari ke-${hariIniDihitung} yang dihitung - batas ${batasAkhir.label} sudah lewat ${-sisa} hari.`
      : "",
    perjalanan.potonganTakTerletak
      ? `Mediasi ${perjalanan.hariMediasi} hari belum dapat ditempatkan pada tanggalnya - titik memakai hari kalender, lebih tinggi daripada Lama perkara.`
      : "",
    perjalanan.mediasiTakTerpotong
      ? "Lama mediasi belum terbaca dari SIPP - rentangnya diarsir tetapi tidak dipotong, sama seperti Lama perkara."
      : "",
    perjalanan.rentangMediasi.some((r) => r.tanpaLaporan)
      ? "Ada mediasi tanpa tanggal laporan mediator - di grafik dianggap berjalan sampai putusan atau hari ini (SIPP sendiri menghitungnya sampai hari ini, juga pada perkara yang sudah putus). Periksa laporan mediatornya."
      : "",
    perjalanan.tanpaTanggal > 0
      ? `${perjalanan.tanpaTanggal} sidang dengan tanggal tak terbaca atau sebelum pendaftaran tidak digambar.`
      : "",
    // ========================================================================
    // SELISIH 120 HARI ANTAR-LAYAR DITERANGKAN DI SINI, SEKALI
    // ========================================================================
    //
    // Perkara ghaib punya DUA angka umur yang keduanya benar, dan layar yang
    // berbeda memajang angka yang berbeda:
    //
    //   grafik ini          hari kalender di luar mediasi - cara SEMA 2/2014
    //   lencana Antrian     angka itu DIKURANGI kelonggaran 120 hari SK
    //                       048/2024 Tabel 2 nomor 1
    //
    // Terukur di sipp_donggala 25 September 2026: dari 13 perkara ghaib yang
    // belum putus, 12 lencananya berbunyi "1 hari" karena potongannya dijepit -
    // 322/Pdt.G/2026 berjalan 115 hari dan berbunyi "1 hari · dari 115".
    // Panitera yang menyandingkan grafik ini dengan lencana itu melihat 115
    // lawan 1 tanpa satu pun kalimat yang menerangkannya.
    //
    // Garisnya SENGAJA tidak dipotong: kelonggaran SK memotong penilaian
    // KINERJA majelis, sedangkan grafik ini menggambar jalannya perkara. Batas
    // lima bulan SEMA 2/2014 - pita oranye teratas - juga tidak mengenal
    // kelonggaran itu, jadi memotong garisnya akan membuat kewajiban lapor
    // majelis hilang dari gambar.
    ghaib
      ? "Perkara ghaib: garis ini hari kalender di luar mediasi, dengan cara batas lima bulan SEMA 2/2014 - TIDAK dipotong. Kelonggaran 120 hari SK Dirjen Badilag 048/2024 Tabel 2 nomor 1 hanya memotong penilaian kinerja waktu putus, bukan garis ini; karena itu lencana umur di Antrian Sidang dapat berbunyi jauh lebih rendah daripada titik terakhir di sini."
      : "",
  ].filter(Boolean);

  const terpilih = pilihan !== null && pilihan < n ? titik[pilihan] : null;

  return (
    <div>
      <Kepala judul={judul} />
      <ul className="mb-2 space-y-0.5 text-xs leading-5 text-muted-foreground">
        {catatan.map((kalimat) => (
          <li key={kalimat}>{kalimat}</li>
        ))}
      </ul>
      <div className="overflow-x-auto rounded-lg border border-border/80 bg-card/40 p-3">
        <div ref={kotak} className="w-full">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="block"
            role="img"
            aria-label={`Umur perkara pada ${n} sidang, dari ${titik[0].hari} sampai ${titik[n - 1].hari} hari yang dihitung`}
          >
            {/* Pita latar - hijau, kuning, oranye, merah. */}
            {lapisanTampak.map((l) => {
              const yAtas = y(Math.min(l.sampai, atas));
              return (
                <rect
                  key={`pita-${l.dari}`}
                  x={KIRI}
                  y={yAtas}
                  width={kananPlot - KIRI}
                  height={y(l.dari) - yAtas}
                  className={WARNA_PITA[l.nada].latar}
                />
              );
            })}

            {/* Kisi dan angka sumbu tegak. */}
            {tik.map((v) => (
              <g key={`tik-${v}`}>
                <line
                  x1={KIRI}
                  y1={y(v)}
                  x2={kananPlot}
                  y2={y(v)}
                  className={v === 0 ? "stroke-border" : "stroke-border/50"}
                  strokeWidth="1"
                />
                <text x={KIRI - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                  {v}
                </text>
              </g>
            ))}
            <text x={KIRI - 6} y={ATAS - 12} textAnchor="end" className="fill-muted-foreground text-[10px]">
              hari
            </text>

            {/* Rentang mediasi - hari yang tidak dihitung. Teal, sama dengan
                mediasi pada Kalender perkara. */}
            {arsir.map((r) => (
              <g key={`mediasi-${r.mulai}`}>
                <title>{`Mediasi ${tanggalHariPanjang(r.mulai)} sampai ${tanggalHariPanjang(r.selesai)}${
                  r.tanpaLaporan ? " (belum ada laporan mediator)" : ""
                } - ${r.hari} hari, tidak dihitung (PERMA 1/2016 Pasal 24)`}</title>
                <rect x={r.x1} y={ATAS} width={r.x2 - r.x1} height={TINGGI} className="fill-teal-500/15 dark:fill-teal-400/15" />
                {r.x2 - r.x1 >= 44 ? (
                  <text x={r.x1 + 4} y={ATAS + 12} className="fill-teal-700 text-[10px] font-medium dark:fill-teal-300">
                    mediasi
                  </text>
                ) : null}
              </g>
            ))}

            {/* Garis batas tiap pita, diwarnai pita yang DIMASUKINYA. */}
            {pita
              .filter((p) => p.sampai <= atas)
              .map((p) => {
                const nada = (lapisan.find((l) => l.dari === p.sampai) || lapisan[lapisan.length - 1]).nada;
                return (
                  <g key={`batas-${p.sampai}`}>
                    <title>{`${p.sampai} hari - ${p.label}`}</title>
                    <line
                      x1={KIRI}
                      y1={y(p.sampai)}
                      x2={kananPlot}
                      y2={y(p.sampai)}
                      className={WARNA_PITA[nada].garis}
                      strokeWidth="1"
                      strokeDasharray="5 4"
                    />
                    <text x={kananPlot + 4} y={y(p.sampai) + 3} className={`${WARNA_PITA[nada].teks} text-[10px] font-medium`}>
                      {p.singkat}
                    </text>
                  </g>
                );
              })}
            {batasDiAtas ? (
              <text x={kananPlot} y={ATAS - 12} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {`↑ ${batasDiAtas.label}: ${batasDiAtas.sampai} hari`}
              </text>
            ) : null}

            {/* Ruas antar sidang - kemiringannya adalah jaraknya. */}
            {titik.slice(1).map((t, j) => {
              const s = titik[j];
              const d = `M ${xTitik[j].toFixed(1)} ${y(s.hari).toFixed(1)} L ${xTitik[j + 1].toFixed(1)} ${y(t.hari).toFixed(1)}`;
              return (
                <g key={`ruas-${t.kunci}`}>
                  <title>{`+${t.jeda ?? "?"} hari: sidang ke-${s.ke} (${tanggalHariPanjang(s.tanggal)}) ke sidang ke-${t.ke} (${tanggalHariPanjang(t.tanggal)})${
                    s.alasanTunda ? `\nDitunda: ${s.alasanTunda}` : ""
                  }`}</title>
                  <path d={d} className="fill-none stroke-transparent" strokeWidth="12" />
                  <path
                    d={d}
                    className="fill-none stroke-primary"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={t.akanDatang ? "5 4" : undefined}
                  />
                </g>
              );
            })}

            {/* Titik - satu sidang. Berongga: belum berlangsung. Bercincin: hari putusan. */}
            {titik.map((t, i) => {
              const cx = xTitik[i];
              const cy = y(t.hari);
              return (
                <g
                  key={`titik-${t.kunci}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setPilihan(i)}
                  onClick={() => setPilihan(i)}
                >
                  <title>{rincianTitik(t).join("\n")}</title>
                  <circle cx={cx} cy={cy} r="12" className="fill-transparent" />
                  {t.hariPutus ? (
                    <circle cx={cx} cy={cy} r="8" className="fill-none stroke-primary" strokeWidth="1.5" />
                  ) : null}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={t.akanDatang ? 4 : t.hariPutus ? 4.5 : 3.5}
                    className={t.akanDatang ? "fill-card stroke-primary" : "fill-primary stroke-card"}
                    strokeWidth={t.akanDatang ? 2 : 1.5}
                  />
                  <text
                    x={cx}
                    y={cy - (t.hariPutus ? 12 : 8)}
                    textAnchor="middle"
                    className={`text-[10px] tabular-nums ${t.akanDatang ? "fill-muted-foreground" : "fill-foreground font-medium"}`}
                  >
                    {t.hariPutus ? `${t.hari} · putus` : t.hari}
                  </text>
                </g>
              );
            })}

            {/* Sumbu mendatar: sidang ke-, tanggal, dan jarak di antaranya.
                "ke-" adalah nomor sidang SIPP - angka yang sama dengan tepi
                kiri daftar Perjalanan sidang di atas gambar ini. */}
            {titik.map((t, i) => {
              const tahunBerganti = i === 0 || t.tanggal.slice(0, 4) !== titik[i - 1].tanggal.slice(0, 4);
              return (
                <g key={`sumbu-${t.kunci}`}>
                  <line x1={xTitik[i]} y1={dasarY} x2={xTitik[i]} y2={dasarY + 4} className="stroke-border" />
                  <text x={xTitik[i]} y={dasarY + 15} textAnchor="middle" className="fill-foreground/70 text-[10px] font-medium">
                    {`ke-${t.ke}`}
                  </text>
                  <text x={xTitik[i]} y={dasarY + 27} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {tanggalRingkas(t.tanggal, tahunBerganti)}
                  </text>
                  {i > 0 && t.jeda !== null ? (
                    <text
                      x={(xTitik[i - 1] + xTitik[i]) / 2}
                      y={dasarY + 42}
                      textAnchor="middle"
                      className={`text-[10px] tabular-nums ${
                        i === ruasTerpanjang ? "fill-foreground font-semibold" : "fill-muted-foreground"
                      }`}
                    >
                      {`+${t.jeda}${langkah >= 60 ? " hari" : ""}`}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Keterangan warna - hanya yang tampak pada gambar ini. */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {lapisanTampak.map((l) => (
            <span key={`kunci-${l.dari}`} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-4 rounded-sm ${WARNA_PITA[l.nada].contoh}`} />
              {sebutanPita(l)}
            </span>
          ))}
          {arsir.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-teal-500/30 dark:bg-teal-400/30" />
              mediasi - tidak dihitung
            </span>
          ) : null}
          {titik.some((t) => t.hariPutus) ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary ring-1 ring-primary ring-offset-1 ring-offset-card" />
              hari putusan
            </span>
          ) : null}
          {titik.some((t) => t.akanDatang) ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border-2 border-primary" />
              belum berlangsung
            </span>
          ) : null}
        </div>

        {/* Rincian terpilih - tooltip tidak ada pada layar sentuh. */}
        <p className="mt-1.5 min-h-[1.25rem] text-xs leading-5" aria-live="polite">
          {terpilih ? (
            rincianTitik(terpilih).join(" · ")
          ) : (
            <span className="text-muted-foreground">Arahkan atau ketuk titik untuk rincian sidangnya.</span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
 * D16 - GARIS MINI DI DALAM SEL
 * ========================================================================== */

/**
 * Riwayat ringkas sebuah baris, digambar sebesar satu sel tabel.
 *
 * Gunanya menjawab pertanyaan yang selalu muncul saat melihat daftar temuan:
 * "apakah baris ini memang selalu begini, atau baru belakangan?" Tanpa itu,
 * satu periode buruk terbaca sama dengan kebiasaan buruk yang menahun.
 *
 * Sengaja tanpa sumbu, tanpa angka, tanpa kisi. Yang dicari BENTUKnya - naik,
 * turun, atau berombak. Angka pastinya ada di kolom sebelahnya, dan mengulang
 * angka di dalam gambar sekecil ini hanya membuat keduanya sulit dibaca.
 */
export function GarisMini({
  nilai,
  lebar = 72,
  tinggi = 20,
  judul,
}: {
  nilai: Array<number | null>;
  lebar?: number;
  tinggi?: number;
  judul?: string;
}) {
  const isi = nilai.filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  // Di bawah tiga titik, bentuknya tidak bermakna - dua titik selalu lurus.
  if (isi.length < 3) {
    return (
      <span className="text-xs text-muted-foreground" title="riwayat belum cukup untuk digambar">
        -
      </span>
    );
  }

  const puncak = Math.max(...isi, 1);
  const dasar = Math.min(...isi, 0);
  const jangkauan = puncak - dasar || 1;
  const langkah = lebar / (isi.length - 1);
  const d = isi
    .map((n, i) => {
      const x = i * langkah;
      const y = tinggi - ((n - dasar) / jangkauan) * tinggi;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const akhir = isi[isi.length - 1];
  const awal = isi[0];
  const arah = akhir > awal ? "naik" : akhir < awal ? "turun" : "tetap";

  return (
    <svg
      viewBox={`0 0 ${lebar} ${tinggi}`}
      className="inline-block h-5 w-[4.5rem] align-middle"
      role="img"
      aria-label={judul || `riwayat ${isi.length} periode, ${arah}`}
    >
      <title>{judul || `${isi.length} periode terakhir, ${arah}`}</title>
      <path d={d} className="fill-none stroke-primary" strokeWidth="1.5" />
      <circle
        cx={lebar}
        cy={tinggi - ((akhir - dasar) / jangkauan) * tinggi}
        r="2"
        className={arah === "turun" ? "fill-rose-500" : "fill-primary"}
      />
    </svg>
  );
}

/* ==========================================================================
 * S - DIAGRAM SEBAR
 * ========================================================================== */

export function DiagramSebar({
  titik,
  judul,
  labelX,
  labelY,
}: {
  titik: Array<{ x: number; y: number; label?: string }>;
  judul?: string;
  labelX?: string;
  labelY?: string;
}) {
  const isi = titik.filter((t) => Number.isFinite(t.x) && Number.isFinite(t.y));
  const W = 460;
  const H = 220;
  const maxX = Math.max(...isi.map((t) => t.x), 1);
  const maxY = Math.max(...isi.map((t) => t.y), 1);

  if (!isi.length) return <Kosong pesan="Belum ada pasangan nilai untuk disebar." />;

  return (
    <div>
      <Kepala judul={judul} catatan={`${isi.length} titik`} />
      <div className="overflow-x-auto rounded-lg border border-border/80 bg-card/40 p-3">
        <svg viewBox={`0 0 ${W + 30} ${H + 26}`} className="h-auto w-full min-w-[20rem]" role="img">
          <line x1="26" y1={H} x2={W + 26} y2={H} className="stroke-border" />
          <line x1="26" y1="0" x2="26" y2={H} className="stroke-border" />
          {isi.map((t, i) => (
            <circle
              key={`${t.x}-${t.y}-${i}`}
              cx={26 + (t.x / maxX) * W}
              cy={H - (t.y / maxY) * H}
              r="3"
              className="fill-primary/70"
            >
              <title>{t.label || `${t.x} / ${t.y}`}</title>
            </circle>
          ))}
          {labelX ? (
            <text x={W + 26} y={H + 18} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {labelX}
            </text>
          ) : null}
          {labelY ? (
            <text x="0" y="10" className="fill-muted-foreground text-[10px]">
              {labelY}
            </text>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

/* ==========================================================================
 * P - DIAGRAM PAI
 * ========================================================================== */

/**
 * ============================================================================
 * WARNA IRISAN - DIUKUR, BUKAN DIPILIH MENURUT SELERA
 * ============================================================================
 *
 * Palet lama dijalankan lewat pemeriksa palet dan GAGAL dua kali, keduanya
 * pada irisan pertama yang memakai warna utama aplikasi:
 *
 *   pita terang   #155375 berada di L 0,421 - di luar pita 0,43-0,77, terlalu
 *                 gelap sehingga tampak hitam di antara irisan lain;
 *   lantai kroma  kroma 0,083 di bawah lantai 0,1 - ia terbaca ABU-ABU, dan
 *                 abu-abu di dalam pai terbaca sebagai "lain-lain".
 *
 * Warna utama aplikasi memang bukan warna kategorikal. Ia warna tindakan -
 * tombol dan tautan - dan dipilih untuk kontras terhadap tulisan, bukan untuk
 * dibedakan dari tujuh warna lain di dalam satu lingkaran.
 *
 * ============================================================================
 * DELAPAN IRISAN TIDAK PERNAH DAPAT DIBEDAKAN - DAN ITU TERUKUR
 * ============================================================================
 *
 * Pada pemeriksaan SELURUH pasangan, tidak ada palet delapan warna yang lulus -
 * termasuk palet acuan yang sudah tervalidasi. Batasnya tiga warna; pada empat
 * warna lantai penglihatan normal sudah jatuh di bawah 15.
 *
 * Karena itu jumlah irisan dipotong menjadi ENAM, dan yang diperiksa pasangan
 * yang BERSENTUHAN - sebab pada pai yang membingungkan mata adalah dua irisan
 * bersebelahan, bukan dua irisan yang berseberangan. Pada enam irisan kedua
 * mode LULUS SELURUH PEMERIKSAAN: pita terang, lantai kroma, pemisahan buta
 * warna, dan lantai penglihatan normal.
 *
 * Peringatan kontras pada mode terang dijawab keterangan bertulisan di samping
 * gambar - identitas tidak pernah bersandar pada warna saja.
 *
 * Urutannya TETAP, tidak diputar. Warna mengikuti entitasnya, bukan
 * peringkatnya: menyaring satu irisan tidak boleh mengecat ulang sisanya.
 */
const WARNA_IRISAN = [
  "fill-[#2a78d6] dark:fill-[#3987e5]",
  "fill-[#eb6834] dark:fill-[#d95926]",
  "fill-[#1baf7a] dark:fill-[#199e70]",
  "fill-[#eda100] dark:fill-[#c98500]",
  "fill-[#e87ba4] dark:fill-[#d55181]",
  "fill-[#008300] dark:fill-[#008300]",
];

export function DiagramPai({ data, judul, maksIrisan = 6 }: { data: TitikData[]; judul?: string; maksIrisan?: number }) {
  const isi = ada(data).filter((d) => (d.nilai as number) > 0);
  if (!isi.length) return <Kosong pesan="Belum ada bagian untuk digambar." />;

  const urut = [...isi].sort((a, b) => (b.nilai as number) - (a.nilai as number));
  const utama = urut.slice(0, maksIrisan - 1);
  const sisa = urut.slice(maksIrisan - 1);
  const disatukan = sisa.reduce((a, b) => a + (b.nilai as number), 0);
  const irisan = disatukan > 0 ? [...utama, { label: `Lainnya (${sisa.length} macam)`, nilai: disatukan }] : utama;

  const total = irisan.reduce((a, b) => a + (b.nilai as number), 0);

  // Sudut tiap irisan dihitung SEBELUM digambar, bukan ditumpuk sambil
  // menggambar. Mengubah nilai di tengah penggambaran membuat hasilnya
  // bergantung pada urutan React memanggil - dan itu tidak dijamin.
  const berSudut = irisan.reduce<Array<{ label: string; nilai: number; mulai: number; selesai: number }>>(
    (kumpul, d) => {
      const mulai = kumpul.length ? kumpul[kumpul.length - 1].selesai : -Math.PI / 2;
      const bagian = ((d.nilai as number) / total) * Math.PI * 2;
      kumpul.push({ label: d.label, nilai: d.nilai as number, mulai, selesai: mulai + bagian });
      return kumpul;
    },
    []
  );

  return (
    <div>
      <Kepala
        judul={judul}
        catatan={
          disatukan > 0
            ? `${sisa.length} bagian terkecil disatukan sebagai "Lainnya" - jumlahnya ${disatukan.toLocaleString("id-ID")}`
            : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-5 rounded-lg border border-border/80 bg-card/40 p-3">
        <svg viewBox="0 0 100 100" className="h-40 w-40 shrink-0" role="img">
          {berSudut.map((d, i) => {
            const x1 = 50 + 46 * Math.cos(d.mulai);
            const y1 = 50 + 46 * Math.sin(d.mulai);
            const x2 = 50 + 46 * Math.cos(d.selesai);
            const y2 = 50 + 46 * Math.sin(d.selesai);
            const besar = d.selesai - d.mulai > Math.PI ? 1 : 0;
            return (
              <path
                key={d.label}
                d={`M 50 50 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 46 46 0 ${besar} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
                className={WARNA_IRISAN[i % WARNA_IRISAN.length]}
              >
                <title>{`${d.label}: ${d.nilai.toLocaleString("id-ID")}`}</title>
              </path>
            );
          })}
        </svg>
        <ul className="min-w-0 flex-1 space-y-1 text-sm">
          {irisan.map((d, i) => (
            <li key={d.label} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <svg viewBox="0 0 10 10" className="h-3 w-3 shrink-0">
                  <rect width="10" height="10" rx="2" className={WARNA_IRISAN[i % WARNA_IRISAN.length]} />
                </svg>
                <span className="truncate">{d.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {(((d.nilai as number) / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ==========================================================================
 * K - PETA KENDALI
 * ========================================================================== */

/**
 * Peta kendali membedakan naik-turun biasa dari perubahan yang sungguhan.
 *
 * Batasnya dihitung dari datanya sendiri - rerata ditambah dan dikurangi tiga
 * simpangan baku. Titik di luar batas itu bukan "nilai buruk", melainkan
 * pertanda bahwa ada yang BERUBAH pada prosesnya, dan itulah yang layak
 * ditelusuri.
 *
 * Di bawah delapan titik, batasnya tidak dihitung. Simpangan baku dari lima
 * angka bukan simpangan baku - ia hanya angka yang tampak seperti simpangan
 * baku, dan garis batas yang digambar darinya akan menuduh titik yang wajar.
 */
export function PetaKendali({ data, judul }: { data: TitikData[]; judul?: string }) {
  const isi = ada(data);
  const W = 640;
  const H = 180;

  const hitung = useMemo(() => {
    if (isi.length < 8) return null;
    const nilai = isi.map((d) => d.nilai as number);
    const rerata = nilai.reduce((a, b) => a + b, 0) / nilai.length;
    const ragam = nilai.reduce((a, b) => a + (b - rerata) ** 2, 0) / (nilai.length - 1);
    const sb = Math.sqrt(ragam);
    return { rerata, sb, atas: rerata + 3 * sb, bawah: Math.max(0, rerata - 3 * sb) };
  }, [isi]);

  if (!isi.length) return <Kosong pesan="Belum ada data untuk dipetakan." />;

  if (!hitung) {
    return (
      <div>
        <Kepala judul={judul} />
        <Kosong
          pesan={`Baru ${isi.length} titik. Batas kendali tidak dihitung di bawah delapan titik - simpangan baku dari data sesedikit itu akan menuduh titik yang wajar.`}
        />
      </div>
    );
  }

  const puncak = Math.max(...isi.map((d) => d.nilai as number), hitung.atas, 1);
  const titik = jalurGaris(isi, W, H, puncak);
  const y = (v: number) => H - (v / puncak) * H;

  return (
    <div>
      <Kepala
        judul={judul}
        catatan={`Rerata ${hitung.rerata.toFixed(1)}; batas ${hitung.bawah.toFixed(1)} sampai ${hitung.atas.toFixed(1)} (tiga simpangan baku)`}
      />
      <div className="overflow-x-auto rounded-lg border border-border/80 bg-card/40 p-3">
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="h-auto w-full min-w-[24rem]" role="img">
          <line x1="0" y1={y(hitung.atas)} x2={W} y2={y(hitung.atas)} className="stroke-rose-500" strokeDasharray="5 4" />
          <line x1="0" y1={y(hitung.bawah)} x2={W} y2={y(hitung.bawah)} className="stroke-rose-500" strokeDasharray="5 4" />
          <line x1="0" y1={y(hitung.rerata)} x2={W} y2={y(hitung.rerata)} className="stroke-foreground/40" />
          <path
            d={titik.map((t, i) => `${i === 0 ? "M" : "L"} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`).join(" ")}
            className="fill-none stroke-primary"
            strokeWidth="1.5"
          />
          {titik.map((t) => {
            const v = t.d.nilai as number;
            const luar = v > hitung.atas || v < hitung.bawah;
            return (
              <circle
                key={t.d.label}
                cx={t.x}
                cy={t.y}
                r={luar ? 4 : 2.5}
                className={luar ? "fill-rose-600" : "fill-primary"}
              >
                <title>{`${t.d.label}: ${v.toLocaleString("id-ID")}${luar ? " - di luar batas kendali" : ""}`}</title>
              </circle>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ==========================================================================
 * L - BENTUK RESMI
 * ========================================================================== */

/**
 * Bentuk resmi - sajian yang dapat dicetak dan dilampirkan.
 *
 * Kakinya wajib: tanggal hitung, ambang yang dipakai, dan keterangan
 * penyandingan. Lembar cetak tanpa kaki itu tidak dapat dipertanggungjawabkan
 * enam bulan kemudian, ketika tidak seorang pun ingat aturan apa yang berlaku
 * saat angkanya dihitung.
 */
export function BentukResmi({
  judul,
  subjudul,
  kolom,
  baris,
  tanggalHitung,
  ambang,
  penyandingan,
}: {
  judul: string;
  subjudul?: string;
  kolom: KolomTabel[];
  baris: Array<Record<string, unknown>>;
  tanggalHitung: string;
  ambang?: string;
  penyandingan?: string;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-card/60 p-4">
      <div className="mb-3 border-b border-border/70 pb-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide">{judul}</p>
        {subjudul ? <p className="text-xs text-muted-foreground">{subjudul}</p> : null}
      </div>

      {baris.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/70 text-muted-foreground">
              <tr>
                {kolom.map((k) => (
                  <th key={k.kunci} className={`px-2 py-1.5 font-semibold ${k.angka ? "text-right" : ""}`}>
                    {k.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={String(b.kunci ?? i)} className="border-b border-border/40">
                  {kolom.map((k) => (
                    <td key={k.kunci} className={`px-2 py-1.5 ${k.angka ? "text-right tabular-nums" : ""}`}>
                      {b[k.kunci] === null || b[k.kunci] === undefined || b[k.kunci] === "" ? "-" : String(b[k.kunci])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Kosong pesan="Tidak ada baris pada periode ini." />
      )}

      <dl className="mt-3 space-y-0.5 border-t border-border/70 pt-2 text-xs text-muted-foreground">
        <div>
          <dt className="inline font-medium">Tanggal hitung: </dt>
          <dd className="inline">{tanggalHitung}</dd>
        </div>
        {ambang ? (
          <div>
            <dt className="inline font-medium">Ambang yang dipakai: </dt>
            <dd className="inline">{ambang}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline font-medium">Penyandingan: </dt>
          <dd className="inline">
            {penyandingan || "belum disandingkan dengan angka dari luar ALETA - belum boleh dipakai membina"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ==========================================================================
 * PENERJEMAH HURUF
 * ========================================================================== */

/** Huruf bentuk yang dikenali berkas ini. Sama dengan yang dikenal katalog. */
export const HURUF_DIKENALI = "NTRBGASPKL".split("");

/**
 * Apakah seluruh huruf pada sebuah butir dapat digambar?
 *
 * Dipakai penjaga: butir yang menyebut huruf yang tidak dapat digambar akan
 * menampilkan bagian kosong tanpa keterangan, dan itu terbaca seperti aplikasi
 * rusak.
 */
export function hurufTakDikenali(bentuk: string): string[] {
  return [...String(bentuk || "")].filter((h) => !HURUF_DIKENALI.includes(h));
}
