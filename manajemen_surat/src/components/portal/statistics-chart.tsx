"use client";

/**
 * ============================================================================
 * GRAFIK STATISTIK - DELAPAN BENTUK, TANPA SATU PUN PUSTAKA
 * ============================================================================
 *
 * Tiga bentuk menjadi delapan. Yang ditambahkan dipilih menurut PEKERJAAN
 * datanya, bukan menurut ragamnya:
 *
 *   batang            besaran antar kategori - bentuk bawaan
 *   batang mendatar   ketika labelnya panjang; "Pengesahan Perkawinan/Istbat
 *                     Nikah" tidak muat di bawah batang tegak
 *   garis             perubahan menurut waktu
 *   bidang            perubahan menurut waktu ketika yang dibaca JUMLAHNYA
 *   lolipop           kategori banyak - tangkainya tipis, jadi tiga puluh
 *                     kategori masih terbaca
 *   lingkaran         bagian dari keseluruhan
 *   donat             sama, dengan jumlah seluruhnya di tengahnya
 *   petak             bagian dari keseluruhan ketika kategorinya banyak -
 *                     luas lebih mudah dibandingkan daripada juring tipis
 *
 * TANPA PUSTAKA GRAFIK. Bukan karena hemat, melainkan karena satu pustaka
 * grafik berarti satu hal lagi yang harus dibangun ulang di peladen, dipindai
 * keamanannya, dan ditambal tiap tahun - untuk menggambar bentuk yang seluruh
 * perhitungannya muat di berkas ini. Ia juga yang menjaga janji "jangan sampai
 * lag": tidak ada yang diunduh, tidak ada yang dijalankan sebelum tergambar.
 *
 * ============================================================================
 * WARNANYA DIHITUNG, BUKAN DIKIRA-KIRA
 * ============================================================================
 *
 * Palet lama - enam warna yang dipakai lingkaran - DIPERIKSA dengan pengukur
 * palet, dan satu di antaranya gagal:
 *
 *     Chroma floor   GAGAL   #0f766e (0,086) - terbaca ABU-ABU
 *
 * Ia juga DIPUTAR: `colors[index % colors.length]`. Kategori ketujuh karena itu
 * berwarna sama dengan yang pertama, dan dua juring sewarna pada satu lingkaran
 * adalah kekeliruan yang tidak berbunyi.
 *
 * Palet baru delapan slot, diperiksa pada kedua tema:
 *
 *     terang   Lightness LULUS · Chroma LULUS · CVD LULUS (ΔE 9,1 protan)
 *              · Normal-vision LULUS (ΔE 19,6) · Contrast PERINGATAN pada
 *                tiga warna - dan itulah sebabnya daftar berlabel SELALU
 *                digambar di samping tiap grafik bagian-dari-keseluruhan;
 *                peringatan kontras menuntut label yang terbaca, bukan
 *                diabaikan
 *     gelap    kelima pemeriksaan LULUS
 *
 * Temanya DIPILIH, bukan dibalik: palet gelap punya langkahnya sendiri.
 *
 * Kategori kesembilan TIDAK diberi warna karangan - ia dilipat menjadi
 * "Lainnya" beserta jumlah kategorinya, sehingga tidak ada satu pun angka yang
 * hilang diam-diam dan tidak ada dua kategori sewarna.
 */

import { useId } from "react";

import { cn } from "@/lib/utils";

type DataPoint = {
  label: string;
  value: number;
};

export type JenisGrafik =
  | "bar"
  | "bar-h"
  | "line"
  | "area"
  | "lollipop"
  | "pie"
  | "donut"
  | "treemap";

/** Bentuk yang tersedia beserta kapan ia dipakai - satu sumber untuk layar. */
export const JENIS_GRAFIK: { nilai: JenisGrafik; label: string; untuk: string }[] = [
  { nilai: "bar", label: "Batang", untuk: "membandingkan besaran antar kategori" },
  { nilai: "bar-h", label: "Batang mendatar", untuk: "kategori berlabel panjang" },
  { nilai: "line", label: "Garis", untuk: "perubahan menurut waktu" },
  { nilai: "area", label: "Bidang", untuk: "perubahan menurut waktu, yang dibaca jumlahnya" },
  { nilai: "lollipop", label: "Lolipop", untuk: "kategori banyak, tetap terbaca" },
  { nilai: "pie", label: "Lingkaran", untuk: "bagian dari keseluruhan" },
  { nilai: "donut", label: "Donat", untuk: "bagian dari keseluruhan, dengan jumlahnya" },
  { nilai: "treemap", label: "Petak", untuk: "bagian dari keseluruhan, kategori banyak" },
];

