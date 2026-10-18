"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { bolehAksiLayar } from "@/lib/matriks-peran";
import {
  PILIHAN_ARAH,
  PILIHAN_MEDIASI,
  daftarBerkas,
  isianKurang,
  pilihanAwal,
  sebutanPihak,
  type BahanPrompt,
  type PilihanPrompt,
} from "@/lib/prompt-putusan";
import {
  PILIHAN_META,
  TUJUAN_AI,
  isianKurangAi,
  masukanAwal,
  susunPromptAi,
  tujuanDari,
  type KunciMeta,
  type KunciTujuan,
  type MasukanAi,
} from "@/lib/prompt-ai";
import {
  NAMA_PROJECT_AI,
  labelVersiProfil,
  profilEfektif,
  type ProfilProjectAi,
} from "@/lib/profil-project-ai";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PENYUSUN PERINTAH UNTUK ALETA AI PA CLAUDE
 * ============================================================================
 *
 * Borang yang mengubah keterangan SIPP menjadi satu perintah panjang siap
 * salin - yang selama ini diketik ulang dari nol tiap kali hendak menyusun
 * putusan.
 *
 * ============================================================================
 * GARIS PEMISAHNYA JELAS
 * ============================================================================
 *
 * Yang berlatar abu-abu DIAMBIL DARI SIPP dan tidak dapat disunting: jadwal
 * sidang, mediator, tanggal laporan mediasi, nama saksi, nama berkas
 * e-Court, kuasa hukum. Yang berlatar putih DIISI ORANG: arah putusan,
 * rekonvensi, blangko, berkas acuan, bukti surat.
 *
 * Pemisahan itu disengaja sampai ke warnanya. Arah putusan adalah keputusan
 * hakim; membiarkan mesin menebaknya - misalnya dari amar yang sudah ada -
 * akan menghasilkan perintah yang terdengar berwibawa dan salah.
 *
 * ============================================================================
 * SATU BAGIAN YANG SENGAJA BOLEH DISUNTING
 * ============================================================================
 *
 * Isi kesepakatan mediasi datang dari SIPP TAPI dapat diubah. Alasannya
 * diukur, bukan diperkirakan: dari 752 baris mediasi hanya 209 yang punya
 * isian, dan bentuknya tidak seragam - sebagian memuat Pasal 1 sampai
 * sekian, sebagian lain hanya ringkasan laporan mediator. Perkara yang
 * dipakai menyusun layar ini termasuk yang kedua. Kalau kolomnya dikunci,
 * penyusun harus kembali mengetik seluruh pasal di tempat lain.
 *
 * Perintahnya dirangkai di peramban, bukan di peladen: mengubah satu pilihan
 * langsung mengubah kalimatnya, tanpa menunggu jaringan.
 */

type Keadaan = "diam" | "muat" | "siap" | "gagal";

function Tanda({ anak }: { anak: string }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{anak}</span>
  );
}

/** Isian yang datanya dari SIPP - ditampilkan, tidak dapat diubah. */
function DariSipp({ label, isi }: { label: string; isi: string }) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Tanda anak="dari SIPP" />
      </div>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">
        {isi || <span className="text-muted-foreground">— tidak tercatat</span>}
      </p>
    </div>
  );
}

