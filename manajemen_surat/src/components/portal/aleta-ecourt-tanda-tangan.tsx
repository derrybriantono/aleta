"use client";

/**
 * ============================================================================
 * TANDA TANGAN PEJABAT - MENAMAI DAN MENGESAHKAN
 * ============================================================================
 *
 * Gambar tanda tangan diimpor dari berkas .doc satuan kerja, dan pengukirannya
 * kasar: ia menyapu bita mencari tanda berkas PNG dan JPEG, tanpa tahu gambar
 * mana milik siapa. Nama pejabat memang ada di berkas yang sama, tetapi urutan
 * gambar di dalam wadah .doc tidak harus sama dengan urutan namanya.
 *
 * Karena itu layar ini ada, dan karena itu pula ia menampilkan GAMBARNYA
 * sebesar mungkin: yang menamai harus melihat tanda tangannya, bukan menebak
 * dari urutan. Tanda tangan yang terpasang pada nama yang keliru adalah tanda
 * tangan palsu pada penetapan pengadilan, dan tidak ada satu galat pun yang
 * akan berbunyi.
 *
 * ============================================================================
 * DUA LANGKAH, DAN ITU DISENGAJA
 * ============================================================================
 *
 * Menamai dan mengesahkan dipisah. Yang pertama menuliskan dugaan; yang kedua
 * menyatakan dugaan itu benar, dan namanya tercatat sebagai yang menyatakan.
 * Mengubah nama yang sudah disahkan MEMBATALKAN pengesahannya - tanda tangan A
 * yang namanya diganti menjadi B adalah tanda tangan A pada penetapan B.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { CheckCircle2, Link2, RefreshCw, Trash2, Upload, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

import { AletaEcourtCap } from "./aleta-ecourt-cap";

/** Pengguna portal yang dapat ditautkan ke sebuah tanda tangan. */
type PenggunaTaut = {
  id: string;
  nama: string;
  peran: string;
  peranLabel: string;
  jabatan: string;
  subPeran: string;
};

type TandaTangan = {
  id: number;
  sidik: string;
  namaPejabat: string;
  jabatan: string;
  penggunaId: string;
  peran: string;
  subPeran: string;
  jenisBerkas: string;
  ukuran: number;
  disahkan: boolean;
  disahkanOleh: string;
  disahkanPada: string;
  asal: string;
};

/**
 * Kode penolakan bot/rute -> kalimat. Kode yang tidak dikenal ditampilkan apa
 * adanya (tanpa garis bawah) - lebih baik daripada membuangnya, dan kalimat
 * yang sudah utuh (mis. "ALETA Bot belum dapat dihubungi.") lolos tanpa diubah.
 */
const KALIMAT_TANDA_TANGAN: Record<string, string> = {
  bukan_gambar_png_atau_jpeg: "Berkas bukan gambar PNG atau JPEG.",
  gambar_kosong: "Berkas gambar kosong.",
  gambar_sudah_ada: "Gambar yang sama persis sudah ada di daftar.",
  gambar_terlalu_besar: "Gambar terlalu besar.",
  gambar_terlalu_kecil: "Gambar terlalu kecil - unggah hasil pindai tanda tangan yang jelas.",
  gambar_tidak_terbaca: "Gambar tidak dapat dibaca.",
  nama_pejabat_kosong: "Nama pejabat wajib diisi.",
  tanda_tangan_tidak_ketemu: "Tanda tangan tidak ditemukan - muat ulang daftarnya.",
  belum_dinamai: "Beri nama lebih dahulu sebelum mengesahkan.",
  pengesah_tidak_dikenali: "Akun yang mengesahkan tidak dikenali - masuk ulang ke ALETA.",
  id_tidak_sah: "Nomor tanda tangan tidak sah.",
  tindakan_tidak_dikenali: "Tindakan tidak dikenali.",
};

function kalimatTandaTangan(kode: string): string {
  const k = String(kode || "").trim();
  if (KALIMAT_TANDA_TANGAN[k]) return KALIMAT_TANDA_TANGAN[k];
  return /^[a-z0-9_]+$/.test(k) ? k.replace(/_/g, " ") : k;
}

