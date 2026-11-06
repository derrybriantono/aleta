"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import {
  bandingBaris,
  berkasUntukBukti,
  buktiDariAlinea,
  butirElektronikDariAlinea,
  kalimatBaris,
  katalogDari,
  kolomBukti,
  PIL_COCOK,
  PIL_METERAI,
  tanggalIndo,
  type BarisBukti,
  type ButirElektronik,
  type DataSipp,
} from "@/lib/bukti-tertulis";
import {
  adaKalimatBantahan,
  bacaKeadaan,
  jenisPerkaraBukti,
  permohonanBukti,
  susunParagrafBukti,
  type BuktiMasuk,
  type IsianPermohonan,
  type JenisPerkaraBukti,
  type ParagrafBukti,
} from "@/lib/sinkron-pertimbangan-bukti";
import type { RencanaSisip } from "@/lib/sisip-pertimbangan-bukti";

type Dokumen = { judul: string; documentKey: string };
type Bahan = DataSipp & { dokumen: Dokumen[]; agendaPembuktianKe?: number | null };
type Butir = { sisi: "P" | "T"; nomor: number; kode: string; baris: BarisBukti; diperiksa: boolean };

/**
 * Pemeriksaan alat bukti tertulis di layar cetak ALETA ABT (6 Nov 2026). Bahannya kalimat bukti yang tertulis di pratinjau naskah; pembandingnya
 * data SIPP (rute bukti-sipp). Layar ini TIDAK menulis ke SIPP atau ABT: perubahan hanya tampil di sini dan kalimatnya dapat disalin. Penyimpanan
 * ke ABT tetap lewat kotak alat bukti di Blangko ABT by Derry Briantono.
 */
