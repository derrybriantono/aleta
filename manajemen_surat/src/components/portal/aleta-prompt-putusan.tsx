"use client";

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import {
  PILIHAN_ARAH,
  PILIHAN_MEDIASI,
  daftarBerkas,
  isianKurang,
  pilihanAwal,
  sebutanPihak,
  susunPrompt,
  type BahanPrompt,
  type PilihanPrompt,
} from "@/lib/prompt-putusan";
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

export function AletaPromptPutusan({ nomorPerkara }: { nomorPerkara: string }) {
  const [keadaan, setKeadaan] = useState<Keadaan>("diam");
  const [pesan, setPesan] = useState("");
  const [bahan, setBahan] = useState<BahanPrompt | null>(null);
  const [pilihan, setPilihan] = useState<PilihanPrompt | null>(null);
  const [tersalin, setTersalin] = useState(false);

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
      const isi = (await jawab.json()) as BahanPrompt & { alasan?: string };
      if (!isi?.ok) {
        setKeadaan("gagal");
        setPesan(isi?.alasan || "Bahan perkara tidak dapat dibaca.");
        return;
      }
      setBahan(isi);
      setPilihan(pilihanAwal(isi));
      setKeadaan("siap");
    } catch (error) {
      setKeadaan("gagal");
      setPesan(error instanceof Error ? error.message : "Gagal menghubungi peladen.");
    }
  }, [nomorPerkara]);

  const ubah = <K extends keyof PilihanPrompt>(kunci: K, nilai: PilihanPrompt[K]) => {
    setPilihan((lama) => (lama ? { ...lama, [kunci]: nilai } : lama));
    setTersalin(false);
  };

  const teks = useMemo(
    () => (bahan && pilihan ? susunPrompt(bahan, pilihan) : ""),
    [bahan, pilihan]
  );
  const kurang = useMemo(
    () => (bahan && pilihan ? isianKurang(bahan, pilihan) : []),
    [bahan, pilihan]
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
          Menyusun perintah lengkap untuk Project Claude <b>ALETA AI PA CLAUDE</b> - jadwal sidang,
          mediasi, saksi, kuasa, dan nama berkas terisi sendiri dari SIPP; arah putusan dan blangko
          diisi sendiri.
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

  return (
    <div className="space-y-5">
      {/* --------------------------------------------------- yang diisi orang */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Yang harus Anda tentukan</h4>

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

        <div className="grid gap-2 sm:grid-cols-2">
          <Centang
            label="Ada gugatan Rekonvensi"
            keterangan="Bila tidak dicentang, perintah menyuruh membuang seluruh format rekonvensi dari blangko."
            nilai={pilihan.adaRekonvensi}
            ubah={(v) => ubah("adaRekonvensi", v)}
          />
          <Centang
            label={`${dua} mengajukan alat bukti`}
            keterangan={`Bila tidak dicentang, perintah menyatakan ${dua} tegas tidak mengajukan bukti.`}
            nilai={pilihan.termohonAdaBukti}
            ubah={(v) => ubah("termohonAdaBukti", v)}
          />
          <Centang
            label="Ada bukti elektronik"
            keterangan="Tangkapan layar, USB, dan sejenisnya."
            nilai={pilihan.adaBuktiElektronik}
            ubah={(v) => ubah("adaBuktiElektronik", v)}
          />
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
        </div>

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

        <label className="block space-y-1">
          <span className="text-sm font-medium">Bukti surat {satu}</span>
          <Input
            value={pilihan.buktiSurat}
            onChange={(e) => ubah("buktiSurat", e.target.value)}
            placeholder="P.1 berupa KTP dan P.2 berupa Kutipan Akta Nikah"
          />
        </label>

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

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Lampiran tambahan (satu per baris)</span>
            <textarea
              value={pilihan.lampiranTambahan}
              onChange={(e) => ubah("lampiranTambahan", e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
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
        <DariSipp label={`Berkas e-Court (${berkas.length})`} isi={berkas.join("\n")} />
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
          Tempelkan ke Project <b>ALETA AI PA CLAUDE</b>, lalu lampirkan berkas yang disebut pada
          bagian E.
        </p>
      </div>
    </div>
  );
}
