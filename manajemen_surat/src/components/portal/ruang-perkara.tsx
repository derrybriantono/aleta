"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileSignature,
  FileText,
  History,
  Loader2,
  Scale,
  Search,
  TrendingUp,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { AletaAnalisaPerkara } from "@/components/portal/aleta-analisa-perkara";
import { RujukanPasal } from "@/components/portal/rujukan-pasal";
import { EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import type { RoleId } from "@/lib/types";

/**
 * RUANG KERJA PERKARA (H1-H4).
 *
 * ============================================================================
 * SATU LAYAR, KARENA PEKERJAANNYA SATU
 * ============================================================================
 *
 * Berkas, riwayat, pemeriksaan, draf, dan jejak selama ini berada di lima
 * tempat. Memindahkan pekerjaan antar lima tempat bukan sekadar melelahkan -
 * ia membuat pemeriksaan yang satu tidak pernah diadu dengan yang lain.
 * Halangan yang tampil di layar pemeriksaan tidak terlihat oleh yang sedang
 * membaca draf di layar sebelah, dan draf itu tetap ditandatangani.
 *
 * ============================================================================
 * BEDA PERAN, BEDA URUTAN - BUKAN BEDA KEWENANGAN (H4)
 * ============================================================================
 *
 * Panitera membuka perkara untuk menulis BAS; hakim membukanya untuk menimbang.
 * Keduanya melihat bagian yang SAMA, hanya urutannya yang berbeda, dan yang
 * paling sering dipakai terbuka lebih dulu.
 *
 * Yang sengaja TIDAK dikerjakan: menyembunyikan bagian dari peran tertentu.
 * Kewenangan sudah dijaga di sisi peladen - tiap rute memeriksanya sendiri -
 * dan layar yang menyembunyikan sesuatu yang sebenarnya boleh dilihat hanya
 * akan membuat orang mencarinya lewat jalan lain, atau meminta dibukakan
 * kewenangan yang lebih besar daripada yang ia perlukan.
 *
 * ============================================================================
 * TIGA RUTE BERSEBELAHAN, DAN MENGAPA KETIGANYA TETAP TERPISAH
 * ============================================================================
 *
 * Layar ini memanggil tiga rute yang sekilas menjawab pertanyaan yang sama
 * tentang satu perkara:
 *
 *   status-perkara/  keterangan perkara dari SIPP - 31 kueri, dimuat di muka
 *   analisa/         sebelas hitungan dari register - dimuat saat diminta
 *   pemeriksaan/     aturan hukum diadu dengan fakta - dari pustaka, bukan SIPP
 *
 * Dua yang pertama memang bersaudara: sumbernya sama, kewenangannya sama
 * (panel), dan dipisah SEMATA karena beban - menjalankan sebelas agregasi saat
 * perkara dibuka berarti membuka perkara menunggu angka yang mungkin tidak
 * dilihat siapa pun. Menyatukannya kembali akan mengembalikan beban itu.
 *
 * Yang ketiga bukan saudara mereka meski namanya terdengar mirip. Ia membaca
 * pustaka hukum, bukan register; menulis aturan dan sidik pola; dan menuntut
 * kewenangan Super Admin untuk mengubahnya. Menyatukannya ke salah satu yang
 * lain memaksa satu kewenangan menang - dan kedua arahnya salah: bila `panel`
 * yang menang, aturan hukum dapat diubah siapa pun yang boleh membuka panel;
 * bila kewenangan admin yang menang, panel statistik yang sudah dipakai hari
 * ini berhenti bekerja.
 *
 * Maka yang disatukan PINTU MASUKNYA, bukan rutenya. Ketiganya sampai ke
 * layar ini, dan pemakainya tidak perlu tahu ada tiga.
 *
 * ============================================================================
 * TELAAH PER ALINEA (H3)
 * ============================================================================
 *
 * Hakim menerima atau menolak tiap alinea pertimbangan, bukan menerima
 * seluruh naskah sekali tekan. Syaratnya ditegakkan peladen: selama masih ada
 * alinea yang belum ditelaah, tanda tangan ditolak. Tombol di sini hanya
 * memperlihatkan syarat itu, tidak menciptakannya - tombol yang tidak
 * mengubah syarat adalah hiasan yang dilewati pada hari kedua.
 */

type Bagian = { ada: boolean; asal: { sistem: string; sumber: string }; galat: string; nilai: unknown };

type Berkas = {
  ok: boolean;
  nomorPerkara: string;
  perkaraId: string;
  identitas: Bagian;
  paraPihak: Bagian;
  majelis: Bagian;
  panitera: Bagian;
  riwayatSidang: Bagian;
  saksiTercatat: Bagian;
  pemeriksaanSaksi: Bagian;
  dokumenECourt: Bagian;
  putusan: Bagian;
  pertimbangan: Bagian;
  selisih: Array<{ hal: string; menurut: Array<{ sistem: string; nilai: string }>; keterangan: string }>;
  halangan: string[];
};

type Pilihan = { perkaraId: string; nomorPerkara: string; jenisPerkara: string; tanggalDaftar: string };

type ButirTelaah = {
  id: string;
  butirId: string;
  urutan: number;
  teks: string;
  keadaan: "belum" | "diterima" | "ditolak";
  diputusOleh: string;
  alasanTolak: string;
  sekaligus: boolean;
};

type RingkasTelaah = {
  jumlah: number;
  belum: number;
  diterima: number;
  ditolak: number;
  diterimaSekaligus: number;
  selesai: boolean;
};

type DasarBeku = {
  jangkar: string;
  tertulis: string;
  versiPeraturan: string;
  terbukti: boolean;
  sudahDicabut: boolean;
};

type Draf = {
  id: string;
  nomorPerkara: string;
  versi: number;
  keadaan: string;
  naskah: string;
  siap: boolean;
  halangan: string[];
  belumTerisi: string[];
  ditandatanganiOleh: string;
};

type Jejak = {
  dasar: DasarBeku[];
  nilai: Array<{ nama: string; nilai: string; asal: string }>;
  lubang: string[];
};

type KunciPanel = "berkas" | "riwayat" | "statistik" | "pemeriksaan" | "draf" | "jejak";

const PANEL: Array<{ kunci: KunciPanel; judul: string; ikon: typeof FileText }> = [
  { kunci: "berkas", judul: "Berkas", ikon: FileText },
  { kunci: "riwayat", judul: "Riwayat", ikon: History },
  { kunci: "statistik", judul: "Statistik", ikon: TrendingUp },
  { kunci: "pemeriksaan", judul: "Pemeriksaan", ikon: Scale },
  { kunci: "draf", judul: "Draf putusan", ikon: FileSignature },
  { kunci: "jejak", judul: "Jejak", ikon: ClipboardList },
];

/**
 * Urutan panel menurut peran.
 *
 * Peran yang tidak disebut memakai urutan bawaan. Itu disengaja: peran baru
 * akan bermunculan, dan yang tidak disebut harus tetap melihat SEMUANYA, hanya
 * dengan urutan yang tidak disesuaikan. Bawaan yang menyembunyikan akan membuat
 * peran baru kehilangan bagian tanpa ada yang menyadarinya.
 */
const URUTAN_PERAN: Partial<Record<RoleId, KunciPanel[]>> = {
  hakim: ["pemeriksaan", "draf", "berkas", "riwayat", "statistik", "jejak"],
  ketua: ["pemeriksaan", "draf", "statistik", "berkas", "riwayat", "jejak"],
  "wakil-ketua": ["pemeriksaan", "draf", "statistik", "berkas", "riwayat", "jejak"],
  panitera: ["riwayat", "berkas", "statistik", "draf", "pemeriksaan", "jejak"],
  "panitera-pengganti": ["riwayat", "berkas", "draf", "statistik", "pemeriksaan", "jejak"],
  "panitera-muda": ["riwayat", "statistik", "berkas", "pemeriksaan", "draf", "jejak"],
  "analis-perkara": ["statistik", "pemeriksaan", "berkas", "riwayat", "jejak", "draf"],
};

const URUTAN_BAWAAN: KunciPanel[] = ["berkas", "riwayat", "statistik", "pemeriksaan", "draf", "jejak"];

function BarisBerkas({ nama, bagian }: { nama: string; bagian: Bagian }) {
  const jumlah = Array.isArray(bagian.nilai) ? bagian.nilai.length : null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <div className="flex items-baseline gap-2">
        <span className={bagian.ada ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{nama}</span>
        {jumlah !== null && bagian.ada ? <span className="text-xs text-muted-foreground">{jumlah}</span> : null}
      </div>
      <span className="text-right text-xs text-muted-foreground">
        {bagian.galat ? (
          <span className="text-amber-600 dark:text-amber-400">{bagian.asal.sistem} tidak terbaca</span>
        ) : bagian.ada ? (
          `${bagian.asal.sistem} · ${bagian.asal.sumber}`
        ) : (
          "belum ada"
        )}
      </span>
    </div>
  );
}

export function RuangPerkara() {
  const { currentUser } = usePortal();
  const peran = (currentUser?.roleId ?? "staf") as RoleId;
  const namaSaya = currentUser?.name ?? "";

  const urutan = useMemo(() => URUTAN_PERAN[peran] ?? URUTAN_BAWAAN, [peran]);
  const panel = useMemo(
    () => urutan.map((kunci) => PANEL.find((item) => item.kunci === kunci)!).filter(Boolean),
    [urutan]
  );

  const [nomor, setNomor] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [pesan, setPesan] = useState("");
  const [pilihan, setPilihan] = useState<Pilihan[]>([]);
  const [berkas, setBerkas] = useState<Berkas | null>(null);
  const [aktif, setAktif] = useState<KunciPanel>(urutan[0]);

  const [draf, setDraf] = useState<Draf | null>(null);
  const [butir, setButir] = useState<ButirTelaah[]>([]);
  const [ringkas, setRingkas] = useState<RingkasTelaah | null>(null);
  const [jejak, setJejak] = useState<Jejak | null>(null);
  const [alasanTolak, setAlasanTolak] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState("");

  const muatBerkas = useCallback(async (cari: string, perkaraId = "") => {
    const kunci = cari.trim();
    if (!kunci && !perkaraId) return;

    setMemuat(true);
    setPesan("");
    setPilihan([]);
    setBerkas(null);
    setDraf(null);
    setButir([]);
    setRingkas(null);
    setJejak(null);

    try {
      const alamat = perkaraId
        ? `/api/aleta-ecourt/berkas-perkara?perkaraId=${encodeURIComponent(perkaraId)}`
        : `/api/aleta-ecourt/berkas-perkara?nomor=${encodeURIComponent(kunci)}`;
      const tanggapan = await fetch(apiPath(alamat));
      const isi = (await tanggapan.json()) as {
        ada?: boolean;
        berkas?: Berkas;
        kandidat?: Pilihan[];
        sebab?: string;
      };

      // Nomor yang cocok ke banyak perkara TIDAK dipilihkan sendiri. Mengetik
      // "324" cocok ke belasan perkara lintas tahun, dan memilih yang pertama
      // membuka perkara orang lain tanpa ada yang tahu.
      if (isi?.kandidat?.length) {
        setPilihan(isi.kandidat);
        setPesan(`${isi.kandidat.length} perkara cocok dengan "${kunci}". Pilih yang dimaksud.`);
        return;
      }
      if (!isi?.ada || !isi.berkas) {
        setPesan(isi?.sebab || "Perkara tidak ditemukan.");
        return;
      }
      setBerkas(isi.berkas);
      setNomor(isi.berkas.nomorPerkara || kunci);
    } catch {
      setPesan("Berkas perkara tidak terbaca. Coba lagi.");
    } finally {
      setMemuat(false);
    }
  }, []);

  const muatDraf = useCallback(async (perkaraId: string) => {
    setSibuk("draf");
    try {
      const daftar = await fetch(apiPath(`/api/aleta-ecourt/putusan?perkaraId=${encodeURIComponent(perkaraId)}`));
      const isiDaftar = (await daftar.json()) as { riwayat?: Draf[] };
      const terbaru = isiDaftar?.riwayat?.[0];
      if (!terbaru) {
        setDraf(null);
        setButir([]);
        setRingkas(null);
        return;
      }

      const satu = await fetch(apiPath(`/api/aleta-ecourt/putusan?drafId=${encodeURIComponent(terbaru.id)}`));
      const isiSatu = (await satu.json()) as {
        draf?: Draf;
        butir?: ButirTelaah[];
        ringkasTelaah?: RingkasTelaah;
      };
      setDraf(isiSatu?.draf ?? null);
      setButir(isiSatu?.butir ?? []);
      setRingkas(isiSatu?.ringkasTelaah ?? null);
    } catch {
      setPesan("Draf putusan tidak terbaca.");
    } finally {
      setSibuk("");
    }
  }, []);

  const muatJejak = useCallback(async (drafId: string) => {
    setSibuk("jejak");
    try {
      const tanggapan = await fetch(apiPath(`/api/aleta-ecourt/putusan/jejak?drafId=${encodeURIComponent(drafId)}`));
      setJejak((await tanggapan.json()) as Jejak);
    } catch {
      setPesan("Jejak draf tidak terbaca.");
    } finally {
      setSibuk("");
    }
  }, []);

  const telaah = useCallback(
    async (barisId: string, keadaan: "diterima" | "ditolak") => {
      if (!draf) return;
      if (!namaSaya) {
        setPesan("Nama penelaah tidak diketahui dari akun ini, sehingga telaah tidak dapat dicatat.");
        return;
      }
      setSibuk(barisId);
      try {
        const tanggapan = await fetch(apiPath("/api/aleta-ecourt/putusan"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tindakan: "telaah",
            drafId: draf.id,
            barisId,
            keadaan,
            olehNama: namaSaya,
            alasan: alasanTolak[barisId] ?? "",
          }),
        });
        const isi = (await tanggapan.json()) as { ok?: boolean; sebab?: string };
        if (!isi?.ok) {
          setPesan(isi?.sebab || "Telaah tidak tersimpan.");
          return;
        }
        await muatDraf(berkas?.perkaraId ?? "");
      } finally {
        setSibuk("");
      }
    },
    [alasanTolak, berkas?.perkaraId, draf, muatDraf, namaSaya]
  );

  const terimaSisanya = useCallback(async () => {
    if (!draf || !namaSaya) return;
    setSibuk("sisanya");
    try {
      await fetch(apiPath("/api/aleta-ecourt/putusan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tindakan: "terimaSisanya", drafId: draf.id, olehNama: namaSaya }),
      });
      await muatDraf(berkas?.perkaraId ?? "");
    } finally {
      setSibuk("");
    }
  }, [berkas?.perkaraId, draf, muatDraf, namaSaya]);

  const bukaPanel = useCallback(
    (kunci: KunciPanel) => {
      setAktif(kunci);
      if (!berkas) return;
      if (kunci === "draf" && !draf) void muatDraf(berkas.perkaraId);
      if (kunci === "jejak" && draf && !jejak) void muatJejak(draf.id);
    },
    [berkas, draf, jejak, muatDraf, muatJejak]
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="ALETA Judicia"
        title="Ruang kerja perkara"
        description="Berkas, riwayat, pemeriksaan, draf, dan jejaknya dalam satu tempat. Susunannya mengikuti peran Anda."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <Input
            value={nomor}
            onChange={(event) => setNomor(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void muatBerkas(nomor);
            }}
            placeholder="Nomor perkara, misalnya 545/Pdt.G/2026/PA.Dgl"
            aria-label="Nomor perkara"
          />
          <Button onClick={() => void muatBerkas(nomor)} disabled={memuat || !nomor.trim()}>
            {memuat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Buka perkara
          </Button>
        </CardContent>
      </Card>

      {pesan ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{pesan}</span>
        </div>
      ) : null}

      {pilihan.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perkara mana yang dimaksud?</CardTitle>
            <CardDescription>Nomor yang Anda ketik cocok dengan lebih dari satu perkara.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pilihan.map((item) => (
              <button
                key={item.perkaraId}
                type="button"
                onClick={() => void muatBerkas("", item.perkaraId)}
                className="flex w-full items-baseline justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{item.nomorPerkara}</span>
                <span className="text-xs text-muted-foreground">
                  {item.jenisPerkara} · {item.tanggalDaftar}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {berkas ? (
        <>
          <div className="flex flex-wrap gap-2">
            {panel.map((item) => {
              const Ikon = item.ikon;
              return (
                <Button
                  key={item.kunci}
                  variant={aktif === item.kunci ? "default" : "outline"}
                  size="sm"
                  onClick={() => bukaPanel(item.kunci)}
                >
                  <Ikon className="mr-2 h-4 w-4" aria-hidden />
                  {item.judul}
                </Button>
              );
            })}
          </div>

          {aktif === "berkas" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{berkas.nomorPerkara}</CardTitle>
                <CardDescription>Sebelas sumber ditarik bersamaan; tiap baris menyebut asalnya.</CardDescription>
              </CardHeader>
              <CardContent>
                <BarisBerkas nama="Identitas perkara" bagian={berkas.identitas} />
                <BarisBerkas nama="Para pihak" bagian={berkas.paraPihak} />
                <BarisBerkas nama="Majelis hakim" bagian={berkas.majelis} />
                <BarisBerkas nama="Panitera" bagian={berkas.panitera} />
                <BarisBerkas nama="Riwayat sidang" bagian={berkas.riwayatSidang} />
                <BarisBerkas nama="Saksi tercatat" bagian={berkas.saksiTercatat} />
                <BarisBerkas nama="Keterangan saksi" bagian={berkas.pemeriksaanSaksi} />
                <BarisBerkas nama="Dokumen e-Court" bagian={berkas.dokumenECourt} />
                <BarisBerkas nama="Putusan" bagian={berkas.putusan} />
                <BarisBerkas nama="Pertimbangan" bagian={berkas.pertimbangan} />

                {berkas.halangan.length ? (
                  <div className="mt-4 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    {berkas.halangan.map((satu) => (
                      <p key={satu}>{satu}</p>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {aktif === "riwayat" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Riwayat sidang</CardTitle>
                <CardDescription>
                  Dibaca dari jadwal SIPP. Sidang yang kehadirannya belum dicatat tidak ditulis hadir.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Array.isArray(berkas.riwayatSidang.nilai) && berkas.riwayatSidang.nilai.length ? (
                  <ol className="space-y-2">
                    {(berkas.riwayatSidang.nilai as Array<Record<string, unknown>>).map((sidang, urutan) => (
                      <li
                        key={`${String(sidang.sidangKe ?? urutan)}-${String(sidang.tanggal ?? "")}`}
                        className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0"
                      >
                        <span className="text-sm">
                          Sidang ke-{String(sidang.sidangKe ?? urutan + 1)} · {String(sidang.agenda ?? "agenda belum tercatat")}
                        </span>
                        <span className="text-xs text-muted-foreground">{String(sidang.tanggal ?? "")}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState title="Belum ada sidang tercatat" description="Jadwal sidang perkara ini masih kosong di SIPP." />
                )}
              </CardContent>
            </Card>
          ) : null}

          {aktif === "statistik" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Statistik perkara</CardTitle>
                <CardDescription>
                  Sebelas analisis dari register SIPP: ketepatan input, banding dengan perkara sejenis, kinerja
                  majelis, dan seterusnya. Tiap analisis berjalan hanya saat tombolnya ditekan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Komponen milik layar Status Perkara, dipakai ulang apa adanya.
                    Menyalinnya ke sini akan menghasilkan dua tampilan yang harus
                    diperbaiki dua kali - dan yang kedua selalu terlambat. */}
                <AletaAnalisaPerkara nomorPerkara={berkas.nomorPerkara} />
              </CardContent>
            </Card>
          ) : null}

          {aktif === "pemeriksaan" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pemeriksaan</CardTitle>
                <CardDescription>
                  Aturan pemeriksaan dijalankan dari pustaka. Selama belum ada aturan yang disahkan, bagian ini
                  sengaja kosong — pemeriksaan tanpa dasar hukum tidak boleh menyatakan apa pun.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  title="Aturan pemeriksaan belum disahkan"
                  description="Admin memasukkan aturannya beserta jangkar pasal, lalu mengesahkannya. Sebelum itu, tidak ada kesimpulan yang boleh ditampilkan di sini."
                />
              </CardContent>
            </Card>
          ) : null}

          {aktif === "draf" ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Draf putusan</CardTitle>
                  <CardDescription>
                    {draf
                      ? `Versi ${draf.versi} · ${draf.keadaan}`
                      : "Belum ada draf untuk perkara ini."}
                  </CardDescription>
                </div>
                {ringkas ? (
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {/* "siap" berarti lengkap dan tanpa halangan - BUKAN benar.
                        Kata itu dipilih dengan sengaja, dan tetap dipakai di
                        layar supaya yang membacanya tidak salah menyimpulkan. */}
                    <Badge variant={draf?.siap ? "success" : "muted"}>
                      {draf?.siap ? "lengkap, tanpa halangan" : "masih ada halangan"}
                    </Badge>
                    <Badge variant="outline">{ringkas.diterima} diterima</Badge>
                    <Badge variant="outline">{ringkas.ditolak} ditolak</Badge>
                    {ringkas.belum ? <Badge variant="danger">{ringkas.belum} belum ditelaah</Badge> : null}
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {sibuk === "draf" ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Membuka draf…
                  </p>
                ) : null}

                {draf && ringkas ? (
                  <>
                    {ringkas.diterimaSekaligus ? (
                      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                        {ringkas.diterimaSekaligus} alinea diterima sekaligus, bukan satu per satu. Jejaknya mencatat
                        perbedaan itu.
                      </p>
                    ) : null}

                    {butir.map((satu) => (
                      <div key={satu.id} className="rounded-md border border-border p-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{satu.teks}</p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {satu.keadaan === "belum" ? (
                            <>
                              <Button size="sm" onClick={() => void telaah(satu.id, "diterima")} disabled={sibuk === satu.id}>
                                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden /> Terima
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void telaah(satu.id, "ditolak")}
                                disabled={sibuk === satu.id || !(alasanTolak[satu.id] ?? "").trim()}
                              >
                                <XCircle className="mr-2 h-4 w-4" aria-hidden /> Tolak
                              </Button>
                              <Input
                                value={alasanTolak[satu.id] ?? ""}
                                onChange={(event) =>
                                  setAlasanTolak((lama) => ({ ...lama, [satu.id]: event.target.value }))
                                }
                                placeholder="Alasan menolak — wajib diisi"
                                className="h-9 max-w-md"
                                aria-label="Alasan menolak alinea ini"
                              />
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {satu.keadaan === "diterima" ? "Diterima" : "Ditolak"} oleh {satu.diputusOleh}
                              {satu.sekaligus ? " (sekaligus)" : ""}
                              {satu.alasanTolak ? ` — ${satu.alasanTolak}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {ringkas.belum ? (
                      <Button variant="outline" onClick={() => void terimaSisanya()} disabled={sibuk === "sisanya"}>
                        Terima {ringkas.belum} sisanya sekaligus
                      </Button>
                    ) : null}

                    {draf.halangan.length ? (
                      <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        <p className="font-medium">Yang menahan draf ini:</p>
                        {draf.halangan.map((satu) => (
                          <p key={satu}>{satu}</p>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {!draf && sibuk !== "draf" ? (
                  <EmptyState
                    title="Belum ada draf"
                    description="Draf dirakit dari pustaka pertimbangan setelah fakta perkaranya lengkap."
                  />
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {aktif === "jejak" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Jejak</CardTitle>
                <CardDescription>Butir mana, nilai dari sistem mana, dan pasal versi berapa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!draf ? (
                  <EmptyState title="Belum ada draf" description="Jejak muncul setelah draf pertama dirakit." />
                ) : null}

                {sibuk === "jejak" ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menyusun jejak…
                  </p>
                ) : null}

                {jejak?.dasar?.length ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Dasar hukum, dibekukan saat draf disusun</p>
                    {jejak.dasar.map((satu) => (
                      <div key={satu.jangkar} className="rounded-md border border-border p-3 text-sm">
                        <RujukanPasal jangkar={satu.jangkar} tertulis={satu.tertulis || satu.jangkar} />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {satu.versiPeraturan || "versi peraturan tidak tercatat"}
                        </p>
                        {!satu.terbukti ? (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            Tidak ditemukan di pustaka hukum.
                          </p>
                        ) : null}
                        {satu.sudahDicabut ? (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            Peraturannya sudah dicabut. Bunyi pasalnya masih ada, dan justru itu yang membuat
                            kekeliruan ini tidak terlihat dari naskahnya.
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {jejak?.nilai?.length ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Nilai yang mengisi naskah</p>
                    {jejak.nilai.map((satu) => (
                      <div
                        key={satu.nama}
                        className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-sm last:border-0"
                      >
                        <span>{satu.nama}</span>
                        <span className="text-right text-xs text-muted-foreground">
                          {satu.nilai} · {satu.asal || "asal tidak tercatat"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {jejak?.lubang?.length ? (
                  <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <p className="font-medium">Yang belum dapat dijawab jejak ini:</p>
                    {jejak.lubang.map((satu) => (
                      <p key={satu}>{satu}</p>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