/**
 * Palet kategori - urut tetap, TIDAK pernah diputar.
 *
 * Delapan slot, dan slot kesembilan memang tidak ada: yang melewatinya dilipat
 * menjadi "Lainnya". Menghasilkan warna kesembilan secara hitungan berarti
 * warna yang tidak pernah diperiksa keterbacaannya.
 */
const PALET_TERANG = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

const PALET_GELAP = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
] as const;

const SLOT_MAKSIMUM = PALET_TERANG.length;

/** Satu warna slot - dua tema, dipilih lewat CSS, bukan lewat JavaScript. */
function warnaSlot(indeks: number) {
  const i = Math.min(indeks, SLOT_MAKSIMUM - 1);
  return { terang: PALET_TERANG[i], gelap: PALET_GELAP[i] };
}

/**
 * Melipat kategori yang melewati delapan menjadi satu "Lainnya".
 *
 * Jumlahnya DISEBUT - "Lainnya (5 kategori)" - supaya yang membaca tahu ada
 * yang dilipat, dan angkanya tetap utuh: jumlah seluruh juring sama dengan
 * jumlah seluruh data.
 */
function lipatKeLainnya(data: DataPoint[]) {
  if (data.length <= SLOT_MAKSIMUM) return { baris: data, dilipat: 0 };
  const urut = [...data].sort((a, b) => b.value - a.value);
  const depan = urut.slice(0, SLOT_MAKSIMUM - 1);
  const ekor = urut.slice(SLOT_MAKSIMUM - 1);
  const jumlahEkor = ekor.reduce((n, x) => n + x.value, 0);
  return {
    baris: [...depan, { label: `Lainnya (${ekor.length} kategori)`, value: jumlahEkor }],
    dilipat: ekor.length,
  };
}

const angka = (n: number) => n.toLocaleString("id-ID");

function Kosong() {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-[1.4rem] border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
      Belum ada data yang cocok dengan filter saat ini.
    </div>
  );
}

function Bingkai({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[1.4rem] border border-border bg-card/80 p-5", className)}>
      {children}
    </div>
  );
}

export function StatisticsChart({ type, data }: { type: JenisGrafik; data: DataPoint[] }) {
  if (data.length === 0) return <Kosong />;

  switch (type) {
    case "bar-h":
      return <BatangMendatar data={data} />;
    case "line":
      return <Garis data={data} />;
    case "area":
      return <Garis data={data} bidang />;
    case "lollipop":
      return <Lolipop data={data} />;
    case "pie":
      return <Juring data={data} />;
    case "donut":
      return <Juring data={data} donat />;
    case "treemap":
      return <Petak data={data} />;
    default:
      return <Batang data={data} />;
  }
}

/* ========================================================================== */
/* Batang tegak                                                               */
/* ========================================================================== */

