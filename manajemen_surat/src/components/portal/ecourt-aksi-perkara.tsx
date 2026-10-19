"use client";

/**
 * Aksi e-Court per perkara - KONTRAK K5 (perbaikan 1 Okt 2026, E9, E10, E11).
 *
 *   <EcourtAksiPerkara nomorPerkara perkaraId tanggalSidang konteks="jadwal"|"status" />
 *     - dokumen e-litigasi perkara (yang pada sidang itu didahulukan): unduh
 *       dari arsip ALETA, atau langsung dari e-Court lewat sesi akun sendiri;
 *     - verifikasi majelis LANGSUNG ke e-Court memakai sesi e-Court hakim yang
 *       sedang login (hanya anggota majelis; klik + konfirmasi);
 *     - putusan e-Court: status unggah salinan, TTE oleh panitera memakai sesi
 *       e-Court panitera yang sedang login - passphrase diketik tiap kali,
 *       tidak pernah disimpan;
 *     - lencana "belum diunggah" / "belum TTE".
 *
 *   <EcourtLencanaPutusan nomorPerkara />  - lencana ringkas untuk baris tabel.
 *     Banyak lencana pada satu layar dikumpulkan menjadi SATU permintaan.
 *
 * Membaca tidak menyentuh e-Court (dari catatan penarikan terakhir). Menulis
 * hanya lewat tombol + konfirmasi yang menyebut akun e-Court yang dipakai.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPath, withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { bolehAksiLayar } from "@/lib/matriks-peran";

export type KonteksEcourtAksi = "jadwal" | "status";

export interface EcourtAksiPerkaraProps {
  nomorPerkara: string;
  perkaraId?: number | string | null;
  tanggalSidang?: string | null;
  konteks: KonteksEcourtAksi;
}

export type KeadaanPutusanRingkas = {
  keadaan: string;
  sebutan: string;
  perluTindakan: boolean;
  /** Boleh tidak ada: diturunkan dari `keadaan` (bentuk putusanEcourt baris Jadwal Sidang). */
  belumDiunggah?: boolean;
  belumTte?: boolean;
  diperiksaPada?: string;
};

export interface EcourtLencanaPutusanProps {
  nomorPerkara: string;
  perkaraId?: number | string | null;
  /** Bila pemanggil sudah memegang keadaannya, tidak ada permintaan sama sekali. */
  keadaan?: KeadaanPutusanRingkas | null;
  className?: string;
}

type Dokumen = {
  documentKey: string;
  judulDokumen: string;
  jenisDokumen: string;
  peranPengunggah: string;
  agenda: string;
  tanggalSidang: string;
  padaSidangIni: boolean;
  diunggahPada: string;
  statusVerifikasi: string;
  perluVerifikasi: boolean;
  adaPdf: boolean;
  adaWord: boolean;
};

type AkunRingkas = { nama: string; peran: string; kodePeran?: string; tersambung: boolean; sumber: string } | null;

type Ringkasan = {
  nomorPerkara: string;
  elitigasi: boolean;
  alamatPerkaraDikenal: boolean;
  dokumen: Dokumen[];
  putusan:
    | (KeadaanPutusanRingkas & {
        diunggahOleh: string;
        tanggalUnggahTeks: string;
        paniteraNama: string;
        paniteraTanggalTte: string;
      })
    | null;
  sesi: Array<{ peran: string; sebutanPeran: string; namaAkunEcourt: string; keadaan: string }>;
  akunVerifikasi: AkunRingkas;
  akunTte: AkunRingkas;
  akunUnggah: AkunRingkas;
  bolehVerifikasi: boolean;
  alasanTidakBolehVerifikasi: string;
};

export const TAUTAN_SESI_SAYA = "/admin/aleta-ecourt#sesi-ecourt-saya";

async function bacaJson<T>(respons: Response): Promise<T | null> {
  const isi = (await respons.json().catch(() => null)) as { data?: T } | null;
  return (isi && (isi.data ?? (isi as unknown as T))) || null;
}

// ===========================================================================
// LENCANA - dikumpulkan per layar
// ===========================================================================

