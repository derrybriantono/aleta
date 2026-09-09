"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  HasilPenilaianTampil,
  warnaNilai,
  type AmbangDipakai,
  type CaraHitung,
  type HasilPenilaian,
} from "@/components/portal/penilaian-hasil";
import { apiPath } from "@/lib/base-path";

/**
 * ============================================================================
 * PENILAIAN BERJENJANG - LAYAR YANG MENOLAK MENAMPILKAN ANGKA YANG TIDAK PANTAS
 * ============================================================================
 *
 * Delapan penilaian sudah dapat dihitung dan lulus uji. Sampai layar ini ada,
 * tidak seorang pun di pengadilan dapat MELIHATnya - dan kode yang lulus uji
 * tetapi tidak dapat dilihat siapa pun bukan pekerjaan yang selesai.
 *
 * Layar ini bukan penghias hasil. Tugasnya justru sebaliknya: menahan angka
 * yang belum pantas ditampilkan sebagai nilai, dan menyebut sebabnya. Ada empat
 * keadaan yang membuat nilai TIDAK ditampilkan, dan seluruhnya datang dari
 * mesinnya - bukan diputuskan di sini:
 *
 *   1. `bawahLantai`  - periodenya lebih pendek daripada lantai penilaian itu.
 *                       Ketaatan tenggang pemanggilan tidak bermakna sebagai
 *                       persentase harian; yang disajikan daftar kerjanya.
 *   2. `cukup: false` - penyebutnya di bawah dua puluh. Tiga dari tiga adalah
 *                       seratus persen, dan seratus persen dari tiga tidak
 *                       memberi tahu apa pun.
 *   3. `selisihRingkas` - kueri agregat dan daftar buktinya tidak sepakat.
 *                       Itu temuan, bukan hal yang boleh dibulatkan.
 *   4. penyandingan belum dikerjakan - angkanya belum pernah dibandingkan
 *                       dengan angka dari luar ALETA.
 *
 * Yang keempat tidak menghilangkan angkanya, tetapi menempel padanya sampai
 * seseorang benar-benar menyandingkan.
 *
 * ============================================================================
 * BUKTINYA IKUT, DAN ITU YANG MEMBEDAKANNYA DARI PAPAN ANGKA
 * ============================================================================
 *
 * Tiap satuan periode membawa daftar barisnya. Angka pembilang dan penyebutnya
 * DITURUNKAN dari daftar itu, sehingga keduanya tidak mungkin berbeda. Orang
 * yang tidak percaya pada angkanya dapat membuka daftarnya, mengambil satu
 * nomor perkara, lalu memeriksanya sendiri di SIPP.
 *
 * Kolom daftarnya tidak ditulis di sini. Tiap penilaian membawa ruasnya
 * sendiri - tenggang pemanggilan membawa juru sita dan tanggal relaas,
 * kelengkapan berita acara membawa panitera sidang - dan menuliskannya di layar
 * berarti daftar kedua yang perlahan menyimpang. Kolomnya disusun dari ruas
 * yang benar-benar ada pada barisnya.
 */

type ApiEnvelope<T> = { ok?: boolean; data?: T; error?: { message?: string } };


type PenilaianRingkas = {
  kunci: string;
  judul: string;
  keterangan?: string;
  lantai?: string;
  versiRumus?: string;
  ambangDipakai?: string[];
  caraHitung?: CaraHitung;
  punyaRingkas?: boolean;
};

type JendelaPeriode = { jenis: string; label: string; satuan?: string };

type DaftarJawaban = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  jumlah?: number;
  penilaian?: PenilaianRingkas[];
  periode?: JendelaPeriode[];
  catatan?: string;
};


type ButirLipa = { nomor: number; kunci: string; nama: string; dipa04: boolean };