function Centang({
  label,
  keterangan,
  nilai,
  ubah,
}: {
  label: string;
  keterangan?: string;
  nilai: boolean;
  ubah: (baru: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 hover:bg-muted/40">
      <input
        type="checkbox"
        checked={nilai}
        onChange={(e) => ubah(e.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {keterangan ? (
          <span className="block text-sm text-muted-foreground">{keterangan}</span>
        ) : null}
      </span>
    </label>
  );
}

function AletaPromptPutusanInti({ nomorPerkara }: { nomorPerkara: string }) {
  const [keadaan, setKeadaan] = useState<Keadaan>("diam");
  const [pesan, setPesan] = useState("");
  const [bahan, setBahan] = useState<BahanPrompt | null>(null);
  const [pilihan, setPilihan] = useState<PilihanPrompt | null>(null);
  const [tersalin, setTersalin] = useState(false);
  const pengguna = usePenggunaAktifOpsional();
  const kunciSimpanCentang = `aleta.prompt-ai.pakai-project.${pengguna?.id ?? "tamu"}`;
  // Pilihan centang diingat per pengguna (per peramban), bukan per perkara: yang
  // memakai Project hampir pasti memakainya di perkara berikutnya juga.
  const bacaCentang = (k: string) => {
    try {
      return window.localStorage.getItem(k) === "1";
    } catch {
      return false; // peramban yang memblokir penyimpanan tetap dapat memakai layar ini
    }
  };
  const [masukan, setMasukan] = useState<MasukanAi>(() => ({ ...masukanAwal(), pakaiProject: bacaCentang(kunciSimpanCentang) }));
  const [kunciDibaca, setKunciDibaca] = useState(kunciSimpanCentang);
  if (kunciDibaca !== kunciSimpanCentang) {
    // Pengguna aktif berganti: pilihannya dibaca ulang saat render, bukan lewat efek.
    setKunciDibaca(kunciSimpanCentang);
    setMasukan((lama) => ({ ...lama, pakaiProject: bacaCentang(kunciSimpanCentang) }));
  }
  const [profil, setProfil] = useState<ProfilProjectAi>(() => profilEfektif(null));

  // Profil Project: yang diisi Super Admin, atau bawaan V.4.5 bila belum/gagal.
  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const jawab = await fetch(apiPath("/api/aleta-ecourt/profil-project-ai"), { cache: "no-store" });
        const luar = (await jawab.json()) as { data?: { profil?: ProfilProjectAi } } | null;
        if (!batal && luar?.data?.profil) setProfil(profilEfektif(luar.data.profil));
      } catch {
        /* tanpa profil dari server, bawaan V.4.5 yang berlaku */
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  const ubahMasukan = <K extends keyof MasukanAi>(kunci: K, nilai: MasukanAi[K]) => {
    setMasukan((lama) => ({ ...lama, [kunci]: nilai }));
    setTersalin(false);
  };
  const ubahCentangProject = (v: boolean) => {
    ubahMasukan("pakaiProject", v);
    try {
      window.localStorage.setItem(kunciSimpanCentang, v ? "1" : "0");
    } catch {
      /* lihat di atas */
    }
  };
  const ubahTempelan = (kunci: keyof MasukanAi["tempelan"], nilai: string) => {
    setMasukan((lama) => ({ ...lama, tempelan: { ...lama.tempelan, [kunci]: nilai } }));
    setTersalin(false);
  };

  const ambil = useCallback(async () => {
    setKeadaan("muat");
    setPesan("");
    try {
      // apiPath wajib: di produksi portal berjalan di bawah /aleta, dan
      // fetch("/api/...") polos akan memulangkan kerangka HTML, bukan JSON.
      const jawab = await fetch(
        apiPath(`/api/aleta-ecourt/prompt-putusan?nomor=${encodeURIComponent(nomorPerkara)}`),
        { cache: "no-store" }
      );

      // ====================================================================
      // BUNGKUSNYA DIBUKA DULU - INI YANG DULU MEMBUAT LAYARNYA JATUH
      // ====================================================================
      //
      // Seluruh rute portal menjawab dengan bungkus { ok: true, data: {...} }.
      // Yang dibaca di sini dulu bungkusnya, bukan isinya, dan akibatnya
      // berlapis:
      //
      //   1. isi.ok SELALU true - itu ok milik bungkusnya. Cabang gagal di
      //      bawah karena itu tidak pernah menyala, bahkan ketika botnya mati
      //      dan rutenya menjawab "ALETA Bot belum dapat dihubungi". Alasan
      //      yang sudah disiapkan peladen tidak pernah sampai ke layar.
      //   2. bahan diisi BUNGKUSNYA. Seluruh ruasnya undefined, dan
      //      penggambarnya membaca bahan.identitas.jenisPerkara - membaca
      //      properti dari undefined, yang menjatuhkan seluruh layar Status
      //      Perkara, bukan hanya bagian ini.
      //
      // Gejalanya: tombol "Ambil bahan dari SIPP" ditekan, layarnya galat.
      // Selalu, pada perkara mana pun, sebab sebabnya tidak pernah datanya.
      const luar = (await jawab.json()) as { data?: unknown } | null;
      const isi = ((luar && typeof luar === "object" && "data" in luar ? luar.data : luar) ??
        {}) as BahanPrompt & { alasan?: string };

      if (!isi.ok) {
        setKeadaan("gagal");
        setPesan(isi.alasan || "Bahan perkara tidak dapat dibaca.");
        return;
      }

      // Bahan yang mengaku berhasil tetapi tidak membawa identitas perkara
      // tetap ditolak. Tanpa penjagaan ini, satu perubahan bentuk jawaban di
      // peladen kembali menjatuhkan layarnya alih-alih menerangkan keadaannya.
      if (!isi.identitas) {
        setKeadaan("gagal");
        setPesan("Bahan perkara terbaca tetapi tidak memuat identitas perkara.");
        return;
      }

      setBahan(isi);
      setPilihan(pilihanAwal(isi));
      setKeadaan("siap");
    } catch (error) {
      setKeadaan("gagal");
      setPesan(error instanceof Error ? error.message : "Gagal menghubungi server.");
    }
  }, [nomorPerkara]);

  const ubah = <K extends keyof PilihanPrompt>(kunci: K, nilai: PilihanPrompt[K]) => {
    setPilihan((lama) => (lama ? { ...lama, [kunci]: nilai } : lama));
    setTersalin(false);
  };

  const teks = useMemo(
    () => (bahan && pilihan ? susunPromptAi(bahan, pilihan, masukan, profil) : ""),
    [bahan, pilihan, masukan, profil]
  );
  const kurang = useMemo(
    () =>
      bahan && pilihan
        ? [
            ...(masukan.tujuan === "putusan-lengkap" ? isianKurang(bahan, pilihan) : []),
            ...isianKurangAi(masukan, bahan),
          ]
        : [],
    [bahan, pilihan, masukan]
  );

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
    } catch {
      // Peramban yang menolak papan klip tetap menyisakan jalan keluar:
      // teksnya sudah tergelar di kotak bawah dan dapat disorot sendiri.
      setPesan("Peramban menolak menyalin otomatis. Sorot teksnya lalu salin manual.");
    }
  };

  if (keadaan !== "siap" || !bahan || !pilihan) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Menyusun perintah AI yang lengkap - draf pertimbangan, amar, putusan, analisis pembuktian,
          ringkasan, dan lainnya. Jadwal sidang, mediasi, saksi, kuasa, dan nama berkas terisi sendiri
          dari SIPP, dengan identitas pihak disamarkan menjadi inisial; arah putusan dan blangko diisi
          sendiri.
        </p>
        <Button type="button" onClick={ambil} disabled={keadaan === "muat"}>
          {keadaan === "muat" ? "Mengambil bahan…" : "Ambil bahan dari SIPP"}
        </Button>
        {keadaan === "gagal" ? <p className="text-sm text-destructive">{pesan}</p> : null}
      </div>
    );
  }

  const { satu, dua } = sebutanPihak(bahan);
  const berkas = daftarBerkas(bahan);
  const tujuan = tujuanDari(masukan.tujuan);
  const penuhPutusan = tujuan.kunci === "putusan-lengkap";

  return (
    <div className="space-y-5">
      {/* --------------------------------------------------- yang diisi orang */}
      {/* ------------------------------------------------------- tujuan */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Yang ingin dikerjakan</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Tujuan</span>
            <select
              value={masukan.tujuan}
              onChange={(e) => ubahMasukan("tujuan", e.target.value as KunciTujuan)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {TUJUAN_AI.map((t) => (
                <option key={t.kunci} value={t.kunci}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Cakupan jawaban</span>
            <select
              value={masukan.meta}
              onChange={(e) => ubahMasukan("meta", e.target.value as KunciMeta)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {PILIHAN_META.map((m) => (
                <option key={m.kunci || "bawaan"} value={m.kunci}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tujuan.parameter ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium">{tujuan.labelParameter}</span>
            <Input
              value={masukan.parameter}
              onChange={(e) => ubahMasukan("parameter", e.target.value)}
              placeholder={tujuan.parameter === "jenis" ? bahan.identitas.jenisPerkara : tujuan.contohParameter}
            />
          </label>
        ) : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium">Pertanyaan yang ingin dijawab (boleh kosong)</span>
          <textarea
            value={masukan.pertanyaan}
            onChange={(e) => ubahMasukan("pertanyaan", e.target.value)}
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Mis. apakah nafkah madhiyah dapat dikabulkan tanpa tuntutan?"
          />
        </label>

        <div>
          <Centang
            label="Apakah Anda menggunakan Project ALETA AI PA CLAUDE ULTRA?"
            keterangan="Bila dicentang, perintah tidak menulis peran dan tidak menyapa; hanya data perkara dan permintaan dengan pemicu Project."
            nilai={masukan.pakaiProject}
            ubah={ubahCentangProject}
          />
          <p className="mt-1 px-1 text-xs text-muted-foreground">
            {labelVersiProfil(profil)}
            {profil.namaProject && profil.namaProject !== NAMA_PROJECT_AI ? ` (${profil.namaProject})` : ""}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Yang harus Anda tentukan</h4>

        {tujuan.butuhArah ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Arah putusan</span>
            <select
              value={pilihan.arahPutusan}
              onChange={(e) => ubah("arahPutusan", e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">— pilih —</option>
              {PILIHAN_ARAH.map((a) => (
                <option key={a.kunci} value={a.kunci}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Hasil mediasi</span>
            <select
              value={pilihan.hasilMediasi}
              onChange={(e) => ubah("hasilMediasi", e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">— pilih —</option>
              {PILIHAN_MEDIASI.map((m) => (
                <option key={m.kunci} value={m.kunci}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {tujuan.butuhArah ? (
          <Centang
            label="Ada gugatan Rekonvensi"
            keterangan="Bila tidak dicentang, perintah menyuruh membuang seluruh format rekonvensi dari blangko."
            nilai={pilihan.adaRekonvensi}
            ubah={(v) => ubah("adaRekonvensi", v)}
          />
          ) : null}
          {penuhPutusan ? (<>
          <Centang
            label={`${dua} mengajukan alat bukti`}
            keterangan={`Bila tidak dicentang, perintah menyatakan ${dua} tegas tidak mengajukan bukti.`}
            nilai={pilihan.termohonAdaBukti}
            ubah={(v) => ubah("termohonAdaBukti", v)}
          />
          </>) : null}
          <Centang
            label="Ada bukti elektronik"
            keterangan="Tangkapan layar, USB, dan sejenisnya."
            nilai={pilihan.adaBuktiElektronik}
            ubah={(v) => ubah("adaBuktiElektronik", v)}
          />
          {penuhPutusan ? (<>
          <Centang
            label={`Replik ${satu} benar-benar diajukan`}
            keterangan="SIPP kerap menjadwalkan agenda replik meski akhirnya tidak diajukan."
            nilai={pilihan.adaReplik}
            ubah={(v) => ubah("adaReplik", v)}
          />
          <Centang
            label={`Duplik ${dua} benar-benar diajukan`}
            nilai={pilihan.adaDuplik}
            ubah={(v) => ubah("adaDuplik", v)}
          />
          <Centang
            label="Minta analisa sebelum draf"
            keterangan="Analisa perkara dan rumusan pembebanan lebih dahulu, baru teks putusan."
            nilai={pilihan.mintaAnalisaAwal}
            ubah={(v) => ubah("mintaAnalisaAwal", v)}
          />
          <Centang
            label="Minta hasil dalam berkas .doc"
            keterangan="Putusan utuh dikeluarkan sebagai dokumen yang dapat diunduh."
            nilai={pilihan.mintaBerkasDoc}
            ubah={(v) => ubah("mintaBerkasDoc", v)}
          />
          </>) : null}
        </div>

        {penuhPutusan ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Nama file blangko</span>
            <Input
              value={pilihan.berkasBlangko}
              onChange={(e) => ubah("berkasBlangko", e.target.value)}
              placeholder="359_Pdt.G_2026_PA.Dgl - [02] [Kabul] CT - F.rtf"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Nama file acuan susunan</span>
            <Input
              value={pilihan.berkasAcuan}
              onChange={(e) => ubah("berkasAcuan", e.target.value)}
              placeholder="274_Pdt.G_2026_PA.Dgl - [02] [Kabul] CT - F.rtf.doc"
            />
          </label>
        </div>
        ) : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium">Fakta kunci</span>
          <textarea
            value={masukan.fakta}
            onChange={(e) => ubahMasukan("fakta", e.target.value)}
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Fakta yang menurut Anda menentukan, satu per baris. Nama pihak otomatis diganti inisial."
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Bukti surat {satu}</span>
          <Input
            value={pilihan.buktiSurat}
            onChange={(e) => ubah("buktiSurat", e.target.value)}
            placeholder="P.1 berupa KTP dan P.2 berupa Kutipan Akta Nikah"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Keterangan saksi (kutipan BAS, boleh kosong)</span>
          <textarea
            value={masukan.keteranganSaksiBas}
            onChange={(e) => ubahMasukan("keteranganSaksiBas", e.target.value)}
            rows={4}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Tempel keterangan saksi dari BAS apa adanya; ditandai sebagai kutipan BAS."
          />
        </label>

        <details className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Produk para pihak (gugatan, jawaban, replik, duplik, kesimpulan)
          </summary>
          <p className="mt-1 text-sm text-muted-foreground">
            Tempel apa adanya - tidak diringkas dan tidak dirapikan. NIK, nomor telepon, dan nama pihak otomatis
            ditutup; selebihnya dikutip persis.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["gugatan", satu === "Pemohon" ? "Permohonan" : "Gugatan"],
                ["jawaban", `Jawaban ${dua}`],
                ["replik", `Replik ${satu}`],
                ["duplik", `Duplik ${dua}`],
                ["kesimpulan", "Kesimpulan"],
              ] as const
            ).map(([kunci, label]) => (
              <label key={kunci} className="block space-y-1">
                <span className="text-sm font-medium">{label}</span>
                <textarea
                  value={masukan.tempelan[kunci]}
                  onChange={(e) => ubahTempelan(kunci, e.target.value)}
                  rows={4}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </details>

        {tujuan.butuhArah ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium">
            Isi kesepakatan mediasi{" "}
            <Tanda anak={pilihan.isiKesepakatan ? "terisi dari SIPP - boleh diubah" : "SIPP kosong"} />
          </span>
          <textarea
            value={pilihan.isiKesepakatan}
            onChange={(e) => ubah("isiKesepakatan", e.target.value)}
            rows={6}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder={"Pasal 1: …\nPasal 2: …"}
          />
        </label>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {penuhPutusan ? (
          <label className="space-y-1">
            <span className="text-sm font-medium">Lampiran tambahan (satu per baris)</span>
            <textarea
              value={pilihan.lampiranTambahan}
              onChange={(e) => ubah("lampiranTambahan", e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          ) : null}
          <label className="space-y-1">
            <span className="text-sm font-medium">Catatan khusus majelis</span>
            <textarea
              value={pilihan.catatanKhusus}
              onChange={(e) => ubah("catatanKhusus", e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      {/* ------------------------------------------------ yang diambil mesin */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Sudah terisi dari SIPP</h4>
        <p className="text-xs text-muted-foreground">
          Di layar ini nama tampil apa adanya; di dalam perintah, nama pihak, kuasa, dan saksi diganti inisial.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <DariSipp label="Jenis perkara" isi={bahan.identitas.jenisPerkara} />
          <DariSipp label="Sebutan pihak" isi={`${satu} dan ${dua}`} />
          <DariSipp label="Mediator" isi={bahan.mediasi.mediator} />
          <DariSipp
            label="Tanggal mediasi"
            isi={[
              bahan.mediasi.tanggalMulaiTerbaca && `mulai ${bahan.mediasi.tanggalMulaiTerbaca}`,
              bahan.mediasi.tanggalLaporanTerbaca && `laporan ${bahan.mediasi.tanggalLaporanTerbaca}`,
            ]
              .filter(Boolean)
              .join(", ")}
          />
          <DariSipp
            label="Kuasa hukum"
            isi={
              bahan.kuasa.length
                ? bahan.kuasa.map((k) => `${k.pihak}: ${k.nama}`).join("\n")
                : "tidak ada - pihak hadir sendiri"
            }
          />
          <DariSipp
            label="Saksi"
            isi={bahan.saksi.map((s) => `${s.nama} (${s.pihak})`).join("\n")}
          />
        </div>
        <DariSipp
          label={`Riwayat sidang (${bahan.sidang.length})`}
          isi={bahan.sidang
            .map(
              (s) =>
                `${s.tanggalTerbaca}: ${s.agenda}${s.alasanDitunda ? ` (Ditunda: ${s.alasanDitunda})` : ""}`
            )
            .join("\n")}
        />
        <DariSipp
          label={`Berkas e-Court (${berkas.length})`}
          isi={berkas.map((b) => (b.penjelas ? `${b.nama} (${b.penjelas})` : b.nama)).join("\n")}
        />
      </div>

      {/* ------------------------------------------------------- peringatan */}
      {kurang.length > 0 ? (
        <div className="rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
          <p className="text-sm font-medium">Masih perlu dilengkapi</p>
          <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
            {kurang.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ------------------------------------------------------ hasil perintah */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold">Perintah siap salin</h4>
          <span className="text-sm text-muted-foreground">{teks.length.toLocaleString("id-ID")} huruf</span>
          <Button type="button" size="sm" onClick={salin} className="ml-auto">
            {tersalin ? "Tersalin" : "Salin perintah"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={ambil}>
            Muat ulang dari SIPP
          </Button>
        </div>
        <textarea
          readOnly
          value={teks}
          rows={18}
          className={cn(
            "w-full rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm leading-relaxed",
            kurang.length ? "border-amber-400/60" : ""
          )}
        />
        {pesan ? <p className="text-sm text-destructive">{pesan}</p> : null}
        <p className="text-sm text-muted-foreground">
          {masukan.pakaiProject ? (
            <>
              Tempelkan ke Project <b>ALETA AI PA CLAUDE ULTRA</b>
              {penuhPutusan ? ", lalu lampirkan berkas yang disebut pada bagian E." : "."}
            </>
          ) : (
            <>
              Tempelkan ke percakapan Claude
              {penuhPutusan ? ", lalu lampirkan berkas yang disebut pada bagian E." : "."}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/* === HAK-PERAN 12 Okt === */
// Matriks peran: hanya golongan yang berhak (status.analisa) yang melihat panel ini;
// rute GET-nya juga menjawab 403 (pastikanAksi).
export function AletaPromptPutusan(props: { nomorPerkara: string }) {
  const currentUser = usePenggunaAktifOpsional();
  if (!bolehAksiLayar(currentUser, "status.analisa")) return null;
  return <AletaPromptPutusanInti {...props} />;
}
/* === AKHIR HAK-PERAN === */