function Batang({ data }: { data: DataPoint[] }) {
  const maks = Math.max(...data.map((x) => x.value), 1);
  const lebar = 680;
  const tinggi = 240;
  const kaki = 34;
  const selaBatang = 2; // dua piksel permukaan antar batang - lihat marks & anatomy
  const lebarSel = lebar / data.length;
  const lebarBatang = Math.max(6, lebarSel - selaBatang * 2 - 8);
  // Angka hanya pada yang tertinggi dan terendah bila kategorinya banyak:
  // satu angka di atas tiap batang menutupi grafiknya sendiri.
  const semuaBerangka = data.length <= 12;
  const nilaiMaks = Math.max(...data.map((x) => x.value));
  const nilaiMin = Math.min(...data.map((x) => x.value));

  return (
    <Bingkai>
      <svg viewBox={`0 0 ${lebar} ${tinggi + kaki}`} className="w-full" role="img">
        {data.map((satu, i) => {
          const t = Math.max((satu.value / maks) * (tinggi - 24), 2);
          const x = i * lebarSel + (lebarSel - lebarBatang) / 2;
          const y = tinggi - t;
          const berangka = semuaBerangka || satu.value === nilaiMaks || satu.value === nilaiMin;
          return (
            <g key={satu.label}>
              <title>{`${satu.label}: ${angka(satu.value)}`}</title>
              <rect x={x} y={y} width={lebarBatang} height={t} rx={4} className="fill-primary" />
              {berangka ? (
                <text
                  x={x + lebarBatang / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-semibold"
                >
                  {angka(satu.value)}
                </text>
              ) : null}
              <text
                x={x + lebarBatang / 2}
                y={tinggi + 16}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {satu.label.length > 14 ? `${satu.label.slice(0, 13)}…` : satu.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Bingkai>
  );
}

/* ========================================================================== */
/* Batang mendatar - untuk label yang panjang                                 */
/* ========================================================================== */

function BatangMendatar({ data }: { data: DataPoint[] }) {
  const maks = Math.max(...data.map((x) => x.value), 1);
  return (
    <Bingkai>
      <div className="flex flex-col gap-1.5">
        {data.map((satu) => (
          <div key={satu.label} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3">
            <span className="truncate text-xs text-muted-foreground" title={satu.label}>
              {satu.label}
            </span>
            <span className="h-4 rounded-sm bg-muted/50" title={`${satu.label}: ${angka(satu.value)}`}>
              <span
                className="block h-4 rounded-sm bg-primary"
                style={{ width: `${Math.max((satu.value / maks) * 100, 1)}%` }}
              />
            </span>
            <span className="text-right text-xs font-semibold tabular-nums text-foreground">
              {angka(satu.value)}
            </span>
          </div>
        ))}
      </div>
    </Bingkai>
  );
}

/* ========================================================================== */
/* Garis, dan bidang                                                          */
/* ========================================================================== */

function Garis({ data, bidang = false }: { data: DataPoint[]; bidang?: boolean }) {
  const idGradasi = useId();
  const lebar = 680;
  const tinggi = 240;
  const tepi = 26;
  const maks = Math.max(...data.map((x) => x.value), 1);
  const titik = data.map((satu, i) => ({
    ...satu,
    x: tepi + (i * (lebar - tepi * 2)) / Math.max(data.length - 1, 1),
    y: tinggi - tepi - (satu.value / maks) * (tinggi - tepi * 2),
  }));
  const jalur = titik.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const jalurBidang = `${jalur} L ${titik[titik.length - 1].x} ${tinggi - tepi} L ${titik[0].x} ${tinggi - tepi} Z`;
  const nilaiMaks = Math.max(...data.map((x) => x.value));

  return (
    <Bingkai>
      <svg viewBox={`0 0 ${lebar} ${tinggi + 34}`} className="w-full" role="img">
        {bidang ? (
          <>
            <defs>
              <linearGradient id={idGradasi} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={jalurBidang} fill={`url(#${idGradasi})`} className="text-primary" />
          </>
        ) : null}
        {/* Dua piksel, bukan empat - lihat mark specs: garis tipis, bukan pita. */}
        <path d={jalur} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
        {titik.map((p) => (
          <g key={p.label}>
            <title>{`${p.label}: ${angka(p.value)}`}</title>
            {/* Cincin permukaan dua piksel supaya titik yang bertumpuk tetap terpisah. */}
            <circle cx={p.x} cy={p.y} r="5" className="fill-primary stroke-card" strokeWidth="2" />
            <text x={p.x} y={tinggi + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {p.label.length > 10 ? `${p.label.slice(0, 9)}…` : p.label}
            </text>
            {p.value === nilaiMaks ? (
              <text x={p.x} y={p.y - 11} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                {angka(p.value)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </Bingkai>
  );
}

/* ========================================================================== */
/* Lolipop - kategori banyak, tangkai tipis                                   */
/* ========================================================================== */

function Lolipop({ data }: { data: DataPoint[] }) {
  const maks = Math.max(...data.map((x) => x.value), 1);
  const lebar = 680;
  const tinggi = 240;
  const kaki = 34;
  const sela = lebar / data.length;

  return (
    <Bingkai>
      <svg viewBox={`0 0 ${lebar} ${tinggi + kaki}`} className="w-full" role="img">
        {data.map((satu, i) => {
          const x = i * sela + sela / 2;
          const y = tinggi - Math.max((satu.value / maks) * (tinggi - 24), 2);
          return (
            <g key={satu.label}>
              <title>{`${satu.label}: ${angka(satu.value)}`}</title>
              <line x1={x} y1={tinggi} x2={x} y2={y} stroke="currentColor" strokeWidth="2" className="text-primary/50" />
              <circle cx={x} cy={y} r="5" className="fill-primary stroke-card" strokeWidth="2" />
              <text x={x} y={tinggi + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {satu.label.length > 10 ? `${satu.label.slice(0, 9)}…` : satu.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Bingkai>
  );
}

/* ========================================================================== */
/* Lingkaran dan donat                                                        */
/* ========================================================================== */

function Juring({ data, donat = false }: { data: DataPoint[]; donat?: boolean }) {
  const { baris, dilipat } = lipatKeLainnya(data);
  const jumlah = baris.reduce((n, x) => n + x.value, 0) || 1;
  const pusat = 110;
  const jari = 92;
  const jariDalam = donat ? 52 : 0;

  let berjalan = 0;
  const juring = baris.map((satu, i) => {
    const mulai = (berjalan / jumlah) * Math.PI * 2 - Math.PI / 2;
    berjalan += satu.value;
    const selesai = (berjalan / jumlah) * Math.PI * 2 - Math.PI / 2;
    const busurBesar = selesai - mulai > Math.PI ? 1 : 0;
    const x1 = pusat + jari * Math.cos(mulai);
    const y1 = pusat + jari * Math.sin(mulai);
    const x2 = pusat + jari * Math.cos(selesai);
    const y2 = pusat + jari * Math.sin(selesai);
    const jalur = donat
      ? [
          `M ${x1} ${y1}`,
          `A ${jari} ${jari} 0 ${busurBesar} 1 ${x2} ${y2}`,
          `L ${pusat + jariDalam * Math.cos(selesai)} ${pusat + jariDalam * Math.sin(selesai)}`,
          `A ${jariDalam} ${jariDalam} 0 ${busurBesar} 0 ${pusat + jariDalam * Math.cos(mulai)} ${pusat + jariDalam * Math.sin(mulai)}`,
          "Z",
        ].join(" ")
      : [`M ${pusat} ${pusat}`, `L ${x1} ${y1}`, `A ${jari} ${jari} 0 ${busurBesar} 1 ${x2} ${y2}`, "Z"].join(" ");
    return { ...satu, jalur, warna: warnaSlot(i), persen: (satu.value / jumlah) * 100 };
  });

  return (
    <Bingkai className="grid gap-6 md:grid-cols-[260px_1fr] md:items-center">
      <svg viewBox="0 0 220 220" className="mx-auto h-[220px] w-[220px]" role="img">
        {juring.map((j) => (
          <path
            key={j.label}
            d={j.jalur}
            fill={j.warna.terang}
            /* Dua piksel permukaan antar juring - lihat spacers. */
            stroke="var(--card, #fff)"
            strokeWidth="2"
            className="dark:[fill:var(--gelap)]"
            style={{ ["--gelap" as string]: j.warna.gelap }}
          >
            <title>{`${j.label}: ${angka(j.value)} (${j.persen.toFixed(1)}%)`}</title>
          </path>
        ))}
        {donat ? (
          <>
            <text x={pusat} y={pusat - 2} textAnchor="middle" className="fill-foreground text-[22px] font-bold">
              {angka(jumlah)}
            </text>
            <text x={pusat} y={pusat + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              seluruhnya
            </text>
          </>
        ) : null}
      </svg>

      {/* ====================================================================
          DAFTAR BERLABEL SELALU ADA, DAN ITU BUKAN HIASAN
          ====================================================================

          Pengukur palet memberi PERINGATAN kontras pada tiga warna tema terang
          (#1baf7a 2,74 · #eda100 2,11 · #e87ba4 2,62 terhadap permukaannya).
          Peringatan itu menuntut label yang terbaca atau tampilan tabel - ia
          tidak boleh diabaikan. Daftar inilah tabelnya: tiap warna berdampingan
          dengan namanya dan angkanya, sehingga identitas tidak pernah
          bergantung pada warna semata. */}
      <div className="space-y-1.5">
        {juring.map((j) => (
          <div
            key={j.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-1.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3 w-3 flex-none rounded-full dark:[background:var(--gelap)]"
                style={{ backgroundColor: j.warna.terang, ["--gelap" as string]: j.warna.gelap }}
              />
              <span className="truncate text-sm text-foreground" title={j.label}>
                {j.label}
              </span>
            </div>
            <span className="flex-none text-sm font-semibold tabular-nums text-foreground">
              {angka(j.value)}
              <span className="ml-1.5 font-normal text-muted-foreground">{j.persen.toFixed(1)}%</span>
            </span>
          </div>
        ))}
        {dilipat > 0 ? (
          <p className="pt-1 text-xs text-muted-foreground">
            {dilipat} kategori terkecil digabung menjadi “Lainnya”. Jumlah seluruhnya tidak berubah.
          </p>
        ) : null}
      </div>
    </Bingkai>
  );
}

/* ========================================================================== */
/* Petak - bagian dari keseluruhan ketika kategorinya banyak                   */
/* ========================================================================== */

/**
 * Petak disusun baris demi baris menurut besarnya.
 *
 * Bukan algoritme squarify yang sesungguhnya - ini menyusun baris berisi
 * beberapa petak, tiap baris setinggi bagiannya. Cukup untuk membandingkan
 * luas, dan seluruh perhitungannya muat di dua puluh baris tanpa pustaka.
 */
function Petak({ data }: { data: DataPoint[] }) {
  const { baris: isi, dilipat } = lipatKeLainnya(data);
  const jumlah = isi.reduce((n, x) => n + x.value, 0) || 1;
  const perBaris = isi.length <= 4 ? 2 : 3;
  const kelompok: (typeof isi)[] = [];
  for (let i = 0; i < isi.length; i += perBaris) kelompok.push(isi.slice(i, i + perBaris));

  return (
    <Bingkai>
      <div className="flex min-h-[260px] flex-col gap-0.5">
        {kelompok.map((satuBaris, iBaris) => {
          const jumlahBaris = satuBaris.reduce((n, x) => n + x.value, 0) || 1;
          const tinggiBaris = (jumlahBaris / jumlah) * 100;
          return (
            <div
              key={`baris-${iBaris}`}
              className="flex gap-0.5"
              style={{ height: `${Math.max(tinggiBaris, 6)}%`, minHeight: "44px" }}
            >
              {satuBaris.map((satu, iKolom) => {
                const slot = iBaris * perBaris + iKolom;
                const warna = warnaSlot(slot);
                const persen = (satu.value / jumlah) * 100;
                return (
                  <div
                    key={satu.label}
                    className="flex min-w-0 flex-col justify-end overflow-hidden rounded-md p-2 dark:[background:var(--gelap)]"
                    style={{
                      width: `${Math.max((satu.value / jumlahBaris) * 100, 8)}%`,
                      backgroundColor: warna.terang,
                      ["--gelap" as string]: warna.gelap,
                    }}
                    title={`${satu.label}: ${angka(satu.value)} (${persen.toFixed(1)}%)`}
                  >
                    {/* Tulisan putih di atas petak berwarna, bukan warna seri di
                        atas permukaan - inilah satu-satunya tempat warna seri
                        menjadi latar, dan tulisannya diberi bayangan supaya
                        terbaca di atas kuning maupun hijau tua. */}
                    <span className="truncate text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.45)]">
                      {satu.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,.45)]">
                      {angka(satu.value)} · {persen.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {dilipat > 0 ? (
        <p className="pt-3 text-xs text-muted-foreground">
          {dilipat} kategori terkecil digabung menjadi “Lainnya”. Jumlah seluruhnya tidak berubah.
        </p>
      ) : null}
    </Bingkai>
  );
}
