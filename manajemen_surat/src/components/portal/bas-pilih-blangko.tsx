"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, Eye, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { jenjangkan, labelBlangko, setUntukPerkara, type BlangkoItem } from "@/lib/pohon-blangko";
import { ringkasSebelumnya, sidangKe, susunRangkaian, tanggalIndonesia } from "@/lib/rangkaian-sidang";

/**
 * Memilih blangko secara berjenjang.
 *
 * ============================================================================
 * SATU PERTANYAAN PADA SATU WAKTU
 * ============================================================================
 *
 * Panitera menjawab tiga pertanyaan berurutan, dan ketiganya sudah ada
 * jawabannya di kepalanya sebelum ia membuka ALETA:
 *
 *   perkara apa ini  ->  sidang ke berapa  ->  apa yang terjadi hari ini
 *
 * Yang pertama sudah dijawab SIPP, jadi tidak ditanyakan - set yang sesuai
 * jenis perkaranya berdiri di depan dan yang pertama terpilih sendiri.
 *
 * Daftar datar berisi dua belas nama berkas panjang menuntut panitera membaca
 * semuanya lalu menyaring sendiri, tiap kali, untuk perkara yang sebenarnya
 * sudah ia kenali sejak awal.
 */

type Temuan = { tingkat: "halangan" | "peringatan" | "catatan"; hal: string; keterangan: string; tindakan: string };

type KutipanPedoman = { pedoman: string; halaman: number; kutipan: string };

type Pemeriksaan = {
  ok: boolean;
  pedoman?: KutipanPedoman[];
  sebab?: string;
  berkas: string;
  jumlahPenanda: number;
  jumlahTerisi: number;
  jumlahTersisa: number;
  ringkasan: string;
  temuan: Temuan[];
};

type IsiBlangko = {
  ada: boolean;
  sebab?: string;
  berkas: string;
  jumlahPenanda: number;
  teks: string;
};