type BarisBlangko = {
  bulanLaporan: string;
  batasKirim: string | null;
  tanggalKirim: string | null;
  terlambatHari: number | null;
  angkaLaporan: number | null;
  angkaSipp: number | null;
  selisihAngka: number | null;
  nilai: number | null;
  keadaan?: string;
  nilaiKetepatan?: number | null;
  nilaiKesesuaian?: number | null;
  belumDapatDinilai?: string | null;
};

type Blangko = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  lipa?: string;
  nomor?: number;
  nama?: string;
  dipa04?: boolean;
  kolom?: string[];
  baris?: BarisBlangko[];
  catatan?: string;
};


async function ambilJson<T>(alamat: string, opsi?: RequestInit): Promise<T> {
  const respons = await fetch(apiPath(alamat), { cache: "no-store", ...opsi });
  const isi = (await respons.json()) as ApiEnvelope<T>;
  return (isi.data ?? (isi as unknown)) as T;
}

export function AletaPenilaianBerjenjang() {
  const [daftar, setDaftar] = useState<DaftarJawaban | null>(null);
  const [galatDaftar, setGalatDaftar] = useState("");
  const [kunci, setKunci] = useState("");
  const [periode, setPeriode] = useState("bulanan");
  const [acuan, setAcuan] = useState("");
  const [hasil, setHasil] = useState<HasilPenilaian | null>(null);
  const [sedangHitung, setSedangHitung] = useState(false);
  const [buktiTerbuka, setBuktiTerbuka] = useState<string>("");

  useEffect(() => {
    let dibatalkan = false;
    (async () => {
      try {
        const jawab = await ambilJson<DaftarJawaban>("/api/aleta-penilaian/daftar");
        if (dibatalkan) return;
        setDaftar(jawab);
        if (jawab.penilaian && jawab.penilaian.length > 0) setKunci(jawab.penilaian[0].kunci);
      } catch (galat) {
        if (!dibatalkan) setGalatDaftar(galat instanceof Error ? galat.message : String(galat));
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, []);

  const terpilih = useMemo(
    () => (daftar?.penilaian || []).find((p) => p.kunci === kunci) || null,
    [daftar, kunci]
  );

  const jalankan = useCallback(async () => {
    if (!kunci) return;
    setSedangHitung(true);
    setBuktiTerbuka("");
    try {
      const kueri = new URLSearchParams({ kunci, periode, bukti: "25" });
      if (acuan) kueri.set("acuan", acuan);
      const jawab = await ambilJson<HasilPenilaian>(`/api/aleta-penilaian/jalankan?${kueri.toString()}`);
      setHasil(jawab);
    } catch (galat) {
      setHasil({ ok: false, alasan: galat instanceof Error ? galat.message : String(galat) });
    } finally {
      setSedangHitung(false);
    }
  }, [acuan, kunci, periode]);

  const jendela = daftar?.periode || [];

  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Penilaian Berjenjang</CardTitle>
          <CardDescription>
            Delapan penilaian yang angkanya diturunkan dari daftar buktinya, sehingga angka dan bukti
            tidak mungkin berbeda. Tidak satu pun boleh dipakai membina sebelum disandingkan dengan
            angka dari luar ALETA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {galatDaftar ? (
            <div className="rounded-md border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
              Daftar penilaian tidak dapat diambil: {galatDaftar}
            </div>
          ) : null}

          {daftar && daftar.available === false ? (
            <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
              {daftar.alasan || "ALETA Bot belum dapat dihubungi."}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="penilaian-kunci">
                Penilaian
              </label>
              <NativeSelect
                id="penilaian-kunci"
                value={kunci}
                onChange={(e) => setKunci(e.target.value)}
                disabled={!daftar?.penilaian?.length}
              >
                {(daftar?.penilaian || []).map((p) => (
                  <option key={p.kunci} value={p.kunci}>
                    {p.judul}
                  </option>
                ))}
                {daftar?.penilaian?.length ? null : <option value="">(belum ada)</option>}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="penilaian-periode">
                Jendela periode
              </label>
              <NativeSelect
                id="penilaian-periode"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
              >
                {(jendela.length
                  ? jendela
                  : [{ jenis: "bulanan", label: "Bulanan" }]
                ).map((j) => (
                  <option key={j.jenis} value={j.jenis}>
                    {j.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="penilaian-acuan">
                Tanggal acuan
              </label>
              <Input
                id="penilaian-acuan"
                type="date"
                value={acuan}
                onChange={(e) => setAcuan(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={jalankan} disabled={!kunci || sedangHitung}>
                {sedangHitung ? "Menghitung..." : "Hitung"}
              </Button>
            </div>
          </div>

          {terpilih ? (
            <div className="rounded-md border border-border/80 bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">{terpilih.keterangan}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {terpilih.lantai ? <Badge variant="outline">lantai {terpilih.lantai}</Badge> : null}
                {terpilih.versiRumus ? (
                  <Badge variant="muted">rumus {terpilih.versiRumus}</Badge>
                ) : null}
                {terpilih.punyaRingkas ? (
                  <Badge variant="muted">punya kueri agregat pembanding</Badge>
                ) : null}
              </div>
            </div>
          ) : null}

          {daftar?.catatan ? (
            <p className="text-xs leading-5 text-muted-foreground">{daftar.catatan}</p>
          ) : null}
        </CardContent>
      </Card>

      {hasil ? (
        <HasilPenilaianTampil
          hasil={hasil}
          buktiTerbuka={buktiTerbuka}
          setBuktiTerbuka={setBuktiTerbuka}
        />
      ) : null}

      <PencatatanLaporanPerkara />
      <RubrikPenilaian />
    </div>
  );
}


/**
 * ============================================================================
 * PENCATATAN LAPORAN PERKARA - SATU-SATUNYA JALAN YANG PANTAS
 * ============================================================================
 *
 * Tanggal sebuah laporan dikirim tidak ada di SIPP. Ia hanya diketahui oleh
 * orang yang mengirimkannya. Sebelum layar ini ada, satu-satunya cara
 * memasukkannya adalah menulis langsung ke basis data - dan itu bukan cara yang
 * boleh diminta dari siapa pun.
 *
 * Nama pencatat TIDAK diketik di sini; ia diambil dari sesi yang sedang
 * berjalan. Ruas yang dapat diketik sendiri membuat catatannya tidak dapat
 * ditelusuri, dan catatan yang tidak dapat ditelusuri tidak berguna sebagai
 * bukti ketepatan waktu.
 */
function PencatatanLaporanPerkara() {
  const [lipa, setLipa] = useState<ButirLipa[]>([]);
  const [nomor, setNomor] = useState<number>(0);
  const [blangko, setBlangko] = useState<Blangko | null>(null);
  const [sedangMuat, setSedangMuat] = useState(false);
  const [isian, setIsian] = useState<Record<string, { tanggalKirim: string; angkaLaporan: string }>>({});
  const [sedangSimpan, setSedangSimpan] = useState("");
  const [pesan, setPesan] = useState("");

  const muatBlangko = useCallback(async (nomorLipa: number) => {
    if (!nomorLipa) return;
    setSedangMuat(true);
    setPesan("");
    try {
      const jawab = await ambilJson<Blangko>(`/api/aleta-penilaian/laporan?lipa=${nomorLipa}&bulan=12`);
      setBlangko(jawab);
      const awal: Record<string, { tanggalKirim: string; angkaLaporan: string }> = {};
      (jawab.baris || []).forEach((b) => {
        awal[b.bulanLaporan] = {
          tanggalKirim: b.tanggalKirim || "",
          angkaLaporan: b.angkaLaporan === null || b.angkaLaporan === undefined ? "" : String(b.angkaLaporan),
        };
      });
      setIsian(awal);
    } catch (galat) {
      setBlangko({ ok: false, alasan: galat instanceof Error ? galat.message : String(galat) });
    } finally {
      setSedangMuat(false);
    }
  }, []);

  /**
   * Daftar laporan, lalu blangko yang pertama.
   *
   * Keduanya dikerjakan di dalam satu rangkaian tak serentak. Memisahkannya
   * menjadi efek kedua yang mengintai `nomor` akan memuat ulang blangko tiap
   * kali keadaan lain berubah - dan tiap muat ulang membuang isian yang belum
   * disimpan petugas.
   */
  useEffect(() => {
    let dibatalkan = false;
    (async () => {
      try {
        const jawab = await ambilJson<{ lipa?: ButirLipa[] }>("/api/aleta-penilaian/laporan");
        if (dibatalkan) return;
        setLipa(jawab.lipa || []);
        if (jawab.lipa && jawab.lipa.length > 0) {
          setNomor(jawab.lipa[0].nomor);
          await muatBlangko(jawab.lipa[0].nomor);
        }
      } catch {
        // Daftar LIPA yang gagal diambil tidak perlu menampilkan galat merah -
        // bagian ini memang tambahan, dan penilaian di atasnya tetap berguna.
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, [muatBlangko]);

  const simpan = useCallback(
    async (bulanLaporan: string) => {
      const isi = isian[bulanLaporan];
      if (!isi) return;
      setSedangSimpan(bulanLaporan);
      setPesan("");
      try {
        const jawab = await ambilJson<{ ok?: boolean; alasan?: string; dicatatOleh?: string }>(
          "/api/aleta-penilaian/laporan",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lipaNomor: nomor,
              bulanLaporan,
              tanggalKirim: isi.tanggalKirim || null,
              angkaLaporan: isi.angkaLaporan === "" ? null : Number(isi.angkaLaporan),
            }),
          }
        );
        if (jawab.ok === false) {
          setPesan(jawab.alasan || "Tidak tersimpan.");
          return;
        }
        setPesan(
          `Tersimpan atas nama ${jawab.dicatatOleh || "pengguna yang sedang masuk"} untuk ${bulanLaporan}.`
        );
        await muatBlangko(nomor);
      } catch (galat) {
        setPesan(galat instanceof Error ? galat.message : String(galat));
      } finally {
        setSedangSimpan("");
      }
    },
    [isian, muatBlangko, nomor]
  );

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>Pencatatan Laporan Perkara</CardTitle>
        <CardDescription>
          Tanggal kirim tidak ada di SIPP dan tidak boleh ditebak. Yang dicatat di sini menjadi dasar
          penilaian ketepatan waktu kedua puluh dua laporan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_auto]">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="lipa-nomor">
              Laporan
            </label>
            <NativeSelect
              id="lipa-nomor"
              value={String(nomor)}
              onChange={(e) => {
                const dipilih = Number(e.target.value);
                setNomor(dipilih);
                void muatBlangko(dipilih);
              }}
              disabled={lipa.length === 0}
            >
              {lipa.map((x) => (
                <option key={x.nomor} value={x.nomor}>
                  LIPA {x.nomor} - {x.nama}
                  {x.dipa04 ? " (DIPA 04)" : ""}
                </option>
              ))}
              {lipa.length ? null : <option value="0">(daftar belum terambil)</option>}
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void muatBlangko(nomor)} disabled={!nomor || sedangMuat}>
              {sedangMuat ? "Memuat..." : "Muat ulang"}
            </Button>
          </div>
        </div>

        {pesan ? (
          <div className="rounded-md border border-border/80 bg-muted/50 p-3 text-sm">{pesan}</div>
        ) : null}

        {blangko && blangko.ok === false ? (
          <div className="rounded-md border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
            {blangko.alasan || "Blangko tidak dapat diambil."}
          </div>
        ) : null}

        {blangko && blangko.baris ? (
          <div className="overflow-x-auto rounded-lg border border-border/80">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/70 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Bulan</th>
                  <th className="px-3 py-2 font-semibold">Batas kirim</th>
                  <th className="px-3 py-2 font-semibold">Tanggal kirim</th>
                  <th className="px-3 py-2 font-semibold">Telat</th>
                  <th className="px-3 py-2 font-semibold">Angka laporan</th>
                  <th className="px-3 py-2 font-semibold">Angka SIPP</th>
                  <th className="px-3 py-2 font-semibold">Nilai</th>
                  <th className="px-3 py-2 font-semibold">Simpan</th>
                </tr>
              </thead>
              <tbody>
                {blangko.baris.map((b) => {
                  const isi = isian[b.bulanLaporan] || { tanggalKirim: "", angkaLaporan: "" };
                  return (
                    <tr key={b.bulanLaporan} className="border-t border-border/70">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{b.bulanLaporan}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{b.batasKirim || "-"}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="date"
                          className="h-9 w-40"
                          value={isi.tanggalKirim}
                          onChange={(e) =>
                            setIsian((s) => ({
                              ...s,
                              [b.bulanLaporan]: { ...isi, tanggalKirim: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {b.terlambatHari === null || b.terlambatHari === undefined ? (
                          "-"
                        ) : b.terlambatHari > 0 ? (
                          <Badge variant="danger">{b.terlambatHari} hari</Badge>
                        ) : (
                          <Badge variant="success">tepat</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          className="h-9 w-32"
                          value={isi.angkaLaporan}
                          onChange={(e) =>
                            setIsian((s) => ({
                              ...s,
                              [b.bulanLaporan]: { ...isi, angkaLaporan: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                        {b.angkaSipp === null || b.angkaSipp === undefined ? "belum disambung" : b.angkaSipp}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {b.nilai === null || b.nilai === undefined ? (
                          <Badge variant="muted" title={b.belumDapatDinilai || ""}>
                            belum dinilai
                          </Badge>
                        ) : (
                          <Badge variant={warnaNilai(b.nilai)}>{b.nilai.toFixed(1)}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sedangSimpan === b.bulanLaporan}
                          onClick={() => void simpan(b.bulanLaporan)}
                        >
                          {sedangSimpan === b.bulanLaporan ? "..." : "Simpan"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {blangko?.catatan ? (
          <p className="text-xs leading-5 text-muted-foreground">{blangko.catatan}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ==========================================================================
 * RUBRIK PENILAIAN PERKARA - BOBOT DAN AMBANG PREDIKATNYA
 * ========================================================================== */

type ButirRubrik = {
  kunci: string;
  label: string;
  keterangan: string;
  dasar: string;
  bobot: number;
};

type PengaturanRubrik = {
  bulanPenuh: number;
  bulanNol: number;
  hariMinutasi: number;
  ambangBaik: number;
  ambangPerhatian: number;
  bobot: Record<string, number>;
};

type JawabanRubrik = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  pengaturan?: PengaturanRubrik;
  butir?: ButirRubrik[];
};

/**
 * Sebab penolakan dari mesin, diterjemahkan menjadi kalimat.
 *
 * Nama sebabnya berbentuk kunci supaya dapat diperiksa; yang dibaca orang
 * harus kalimat yang menerangkan APA yang salah dan kenapa itu penting.
 */
const SEBAB_TOLAK: Record<string, string> = {
  bulan_nol_harus_lebih_besar:
    "Bulan bernilai nol harus lebih besar daripada bulan bernilai penuh. Kalau tidak, tidak ada rentang untuk nilai di antara keduanya.",
  ambang_perhatian_harus_lebih_kecil:
    "Ambang perhatian harus lebih kecil daripada ambang baik. Kalau sama atau terbalik, golongan tengahnya tidak akan pernah terpakai - dan tidak ada galat apa pun yang muncul.",
};

/**
 * ============================================================================
 * ANGKANYA DIUBAH PENGADILAN, BUKAN MENUNGGU VERSI BARU
 * ============================================================================
 *
 * Tercatat sejak 1.31.0 sebagai keterbatasan: bobot skor ditetapkan aplikasi
 * dan belum dapat diubah pengadilan. Mesinnya sebenarnya sudah lama membacanya
 * dari pengaturan, dan rutenya pun sudah ada di bot - yang tidak pernah ada
 * jalan dari portal menuju ke sana.
 *
 * Selama layar ini tidak ada, "dapat diubah" benar bagi mesin dan tidak benar
 * bagi orang yang memakainya: satu-satunya cara mengubahnya adalah menyunting
 * berkas pengaturan di dalam container.
 *
 * ============================================================================
 * AMBANG PREDIKAT DITARUH PALING ATAS, DAN SENGAJA
 * ============================================================================
 *
 * Bobot menentukan bagaimana angkanya tersusun - itu perkara teknis. Ambang
 * menentukan perkara SIAPA yang disebut kurang, dan itu perkara yang
 * menyangkut orang. Yang kedua yang paling sering dipersoalkan, dan yang
 * paling perlu terlihat lebih dahulu oleh yang membukanya.
 */
function RubrikPenilaian() {
  const [jawaban, setJawaban] = useState<JawabanRubrik | null>(null);
  const [draf, setDraf] = useState<PengaturanRubrik | null>(null);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [sedangSimpan, setSedangSimpan] = useState(false);

  /** Membaca rubrik. TIDAK menyentuh keadaan layar. */
  const baca = useCallback(async (): Promise<{ isi: JawabanRubrik | null; sebab: string }> => {
    try {
      return { isi: await ambilJson<JawabanRubrik>("/api/aleta-ecourt/rubrik"), sebab: "" };
    } catch (kesalahan) {
      return {
        isi: null,
        sebab: kesalahan instanceof Error ? kesalahan.message : String(kesalahan),
      };
    }
  }, []);

  const terapkan = useCallback((isi: JawabanRubrik | null, sebab: string) => {
    setGalat(sebab);
    if (!isi) return;
    setJawaban(isi);
    if (isi.pengaturan) setDraf({ ...isi.pengaturan, bobot: { ...isi.pengaturan.bobot } });
  }, []);

  /** Penyegaran atas permintaan - sesudah menyimpan. */
  const muat = useCallback(async () => {
    const { isi, sebab } = await baca();
    terapkan(isi, sebab);
  }, [baca, terapkan]);

  // Penanda hidup: jawaban yang terlambat tidak ditulis ke layar yang sudah
  // dilepas. Pola yang sama dengan papan antrian.
  useEffect(() => {
    let hidup = true;
    void (async () => {
      const { isi, sebab } = await baca();
      if (!hidup) return;
      terapkan(isi, sebab);
    })();
    return () => {
      hidup = false;
    };
  }, [baca, terapkan]);

  const butir = useMemo(() => jawaban?.butir || [], [jawaban]);

  // Jumlah bobot ditampilkan apa adanya, TIDAK dipaksa seratus. Pembagi
  // nilainya memang jumlah bobot yang berlaku pada perkara itu, bukan angka
  // seratus - jadi jumlah delapan puluh pun menghasilkan nilai yang benar.
  // Yang ditampilkan hanya keterangannya, supaya tidak ada yang menyangka
  // aplikasi diam-diam membetulkannya.
  const jumlahBobot = useMemo(
    () => butir.reduce((jumlah, b) => jumlah + Number(draf?.bobot?.[b.kunci] ?? b.bobot), 0),
    [butir, draf]
  );

  const ubahAngka = (kunci: keyof PengaturanRubrik, nilai: string) => {
    setDraf((lama) => (lama ? { ...lama, [kunci]: Number(nilai) } : lama));
    setPesan("");
  };

  const ubahBobot = (kunciButir: string, nilai: string) => {
    setDraf((lama) =>
      lama ? { ...lama, bobot: { ...lama.bobot, [kunciButir]: Number(nilai) } } : lama
    );
    setPesan("");
  };

  const simpan = async () => {
    if (!draf) return;
    setSedangSimpan(true);
    setPesan("");
    setGalat("");
    try {
      const isi = await ambilJson<JawabanRubrik>("/api/aleta-ecourt/rubrik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draf),
      });

      if (isi.available === false) {
        setGalat(isi.alasan || "ALETA Bot belum dapat dihubungi.");
        return;
      }
      if (isi.ok === false) {
        setGalat(SEBAB_TOLAK[String(isi.alasan)] || isi.alasan || "Tidak tersimpan.");
        return;
      }

      setPesan("Rubrik tersimpan. Nilai perkara dihitung memakai angka ini mulai sekarang.");
      await muat();
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : String(kesalahan));
    } finally {
      setSedangSimpan(false);
    }
  };

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>Rubrik penilaian perkara</CardTitle>
        <CardDescription>
          Bobot tiap butir dan ambang predikatnya. Ini rubrik ALETA, BUKAN nilai resmi SK Penilaian
          SIPP - keduanya sengaja tidak dijumlahkan. Perubahan di sini berlaku surut: seluruh perkara
          dinilai memakai angka yang baru, tanpa satu pun berkas berubah.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {galat ? (
          <div className="rounded-md border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
            {galat}
          </div>
        ) : null}

        {jawaban?.available === false ? (
          <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            {jawaban.alasan || "ALETA Bot belum dapat dihubungi."}
          </div>
        ) : null}

        {pesan ? (
          <div className="rounded-md border border-emerald-300/70 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            {pesan}
          </div>
        ) : null}

        {draf ? (
          <>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Ambang predikat</h4>
              <p className="text-xs leading-5 text-muted-foreground">
                Angka inilah yang menentukan perkara mana yang disebut kurang. Sampai sekarang ia
                tertanam di dalam kode, sehingga mengubahnya menuntut versi baru dipasang untuk
                sesuatu yang sifatnya kebijakan pimpinan.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Sekurang-kurangnya bernilai baik</span>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={draf.ambangBaik}
                    onChange={(e) => ubahAngka("ambangBaik", e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Sekurang-kurangnya perhatian</span>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={draf.ambangPerhatian}
                    onChange={(e) => ubahAngka("ambangPerhatian", e.target.value)}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Di bawah {draf.ambangPerhatian} disebut kurang.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Skala waktu</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Bulan bernilai penuh</span>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={draf.bulanPenuh}
                    onChange={(e) => ubahAngka("bulanPenuh", e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Bulan bernilai nol</span>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    value={draf.bulanNol}
                    onChange={(e) => ubahAngka("bulanNol", e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Hari minutasi masih tepat</span>
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={draf.hariMinutasi}
                    onChange={(e) => ubahAngka("hariMinutasi", e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">
                Bobot tiap butir{" "}
                <span className="font-normal text-muted-foreground">— berjumlah {jumlahBobot}</span>
              </h4>
              <div className="space-y-2">
                {butir.map((b) => (
                  <div
                    key={b.kunci}
                    className="grid items-start gap-2 rounded-md border border-border/70 p-3 sm:grid-cols-[1fr_7rem]"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{b.label}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{b.keterangan}</p>
                      {/* Dasar tiap butir ikut ditampilkan. Bobot yang tidak
                          diketahui dasarnya akan diubah menurut selera, dan
                          angka yang diubah menurut selera tidak dapat
                          dipertahankan pada hari ia dipersoalkan. */}
                      <p className="text-xs leading-5 text-muted-foreground/80">{b.dasar}</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draf.bobot?.[b.kunci] ?? b.bobot}
                      onChange={(e) => ubahBobot(b.kunci, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Jumlahnya tidak harus seratus. Pembagi nilainya adalah jumlah bobot yang BERLAKU
                pada perkara itu - butir yang belum waktunya dinilai tidak ikut membagi - sehingga
                jumlah delapan puluh pun menghasilkan nilai yang benar.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" onClick={() => void simpan()} disabled={sedangSimpan}>
                {sedangSimpan ? "Menyimpan…" : "Simpan rubrik"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Tersimpan atas nama Anda, dan tercatat.
              </span>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