export function AletaEcourtTandaTangan() {
  const [baris, setBaris] = useState<TandaTangan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(0);
  const [suntingan, setSuntingan] = useState<
    Record<number, { nama: string; jabatan: string; penggunaId: string }>
  >({});
  const [pengguna, setPengguna] = useState<PenggunaTaut[]>([]);
  const [penggunaAlasan, setPenggunaAlasan] = useState("");

  // Borang tambah - berdiri sendiri, dan sengaja TIDAK dibuka secara bawaan:
  // yang paling sering dikerjakan di layar ini menamai gambar yang sudah ada,
  // bukan menambah yang baru.
  const [bukaTambah, setBukaTambah] = useState(false);
  const [berkasBaru, setBerkasBaru] = useState<{ nama: string; base64: string; jenis: string; ukuran: number } | null>(null);
  const [tautBaru, setTautBaru] = useState("");
  const [namaBaru, setNamaBaru] = useState("");
  const [jabatanBaru, setJabatanBaru] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const respons = await fetch(apiPath("/api/aleta-ecourt/tanda-tangan"), {
        credentials: "include",
        cache: "no-store",
      });
      if (!respons.ok) {
        // Sebabnya dibaca dari badan jawaban lebih dulu: rute meneruskan
        // kalimat bot ("ALETA Bot belum dapat dihubungi.") di ruas error.
        // Tanpa itu yang tampil hanya nomor HTTP.
        // Hanya ruas `error` yang dibaca: kalimat bot (gatewayFetch) berupa
        // teks, galat rute portal berupa { message }.
        const badanGagal = (await respons.json().catch(() => null)) as {
          error?: string | { message?: string };
        } | null;
        const sebab =
          typeof badanGagal?.error === "string" ? badanGagal.error : badanGagal?.error?.message || "";
        throw new Error(
          respons.status === 403
            ? "Hanya admin yang dapat menamai dan mengesahkan tanda tangan."
            : sebab
              ? kalimatTandaTangan(sebab)
              : `ALETA menjawab ${respons.status}.`
        );
      }
      // Jawaban portal dibungkus { ok, data } - barisnya ada DI DALAM data.
      // Dibaca dari bungkusnya, daftarnya selalu kosong tanpa satu pun galat.
      //
      // Daftar PENGGUNA justru di LUAR data: rute menyusunnya sendiri lalu
      // menempelkannya di tingkat atas bungkus ({ ...jawabanBot, pengguna,
      // penggunaAlasan }). Dibaca dari data saja, pemilih akun selalu kosong
      // (terukur 9 Okt 2026). Keduanya dibaca - tingkat atas lebih dulu.
      const bungkus = (await respons.json()) as {
        data?: { baris?: TandaTangan[]; pengguna?: PenggunaTaut[]; penggunaAlasan?: string };
        baris?: TandaTangan[];
        pengguna?: PenggunaTaut[];
        penggunaAlasan?: string;
      };
      const isi = (bungkus.data ?? bungkus) as {
        baris?: TandaTangan[];
        pengguna?: PenggunaTaut[];
        penggunaAlasan?: string;
      };
      setBaris(Array.isArray(isi.baris) ? isi.baris : []);
      setPengguna(
        Array.isArray(bungkus.pengguna)
          ? bungkus.pengguna
          : Array.isArray(isi.pengguna)
            ? isi.pengguna
            : []
      );
      setPenggunaAlasan(String(bungkus.penggunaAlasan ?? isi.penggunaAlasan ?? ""));
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Daftar tidak dapat dibaca.");
      setBaris([]);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  /**
   * Mengirim satu tindakan. Mengembalikan true bila berhasil - pemanggil yang
   * mengosongkan isian (tambah) HANYA mengosongkannya bila berhasil; yang
   * ditolak harus tetap dapat diperbaiki tanpa memilih berkas dari awal.
   */
  const kirim = useCallback(
    async (muatan: Record<string, unknown>): Promise<boolean> => {
      setSibuk((n) => n + 1);
      setGalat("");
      try {
        const respons = await fetch(apiPath("/api/aleta-ecourt/tanda-tangan"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(muatan),
        });
        // Penolakan datang dalam dua bentuk:
        //   - dari rute sendiri: { ok:false, alasan }
        //   - dari bot lewat gatewayFetch: { ok:false, error, status } - alasan
        //     bot sudah dipindah ke ruas `error`.
        // Yang kedua dulu tidak dibaca, sehingga "gambar_sudah_ada" maupun bot
        // yang mati sama-sama terbaca "ALETA menjawab 400.".
        const bungkus = (await respons.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: { ok?: boolean; alasan?: string; error?: string };
          alasan?: string;
          error?: string | { message?: string };
        };
        const isi = (bungkus.data ?? bungkus) as { ok?: boolean; alasan?: string; error?: unknown };
        if (!respons.ok || bungkus.ok === false || isi.ok === false) {
          const sebab =
            isi.alasan ||
            (typeof isi.error === "string" ? isi.error : "") ||
            bungkus.alasan ||
            (typeof bungkus.error === "string" ? bungkus.error : bungkus.error?.message) ||
            "";
          throw new Error(sebab ? kalimatTandaTangan(sebab) : `ALETA menjawab ${respons.status}.`);
        }
        await muat();
        return true;
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Tidak dapat disimpan.");
        return false;
      } finally {
        setSibuk((n) => n - 1);
      }
    },
    [muat]
  );

  const belumSah = useMemo(() => baris.filter((x) => !x.disahkan).length, [baris]);
  const petaPengguna = useMemo(() => new Map(pengguna.map((u) => [u.id, u])), [pengguna]);

  /**
   * Membaca berkas gambar menjadi base64.
   *
   * Dibaca di peramban, bukan dikirim sebagai multipart: rute bot menerima
   * JSON, dan satu bentuk untuk semua alamat lebih sedikit tempat untuk keliru
   * daripada dua.
   */
  const bacaBerkas = useCallback((berkas: File) => {
    return new Promise<{ nama: string; base64: string; jenis: string; ukuran: number }>((selesai, gagal) => {
      const pembaca = new FileReader();
      pembaca.onerror = () => gagal(new Error("Berkas tidak dapat dibaca."));
      pembaca.onload = () => {
        const hasil = String(pembaca.result ?? "");
        selesai({
          nama: berkas.name,
          base64: hasil.replace(/^data:[^;]+;base64,/, ""),
          jenis: berkas.type || "",
          ukuran: berkas.size,
        });
      };
      pembaca.readAsDataURL(berkas);
    });
  }, []);

  /** Memilih pengguna mengisi nama dan jabatannya - tetapi tetap dapat disunting. */
  const pilihPengguna = useCallback(
    (id: string, setNama: (v: string) => void, setJabatan: (v: string) => void) => {
      const u = petaPengguna.get(id);
      if (!u) return;
      setNama(u.nama);
      // Jabatan diisi bila ada; yang kosong tidak menimpa apa yang sudah
      // diketik orang.
      if (u.jabatan) setJabatan(u.jabatan);
    },
    [petaPengguna]
  );

  const kirimTambah = useCallback(async () => {
    if (!berkasBaru || !namaBaru.trim()) return;
    const u = tautBaru ? petaPengguna.get(tautBaru) : null;
    const berhasil = await kirim({
      tindakan: "tambah",
      isiBase64: berkasBaru.base64,
      jenisBerkas: berkasBaru.jenis,
      namaPejabat: namaBaru.trim(),
      jabatan: jabatanBaru.trim(),
      penggunaId: u?.id ?? "",
      peran: u?.peran ?? "",
      subPeran: u?.subPeran ?? "",
    });
    // Yang ditolak TIDAK dikosongkan: berkas, nama, dan jabatannya tetap ada
    // untuk diperbaiki, dan sebab penolakannya tampil di atas daftar.
    if (!berhasil) return;
    setBerkasBaru(null);
    setTautBaru("");
    setNamaBaru("");
    setJabatanBaru("");
    setBukaTambah(false);
  }, [berkasBaru, namaBaru, jabatanBaru, tautBaru, petaPengguna, kirim]);

  // Cap pengadilan (butir 17, 2 Okt 2026) tampil di bawah daftar tanda tangan -
  // satu menu "Berkas tanda tangan" untuk keduanya.
  return (
    <div className="space-y-4">
      <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Tanda tangan pejabat
          <Badge variant="muted">{baris.length} gambar</Badge>
          {belumSah > 0 ? <Badge variant="warning">{belumSah} belum disahkan</Badge> : null}
        </CardTitle>
        <CardDescription>
          Dipakai membubuhkan tanda tangan pada penetapan yang diterbitkan ALETA. Gambarnya diukir
          dari berkas .doc satuan kerja, dan pengukirannya tidak tahu gambar mana milik siapa —
          karena itu tiap gambar harus dinamai dan disahkan lebih dahulu. Yang belum disahkan tidak
          pernah dipakai membubuhkan apa pun.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void muat()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
          <Button type="button" size="sm" onClick={() => setBukaTambah((b) => !b)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {bukaTambah ? "Tutup blangko" : "Tambah tanda tangan"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Impor gambar baru dijalankan dari server:{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              node scripts/impor-tanda-tangan.js &quot;TTD ALL.doc&quot;
            </code>
          </p>
        </div>

        {/* ==================================================================
            BORANG UNGGAH

            Sampai 2.21.0 gambar hanya dapat masuk lewat skrip pengimpor yang
            membaca berkas .doc di peladen - pejabat yang tanda tangannya tidak
            ada di dokumen itu tidak punya jalan sama sekali.
            ================================================================== */}
        {bukaTambah ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Gambar PNG atau JPEG. Yang diunggah <strong>belum sah</strong> — ia tetap menunggu
              pengesahan, persis seperti yang diimpor dari berkas .doc.
            </p>

            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Berkas gambar
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const berkas = e.target.files?.[0];
                  if (!berkas) return;
                  void bacaBerkas(berkas)
                    .then(setBerkasBaru)
                    .catch((k) => setGalat(k instanceof Error ? k.message : "Berkas tidak terbaca."));
                }}
                className="text-sm text-foreground"
              />
              {berkasBaru ? (
                <span className="text-[0.7rem]">
                  {berkasBaru.nama} · {Math.round(berkasBaru.ukuran / 1024)} KB
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" aria-hidden />
                Tautkan ke akun portal
              </span>
              <select
                value={tautBaru}
                onChange={(e) => {
                  setTautBaru(e.target.value);
                  pilihPengguna(e.target.value, setNamaBaru, setJabatanBaru);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">— tanpa akun (ketik namanya sendiri) —</option>
                {pengguna.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama} — {u.peranLabel}
                    {u.jabatan ? ` · ${u.jabatan}` : ""}
                  </option>
                ))}
              </select>
              {penggunaAlasan ? (
                <span className="text-[0.7rem] text-amber-600 dark:text-amber-400">
                  Daftar pengguna tidak terbaca: {penggunaAlasan}. Namanya tetap dapat diketik sendiri.
                </span>
              ) : (
                <span className="text-[0.7rem]">
                  Boleh dikosongkan — pejabat dari luar satuan kerja memang tidak punya akun di sini.
                </span>
              )}
            </label>

            {tautBaru && petaPengguna.get(tautBaru) ? (
              <p className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Peran <strong>{petaPengguna.get(tautBaru)?.peranLabel}</strong>
                  {petaPengguna.get(tautBaru)?.jabatan ? ` · jabatan ${petaPengguna.get(tautBaru)?.jabatan}` : ""}
                  {petaPengguna.get(tautBaru)?.subPeran
                    ? ` · peran tambahan ${petaPengguna.get(tautBaru)?.subPeran}`
                    : ""}
                  . Ketiganya DISALIN saat menyimpan, bukan dibaca ulang kelak — yang harus terbaca
                  pada penetapan lama adalah jabatan orang itu ketika ia menandatangani.
                </span>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                Nama pejabat
                <Input value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} placeholder="NAMA LENGKAP, GELAR" />
              </label>
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                Jabatan
                <Input value={jabatanBaru} onChange={(e) => setJabatanBaru(e.target.value)} placeholder="Hakim / Panitera / ..." />
              </label>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={!berkasBaru || !namaBaru.trim() || sibuk > 0}
              onClick={() => void kirimTambah()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Simpan tanda tangan
            </Button>
          </div>
        ) : null}

        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}

        {memuat ? (
          <div className="min-h-[14rem] animate-pulse rounded-lg border border-border bg-muted/30" />
        ) : baris.length === 0 ? (
          // Daftar yang GAGAL dibaca bukan daftar yang kosong: menyuruh
          // "jalankan impor" saat server tidak menjawab menyesatkan - sebabnya
          // sudah tertulis di atas.
          galat ? null : (
            <p className="text-sm text-muted-foreground">
              Belum ada tanda tangan. Jalankan impor dari berkas .doc satuan kerja lebih dahulu.
            </p>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {baris.map((x) => {
              const sunting = suntingan[x.id] ?? {
                nama: x.namaPejabat,
                jabatan: x.jabatan,
                penggunaId: x.penggunaId ?? "",
              };
              // Dibandingkan sesudah dipangkas: bot menyimpan nama dan jabatan
              // terpangkas (tandaTanganService.namai). Dibandingkan mentah,
              // satu spasi di ujung nama membuat isian "berubah" selamanya dan
              // tombol Sahkan mati sampai halaman dimuat ulang.
              const berubah =
                sunting.nama.trim() !== String(x.namaPejabat ?? "").trim() ||
                String(sunting.jabatan ?? "").trim() !== String(x.jabatan ?? "").trim() ||
                sunting.penggunaId !== (x.penggunaId ?? "");
              const akun = sunting.penggunaId ? petaPengguna.get(sunting.penggunaId) : null;

              return (
                <div
                  key={x.id}
                  className={
                    "flex flex-col gap-2 rounded-lg border p-3 " +
                    (x.disahkan ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-border")
                  }
                >
                  {/* Gambarnya di atas segalanya, dan di atas latar putih:
                      tanda tangan bertinta hitam di atas latar gelap praktis
                      tidak terlihat, dan yang tidak terlihat tidak dapat
                      diperiksa. */}
                  <div className="flex h-28 items-center justify-center rounded border border-border bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={apiPath(`/api/aleta-ecourt/tanda-tangan/${x.id}/gambar`)}
                      alt={x.namaPejabat || `Tanda tangan ${x.id}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <Input
                    value={sunting.nama}
                    placeholder="Nama pejabat beserta gelarnya"
                    onChange={(peristiwa) =>
                      setSuntingan((s) => ({
                        ...s,
                        [x.id]: { ...sunting, nama: peristiwa.target.value },
                      }))
                    }
                    className="h-8 text-sm"
                  />
                  <Input
                    value={sunting.jabatan}
                    placeholder="Jabatan (Ketua, Panitera, Hakim…)"
                    onChange={(peristiwa) =>
                      setSuntingan((s) => ({
                        ...s,
                        [x.id]: { ...sunting, jabatan: peristiwa.target.value },
                      }))
                    }
                    className="h-8 text-sm"
                  />

                  {/* Tautan ke akun portal.

                      Nama sebagai teks bebas sudah membuktikan rapuhnya di
                      tempat lain: SK menulis "Munifah, S.H." sedangkan SIPP
                      menulis "Munifa" - beda satu huruf, dan pencocokan nama
                      yang meleset memasang tanda tangan orang lain pada
                      penetapan pengadilan. */}
                  <select
                    value={sunting.penggunaId}
                    onChange={(peristiwa) => {
                      const id = peristiwa.target.value;
                      const u = id ? petaPengguna.get(id) : null;
                      setSuntingan((s) => ({
                        ...s,
                        [x.id]: {
                          ...sunting,
                          penggunaId: id,
                          // Nama dan jabatan ikut terisi, tetapi TIDAK menimpa
                          // yang sudah diketik bila akunnya dilepas kembali.
                          nama: u ? u.nama : sunting.nama,
                          jabatan: u && u.jabatan ? u.jabatan : sunting.jabatan,
                        },
                      }));
                    }}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="">— belum ditautkan ke akun —</option>
                    {pengguna.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nama} — {u.peranLabel}
                      </option>
                    ))}
                  </select>

                  {akun ? (
                    <p className="flex items-start gap-1.5 text-[0.7rem] text-muted-foreground">
                      <UserRound className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      <span>
                        {akun.peranLabel}
                        {akun.jabatan ? ` · ${akun.jabatan}` : ""}
                        {akun.subPeran ? ` · +${akun.subPeran}` : ""}
                      </span>
                    </p>
                  ) : x.penggunaId ? (
                    <p className="text-[0.7rem] text-muted-foreground">
                      Tertaut ke akun yang tidak ada di daftar — {x.peran || "peran tidak tercatat"}
                      {x.subPeran ? ` · +${x.subPeran}` : ""}.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={sibuk > 0 || !berubah || !sunting.nama.trim()}
                      onClick={() => {
                        const u = sunting.penggunaId ? petaPengguna.get(sunting.penggunaId) : null;
                        void kirim({
                          id: x.id,
                          tindakan: "nama",
                          namaPejabat: sunting.nama.trim(),
                          jabatan: String(sunting.jabatan ?? "").trim(),
                          penggunaId: u?.id ?? "",
                          peran: u?.peran ?? "",
                          subPeran: u?.subPeran ?? "",
                        }).then((berhasil) => {
                          // Sesudah tersimpan, isiannya kembali dibaca dari
                          // daftar yang baru dimuat - bukan dari ketikan lama.
                          if (!berhasil) return;
                          setSuntingan((s) => {
                            const sisa = { ...s };
                            delete sisa[x.id];
                            return sisa;
                          });
                        });
                      }}
                    >
                      Simpan nama
                    </Button>

                    {x.disahkan ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        disahkan
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={sibuk > 0 || berubah || !x.namaPejabat}
                        onClick={() => void kirim({ id: x.id, tindakan: "sahkan" })}
                        title={
                          berubah
                            ? "Simpan namanya lebih dahulu."
                            : !x.namaPejabat
                              ? "Beri nama lebih dahulu."
                              : "Menyatakan gambar ini benar tanda tangan orang tersebut."
                        }
                      >
                        Sahkan
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={sibuk > 0}
                      onClick={() => {
                        // Menghapus PERMANEN di server (DELETE, bukan dimatikan) -
                        // termasuk tanda tangan yang sudah disahkan. Satu klik
                        // yang meleset tidak boleh cukup.
                        const nama = x.namaPejabat || `nomor ${x.id}`;
                        const pesanYakin = x.disahkan
                          ? `Hapus PERMANEN tanda tangan ${nama} yang SUDAH disahkan? Penetapan berikutnya tidak lagi dapat dibubuhi tanda tangan ini.`
                          : `Hapus permanen gambar tanda tangan ${nama}?`;
                        let yakin = false;
                        try {
                          yakin = window.confirm(pesanYakin);
                        } catch {
                          yakin = false;
                        }
                        if (!yakin) return;
                        void kirim({ id: x.id, tindakan: "hapus" });
                      }}
                      title="Buang gambar ini"
                      aria-label={`Buang gambar tanda tangan ${x.namaPejabat || x.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    {x.jenisBerkas.toUpperCase()} · {Math.round(x.ukuran / 1024)} KB
                    {x.disahkan && x.disahkanOleh ? ` · disahkan ${x.disahkanOleh}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      </Card>
      <AletaEcourtCap />
    </div>
  );
}