export function PilihBlangko({
  perkaraId,
  jenisPerkara,
  riwayatSidang,
}: {
  perkaraId: string;
  jenisPerkara: string;
  riwayatSidang: unknown;
}) {
  const rangkaian = useMemo(() => susunRangkaian(riwayatSidang), [riwayatSidang]);
  const daftarSet = useMemo(() => setUntukPerkara(jenisPerkara), [jenisPerkara]);
  const [setTerpilih, setSetTerpilih] = useState(daftarSet[0]?.id ?? "");
  const [tingkatTerpilih, setTingkatTerpilih] = useState("");
  const [pesan, setPesan] = useState("");
  const [isi, setIsi] = useState<IsiBlangko | null>(null);
  const [memuatIsi, setMemuatIsi] = useState("");
  const [periksa, setPeriksa] = useState<Pemeriksaan | null>(null);
  const [memuatPeriksa, setMemuatPeriksa] = useState("");

  const set = daftarSet.find((item) => item.id === setTerpilih) ?? daftarSet[0];

  /**
   * Katalog satu set, BESERTA set yang memuatnya.
   *
   * Sama seperti pada lembar: kuncinya disimpan bersama isinya, sehingga
   * katalog set lama tidak mungkin mendarat di layar set baru hanya karena
   * jawabannya datang belakangan.
   */
  const [katalog, setKatalog] = useState<{ folder: string; blangko: BlangkoItem[] } | null>(null);
  const memuat = katalog?.folder !== set?.folder;

  useEffect(() => {
    if (!set?.folder) return;
    let batal = false;
    const kendali = new AbortController();
    const folder = set.folder;

    fetch(apiPath(`/api/aleta-ecourt/bas/blangko?folder=${encodeURIComponent(folder)}`), {
      cache: "no-store",
      signal: kendali.signal,
    })
      .then((jawaban) => jawaban.json())
      .then((hasil) => {
        if (batal) return;
        setKatalog({ folder, blangko: ((hasil?.data ?? {})?.blangko ?? []) as BlangkoItem[] });
        setTingkatTerpilih("");
        setIsi(null);
        setPesan("");
      })
      .catch(() => {
        if (batal) return;
        setKatalog({ folder, blangko: [] });
        setPesan("Daftar blangko tidak terbaca dari APS Badilag.");
      });

    return () => {
      batal = true;
      kendali.abort();
    };
  }, [set?.folder]);

  // Penjenjangan dihitung dari katalog langsung, bukan dari larik antara.
  // Larik antara yang dibuat ulang tiap render akan memaksa perhitungan ini
  // berjalan lagi setiap kali, padahal isinya tidak berubah.
  const jenjang = useMemo(
    () => jenjangkan(set?.jenis ?? "bas", katalog?.folder === set?.folder ? katalog.blangko : []),
    [set?.jenis, set?.folder, katalog]
  );

  // Bila hanya ada satu tingkat, ia terbuka sendiri. Menuntut satu ketukan
  // untuk pilihan yang tidak punya alternatif hanya menambah pekerjaan.
  const tingkat =
    jenjang.find((item) => item.kunci === tingkatTerpilih) ?? (jenjang.length === 1 ? jenjang[0] : null);

  // Nomor sidang diambil dari tingkat yang benar-benar terbuka - termasuk saat
  // tingkatnya terbuka sendiri karena hanya ada satu.
  const nomorSidangIni = Number(String(tingkat?.kunci ?? "").replace("sidang-", "")) || 0;
  const sidangIni = sidangKe(rangkaian, nomorSidangIni);

  async function lihatIsi(namaBerkas: string) {
    if (!set) return;
    setMemuatIsi(namaBerkas);
    setIsi(null);
    try {
      const alamat = `/api/aleta-ecourt/bas/blangko?folder=${encodeURIComponent(set.folder)}&berkas=${encodeURIComponent(namaBerkas)}`;
      const jawaban = await fetch(apiPath(alamat), { cache: "no-store" });
      setIsi(((await jawaban.json())?.data ?? {}) as IsiBlangko);
    } catch {
      setPesan("Blangko tidak dapat dibaca.");
    } finally {
      setMemuatIsi("");
    }
  }

  /**
   * Alamat unduhan, LENGKAP dengan nomor sidangnya.
   *
   * Nomornya diambil dari blangko itu sendiri - "BAS 2" memang untuk sidang
   * ke-2 - sehingga hari, tanggal, dan sebutan sidang pada naskah mengikuti
   * sidang yang benar, bukan sidang terakhir yang kebetulan tercatat.
   */
  /**
   * Memeriksa kesiapan satu blangko sebelum diunduh.
   *
   * Dipanggil atas permintaan, bukan otomatis untuk seluruh daftar - memeriksa
   * dua belas blangko sekaligus berarti dua belas pembacaan berkas untuk
   * sebelas yang tidak akan dipakai.
   */
  async function periksaKesiapanBlangko(item: BlangkoItem) {
    if (!set) return;
    setMemuatPeriksa(item.berkas);
    setPeriksa(null);
    try {
      const sidang = item.basKe > 0 ? `&sidangKe=${item.basKe}` : "";
      const alamat =
        `/api/aleta-ecourt/bas/periksa?perkaraId=${encodeURIComponent(perkaraId)}` +
        `&folder=${encodeURIComponent(set.folder)}&berkas=${encodeURIComponent(item.berkas)}${sidang}`;
      const jawaban = await fetch(apiPath(alamat), { cache: "no-store" });
      setPeriksa(((await jawaban.json())?.data ?? {}) as Pemeriksaan);
    } catch {
      setPesan("Pemeriksaan tidak dapat dijalankan.");
    } finally {
      setMemuatPeriksa("");
    }
  }

  function alamatNaskah(item: BlangkoItem) {
    const sidang = item.basKe > 0 ? `&sidangKe=${item.basKe}` : "";
    return apiPath(
      `/api/aleta-ecourt/bas/naskah?perkaraId=${encodeURIComponent(perkaraId)}` +
        `&folder=${encodeURIComponent(set?.folder ?? "")}&berkas=${encodeURIComponent(item.berkas)}${sidang}`
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blangko</CardTitle>
          <CardDescription>
            Dibaca langsung dari folder APS Badilag, bukan salinan — yang muncul di sini sama dengan yang Anda pegang
            di ABT.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kumpulan</p>
            <div className="flex flex-wrap gap-2">
              {daftarSet.map((item) => (
                <Button
                  key={item.id}
                  variant={set?.id === item.id ? "default" : item.cocok ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => setSetTerpilih(item.id)}
                >
                  {item.nama}
                  {item.cocok ? <Badge variant="muted">sesuai perkara ini</Badge> : null}
                </Button>
              ))}
            </div>
          </div>

          {memuat ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Membaca folder…
            </p>
          ) : null}

          {!memuat && jenjang.length > 1 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {set?.jenis === "bas" ? "Sidang ke berapa" : "Bagaimana perkara ini berakhir"}
              </p>
              <div className="flex flex-wrap gap-2">
                {jenjang.map((item) => (
                  <Button
                    key={item.kunci}
                    variant={tingkat?.kunci === item.kunci ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setTingkatTerpilih(item.kunci);
                      setIsi(null);
                    }}
                  >
                    {item.label}
                    <Badge variant="muted">{item.blangko.length}</Badge>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {!memuat && jenjang.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada blangko terbaca pada kumpulan ini.</p>
          ) : null}

          {tingkat ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {set?.nama}
                <ChevronRight className="h-3 w-3" />
                {tingkat.label}
              </p>

              {/* Apa yang terjadi pada sidang sebelumnya - supaya panitera tidak
                  perlu membuka SIPP di tab lain untuk mengingatnya. */}
              {sidangIni ? (
                <div className="rounded-md bg-muted/40 p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Sidang ke-{sidangIni.sidangKe}: </span>
                    {sidangIni.hari}, {tanggalIndonesia(sidangIni.tanggal)}
                    {sidangIni.agenda ? ` — ${sidangIni.agenda}` : ""}
                  </p>
                  {ringkasSebelumnya(sidangIni) ? (
                    <p className="text-muted-foreground">{ringkasSebelumnya(sidangIni)}</p>
                  ) : null}
                </div>
              ) : nomorSidangIni > 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Sidang ke-{nomorSidangIni} belum tercatat di SIPP. Hari dan tanggalnya akan tetap bertanda pada
                  naskah.
                </p>
              ) : null}
              {tingkat.blangko.map((item) => (
                <div
                  key={item.berkas}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0"
                >
                  <p className="text-sm">
                    {labelBlangko(set?.jenis ?? "bas", item)}
                    {item.eCourt ? <span className="text-xs text-muted-foreground"> · e-Court</span> : null}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void lihatIsi(item.berkas)}
                      disabled={memuatIsi === item.berkas}
                      aria-label={`Lihat isi ${labelBlangko(set?.jenis ?? "bas", item)}`}
                    >
                      {memuatIsi === item.berkas ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Lihat isi
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void periksaKesiapanBlangko(item)}
                      disabled={memuatPeriksa === item.berkas}
                      aria-label={`Periksa kesiapan ${labelBlangko(set?.jenis ?? "bas", item)}`}
                    >
                      {memuatPeriksa === item.berkas ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Periksa
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={alamatNaskah(item)} download>
                        <Download className="h-4 w-4" />
                        Unduh terisi
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!memuat && jenjang.length > 1 && !tingkat ? (
            <p className="text-sm text-muted-foreground">
              Pilih {set?.jenis === "bas" ? "sidang ke berapa" : "bagaimana perkara ini berakhir"} untuk melihat
              blangkonya.
            </p>
          ) : null}

          {pesan ? <p className="text-sm text-amber-600 dark:text-amber-400">{pesan}</p> : null}

          <p className="text-xs text-muted-foreground">
            Blangko diunduh dalam bentuk aslinya, hanya bagian yang sudah pasti dari berkas perkara dan lembar BAS
            yang terisi. Bagian yang belum pasti tetap bertanda dan menunggu Anda.
          </p>
        </CardContent>
      </Card>

      {periksa?.ok ? (
        <Card
          className={
            periksa.temuan.some((item) => item.tingkat === "halangan")
              ? "border-amber-300 dark:border-amber-500/40"
              : undefined
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {periksa.temuan.some((item) => item.tingkat === "halangan") ? (
                <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
              Pemeriksaan sebelum cetak
            </CardTitle>
            <CardDescription>
              {periksa.ringkasan} {periksa.jumlahTerisi} dari {periksa.jumlahPenanda} bagian sudah terisi sendiri.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {periksa.temuan.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada temuan.</p>
            ) : (
              periksa.temuan.map((item, urutan) => (
                <div key={`${item.hal}-${urutan}`} className="space-y-0.5">
                  <p className="flex items-baseline gap-2 text-sm font-medium">
                    <Badge
                      variant="muted"
                      className={
                        item.tingkat === "halangan"
                          ? "text-amber-700 dark:text-amber-300"
                          : item.tingkat === "peringatan"
                            ? "text-sky-700 dark:text-sky-300"
                            : undefined
                      }
                    >
                      {item.tingkat === "halangan" ? "perlu dibereskan" : item.tingkat === "peringatan" ? "periksa" : "catatan"}
                    </Badge>
                    {item.hal}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.keterangan}</p>
                  {item.tindakan ? <p className="text-sm">{item.tindakan}</p> : null}
                </div>
              ))
            )}
            {(periksa.pedoman?.length ?? 0) > 0 ? (
              <div className="space-y-2 rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Yang disebut pedoman Badilag tentang dokumen ini
                </p>
                {(periksa.pedoman ?? []).map((item, urutan) => (
                  <p key={`${item.halaman}-${urutan}`} className="text-sm">
                    <span className="text-muted-foreground">
                      {item.pedoman}, hal. {item.halaman}:{" "}
                    </span>
                    {item.kutipan}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground">
                  Kutipan apa adanya, bukan penilaian. ALETA tidak menyatakan naskah ini sesuai atau tidak sesuai
                  pedoman — yang menilainya Anda.
                </p>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Temuan di atas dari berkas dan lembar; kutipan pedoman dicocokkan lewat kata kunci nama blangko, jadi
              belum tentu tepat pada bagian yang Anda cari.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {periksa && !periksa.ok ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pemeriksaan tidak dapat dijalankan</CardTitle>
            <CardDescription>{periksa.sebab ?? "Blangko tidak terbaca."}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {isi?.ada ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isi.berkas}</CardTitle>
            <CardDescription>
              {isi.jumlahPenanda} bagian yang harus terisi. Yang tampil di bawah ini teksnya saja — tata letak, huruf,
              dan penomorannya tetap utuh pada berkas yang Anda unduh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
              {isi.teks}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {isi && !isi.ada ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blangko belum dapat dibaca</CardTitle>
            <CardDescription>{isi.sebab ?? "Berkasnya tidak ditemukan di folder APS Badilag."}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </>
  );
}