const cacheKeadaan = new Map<string, KeadaanPutusanRingkas | null>();
const penantiKeadaan = new Map<string, Array<(k: KeadaanPutusanRingkas | null) => void>>();
let pengumpul: ReturnType<typeof setTimeout> | null = null;

function mintaKeadaan(nomor: string): Promise<KeadaanPutusanRingkas | null> {
  if (cacheKeadaan.has(nomor)) return Promise.resolve(cacheKeadaan.get(nomor) ?? null);
  return new Promise((selesai) => {
    const daftar = penantiKeadaan.get(nomor) ?? [];
    daftar.push(selesai);
    penantiKeadaan.set(nomor, daftar);
    if (pengumpul) return;
    pengumpul = setTimeout(async () => {
      pengumpul = null;
      const nomorBatch = [...penantiKeadaan.keys()];
      const penanti = new Map(penantiKeadaan);
      penantiKeadaan.clear();
      for (let i = 0; i < nomorBatch.length; i += 150) {
        const potong = nomorBatch.slice(i, i + 150);
        const q = new URLSearchParams();
        for (const n of potong) q.append("nomor", n);
        let peta: Record<string, KeadaanPutusanRingkas> = {};
        try {
          const r = await fetch(apiPath(`/api/aleta-ecourt/ecourt-aksi/keadaan?${q.toString()}`), { cache: "no-store" });
          const d = await bacaJson<{ keadaan?: Record<string, KeadaanPutusanRingkas> }>(r);
          peta = d?.keadaan ?? {};
        } catch {
          peta = {};
        }
        for (const n of potong) {
          const k = peta[n] ?? null;
          cacheKeadaan.set(n, k);
          for (const f of penanti.get(n) ?? []) f(k);
        }
      }
    }, 40);
  });
}

/** Lencana E11 untuk satu putusan. Tidak menampilkan apa pun bila tidak perlu tindakan. */
export function LencanaKeadaanPutusan({ keadaan, className }: { keadaan: KeadaanPutusanRingkas | null; className?: string }) {
  if (!keadaan || !keadaan.perluTindakan) return null;
  const belumDiunggah = keadaan.belumDiunggah ?? keadaan.keadaan === "salinan_belum_diunggah";
  const belumTte = keadaan.belumTte ?? keadaan.keadaan === "belum_tte_panitera";
  const teks =
    keadaan.keadaan === "putusan_ecourt_error"
      ? "Putusan e-Court error"
      : belumDiunggah
        ? "Belum diunggah ke e-Court"
        : belumTte
          ? "Belum TTE panitera"
          : keadaan.sebutan;
  return (
    <Badge
      variant={keadaan.keadaan === "putusan_ecourt_error" ? "danger" : "warning"}
      className={cn("whitespace-nowrap px-2 py-0.5", className)}
      title={`${keadaan.sebutan}${keadaan.diperiksaPada ? ` - menurut pemeriksaan e-Court ${new Date(keadaan.diperiksaPada).toLocaleString("id-ID")}` : ""}`}
      data-ecourt-lencana={keadaan.keadaan}
    >
      {teks}
    </Badge>
  );
}

export function EcourtLencanaPutusan({ nomorPerkara, keadaan: dariPemanggil, className }: EcourtLencanaPutusanProps) {
  const nomor = String(nomorPerkara || "").trim();
  const [keadaan, setKeadaan] = useState<KeadaanPutusanRingkas | null>(dariPemanggil ?? null);
  useEffect(() => {
    if (dariPemanggil !== undefined || !nomor) return;
    let hidup = true;
    void mintaKeadaan(nomor).then((k) => {
      if (hidup) setKeadaan(k);
    });
    return () => {
      hidup = false;
    };
  }, [nomor, dariPemanggil]);
  return <LencanaKeadaanPutusan keadaan={dariPemanggil !== undefined ? dariPemanggil : keadaan} className={className} />;
}

// ===========================================================================
// KOMPONEN UTAMA
// ===========================================================================

