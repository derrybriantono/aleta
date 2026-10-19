"use client";

/**
 * ============================================================================
 * POP-UP HASIL MEDIASI (.rtf) - JADWAL MEDIASI, HANYA MEDIATOR (7 Okt 2026)
 * ============================================================================
 *
 * Diminta pengguna: "buatkan fitur di jadwal mediasi otomatis membuat hasil
 * mediasi berupa file .rtf (dengan seluruh komponen berkasnya hanya untuk
 * mediator) ... keluar menu pop up terus apa saja yang bisa dipilih untuk
 * disepakati (paling utama itu mediasi perkara cerai terus yang lain
 * mengikuti), (contoh di klik mut'ah terus klik pihak tergugat dan masukkan
 * nominal 1.000.000)".
 *
 * Empat langkah: Hasil -> Butir kesepakatan -> Data perkara -> Pratinjau &
 * unduh. Seluruh naskah disusun lib/hasil-mediasi.ts (murni, teruji) dan
 * ditulis RTF oleh lib/hasil-mediasi-rtf.ts; pop-up ini hanya memegang
 * pilihannya. Dirender lewat PORTAL ke document.body - sama dengan dialog
 * Court Calendar 1.186: induk ber-transform di dalam tabel membuat "fixed"
 * ikut induknya.
 *
 * Tidak ada yang ditulis ke SIPP atau e-Court. Yang disimpan hanya pilihan
 * mediator (draf), supaya pop-up dapat dibuka lagi.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, Save, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PemilihTanggalSidang } from "@/components/ui/pemilih-tanggal-sidang";
import { Textarea } from "@/components/ui/textarea";
import { terbilang } from "@/lib/biaya-perkara";
import { apiPath } from "@/lib/base-path";
import {
  ALASAN_TIDAK_BERHASIL,
  ALASAN_TIDAK_DAPAT,
  HASIL_MEDIASI,
  LABEL_KELOMPOK,
  angkaRibuan,
  berhasil,
  butirTersedia,
  drafAwal,
  kekuranganDraf,
  kelompokPerkara,
  namaBerkasHasilMediasi,
  paduDraf,
  susunNaskah,
  susunPasal,
  type BahanHasilMediasi,
  type DefinisiButir,
  type DrafHasilMediasi,
  type IsianButir,
  type MedanButir,
  type SisiAtauKeduanya,
} from "@/lib/hasil-mediasi";
import { naskahKeRtf, rtfKeBita } from "@/lib/hasil-mediasi-rtf";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";

const ALAMAT = "/api/aleta-ecourt/hasil-mediasi";

type Langkah = "hasil" | "butir" | "data" | "pratinjau";

const LANGKAH: Array<{ kunci: Langkah; label: string }> = [
  { kunci: "hasil", label: "1. Hasil" },
  { kunci: "butir", label: "2. Butir kesepakatan" },
  { kunci: "data", label: "3. Data perkara" },
  { kunci: "pratinjau", label: "4. Pratinjau & unduh" },
];

function angkaDari(teks: string): number {
  const n = Number(String(teks).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Pilihan pihak bersebutan - "Penggugat" / "Tergugat", bukan "pihak 1". */
