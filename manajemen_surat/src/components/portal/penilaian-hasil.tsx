"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * ============================================================================
 * PENGGAMBARAN HASIL PENILAIAN - SATU KOMPONEN UNTUK SEMUA LAYAR
 * ============================================================================
 *
 * Dipakai dua layar: Penilaian Berjenjang di dalam ALETA x SIPP, dan ALETA
 * e-Audit. Keduanya menggambar hasil yang sama, dari mesin yang sama.
 *
 * Dipisahkan ke sini dengan sengaja. Bila tiap layar menggambar sendiri,
 * jadilah dua salinan aturan penahanan nilai - dan pada suatu hari satu layar
 * menahan nilai yang ditampilkan layar lain, untuk angka yang persis sama.
 * Kekeliruan seperti itu paling sulit ditemukan, sebab keduanya "bekerja".
 *
 * ============================================================================
 * LIMA KEADAAN YANG MENAHAN NILAI
 * ============================================================================
 *
 * Seluruhnya datang dari mesinnya, bukan diputuskan di sini:
 *
 *   1. bawahLantai      - periodenya lebih pendek daripada lantai penilaian
 *   2. cukup: false     - penyebutnya di bawah dua puluh
 *   3. selisihRingkas   - kueri agregat tidak sepakat dengan daftar buktinya
 *   4. hariLibur        - daftar hari libur tahun itu belum disahkan
 *   5. penyandingan     - belum pernah dibandingkan dengan angka dari luar
 *
 * Yang kelima tidak menghilangkan angkanya, tetapi menempel padanya sampai
 * seseorang benar-benar menyandingkan.
 */

export type BarisBukti = Record<string, unknown>;

export type CaraHitung = {
  pembilang?: string;
  penyebut?: string;
  dikecualikan?: string;
  tabelSumber?: string;
  ruasSumber?: string;
};

export type SatuanHasil = {
  unit: { kunci: string; label?: string; mulai: string; selesai: string };
  nilai: number | null;
  cukup: boolean;
  sebabTidakCukup?: string;
  terpenuhi?: number;
  penyebut?: number;
  batasPenyebut?: number;
  jumlahBukti?: number;
  belumMemenuhi?: number;
  buktiDipotong?: boolean;
  bukti?: BarisBukti[];
  selisihRingkas?: {
    dariBaris: { terpenuhi: number; penyebut: number };
    dariRingkas: { terpenuhi: number; penyebut: number };
    arti: string;
  } | null;
};

export type AmbangDipakai = {
  kunci?: string;
  nilai: number | null;
  satuan?: string;
  dasar?: string;
  sifat?: string;
  sebab?: string;
  mulai?: string;
};

export type HasilPenilaian = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  kunci?: string;
  judul?: string;
  keterangan?: string;
  lantai?: string;
  versiRumus?: string;
  acuan?: string;
  periode?: { jenis: string; label: string; satuan: string; banyak: number };
  bawahLantai?: boolean;
  satuan?: SatuanHasil[];
  ambangDipakai?: AmbangDipakai[];
  caraHitung?: CaraHitung;
  penyandingan?: { keadaan?: string; penanda?: string };
  pakaiHariKerja?: boolean;
  hariLibur?: {
    dapatDipercaya: boolean;
    tahunBelumDisahkan?: number[];
    tahunTanpaDaftar?: number[];
    sebab?: string | null;
  } | null;
};

/** Ruas yang tidak perlu menjadi kolom - sudah tampil sebagai judul baris. */
const RUAS_BUKAN_KOLOM = new Set(["kunci"]);

const LABEL_KOLOM: Record<string, string> = {
  bulanLaporan: "Bulan",
  batasKirim: "Batas Kirim",
  tanggalKirim: "Dikirim",
  terlambatHari: "Telat (hari)",
  angkaLaporan: "Angka Laporan",
  angkaSipp: "Angka SIPP",
  selisihAngka: "Selisih",
  nilai: "Nilai",
  keadaan: "Keadaan",
};

function judulRuas(ruas: string) {
  if (LABEL_KOLOM[ruas]) return LABEL_KOLOM[ruas];
  const dipisah = ruas.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return dipisah.charAt(0).toUpperCase() + dipisah.slice(1);
}

function tampilkan(nilai: unknown): string {
  if (nilai === null || nilai === undefined || nilai === "") return "-";
  if (typeof nilai === "boolean") return nilai ? "ya" : "tidak";
  if (typeof nilai === "number") return Number.isInteger(nilai) ? String(nilai) : nilai.toFixed(2);
  return String(nilai);
}

/**
 * Warna nilai. Ambangnya sengaja longgar dan hanya tiga tingkat - warna di sini
 * membantu mata, bukan menetapkan predikat. Predikat ditetapkan manusia.
 */
export function warnaNilai(nilai: number | null): "success" | "warning" | "danger" | "muted" {
  if (nilai === null) return "muted";
  if (nilai >= 90) return "success";
  if (nilai >= 75) return "warning";
  return "danger";
}