function TautanSesiSaya({ teks = "Sambungkan sesi e-Court saya" }: { teks?: string }) {
  return (
    <a className="font-medium text-primary underline underline-offset-2" href={withBasePath(TAUTAN_SESI_SAYA)}>
      {teks}
    </a>
  );
}

function sebutStatusVerifikasi(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "belum") return { teks: "Belum diverifikasi", varian: "warning" as const };
  if (s.includes("tidak")) return { teks: "Tidak valid", varian: "danger" as const };
  if (s.includes("valid")) return { teks: "Valid", varian: "success" as const };
  return { teks: status || "-", varian: "muted" as const };
}

export function EcourtAksiPerkara({ nomorPerkara, tanggalSidang, konteks }: EcourtAksiPerkaraProps) {
  const nomor = String(nomorPerkara || "").trim();
  const hari = String(tanggalSidang || "").slice(0, 10);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState("");
  const [semuaDokumen, setSemuaDokumen] = useState(konteks === "status");
  const currentUser = usePenggunaAktifOpsional();
  const bolehVerifikasiPeran = bolehAksiLayar(currentUser, "ecourt.verifikasi");

  const muat = useCallback(async () => {
    if (!nomor) return;
    setMemuat(true);
    try {
      const q = new URLSearchParams({ nomor, tanggalSidang: hari });
      const r = await fetch(apiPath(`/api/aleta-ecourt/ecourt-aksi/perkara?${q.toString()}`), { cache: "no-store" });
      if (r.status === 404) {
        setPesan("Fitur aksi e-Court belum tersedia di server.");
        setRingkasan(null);
        return;
      }
      const d = await bacaJson<{ tersedia: boolean; pesan: string; ringkasan: Ringkasan | null }>(r);
      if (!d?.tersedia || !d.ringkasan) {
        setPesan(d?.pesan || "Keadaan e-Court perkara ini belum terbaca.");
        setRingkasan(null);
      } else {
        setPesan("");
        // HAK-PERAN 12 Okt: verifikasi hanya hakim/pimpinan (ecourt.verifikasi); rute juga 403.
        setRingkasan({ ...d.ringkasan, bolehVerifikasi: d.ringkasan.bolehVerifikasi && bolehVerifikasiPeran });
        cacheKeadaan.set(nomor, d.ringkasan.putusan);
      }
    } catch {
      setPesan("ALETA belum dapat membaca keadaan e-Court perkara ini.");
      setRingkasan(null);
    } finally {
      setMemuat(false);
    }
  }, [nomor, hari, bolehVerifikasiPeran]);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  if (!nomor) return null;
  if (memuat && !ringkasan) {
    return <div className="min-h-[1.25rem]" data-ecourt-aksi="memuat" aria-busy="true" />;
  }
  if (!ringkasan) {
    return pesan ? (
      <p className="text-sm text-muted-foreground" data-ecourt-aksi="kosong">
        {pesan}
      </p>
    ) : null;
  }
  if (!ringkasan.elitigasi && !ringkasan.putusan) {
    return (
      <p className="text-sm text-muted-foreground" data-ecourt-aksi="bukan-ecourt">
        Perkara ini belum tercatat sebagai perkara e-Court di ALETA.
      </p>
    );
  }

  const dokumenTampil = ringkasan.dokumen.filter((d) => semuaDokumen || !hari || d.padaSidangIni);
  const adaDiSidangIni = ringkasan.dokumen.some((d) => d.padaSidangIni);

  return (
    <div className="space-y-3 text-sm" data-ecourt-aksi={konteks}>
      {/* --------------------------- E-LITIGASI --------------------------- */}
      {ringkasan.dokumen.length ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">
              Dokumen e-litigasi
              {hari && !semuaDokumen ? <span className="font-normal text-muted-foreground"> - sidang {hari}</span> : null}
            </h4>
            {hari ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSemuaDokumen((x) => !x)}>
                {semuaDokumen ? "Hanya sidang ini" : `Semua (${ringkasan.dokumen.length})`}
              </Button>
            ) : null}
          </div>
          {hari && !semuaDokumen && !adaDiSidangIni ? (
            <p className="text-muted-foreground">Tidak ada dokumen e-litigasi yang tercatat untuk sidang ini.</p>
          ) : null}
          <ul className="space-y-2">
            {dokumenTampil.map((d) => (
              <BarisDokumen key={d.documentKey} dokumen={d} ringkasan={ringkasan} onSelesai={muat} />
            ))}
          </ul>
          {!ringkasan.bolehVerifikasi && ringkasan.dokumen.some((d) => d.perluVerifikasi) ? (
            <p className="text-sm text-muted-foreground">
              Verifikasi hanya untuk hakim anggota majelis perkara ini
              {ringkasan.alasanTidakBolehVerifikasi === "bukan_anggota_majelis" ? " - Anda bukan anggota majelisnya" : ""}.
            </p>
          ) : null}
        </section>
      ) : ringkasan.elitigasi ? (
        <p className="text-muted-foreground">Belum ada dokumen e-litigasi yang tercatat di arsip ALETA.</p>
      ) : null}

      {/* ----------------------------- PUTUSAN ---------------------------- */}
      {ringkasan.putusan ? <BagianPutusan ringkasan={ringkasan} onSelesai={muat} /> : null}

      <p className="text-sm text-muted-foreground">
        Aksi ke e-Court memakai sesi e-Court akun Anda sendiri.{" "}
        {ringkasan.sesi.some((s) => s.keadaan === "tersambung") ? (
          <>
            Tersambung:{" "}
            {ringkasan.sesi
              .filter((s) => s.keadaan === "tersambung")
              .map((s) => `${s.namaAkunEcourt || "akun"} (${s.sebutanPeran})`)
              .join(", ")}
            . <TautanSesiSaya teks="Atur sesi" />
          </>
        ) : (
          <TautanSesiSaya />
        )}
      </p>
    </div>
  );
}