function PilihPihak({
  nilai,
  onUbah,
  satu,
  dua,
  keduanya,
}: {
  nilai: SisiAtauKeduanya | undefined;
  onUbah: (x: SisiAtauKeduanya) => void;
  satu: string;
  dua: string;
  keduanya?: boolean;
}) {
  const daftar: Array<{ k: SisiAtauKeduanya; label: string }> = [
    { k: "satu", label: satu },
    { k: "dua", label: dua },
    ...(keduanya ? [{ k: "keduanya" as const, label: "Para Pihak" }] : []),
  ];
  return (
    <div className="inline-flex flex-wrap gap-1" role="radiogroup">
      {daftar.map((x) => (
        <button
          key={x.k}
          type="button"
          role="radio"
          aria-checked={nilai === x.k}
          data-pihak={x.k}
          onClick={() => onUbah(x.k)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs font-medium transition",
            nilai === x.k ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}

function MedanIsian({
  butir,
  medan,
  isi,
  onUbah,
  draf,
}: {
  /** Kunci butir pemilik medan - id unik per kartu (9 Okt 2026). */
  butir: string;
  medan: MedanButir;
  isi: IsianButir;
  onUbah: (ubahan: Partial<IsianButir>) => void;
  draf: DrafHasilMediasi;
}) {
  const d = draf.dokumen;
  const nilai = isi[medan.ruas];
  // Unik per butir: "medan-nominal" dulu dipakai bersama oleh nafkah iddah,
  // mut'ah, dst., sehingga label "Uang (Rp)" mut'ah memfokuskan isian nafkah
  // iddah - id ganda di satu halaman.
  const id = `medan-${butir}-${medan.ruas}`;
  let kendali: React.ReactNode = null;
  switch (medan.jenis) {
    case "pihak":
    case "pihak-keduanya":
      kendali = (
        <PilihPihak
          nilai={isi.pihak}
          onUbah={(x) => onUbah({ pihak: x })}
          satu={d.sebutanSatu}
          dua={d.sebutanDua}
          keduanya={medan.jenis === "pihak-keduanya"}
        />
      );
      break;
    case "rupiah": {
      const n = Number(nilai) || 0;
      kendali = (
        <div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Rp</span>
            <Input
              id={id}
              inputMode="numeric"
              value={n > 0 ? angkaRibuan(n) : ""}
              onChange={(e) => onUbah({ [medan.ruas]: angkaDari(e.target.value) } as Partial<IsianButir>)}
              placeholder="0"
              className="h-8 w-40 text-sm tabular-nums"
              data-medan={medan.ruas}
            />
          </div>
          {n > 0 ? <p className="mt-0.5 text-[11px] italic text-muted-foreground">{terbilang(n)} rupiah</p> : null}
        </div>
      );
      break;
    }
    case "angka":
      kendali = (
        <Input
          id={id}
          inputMode="numeric"
          value={nilai === undefined || nilai === null || Number(nilai) === 0 ? "" : String(nilai)}
          onChange={(e) => onUbah({ [medan.ruas]: angkaDari(e.target.value) || undefined } as Partial<IsianButir>)}
          placeholder={medan.petunjuk ?? ""}
          className="h-8 w-28 text-sm tabular-nums"
          data-medan={medan.ruas}
        />
      );
      break;
    case "teks":
      kendali = (
        <Input
          id={id}
          value={String(nilai ?? "")}
          onChange={(e) => onUbah({ [medan.ruas]: e.target.value } as Partial<IsianButir>)}
          placeholder={medan.petunjuk ?? ""}
          className="h-8 text-sm"
          data-medan={medan.ruas}
        />
      );
      break;
    case "teks-panjang":
      kendali = (
        <Textarea
          id={id}
          value={String(nilai ?? "")}
          onChange={(e) => onUbah({ [medan.ruas]: e.target.value } as Partial<IsianButir>)}
          placeholder={medan.petunjuk ?? ""}
          className="min-h-[64px] py-2 text-sm"
          data-medan={medan.ruas}
        />
      );
      break;
    case "pilih":
      kendali = (
        <select
          id={id}
          value={String(nilai ?? "")}
          onChange={(e) => onUbah({ [medan.ruas]: e.target.value } as Partial<IsianButir>)}
          className="h-8 rounded-md border bg-card px-2 text-sm"
          data-medan={medan.ruas}
        >
          {(medan.pilihan ?? []).map((p) => (
            <option key={p.nilai} value={p.nilai}>
              {p.label}
            </option>
          ))}
        </select>
      );
      break;
    case "centang":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-primary"
            checked={Boolean(nilai)}
            onChange={(e) => onUbah({ [medan.ruas]: e.target.checked } as Partial<IsianButir>)}
            data-medan={medan.ruas}
          />
          {medan.label}
        </label>
      );
    case "anak": {
      const terpilih = new Set(isi.anak ?? []);
      const semua = [...new Set([...d.anak, ...(isi.anak ?? [])])];
      kendali = (
        <div className="space-y-1">
          {semua.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nama anak tidak tercatat di SIPP - tambahkan di langkah Data perkara.</p>
          ) : (
            semua.map((nama) => (
              <label key={nama} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={terpilih.has(nama)}
                  onChange={(e) =>
                    onUbah({ anak: e.target.checked ? [...terpilih, nama] : [...terpilih].filter((x) => x !== nama) })
                  }
                />
                {nama}
              </label>
            ))
          )}
        </div>
      );
      break;
    }
  }
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:items-start">
      <label htmlFor={id} className="pt-1 text-xs text-muted-foreground">
        {medan.label}
      </label>
      <div>{kendali}</div>
    </div>
  );
}

function KartuButir({
  def,
  isi,
  onUbah,
  draf,
}: {
  def: DefinisiButir;
  isi: IsianButir;
  onUbah: (ubahan: Partial<IsianButir>) => void;
  draf: DrafHasilMediasi;
}) {
  // Medan kompensasi harta bersama hanya bermakna bila caranya kompensasi.
  const medan = def.medan.filter(
    (m) => !(def.kunci === "harta-bersama" && (m.ruas === "pihak" || m.ruas === "nominal") && isi.cara !== "kompensasi")
  );
  return (
    <div className={cn("rounded-lg border p-2.5", isi.aktif ? "border-primary/50 bg-primary/5" : "bg-card")} data-butir={def.kunci}>
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-primary"
          checked={isi.aktif}
          onChange={(e) => onUbah({ aktif: e.target.checked })}
          aria-label={def.label}
        />
        <span className="text-sm font-medium leading-tight">
          {def.label}
          {def.petunjuk ? <span className="block text-xs font-normal text-muted-foreground">{def.petunjuk}</span> : null}
        </span>
      </label>
      {isi.aktif ? (
        <div className="mt-2 space-y-2 border-t pt-2">
          {medan.map((m) => (
            <MedanIsian key={m.ruas} butir={def.kunci} medan={m} isi={isi} onUbah={onUbah} draf={draf} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HasilMediasiDialog({
  nomorPerkara,
  mediasiId,
  namaPengadilan,
  onTutup,
}: {
  nomorPerkara: string;
  mediasiId: string;
  namaPengadilan: string;
  onTutup: () => void;
}) {
  const [bahan, setBahan] = useState<BahanHasilMediasi | null>(null);
  const [draf, setDraf] = useState<DrafHasilMediasi | null>(null);
  const [tidakTerbaca, setTidakTerbaca] = useState<string[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [kesalahan, setKesalahan] = useState("");
  const [kabar, setKabar] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [langkah, setLangkah] = useState<Langkah>("hasil");
  const [semuaJenis, setSemuaJenis] = useState(false);

  useEffect(() => {
    let batal = false;
    const ambil = async () => {
      try {
        const kueri = new URLSearchParams({ nomorPerkara, mediasiId, pengadilan: namaPengadilan });
        const jawaban = await fetch(apiPath(`${ALAMAT}?${kueri.toString()}`), { cache: "no-store" });
        const luar = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
        if (!jawaban.ok) throw new Error(pesanGalatPortal(luar, `Bahan hasil mediasi tidak terbaca (${jawaban.status}).`));
        const isi = (luar?.data ?? {}) as {
          bahan?: BahanHasilMediasi;
          draf?: unknown;
          tidakTerbaca?: string[];
        };
        if (batal) return;
        // Jawaban tanpa bahan dulu meninggalkan pop-up kosong tanpa pesan.
        if (!isi.bahan) throw new Error("Bahan hasil mediasi tidak terbaca dari server.");
        setBahan(isi.bahan);
        setDraf(paduDraf(drafAwal(isi.bahan), isi.draf));
        setTidakTerbaca(isi.tidakTerbaca ?? []);
      } catch (e) {
        if (!batal) setKesalahan(pesanGalatPortal(e, "Bahan hasil mediasi tidak terbaca."));
      } finally {
        if (!batal) setMemuat(false);
      }
    };
    void ambil();
    return () => {
      batal = true;
    };
  }, [nomorPerkara, mediasiId, namaPengadilan]);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [onTutup]);

  const kelompok = bahan ? kelompokPerkara(bahan) : "umum";
  const ubahButir = useCallback((kunci: string, ubahan: Partial<IsianButir>) => {
    setDraf((lama) => (lama ? { ...lama, butir: { ...lama.butir, [kunci]: { ...lama.butir[kunci], ...ubahan } } } : lama));
  }, []);
  const ubahDokumen = useCallback((ubahan: Partial<DrafHasilMediasi["dokumen"]>) => {
    setDraf((lama) => (lama ? { ...lama, dokumen: { ...lama.dokumen, ...ubahan } } : lama));
  }, []);

  const naskah = useMemo(() => (draf ? susunNaskah(draf, bahan ?? undefined) : []), [draf, bahan]);
  const pasal = useMemo(() => (draf ? susunPasal(draf, bahan ?? undefined) : []), [draf, bahan]);
  const kurang = useMemo(() => (draf ? kekuranganDraf(draf) : []), [draf]);
  const namaBerkas = draf ? namaBerkasHasilMediasi(draf.dokumen.nomorPerkara, draf.hasil) : "";

  const simpan = async (diam = false) => {
    if (!draf) return false;
    setSibuk(true);
    if (!diam) setKabar("");
    try {
      const jawaban = await fetch(apiPath(ALAMAT), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorPerkara, mediasiId, draf }),
      });
      const luar = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
      if (!jawaban.ok) throw new Error(pesanGalatPortal(luar, `Draf belum tersimpan (${jawaban.status}).`));
      const isi = (luar?.data ?? {}) as { tersimpan?: boolean };
      if (!isi.tersimpan) throw new Error("Draf belum tersimpan.");
      if (!diam) setKabar("Draf tersimpan - dapat dibuka lagi dari tombol yang sama.");
      return true;
    } catch (e) {
      setKabar(pesanGalatPortal(e, "Draf belum tersimpan."));
      return false;
    } finally {
      setSibuk(false);
    }
  };

  const unduh = async () => {
    if (!draf) return;
    const rtf = naskahKeRtf(naskah);
    const blob = new Blob([rtfKeBita(rtf)], { type: "application/rtf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = namaBerkas;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    // Draf ikut disimpan - berkas yang diunduh selalu dapat disusun ulang.
    const ok = await simpan(true);
    setKabar(ok ? `Terunduh: ${namaBerkas}. Draf ikut tersimpan.` : `Terunduh: ${namaBerkas}. Draf belum tersimpan - coba Simpan draf.`);
  };

  if (typeof document === "undefined") return null;
  const d = draf?.dokumen;
  const tersedia = draf ? butirTersedia(kelompok, draf.hasil, semuaJenis) : [];

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Hasil mediasi ${nomorPerkara}`}
      onClick={onTutup}
    >
      <div
        className="my-4 w-full max-w-4xl rounded-lg border bg-card p-4 text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-hasil-mediasi=""
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <FileText className="h-4 w-4" /> Hasil mediasi (.rtf)
            </h3>
            <p className="text-sm text-muted-foreground">
              {nomorPerkara}
              {bahan?.jenisPerkara ? ` · ${bahan.jenisPerkara}` : ""}
              {bahan ? ` · ${LABEL_KELOMPOK[kelompok]}` : ""}
              {d?.mediator ? ` · Mediator ${d.mediator}` : ""}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onTutup} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {memuat ? <div className="min-h-[1.25rem]" aria-busy="true" /> : null}
        {kesalahan ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{kesalahan}</p>
        ) : null}

        {draf && d ? (
          <>
            {tidakTerbaca.length ? (
              <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                Tidak terbaca dari SIPP: {tidakTerbaca.join(", ")}. Lengkapi di langkah Data perkara.
              </p>
            ) : null}

            <div className="mb-3 flex flex-wrap gap-1 border-b pb-2" role="tablist">
              {LANGKAH.map((l) => (
                <button
                  key={l.kunci}
                  type="button"
                  role="tab"
                  aria-selected={langkah === l.kunci}
                  disabled={l.kunci === "butir" && !berhasil(draf.hasil)}
                  onClick={() => setLangkah(l.kunci)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40",
                    langkah === l.kunci ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* ---------------- 1. HASIL ---------------- */}
            {langkah === "hasil" ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {HASIL_MEDIASI.map((h) => (
                    <label
                      key={h.kunci}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5",
                        draf.hasil === h.kunci ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      )}
                      data-hasil={h.kunci}
                    >
                      <input
                        type="radio"
                        name="hasil-mediasi"
                        className="mt-0.5 accent-primary"
                        checked={draf.hasil === h.kunci}
                        onChange={() =>
                          setDraf((lama) => {
                            if (!lama) return lama;
                            const baru = { ...lama, hasil: h.kunci };
                            // Berhasil seluruhnya pada perceraian = rukun kembali (Pasal 27 ayat (5)).
                            if (h.kunci === "berhasil-seluruhnya" && kelompok === "cerai") {
                              baru.butir = { ...lama.butir, "rukun-kembali": { ...lama.butir["rukun-kembali"], aktif: true } };
                              baru.penutup = "cabut";
                            }
                            if (h.kunci === "berhasil-sebagian") {
                              baru.butir = { ...baru.butir, "tidak-disepakati": { ...baru.butir["tidak-disepakati"], aktif: true } };
                            }
                            return baru;
                          })
                        }
                      />
                      <span>
                        <span className="text-sm font-medium">{h.label}</span>
                        <span className="block text-xs text-muted-foreground">{h.keterangan}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {draf.hasil === "tidak-berhasil" || draf.hasil === "tidak-dapat-dilaksanakan" ? (
                  <div className="space-y-2 rounded-lg border p-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alasan (PERMA 1/2016 Pasal 32)</p>
                    {(draf.hasil === "tidak-berhasil" ? ALASAN_TIDAK_BERHASIL : ALASAN_TIDAK_DAPAT).map((a) => (
                      <label key={a.kunci} className="flex items-start gap-2 text-sm" data-alasan={a.kunci}>
                        <input
                          type="radio"
                          name="alasan-mediasi"
                          className="mt-0.5 accent-primary"
                          checked={(draf.hasil === "tidak-berhasil" ? draf.alasanTidakBerhasil : draf.alasanTidakDapat) === a.kunci}
                          onChange={() =>
                            setDraf((lama) =>
                              lama
                                ? draf.hasil === "tidak-berhasil"
                                  ? { ...lama, alasanTidakBerhasil: a.kunci as DrafHasilMediasi["alasanTidakBerhasil"] }
                                  : { ...lama, alasanTidakDapat: a.kunci as DrafHasilMediasi["alasanTidakDapat"] }
                                : lama
                            )
                          }
                        />
                        <span>
                          {a.label}
                          <span className="block text-xs text-muted-foreground">{a.pasal}</span>
                        </span>
                      </label>
                    ))}
                    {(draf.hasil === "tidak-berhasil"
                      ? ALASAN_TIDAK_BERHASIL.find((x) => x.kunci === draf.alasanTidakBerhasil)?.iktikad
                      : ALASAN_TIDAK_DAPAT.find((x) => x.kunci === draf.alasanTidakDapat)?.iktikad) ? (
                      <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
                        <span className="text-xs text-muted-foreground">Pihak yang tidak beriktikad baik:</span>
                        <PilihPihak
                          nilai={draf.pihakTidakBeriktikad}
                          onUbah={(x) => setDraf((lama) => (lama ? { ...lama, pihakTidakBeriktikad: x } : lama))}
                          satu={d.sebutanSatu}
                          dua={d.sebutanDua}
                          keduanya
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {draf.hasil === "berhasil-seluruhnya" && kelompok !== "cerai" ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm">
                    <span className="text-xs text-muted-foreground">Penutup kesepakatan:</span>
                    {(
                      [
                        { k: "akta", label: "Dikuatkan dalam Akta Perdamaian (Pasal 27 ayat (4))" },
                        { k: "cabut", label: "Gugatan dicabut (Pasal 27 ayat (5))" },
                      ] as const
                    ).map((p) => (
                      <label key={p.k} className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="penutup"
                          className="accent-primary"
                          checked={draf.penutup === p.k}
                          onChange={() => setDraf((lama) => (lama ? { ...lama, penutup: p.k } : lama))}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setLangkah(berhasil(draf.hasil) ? "butir" : "data")}>
                    Lanjut
                  </Button>
                </div>
              </div>
            ) : null}

            {/* ---------------- 2. BUTIR ---------------- */}
            {langkah === "butir" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Centang yang disepakati, lalu pilih pihak yang dibebani dan isi nominalnya. Nominal yang kosong tercetak titik-titik
                    untuk diisi tangan.
                  </p>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" className="accent-primary" checked={semuaJenis} onChange={(e) => setSemuaJenis(e.target.checked)} />
                    Tampilkan butir jenis perkara lain
                  </label>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {tersedia.map((def) => (
                    <KartuButir
                      key={def.kunci}
                      def={def}
                      isi={draf.butir[def.kunci] ?? { aktif: false }}
                      onUbah={(ubahan) => ubahButir(def.kunci, ubahan)}
                      draf={draf}
                    />
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setLangkah("data")}>
                    Lanjut
                  </Button>
                </div>
              </div>
            ) : null}

            {/* ---------------- 3. DATA PERKARA ---------------- */}
            {langkah === "data" ? (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">Diisi otomatis dari SIPP; boleh disunting. Suntingan hanya untuk naskah ini, tidak ditulis ke SIPP.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["mediator", "Mediator"],
                      ["namaPengadilan", "Nama pengadilan"],
                      ["kota", "Kota (tempat tanda tangan)"],
                      ["tempatMediasi", "Tempat mediasi"],
                      ["kehadiran", "Dihadiri oleh"],
                      ["kuasaSatu", `Kuasa ${d.sebutanSatu} (bila ada)`],
                      ["kuasaDua", `Kuasa ${d.sebutanDua} (bila ada)`],
                    ] as const
                  ).map(([ruas, label]) => (
                    <label key={ruas} className="grid gap-0.5">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <Input value={String(d[ruas] ?? "")} onChange={(e) => ubahDokumen({ [ruas]: e.target.value })} className="h-8 text-sm" />
                    </label>
                  ))}
                  {(
                    [
                      ["tanggalPenunjukan", "Tanggal penunjukan mediator"],
                      ["tanggalKesepakatan", "Tanggal kesepakatan / pernyataan"],
                      ["tanggalLaporan", "Tanggal laporan"],
                    ] as const
                  ).map(([ruas, label]) => (
                    <label key={ruas} className="grid gap-0.5">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <Input type="date" value={d[ruas]} onChange={(e) => ubahDokumen({ [ruas]: e.target.value })} className="h-8 w-44 text-sm" />
                    </label>
                  ))}
                </div>

                {/* Turut Tergugat hanya ditampilkan bila SIPP mencatatnya (9 Okt 2026). */}
                {(["pihakSatu", "pihakDua", ...((d.pihakTurut ?? []).length ? (["pihakTurut"] as const) : [])] as const).map((ruas) => (
                  <div key={ruas} className="rounded-lg border p-2.5" data-identitas={ruas}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {ruas === "pihakSatu" ? d.sebutanSatu : ruas === "pihakDua" ? d.sebutanDua : `Turut ${d.sebutanDua}`} - identitas
                    </p>
                    {(d[ruas] ?? []).map((o, i) => (
                      <div key={i} className="mb-2 grid gap-1">
                        <Input
                          value={o.nama}
                          onChange={(e) => ubahDokumen({ [ruas]: d[ruas].map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)) })}
                          className="h-8 text-sm font-medium"
                          aria-label="Nama"
                        />
                        <Textarea
                          value={o.keterangan}
                          onChange={(e) =>
                            ubahDokumen({ [ruas]: d[ruas].map((x, j) => (j === i ? { ...x, keterangan: e.target.value } : x)) })
                          }
                          placeholder="umur ... tahun, agama ..., pendidikan ..., pekerjaan ..., bertempat tinggal di ..."
                          className="min-h-[56px] py-2 text-xs"
                        />
                      </div>
                    ))}
                    {(d[ruas] ?? []).length === 0 ? (
                      <Button size="sm" variant="outline" onClick={() => ubahDokumen({ [ruas]: [{ nama: "", keterangan: "" }] })}>
                        Tambah nama
                      </Button>
                    ) : null}
                  </div>
                ))}

                <div className="rounded-lg border p-2.5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anak (dari SIPP)</p>
                  <Textarea
                    value={d.anak.join("\n")}
                    onChange={(e) => ubahDokumen({ anak: e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) })}
                    placeholder="Satu baris satu nama anak"
                    className="min-h-[56px] py-2 text-sm"
                  />
                </div>

                <div className="rounded-lg border p-2.5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pertemuan mediasi</p>
                  {d.pertemuan.map((p, i) => (
                    <div key={i} className="mb-1 flex flex-wrap items-center gap-1">
                      <PemilihTanggalSidang
                        value={p.tanggal}
                        sebutan="Tanggal pertemuan mediasi"
                        aria-label={`Tanggal pertemuan mediasi ke-${i + 1}`}
                        kelasBungkus="flex-none"
                        onChange={(v) => ubahDokumen({ pertemuan: d.pertemuan.map((x, j) => (j === i ? { ...x, tanggal: v } : x)) })}
                        className="h-8 w-40 rounded-md border border-input bg-background px-2 text-sm"
                      />
                      <Input
                        value={p.jam}
                        placeholder="jam"
                        onChange={(e) => ubahDokumen({ pertemuan: d.pertemuan.map((x, j) => (j === i ? { ...x, jam: e.target.value } : x)) })}
                        className="h-8 w-28 text-sm"
                      />
                      <Input
                        value={p.tempat}
                        placeholder="tempat"
                        onChange={(e) => ubahDokumen({ pertemuan: d.pertemuan.map((x, j) => (j === i ? { ...x, tempat: e.target.value } : x)) })}
                        className="h-8 w-48 text-sm"
                      />
                      <Input
                        value={p.keterangan}
                        placeholder="keterangan"
                        onChange={(e) =>
                          ubahDokumen({ pertemuan: d.pertemuan.map((x, j) => (j === i ? { ...x, keterangan: e.target.value } : x)) })
                        }
                        className="h-8 w-40 text-sm"
                      />
                      <Button size="sm" variant="ghost" onClick={() => ubahDokumen({ pertemuan: d.pertemuan.filter((_, j) => j !== i) })} aria-label="Hapus pertemuan">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => ubahDokumen({ pertemuan: [...d.pertemuan, { tanggal: "", jam: "", tempat: "", keterangan: "" }] })}
                  >
                    Tambah pertemuan
                  </Button>
                </div>

                <div className="rounded-lg border p-2.5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Biaya mediasi (PERMA 1/2016 Pasal 9)</p>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {(
                      [
                        ["biayaJasa", "Jasa"],
                        ["biayaPanggilanSatu", `Panggilan ${d.sebutanSatu}`],
                        ["biayaPanggilanDua", `Panggilan ${d.sebutanDua}`],
                        ["biayaLain", "Lain-lain"],
                      ] as const
                    ).map(([ruas, label]) => (
                      <label key={ruas} className="grid gap-0.5">
                        <span className="text-xs text-muted-foreground">{label} (Rp)</span>
                        <Input
                          inputMode="numeric"
                          value={d[ruas] > 0 ? angkaRibuan(d[ruas]) : ""}
                          onChange={(e) => ubahDokumen({ [ruas]: angkaDari(e.target.value) })}
                          className="h-8 text-sm tabular-nums"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Dibebankan kepada:</span>
                    <PilihPihak
                      nilai={d.bebanBiayaMediasi}
                      onUbah={(x) => ubahDokumen({ bebanBiayaMediasi: x })}
                      satu={d.sebutanSatu}
                      dua={d.sebutanDua}
                      keduanya
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="accent-primary" checked={d.sertakanPernyataan} onChange={(e) => ubahDokumen({ sertakanPernyataan: e.target.checked })} />
                    Sertakan Pernyataan Para Pihak
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="accent-primary" checked={d.sertakanJadwal} onChange={(e) => ubahDokumen({ sertakanJadwal: e.target.checked })} />
                    Sertakan lembar Jadwal Mediasi
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setLangkah("pratinjau")}>
                    Lanjut
                  </Button>
                </div>
              </div>
            ) : null}

            {/* ---------------- 4. PRATINJAU ---------------- */}
            {langkah === "pratinjau" ? (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={berhasil(draf.hasil) ? "success" : "muted"}>{HASIL_MEDIASI.find((h) => h.kunci === draf.hasil)?.label}</Badge>
                  <span className="break-all text-xs text-muted-foreground" data-nama-berkas="">
                    {namaBerkas}
                  </span>
                </div>
                {kurang.length ? (
                  <ul className="list-disc rounded-md border border-amber-300 bg-amber-50 py-1.5 pl-6 pr-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                    {kurang.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Isi berkas: surat pengantar dan Laporan Hasil Mediasi
                  {d.sertakanPernyataan ? ", Pernyataan Para Pihak" : ""}
                  {berhasil(draf.hasil) ? `, Kesepakatan Perdamaian${draf.hasil === "berhasil-sebagian" ? " Sebagian" : ""} (${pasal.length} pasal)` : ""}
                  {berhasil(draf.hasil) && (d.kuasaSatu || d.kuasaDua) ? ", persetujuan pihak yang diwakili kuasa" : ""}
                  {d.sertakanJadwal ? ", lembar Jadwal Mediasi" : ""}.
                </p>
                {pasal.length ? (
                  <ol className="max-h-[45vh] space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3" data-pratinjau-pasal="">
                    {pasal.map((p, i) => (
                      <li key={`${p.asal}-${i}`}>
                        <p className="text-center text-xs font-semibold">Pasal {i + 1}</p>
                        {p.isi.map((t, j) => (
                          <p key={j} className={cn("text-sm leading-relaxed", j > 0 && /^\d+\.\s/.test(t) ? "pl-5" : "")}>
                            {t}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm">
                    {
                      (
                        naskah.find((b) => b.jenis === "butir" && b.nomor === "1.") as { teks?: string } | undefined
                      )?.teks
                    }
                  </p>
                )}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
              <Button size="sm" onClick={() => void unduh()} disabled={sibuk} data-unduh-rtf="">
                <Download className="mr-1.5 h-4 w-4" />
                Unduh .rtf
              </Button>
              <Button size="sm" variant="outline" onClick={() => void simpan()} disabled={sibuk}>
                <Save className="mr-1.5 h-4 w-4" />
                Simpan draf
              </Button>
              <Button size="sm" variant="ghost" onClick={onTutup}>
                Tutup
              </Button>
              {kabar ? <span className="text-xs text-muted-foreground">{kabar}</span> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