export function BuktiAletaAbt({
  alinea,
  perkaraId,
  nomor,
  jenisPerkara = "",
  onParagraf,
}: {
  alinea: ReadonlyArray<{ teks: string }>;
  perkaraId: string;
  nomor: string;
  jenisPerkara?: string;
  /** Paragraf pertimbangan bukti yang akan disisipkan ke naskah cetak (kosong bila dimatikan atau tidak ada). Dipanggil tiap isinya berubah. */
  onParagraf?: (paragraf: ParagrafBukti[]) => void;
}) {
  const dariNaskah = (l: ReadonlyArray<{ teks: string }>) => buktiDariAlinea(l).map((x) => ({ ...x, diperiksa: false }));
  const [sumber, setSumber] = useState(alinea);
  const [daftar, setDaftar] = useState<Butir[]>(() => dariNaskah(alinea));
  const [aktif, setAktif] = useState(0);
  const [bahan, setBahan] = useState<Bahan | null>(null);
  const [tersalin, setTersalin] = useState(false);
  // Bukti elektronik dibaca dari naskah (kalimat "bukti elektronik tersebut"); hanya tampil dan menjadi bahan pertimbangan, tidak disunting di sini.
  const elektronik = useMemo(() => butirElektronikDariAlinea(alinea), [alinea]);

  // Pratinjau baru: daftar dibaca ulang dari naskah.
  if (sumber !== alinea) {
    setSumber(alinea);
    setDaftar(dariNaskah(alinea));
    setAktif(0);
  }

  useEffect(() => {
    let batal = false;
    const q = new URLSearchParams({ perkaraId, nomor });
    fetch(apiPath(`/api/aleta-ecourt/blangko-derry/bukti-sipp?${q.toString()}`), { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Bahan }) => {
        if (!batal && j && j.ok && j.data) setBahan(j.data);
      })
      .catch(() => undefined);
    return () => {
      batal = true;
    };
  }, [perkaraId, nomor]);

  if (!daftar.length) return null;
  const b = daftar[Math.min(aktif, daftar.length - 1)];
  const r = b.baris;
  const urutanKtp = (i: number) => daftar.slice(0, i).filter((x) => x.sisi === daftar[i].sisi && katalogDari(x.baris.nm)?.kunci === "ktp").length;
  const banding = (i: number) => bandingBaris(daftar[i].baris, daftar[i].sisi, urutanKtp(i), bahan);
  const iAktif = daftar.indexOf(b);
  const hasil = banding(iAktif);
  const kol = kolomBukti(r.nm);
  const jenis = katalogDari(r.nm);
  const berkas = bahan ? berkasUntukBukti(r.nm, bahan.dokumen) : null;
  const jumlahBeda = daftar.reduce((n, _, i) => n + Object.values(banding(i)).filter((h) => h.keadaan === "beda").length, 0);
  const selesai = daftar.filter((x) => x.diperiksa).length;
  const kalimat = kalimatBaris(r, b.sisi, b.nomor - 1, b.kode);
  const ubah = (kolom: keyof BarisBukti, nilai: string | number) =>
    setDaftar((l) => l.map((x, i) => (i === iAktif ? { ...x, baris: { ...x.baris, [kolom]: nilai } } : x)));

  const medan = (kolom: "nm" | "an" | "no" | "tgl" | "oleh", label: string, jenisInput = "text", contoh = "") => {
    const h = hasil[kolom];
    return (
      <div key={kolom} className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor={`bukti-${kolom}`}>
          {label}
        </label>
        <Input id={`bukti-${kolom}`} type={jenisInput} value={String(r[kolom] ?? "")} placeholder={contoh} onChange={(e) => ubah(kolom, e.target.value)} />
        {h?.keadaan === "sama" ? <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Sama dengan SIPP</p> : null}
        {h?.keadaan === "beda" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-100 px-2 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <span className="min-w-0 flex-1">Di SIPP tertulis {kolom === "tgl" ? tanggalIndo(h.sipp) : h.sipp}</span>
            {h.pakai !== null ? (
              <Button type="button" size="sm" variant="outline" onClick={() => ubah(kolom, h.pakai as string)}>
                Pakai data SIPP
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };
  const pilihan = (kolom: "meterai" | "cocok", label: string, opsi: readonly string[]) => (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        className="min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
        value={String(r[kolom] ?? 0)}
        onChange={(e) => ubah(kolom, Number(e.target.value))}
      >
        {opsi.map((t, v) => (
          <option key={t} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alat bukti tertulis</CardTitle>
        <CardDescription>
          Dibaca dari naskah di atas dan diadu dengan SIPP. Perubahan di sini tidak tersimpan ke ABT: salin kalimatnya, atau simpan lewat kotak alat bukti di Blangko ABT by Derry Briantono.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="success">
            {selesai} dari {daftar.length} sudah diperiksa
          </Badge>
          {jumlahBeda ? <Badge variant="warning">{jumlahBeda} isian berbeda dari SIPP</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 lg:max-w-xs">
          {daftar.map((x, i) => {
            const beda = Object.values(banding(i)).filter((h) => h.keadaan === "beda").length;
            return (
              <button
                key={x.kode}
                type="button"
                aria-current={i === iAktif}
                onClick={() => setAktif(i)}
                className={`flex min-h-11 gap-2.5 rounded-lg border p-2.5 text-left ${i === iAktif ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <span className="min-w-8 max-w-28 flex-none break-all text-sm font-bold text-primary">
                  {x.kode}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{x.baris.nm || "Tanpa nama"}</span>
                  <span className="block text-xs text-muted-foreground">{x.diperiksa ? "Sudah diperiksa" : beda ? `${beda} isian berbeda dari SIPP` : "Belum diperiksa"}</span>
                </span>
              </button>
            );
          })}
          {elektronik.length ? (
            <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
              <p className="text-xs font-semibold text-muted-foreground">Bukti elektronik, dibaca dari naskah</p>
              {elektronik.map((x) => (
                <div key={x.kode} className="flex gap-2.5 rounded-lg border border-border bg-card p-2.5">
                  <span className="min-w-8 max-w-28 flex-none break-all text-sm font-bold text-primary">{x.kode}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{x.nama}</span>
                    <span className="block text-xs text-muted-foreground">{keteranganPeriksaEl(x.periksa)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-bold">
              <span className="text-primary">
                {b.kode}
              </span>{" "}
              {r.nm}
            </p>
            {jenis ? <Badge variant="outline">{jenis.kuat}</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex min-h-48 min-w-0 flex-[1_1_240px] items-center justify-center rounded-lg border border-dashed border-border p-2 text-center text-sm text-muted-foreground">
              {berkas ? (
                <div className="w-full">
                  <iframe title={`Pindaian ${berkas.judul}`} className="h-80 w-full rounded" src={apiPath(`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(berkas.documentKey)}&format=pdf&tampil=1`)} />
                  <a className="text-xs underline" target="_blank" rel="noreferrer" href={apiPath(`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(berkas.documentKey)}&format=pdf&tampil=1`)}>
                    Buka {berkas.judul} di tab baru
                  </a>
                </div>
              ) : (
                "Pindaian bukti ini belum ada di arsip e-Court."
              )}
            </div>
            {typeof r.manual === "string" ? (
              <p className="min-w-0 flex-[2_1_320px] text-sm text-muted-foreground">Bukti ini tertulis sebagai kalimat bebas di naskah.</p>
            ) : (
              <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-3">
                {medan("an", kol.an)}
                {medan("no", kol.no, "text", kol.contohNo)}
                {medan("tgl", kol.tgl, "date")}
                {medan("oleh", "Dikeluarkan oleh")}
              </div>
            )}
          </div>
          {typeof r.manual === "string" ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pilihan("meterai", "Meterai", PIL_METERAI)}
              {pilihan("cocok", "Dicocokkan dengan aslinya", PIL_COCOK)}
            </div>
          )}
          <div className="rounded-lg bg-muted/50 px-4 py-3 font-serif text-base leading-relaxed">{kalimat}</div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(kalimat)
                  .then(() => setTersalin(true))
                  .catch(() => setTersalin(false));
              }}
            >
              {tersalin ? "Tersalin" : "Salin kalimat"}
            </Button>
            <Button type="button" onClick={() => setDaftar((l) => l.map((x, i) => (i === iAktif ? { ...x, diperiksa: !x.diperiksa } : x)))}>
              {b.diperiksa ? "Batalkan tanda selesai" : "Tandai sudah diperiksa"}
            </Button>
          </div>
        </div>
      </CardContent>
      <PertimbanganBukti daftar={daftar} elektronik={elektronik} alinea={alinea} jenisPerkara={jenisPerkara} tglNikah={bahan?.nikah?.tglNikah} jumlahPemohonSipp={bahan?.P?.length} agendaSipp={bahan?.agendaPembuktianKe ?? null} onParagraf={onParagraf} />
    </Card>
  );
}

/** Keterangan keadaan pemeriksaan bukti elektronik di daftar. */
function keteranganPeriksaEl(p: ButirElektronik["periksa"]): string {
  if (p === 0) return "Tidak dapat dicocokkan dengan aslinya, tanpa digital forensic";
  if (p === 1) return "Telah dicocokkan dengan aslinya";
  if (p === 2) return "Disertai hasil digital forensic";
  return "Keadaan pemeriksaan tidak terbaca dari naskah";
}

const PILIHAN_STATUS = [
  { nilai: "", teks: "Belum dipilih" },
  { nilai: "Dikabulkan", teks: "Dikabulkan" },
  { nilai: "Dikabulkan sebagian", teks: "Dikabulkan sebagian" },
  { nilai: "Ditolak", teks: "Ditolak" },
  { nilai: "Tidak Dapat Diterima", teks: "Tidak dapat diterima" },
  { nilai: "Dicabut", teks: "Dicabut" },
  { nilai: "Gugur", teks: "Gugur atau digugurkan" },
  { nilai: "Perdamaian", teks: "Berakhir damai" },
];
const PILIHAN_AGENDA = [
  { nilai: 0, teks: "Sebelum ada pembuktian" },
  { nilai: 1, teks: "Pada pembuktian pertama" },
  { nilai: 2, teks: "Pada pembuktian kedua" },
  { nilai: 3, teks: "Pada pembuktian ketiga atau sesudahnya" },
];

/** Keadaan putusan yang tertulis di naskah, sebagai tebakan awal yang bisa diubah. */
function bacaDariNaskah(alinea: ReadonlyArray<{ teks: string }>): { status: string; verstek: boolean } {
  const t = alinea.map((a) => a.teks).join("\n");
  const status = /tidak dapat diterima/i.test(t)
    ? "Tidak Dapat Diterima"
    : /mencabut|dicabut/i.test(t)
      ? "Dicabut"
      : /mengabulkan[^.]{0,80}sebagian/i.test(t)
        ? "Dikabulkan sebagian"
        : /menolak/i.test(t)
          ? "Ditolak"
          : /mengabulkan/i.test(t)
            ? "Dikabulkan"
            : "";
  return { status, verstek: /verstek|tidak pernah hadir/i.test(t) };
}

/** Keterangan singkat kotak "Masukkan paragraf otomatis": paragraf mana yang akan masuk, yang sudah ada di naskah, dan yang belum bisa disisip. */
function keteranganSisipan(masukkan: boolean, rencana: RencanaSisip | null): string {
  if (!masukkan) return "Tidak dimasukkan: naskah cetak tetap seperti pratinjau di atas.";
  if (!rencana) return "Memeriksa letak sisipan di naskah...";
  const bagian: string[] = [];
  bagian.push(rencana.akanMasuk.length ? `Akan masuk: ${rencana.akanMasuk.join(", ")}.` : "Tidak ada paragraf yang akan ditambahkan.");
  if (rencana.sudahAda.length) bagian.push(`Sudah ada di naskah, tidak ditambah: ${rencana.sudahAda.join(", ")}.`);
  const sebabSama = [...new Set(rencana.tidakDisisip.map((t) => t.sebab))];
  if (sebabSama.length)
    bagian.push(`Belum dapat disisip: ${sebabSama.map((sebab) => `${rencana.tidakDisisip.filter((t) => t.sebab === sebab).map((t) => t.kode || "tanpa kode").join(", ")} (${sebab})`).join("; ")}.`);
  bagian.push("Ini perkiraan dari pratinjau; hasil pastinya tampil saat naskah diunduh.");
  return bagian.join(" ");
}

const ISIAN_LAYAR: ReadonlyArray<{ kunci: keyof IsianPermohonan; label: string; contoh: string; untuk: readonly JenisPerkaraBukti[] }> = [
  { kunci: "alamat", label: "Alamat Pemohon", contoh: "desa, kecamatan, kabupaten (untuk kalimat KTP)", untuk: ["IN", "DK"] },
  { kunci: "anak", label: "Nama anak", contoh: "bila belum ada di akta kelahiran", untuk: ["DK"] },
  { kunci: "calon", label: "Nama calon pasangan anak", contoh: "untuk kalimat penolakan KUA", untuk: ["DK"] },
  { kunci: "usiaAnak", label: "Usia anak", contoh: "mis. 17 tahun 3 bulan", untuk: ["DK"] },
  { kunci: "tglLahirAnak", label: "Tanggal lahir anak", contoh: "mis. 2008-05-14", untuk: ["DK"] },
  { kunci: "pewaris", label: "Nama pewaris", contoh: "untuk kalimat surat kematian, mis. Fulan bin Fulin", untuk: ["KW"] },
];

/**
 * Pertimbangan dari alat bukti (cerai gugat, cerai talak, itsbat nikah, dispensasi kawin, harta bersama, kewarisan, penetapan ahli waris). Bunyi dari Blangko ABT by Derry Briantono lewat kartu
 * aturan; layar ini hanya menampilkan dan menyalin, tidak menyisipkan ke naskah dan tidak menulis ke SIPP atau ABT. Jenis perkara lain: kosong
 * dengan keterangan.
 */
function PertimbanganBukti({
  daftar,
  elektronik,
  alinea,
  jenisPerkara,
  tglNikah,
  jumlahPemohonSipp,
  agendaSipp = null,
  onParagraf,
}: {
  daftar: Butir[];
  elektronik: ButirElektronik[];
  alinea: ReadonlyArray<{ teks: string }>;
  jenisPerkara: string;
  tglNikah?: string;
  jumlahPemohonSipp?: number;
  /** Jumlah sidang beragenda pembuktian menurut jadwal SIPP; null = tidak terbaca (pilihan agenda tetap seperti semula). */
  agendaSipp?: number | null;
  onParagraf?: (paragraf: ParagrafBukti[]) => void;
}) {
  const awal = useMemo(() => bacaDariNaskah(alinea), [alinea]);
  const [status, setStatus] = useState(awal.status);
  const [verstek, setVerstek] = useState(awal.verstek);
  const [lawanMembantah, setLawanMembantah] = useState(false);
  const [agenda, setAgenda] = useState(0);
  const [agendaDiubah, setAgendaDiubah] = useState(false);
  const [agendaTerbaca, setAgendaTerbaca] = useState<number | null>(null);
  // Nilai awal pilihan agenda dari jadwal SIPP, dipakai sekali per nilai baru dan tidak pernah menimpa pilihan yang sudah diubah pengguna.
  if (agendaSipp !== null && agendaTerbaca !== agendaSipp) {
    setAgendaTerbaca(agendaSipp);
    if (!agendaDiubah) setAgenda(Math.min(Math.max(Math.trunc(agendaSipp), 0), 3));
  }
  const [dipilih, setDipilih] = useState<ReadonlySet<string>>(new Set());
  const [tersalin, setTersalin] = useState(false);
  const [jumlahPilih, setJumlahPilih] = useState<"" | "1" | "2">("");
  const [anak, setAnak] = useState<"P" | "L">("P");
  const [isian, setIsian] = useState<IsianPermohonan>({});
  const [masukkan, setMasukkan] = useState(true);
  const [rencana, setRencana] = useState<RencanaSisip | null>(null);
  const jenis = jenisPerkaraBukti(jenisPerkara);
  const permohonan = jenis ? permohonanBukti(jenis) : false;
  const verstekPakai = permohonan ? false : verstek;
  const jumlahPemohon = jumlahPilih ? Number(jumlahPilih) : jumlahPemohonSipp === 1 ? 1 : 2;

  const masuk: BuktiMasuk[] = [
    ...daftar.map((x) => ({ sisi: x.sisi, nomor: x.nomor, kode: x.kode, baris: x.baris })),
    ...elektronik.map((x) => ({ sisi: x.sisi, nomor: x.nomor, kode: x.kode, elektronik: true, periksaEl: x.periksa, baris: { nm: x.nama, manual: null } as BarisBukti })),
  ];
  const hasil = useMemo(
    () =>
      jenis
        ? susunParagrafBukti({
            jenisPerkara: jenis,
            status,
            verstek: verstekPakai,
            lawanHadir: !verstekPakai,
            lawanMembantah,
            agendaPembuktianKe: agenda,
            bukti: masuk,
            konteks: { tglNikah, jumlahPemohon, anak, isian },
          })
        : null,
    // masuk dibuat ulang tiap render; isi daftar yang menentukan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jenis, status, verstekPakai, lawanMembantah, agenda, daftar, elektronik, tglNikah, jumlahPemohon, anak, isian]
  );
  const kunciUsulan = (p: { kode: string; bunyi: string }, i: number) => `${i}|${p.kode}|${p.bunyi.slice(0, 40)}`;
  const otomatis = hasil ? hasil.paragraf.filter((p) => p.cara === "otomatis") : [];
  const usulan = hasil ? hasil.paragraf.filter((p) => p.cara === "usulan") : [];
  const terpilih = usulan.filter((p, i) => dipilih.has(kunciUsulan(p, i)));

  // Paragraf yang akan disisipkan ke naskah cetak dilaporkan ke induk; perkiraan "masuk, sudah ada, atau belum bisa" dihitung dari teks pratinjau.
  const kunciNaskah = [...otomatis, ...terpilih].map((p) => `${p.kode}|${p.bunyi}`).join("\n");
  useEffect(() => {
    let batal = false;
    if (!hasil || !masukkan || !kunciNaskah) {
      onParagraf?.([]);
      return;
    }
    void import("@/lib/sisip-pertimbangan-bukti").then((m) => {
      if (batal) return;
      const paragraf = m.paragrafUntukNaskah(hasil, terpilih);
      setRencana(m.rencanakanSisipan(alinea.map((a) => a.teks), paragraf));
      onParagraf?.(paragraf);
    });
    return () => {
      batal = true;
    };
    // terpilih diwakili kunciNaskah; hasil dan alinea menentukan isinya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasil, masukkan, kunciNaskah, alinea, onParagraf]);
  useEffect(
    () => () => {
      onParagraf?.([]);
    },
    [onParagraf]
  );

  if (!jenis || !hasil)
    return (
      <CardContent className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-lg font-bold">Pertimbangan dari alat bukti</p>
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {jenisPerkara ? `Jenis perkara "${jenisPerkara}"` : "Jenis perkara ini"} belum punya bunyi pertimbangan alat bukti di blangko. Yang tersedia: cerai gugat, cerai talak, itsbat nikah (permohonan), dispensasi kawin, harta bersama, kewarisan, dan penetapan ahli waris.
        </p>
      </CardContent>
    );

  const salinan = [...otomatis, ...terpilih].map((p) => p.bunyi).join("\n\n");
  const bacaan = bacaKeadaan(status, verstekPakai, permohonan);
  const keteranganSisip = keteranganSisipan(masukkan, kunciNaskah ? rencana : null);
  const bisaLawanBantah = adaKalimatBantahan(jenis) && !verstek && (bacaan.kunci === "kabul" || bacaan.kunci === "cabut");
  const isianLayar = ISIAN_LAYAR.filter((f) => f.untuk.includes(jenis));

  return (
    <CardContent className="flex flex-col gap-4 border-t border-border pt-4">
      <div>
        <p className="text-lg font-bold">Pertimbangan dari alat bukti</p>
        <p className="text-sm text-muted-foreground">
          Paragraf disusun dari bunyi Blangko ABT by Derry Briantono menurut keadaan putusan dan isian bukti di atas. Yang bertanda tertulis otomatis, dan usulan yang dicentang, ikut masuk ke naskah cetak bila kotak di bawahnya dicentang; menyalin tetap bisa.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Keadaan putusan
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            {PILIHAN_STATUS.map((o) => (
              <option key={o.nilai} value={o.nilai}>
                {o.teks}
              </option>
            ))}
          </NativeSelect>
          <span className="text-xs font-normal text-muted-foreground">{status ? `Terbaca: ${hasil.keadaan}` : "Pilih keadaan putusan agar paragraf tersusun."}</span>
        </label>
        {bacaan.kunci === "cabut" ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Perkara dicabut
            <NativeSelect
              value={String(agenda)}
              onChange={(e) => {
                setAgendaDiubah(true);
                setAgenda(Number(e.target.value));
              }}
            >
              {PILIHAN_AGENDA.map((o) => (
                <option key={o.nilai} value={o.nilai}>
                  {o.teks}
                </option>
              ))}
            </NativeSelect>
            {agendaSipp !== null ? (
              <span className="text-xs font-normal text-muted-foreground">
                Menurut jadwal SIPP, {agendaSipp} sidang berjalan beragenda pembuktian. Pilihan ini dapat diubah.
              </span>
            ) : null}
          </label>
        ) : null}
        {!permohonan ? (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 text-sm font-medium">
            Lawan tidak hadir (verstek)
            <Switch checked={verstek} onCheckedChange={setVerstek} aria-label="Lawan tidak hadir (verstek)" />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Jumlah Pemohon
            <NativeSelect value={String(jumlahPemohon)} onChange={(e) => setJumlahPilih(e.target.value === "1" ? "1" : "2")}>
              <option value="2">Dua atau lebih (para Pemohon)</option>
              <option value="1">Satu Pemohon</option>
            </NativeSelect>
            <span className="text-xs font-normal text-muted-foreground">
              {jumlahPilih ? "Dipilih sendiri." : jumlahPemohonSipp ? `Terbaca ${jumlahPemohonSipp} Pemohon dari SIPP.` : "Belum terbaca dari SIPP: dianggap dua."}
            </span>
          </label>
        )}
        {jenis === "DK" ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Anak Pemohon
            <NativeSelect value={anak} onChange={(e) => setAnak(e.target.value === "L" ? "L" : "P")}>
              <option value="P">Perempuan</option>
              <option value="L">Laki-laki</option>
            </NativeSelect>
          </label>
        ) : null}
        {bisaLawanBantah ? (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 text-sm font-medium">
            Lawan membantah
            <Switch checked={lawanMembantah} onCheckedChange={setLawanMembantah} aria-label="Lawan membantah" />
          </label>
        ) : null}
      </div>
      {isianLayar.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {isianLayar.map((f) => (
            <label key={f.kunci} className="flex flex-col gap-1 text-sm font-medium">
              {f.label} <span className="text-xs font-normal text-muted-foreground">boleh kosong, {f.contoh}</span>
              <Input value={isian[f.kunci] ?? ""} onChange={(e) => setIsian((s) => ({ ...s, [f.kunci]: e.target.value }))} />
            </label>
          ))}
        </div>
      ) : null}
      {hasil.catatan.map((c) => (
        <p key={c} className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {c}
        </p>
      ))}
      {otomatis.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Tertulis otomatis</p>
          {otomatis.map((p, i) => (
            <div key={`${p.kode}-${i}`} className="rounded-lg bg-muted/50 px-4 py-3 font-serif text-base leading-relaxed">
              {p.bunyi}
              <span className="mt-1 block font-sans text-xs text-muted-foreground">Bukti {p.kode}. Dari {p.asal}</span>
            </div>
          ))}
        </div>
      ) : null}
      {usulan.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Usulan, centang yang dipakai</p>
          {usulan.map((p, i) => {
            const k = kunciUsulan(p, i);
            return (
              <label key={k} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-1 size-5 flex-none"
                  checked={dipilih.has(k)}
                  onChange={(e) =>
                    setDipilih((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(k);
                      else n.delete(k);
                      return n;
                    })
                  }
                />
                <span className="min-w-0 font-serif text-base leading-relaxed">
                  {p.bunyi}
                  <span className="mt-1 block font-sans text-xs text-muted-foreground">Bukti {p.kode}. Dari {p.asal}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
      {hasil.perluDisetujui.length ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Usulan bunyi, perlu disetujui</p>
          <p className="text-xs text-muted-foreground">Bunyi ini susunan AI, bukan dari blangko. Belum dipakai dan tidak ikut tersalin sebelum diperiksa pemilik blangko.</p>
          {hasil.perluDisetujui.map((p) => (
            <div key={`${p.id}-${p.kode}`} className="min-w-0 font-serif text-base leading-relaxed">
              {p.bunyi}
              <span className="mt-1 block font-sans text-xs text-muted-foreground">
                Bukti {p.kode} {p.nama}. {p.dasar.length ? `Rujukan: ${p.dasar.join("; ")}.` : "Tanpa rujukan pasal."}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {hasil.belumAdaBunyi.length ? (
        <div className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">Belum ada bunyinya di blangko</p>
          <ul className="list-disc pl-5">
            {hasil.belumAdaBunyi.map((b) => (
              <li key={`${b.kode}-${b.alasan}`}>
                {b.kode} {b.nama}: {b.alasan}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {otomatis.length || terpilih.length ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
          <input type="checkbox" className="mt-1 size-5 flex-none" checked={masukkan} onChange={(e) => setMasukkan(e.target.checked)} />
          <span className="min-w-0 text-sm">
            <span className="block font-medium">Masukkan paragraf otomatis ke naskah cetak</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{keteranganSisip}</span>
          </span>
        </label>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!salinan}
          onClick={() => {
            void navigator.clipboard
              .writeText(salinan)
              .then(() => setTersalin(true))
              .catch(() => setTersalin(false));
          }}
        >
          {tersalin ? "Tersalin" : "Salin pertimbangan"}
        </Button>
      </div>
    </CardContent>
  );
}