export function HasilPenilaianTampil({
  hasil,
  buktiTerbuka,
  setBuktiTerbuka,
}: {
  hasil: HasilPenilaian;
  buktiTerbuka: string;
  setBuktiTerbuka: (kunci: string) => void;
}) {
  if (hasil.ok === false) {
    return (
      <Card className="border-rose-300/70">
        <CardContent className="pt-6 text-sm text-rose-800 dark:text-rose-300">
          {hasil.alasan || "Penilaian tidak dapat dijalankan."}
        </CardContent>
      </Card>
    );
  }

  const keadaanSanding = hasil.penyandingan?.keadaan || "belum";
  const sudahDisanding = keadaanSanding === "sudah" || keadaanSanding === "cocok";

  return (
    <Card className="border-border/80">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{hasil.judul}</CardTitle>
            <CardDescription>
              {hasil.periode?.label} - {hasil.periode?.banyak} {hasil.periode?.satuan} sampai{" "}
              {hasil.acuan}
            </CardDescription>
          </div>
          <Badge variant={sudahDisanding ? "success" : "warning"}>
            {sudahDisanding ? "sudah disandingkan" : "belum disandingkan"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ==================================================================
            PENYANDINGAN - PERINGATAN YANG TIDAK BOLEH HILANG
            ==================================================================
            Angka yang belum pernah dibandingkan dengan angka dari luar ALETA
            belum boleh dipakai membina siapa pun. Peringatan ini menempel pada
            hasilnya, bukan disembunyikan di catatan kaki. */}
        {sudahDisanding ? null : (
          <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            Angka ini belum pernah disandingkan dengan angka dari luar ALETA. Boleh dibaca dan
            diperiksa, belum boleh dipakai membina.
            {hasil.penyandingan?.penanda ? ` ${hasil.penyandingan.penanda}` : ""}
          </div>
        )}

        {/* ==================================================================
            DAFTAR HARI LIBUR - DASAR YANG BELUM DIPASTIKAN
            ==================================================================
            Hanya penilaian yang benar-benar menghitung hari kerja yang membawa
            pita ini. Menghitung tenggang tiga hari kerja dengan daftar libur
            yang belum disahkan berarti menuduh juru sita memakai dasar yang
            belum dipastikan sendiri. */}
        {hasil.pakaiHariKerja && hasil.hariLibur && !hasil.hariLibur.dapatDipercaya ? (
          <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            Penilaian ini menghitung <strong>hari kerja</strong>, dan{" "}
            {hasil.hariLibur.sebab || "daftar hari liburnya belum disahkan"}. Angkanya boleh dibaca,
            belum boleh dipakai membina. Yang perlu dikerjakan: mencocokkan tanggalnya dengan SKB
            tiga menteri, lalu menandai tahun itu sudah disahkan.
          </div>
        ) : null}

        {hasil.bawahLantai ? (
          <div className="rounded-md border border-border/80 bg-muted/50 p-3 text-sm">
            Penilaian ini berlantai <strong>{hasil.lantai}</strong>. Pada jendela sependek ini yang
            disajikan daftar kerjanya, bukan nilai - persentase dari beberapa baris tidak memberi
            tahu apa pun.
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(hasil.satuan || []).map((s) => (
            <SatuanKartu
              key={s.unit.kunci}
              satuan={s}
              terbuka={buktiTerbuka === s.unit.kunci}
              onBuka={() => setBuktiTerbuka(buktiTerbuka === s.unit.kunci ? "" : s.unit.kunci)}
            />
          ))}
        </div>

        {(hasil.satuan || []).map((s) =>
          buktiTerbuka === s.unit.kunci ? (
            <TabelBukti key={`bukti-${s.unit.kunci}`} satuan={s} />
          ) : null
        )}

        <PanelCaraHitung caraHitung={hasil.caraHitung} ambang={hasil.ambangDipakai} />
      </CardContent>
    </Card>
  );
}

function SatuanKartu({
  satuan,
  terbuka,
  onBuka,
}: {
  satuan: SatuanHasil;
  terbuka: boolean;
  onBuka: () => void;
}) {
  const jumlahBukti =
    satuan.jumlahBukti !== undefined ? satuan.jumlahBukti : (satuan.bukti || []).length;

  return (
    <div className="rounded-lg border border-border/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{satuan.unit.label || satuan.unit.kunci}</p>
          <p className="text-xs text-muted-foreground">
            {satuan.unit.mulai} s.d. {satuan.unit.selesai}
          </p>
        </div>
        {satuan.nilai === null ? (
          <Badge variant="muted">tanpa nilai</Badge>
        ) : (
          <Badge variant={warnaNilai(satuan.nilai)}>{satuan.nilai.toFixed(1)}</Badge>
        )}
      </div>

      {/* Pembilang dan penyebut tetap tampil meski nilainya ditahan. Justru
          angka itulah yang menerangkan mengapa nilainya ditahan. */}
      <p className="mt-2 text-sm tabular-nums">
        {satuan.terpenuhi !== undefined ? (
          <>
            {satuan.terpenuhi} dari {satuan.penyebut}
          </>
        ) : (
          <>{jumlahBukti} baris</>
        )}
        {satuan.belumMemenuhi ? (
          <span className="text-muted-foreground"> - {satuan.belumMemenuhi} belum memenuhi</span>
        ) : null}
      </p>

      {satuan.nilai === null && satuan.sebabTidakCukup ? (
        <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">
          {satuan.sebabTidakCukup}
        </p>
      ) : null}

      {satuan.selisihRingkas ? (
        <div className="mt-2 rounded-md border border-rose-300/70 bg-rose-50 p-2 text-xs leading-5 text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
          <strong>Temuan:</strong> kueri agregat memulangkan{" "}
          {satuan.selisihRingkas.dariRingkas.terpenuhi} dari{" "}
          {satuan.selisihRingkas.dariRingkas.penyebut}, sedangkan daftar buktinya{" "}
          {satuan.selisihRingkas.dariBaris.terpenuhi} dari{" "}
          {satuan.selisihRingkas.dariBaris.penyebut}. Yang tampil diambil dari buktinya.
        </div>
      ) : null}

      {jumlahBukti > 0 ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onBuka}>
          {terbuka ? "Tutup bukti" : `Lihat bukti (${jumlahBukti})`}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Daftar bukti. Kolomnya disusun dari ruas yang benar-benar ada pada barisnya,
 * bukan dari daftar yang ditulis di layar - tiap penilaian membawa ruas yang
 * berbeda, dan menuliskannya di sini berarti kolom yang menghilang diam-diam
 * begitu sebuah penilaian menambah ruas.
 */
function TabelBukti({ satuan }: { satuan: SatuanHasil }) {
  const kolom = useMemo(() => {
    const terkumpul: string[] = [];
    (satuan.bukti || []).forEach((b) => {
      Object.keys(b).forEach((k) => {
        if (!RUAS_BUKAN_KOLOM.has(k) && !terkumpul.includes(k)) terkumpul.push(k);
      });
    });
    return terkumpul;
  }, [satuan.bukti]);
  const baris = satuan.bukti || [];

  if (baris.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2 text-sm">
        <span className="font-medium">Bukti - {satuan.unit.label || satuan.unit.kunci}</span>
        {satuan.buktiDipotong ? (
          <span className="text-xs text-muted-foreground">
            {baris.length} dari {satuan.jumlahBukti} baris ditampilkan
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{baris.length} baris, seluruhnya</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr>
              {kolom.map((k) => (
                <th key={k} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {judulRuas(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <tr
                key={String(b.kunci ?? i)}
                className={
                  b.memenuhi === false
                    ? "border-t border-border/70 bg-rose-50/60 dark:bg-rose-950/20"
                    : "border-t border-border/70"
                }
              >
                {kolom.map((k) => (
                  <td key={k} className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {tampilkan(b[k])}
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

/**
 * Cara hitung dan ambangnya. Keduanya datang dari mesin yang benar-benar
 * menghitung, sehingga panel ini tidak dapat menerangkan rumus yang berbeda
 * dari yang dipakai.
 */
function PanelCaraHitung({
  caraHitung,
  ambang,
}: {
  caraHitung?: CaraHitung;
  ambang?: AmbangDipakai[];
}) {
  if (!caraHitung) return null;
  const baris: Array<[string, string | undefined]> = [
    ["Yang dihitung memenuhi", caraHitung.pembilang],
    ["Pembaginya", caraHitung.penyebut],
    ["Yang dikecualikan", caraHitung.dikecualikan],
    ["Tabel SIPP yang dibaca", caraHitung.tabelSumber],
    ["Ruas yang dibaca", caraHitung.ruasSumber],
  ];

  const belumBerlaku = (ambang || []).filter((a) => a && a.nilai === null);

  return (
    <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
      <p className="mb-2 text-sm font-semibold">Cara hitung</p>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        {baris.map(([label, isi]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="leading-6">{isi || "-"}</dd>
          </div>
        ))}
      </dl>

      {(ambang || []).length > 0 ? (
        <div className="mt-3 border-t border-border/70 pt-3">
          <p className="mb-2 text-sm font-semibold">Ambang yang dipakai</p>
          <ul className="space-y-1 text-sm">
            {(ambang || []).map((a, i) => (
              <li key={a?.kunci || i} className="leading-6">
                {a && a.nilai !== null ? (
                  <>
                    <span className="font-medium tabular-nums">
                      {a.nilai} {a.satuan || ""}
                    </span>
                    {a.dasar ? (
                      <span className="text-muted-foreground"> - {a.dasar}</span>
                    ) : null}
                    {a.sifat ? <Badge variant="muted" className="ml-2">{a.sifat}</Badge> : null}
                  </>
                ) : (
                  <span className="text-amber-800 dark:text-amber-300">
                    {a?.sebab || "ambang ini belum berlaku pada tanggal periode yang dinilai"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {belumBerlaku.length > 0 ? (
            <p className="mt-2 text-xs leading-5 text-amber-800 dark:text-amber-300">
              Ada ambang yang belum berlaku pada periode ini. Menilai dengan ambang yang belum
              berlaku berarti menilai orang dengan aturan yang belum ada.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