function BarisDokumen({
  dokumen: d,
  ringkasan,
  onSelesai,
}: {
  dokumen: Dokumen;
  ringkasan: Ringkasan;
  onSelesai: () => void;
}) {
  const status = sebutStatusVerifikasi(d.statusVerifikasi);
  const [bukaVerifikasi, setBukaVerifikasi] = useState(false);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const unduhLewatSesi = async (format: "pdf" | "word") => {
    setSibuk(true);
    setPesan("");
    try {
      const q = new URLSearchParams({ documentKey: d.documentKey, format });
      const r = await fetch(apiPath(`/api/aleta-ecourt/ecourt-aksi/unduh?${q.toString()}`), { cache: "no-store" });
      const tipe = r.headers.get("content-type") || "";
      if (!r.ok || /application\/json/i.test(tipe)) {
        const g = (await r.json().catch(() => ({}))) as { pesan?: string; alasan?: string };
        setPesan(r.status === 404 && !g.alasan ? "Fitur ini belum tersedia di server." : g.pesan || "Berkas belum dapat diambil.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${d.judulDokumen || "dokumen"}.${format === "word" ? "docx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <li className="rounded-md border border-border/70 px-3 py-2" data-dokumen={d.documentKey}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{d.judulDokumen || d.jenisDokumen || "Dokumen"}</span>
        <Badge variant={status.varian} className="px-2 py-0.5">
          {status.teks}
        </Badge>
        {d.padaSidangIni ? (
          <Badge variant="info" className="px-2 py-0.5">
            sidang ini
          </Badge>
        ) : null}
      </div>
      <p className="text-muted-foreground">
        {[d.peranPengunggah, d.agenda, d.tanggalSidang ? `sidang ${d.tanggalSidang}` : ""].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {d.adaPdf ? (
          <a
            className="inline-flex h-9 items-center rounded-lg border px-3 font-semibold"
            href={apiPath(`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(d.documentKey)}&format=pdf`)}
          >
            Unduh PDF
          </a>
        ) : null}
        {d.adaWord ? (
          <a
            className="inline-flex h-9 items-center rounded-lg border px-3 font-semibold"
            href={apiPath(`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(d.documentKey)}&format=word`)}
          >
            Unduh Word
          </a>
        ) : null}
        {!d.adaPdf && !d.adaWord ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={sibuk || !ringkasan.alamatPerkaraDikenal}
            title={
              ringkasan.alamatPerkaraDikenal
                ? "Belum ada di arsip ALETA - ambil langsung dari e-Court memakai sesi akun Anda"
                : "Halaman perkara di e-Court belum dikenal ALETA - jalankan penarikan perkara ini dulu"
            }
            onClick={() => void unduhLewatSesi("pdf")}
          >
            {sibuk ? "Mengambil..." : "Ambil dari e-Court"}
          </Button>
        ) : null}
        {d.perluVerifikasi && ringkasan.bolehVerifikasi ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setBukaVerifikasi((x) => !x)}>
            {bukaVerifikasi ? "Tutup verifikasi" : "Verifikasi"}
          </Button>
        ) : null}
      </div>
      {pesan ? <p className="mt-1 text-amber-700 dark:text-amber-300">{pesan}</p> : null}
      {bukaVerifikasi ? (
        <FormVerifikasi
          dokumen={d}
          akun={ringkasan.akunVerifikasi}
          onSelesai={() => {
            setBukaVerifikasi(false);
            onSelesai();
          }}
        />
      ) : null}
    </li>
  );
}

function FormVerifikasi({ dokumen, akun, onSelesai }: { dokumen: Dokumen; akun: AkunRingkas; onSelesai: () => void }) {
  const [keputusan, setKeputusan] = useState<"valid" | "tidak_valid" | "">("");
  const [keterangan, setKeterangan] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  if (!akun) {
    return (
      <p className="mt-2 text-amber-700 dark:text-amber-300">
        Sesi e-Court akun hakim Anda belum tersambung. <TautanSesiSaya teks="Sambungkan (peran Hakim)" />
      </p>
    );
  }

  const kirim = async (kering: boolean) => {
    if (!keputusan) {
      setPesan("Pilih Valid atau Tidak Valid.");
      return;
    }
    if (!kering) {
      const yakin = window.confirm(
        `Simpan keputusan ${keputusan === "valid" ? "VALID" : "TIDAK VALID"} untuk "${dokumen.judulDokumen}" ` +
          `ke e-Court atas nama ${akun.nama} (${akun.peran})?\n\nIni mengubah data resmi di e-Court.`
      );
      if (!yakin) return;
    }
    setSibuk(true);
    setPesan(kering ? "Membuka dialog verifikasi di e-Court (tanpa menyimpan)..." : "Menyimpan ke e-Court...");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/ecourt-aksi/verifikasi"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentKey: dokumen.documentKey, keputusan, keterangan, konfirmasi: true, kering }),
      });
      if (r.status === 404) {
        setPesan("Fitur ini belum tersedia di server.");
        return;
      }
      const d = await bacaJson<{ ok: boolean; pesan?: string; kering?: boolean; statusSesudah?: string }>(r);
      if (d?.ok) {
        setPesan(
          d.kering
            ? "Dialog verifikasi di e-Court cocok dengan dokumen ini. Belum ada yang disimpan."
            : `Tersimpan di e-Court${d.statusSesudah ? ` (status: ${d.statusSesudah})` : ""}.`
        );
        if (!d.kering) onSelesai();
      } else {
        setPesan(d?.pesan || "Verifikasi belum berhasil.");
      }
    } catch {
      setPesan("ALETA belum dapat dihubungi.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2">
      <p>
        Akan disimpan di e-Court atas nama <strong>{akun.nama}</strong> ({akun.peran}).
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1">
          <input type="radio" name={`v-${dokumen.documentKey}`} checked={keputusan === "valid"} onChange={() => setKeputusan("valid")} />
          Valid
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name={`v-${dokumen.documentKey}`}
            checked={keputusan === "tidak_valid"}
            onChange={() => setKeputusan("tidak_valid")}
          />
          Tidak valid
        </label>
      </div>
      <Input value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Keterangan (boleh kosong)" maxLength={500} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim(true)}>
          Periksa dialog dulu
        </Button>
        <Button type="button" size="sm" disabled={sibuk || !keputusan} onClick={() => void kirim(false)}>
          Simpan verifikasi ke e-Court
        </Button>
      </div>
      {pesan ? <p className="text-muted-foreground">{pesan}</p> : null}
    </div>
  );
}

function BagianPutusan({ ringkasan, onSelesai }: { ringkasan: Ringkasan; onSelesai: () => void }) {
  const p = ringkasan.putusan!;
  const akun = ringkasan.akunTte;
  // HAK-PERAN 12 Okt: TTE salinan hanya panitera/panmud (ecourt.tte); rute juga 403.
  const currentUser = usePenggunaAktifOpsional();
  const bolehTte = bolehAksiLayar(currentUser, "ecourt.tte");
  const kolomRef = useRef<HTMLInputElement | null>(null);
  const [bukaTte, setBukaTte] = useState(false);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const tte = async () => {
    // Passphrase dibaca dari kolomnya TEPAT saat dikirim, tidak pernah
    // ditaruh di state React, dan kolomnya dikosongkan begitu terkirim.
    const kolom = kolomRef.current;
    const passphrase = kolom ? kolom.value : "";
    if (!passphrase) {
      setPesan("Ketik passphrase TTE Anda.");
      return;
    }
    if (!akun) return;
    const yakin = window.confirm(
      `TTE salinan putusan perkara ${ringkasan.nomorPerkara} di e-Court atas nama ${akun.nama} (${akun.peran})?\n\n` +
        "Passphrase tidak disimpan ALETA."
    );
    if (!yakin) return;
    if (kolom) kolom.value = "";
    setSibuk(true);
    setPesan("Mengirim TTE ke e-Court...");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/ecourt-aksi/tte"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorPerkara: ringkasan.nomorPerkara, passphrase, konfirmasi: true }),
      });
      if (r.status === 404) {
        setPesan("Fitur ini belum tersedia di server.");
        return;
      }
      const d = await bacaJson<{ ok: boolean; pesan?: string }>(r);
      if (d?.ok) {
        setPesan("Salinan putusan sudah di-TTE di e-Court.");
        setBukaTte(false);
        onSelesai();
      } else {
        setPesan(d?.pesan || "TTE belum berhasil.");
      }
    } catch {
      setPesan("ALETA belum dapat dihubungi.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <section className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-semibold">Putusan di e-Court</h4>
        <LencanaKeadaanPutusan keadaan={p} />
        {!p.perluTindakan ? <span className="text-muted-foreground">{p.sebutan}</span> : null}
      </div>
      <p className="text-muted-foreground">
        Salinan: {p.belumDiunggah ? "belum diunggah" : p.diunggahOleh ? `diunggah ${p.diunggahOleh}` : "sudah diunggah"}
        {p.tanggalUnggahTeks ? ` · ${p.tanggalUnggahTeks}` : ""}
        {p.paniteraNama ? ` · Panitera ${p.paniteraNama}` : ""}
        {p.paniteraTanggalTte ? ` · TTE ${p.paniteraTanggalTte}` : ""}
      </p>
      {p.belumTte && bolehTte ? (
        akun ? (
          <div className="space-y-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setBukaTte((x) => !x)}>
              {bukaTte ? "Tutup TTE" : "TTE salinan putusan"}
            </Button>
            {bukaTte ? (
              <div className="space-y-2 rounded-md bg-muted/40 p-2">
                <p>
                  Akan ditandatangani di e-Court atas nama <strong>{akun.nama}</strong> ({akun.peran}). Passphrase diketik tiap
                  kali dan tidak disimpan ALETA.
                </p>
                <Input
                  ref={kolomRef}
                  type="password"
                  autoComplete="off"
                  name="aleta-tte-sekali-pakai"
                  placeholder="Passphrase TTE"
                  data-ecourt-passphrase="1"
                />
                <Button type="button" size="sm" disabled={sibuk} onClick={() => void tte()}>
                  {sibuk ? "Mengirim..." : "TTE sekarang"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">
            TTE salinan memakai sesi e-Court akun panitera. <TautanSesiSaya teks="Sambungkan (peran Panitera)" />
          </p>
        )
      ) : null}
      {pesan ? <p className="text-muted-foreground">{pesan}</p> : null}
    </section>
  );
}
