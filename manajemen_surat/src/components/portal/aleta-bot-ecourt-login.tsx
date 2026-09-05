"use client";

/**
 * Login e-Court dari portal.
 *
 * ============================================================================
 * SANDI DIKETIK DI SINI, TAPI TIDAK DISIMPAN DI SINI
 * ============================================================================
 *
 * Sandi hanya berada di keadaan komponen selama satu percobaan login, lalu
 * dikosongkan - baik saat berhasil maupun gagal. Tidak disimpan ke penyimpanan
 * peramban, tidak dikirim ke mana pun selain bot, dan kolomnya memakai
 * autoComplete="off" supaya tidak tersimpan pengelola sandi peramban tanpa
 * disadari petugas.
 *
 * Captcha tetap dijawab manusia. Gambarnya diambil dari halaman e-Court yang
 * sedang dibuka bot, lalu ditampilkan di sini apa adanya.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

type Sesi = {
  tersimpan: boolean;
  berlaku: boolean | null;
  alasan: string;
  namaPengguna?: string;
};

/**
 * Keadaan sesi bernilai TIGA, bukan dua.
 *
 * "Foldernya ada" bukan "sesinya hidup". Sebelum ini keduanya sama-sama
 * ditulis "Sesi tersimpan", sehingga layar menyatakan aman padahal penarikan
 * sudah berhenti sejak semalam.
 */
type Keadaan = {
  slot: string;
  keadaan: "berlaku" | "kedaluwarsa" | "gerbang" | "belum_pasti" | "belum_pernah";
  label: string;
  berlaku: boolean;
  tersimpan: boolean;
  namaPengguna: string;
  alasan: string;
  diperiksaPada: string;
  dariSimpanan: boolean;
  umurDetik: number | null;
};

type Formulir = {
  adaEmail: boolean;
  adaSandi: boolean;
  adaCaptcha: boolean;
  adaTombol: boolean;
  jumlahIsian: number;
};

const ALASAN_TERBACA: Record<string, string> = {
  sesi_login_kedaluwarsa: "Formulir login sudah kedaluwarsa. Mulai lagi untuk mendapat captcha baru.",
  email_atau_sandi_kosong: "Email dan sandi harus diisi.",
  login_ditolak_ecourt: "e-Court menolak login. Periksa email, sandi, dan jawaban captcha, lalu coba lagi.",
  gagal_mengirim_formulir: "Formulir gagal dikirim ke e-Court. Coba lagi.",
  formulir_login_tidak_dikenali: "Halaman login e-Court tidak dikenali. Kemungkinan tampilannya berubah.",
  belum_pernah_login: "Belum pernah login dari server ini.",
  sesi_kedaluwarsa: "Sesi tersimpan sudah kedaluwarsa.",
  bot_tidak_terjangkau: "ALETA Bot belum dapat dihubungi.",
  gagal_membuka:
    "Bot gagal membuka halaman login e-Court. Biasanya karena server tidak dapat menjangkau ecourt.mahkamahagung.go.id, atau peramban di dalam container gagal dijalankan.",
  folder_sesi_gagal:
    "Folder sesi e-Court tidak dapat dibuat atau ditulisi di server. Periksa ruang disk dan hak akses folder.",
  gagal_memeriksa: "Sesi tersimpan gagal diperiksa.",
  belum_diperiksa: "Sesi tersimpan belum diperiksa. Tekan Periksa Sesi.",
  gerbang_menunggu_penegasan:
    "Sesi masih ada, tetapi e-Court menuntut penegasan karena akun dipakai di perangkat lain. Tekan Mulai Login sekali untuk menegaskannya - sesi di perangkat lain akan berhenti.",
  gerbang_ecourt_tidak_terlewati:
    "e-Court menampilkan halaman penegasan (akun sedang dipakai di perangkat lain), tetapi tombol Lanjut tidak ditemukan. Kemungkinan tampilan halaman itu berubah.",
};

/**
 * Mengubah kode alasan menjadi kalimat yang dapat ditindaklanjuti.
 *
 * Sebagian alasan datang berawalan beserta rinciannya, misalnya
 * "gagal_membuka: net::ERR_NAME_NOT_RESOLVED". Rinciannya justru bagian yang
 * paling berguna untuk menelusuri, jadi ia dipertahankan - bukan dibuang demi
 * kalimat yang rapi.
 */
function baca(alasan?: string): string {
  if (!alasan) return "Gagal.";

  const terbaca = ALASAN_TERBACA[alasan];
  if (terbaca) return terbaca;

  const pisah = alasan.indexOf(":");
  if (pisah > 0) {
    const kode = alasan.slice(0, pisah).trim();
    const rincian = alasan.slice(pisah + 1).trim();
    const pangkal = ALASAN_TERBACA[kode];
    if (pangkal) return rincian ? `${pangkal} (${rincian})` : pangkal;
  }

  return alasan.replace(/_/g, " ");
}

export function AletaBotEcourtLogin() {
  const [sesi, setSesi] = useState<Sesi | null>(null);
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");

  // Formulir hanya muncul setelah bot membuka halaman login dan mengambil
  // captchanya. Sebelum itu tidak ada yang bisa diisi.
  const [captcha, setCaptcha] = useState("");
  const [formulir, setFormulir] = useState<Formulir | null>(null);
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [jawabanCaptcha, setJawabanCaptcha] = useState("");

  const lupakanIsian = useCallback(() => {
    setSandi("");
    setJawabanCaptcha("");
    setCaptcha("");
    setFormulir(null);
  }, []);

  const muat = useCallback(async (penuh = false) => {
    setMemuat(true);
    try {
      const respons = await fetch(
        apiPath(`/api/aleta-bot/ecourt/login${penuh ? "?periksa=penuh" : ""}`),
        { cache: "no-store" }
      );
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      if (!isi?.available) {
        // Pesan dari bot dibaca lewat peta alasan juga. Tanpa ini, kode
        // mentah seperti "gagal_membuka: ..." tampil apa adanya di layar
        // petugas - atau lebih buruk, hanya "HTTP 400".
        setPesan(isi?.message ? baca(String(isi.message)) : "ALETA Bot belum dapat dihubungi.");
        setSesi(null);
        setKeadaan(((isi?.data ?? isi)?.keadaan as Keadaan) ?? null);
      } else {
        setPesan("");
        setSesi(isi.sesi);
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal membaca keadaan sesi.");
      setSesi(null);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const kirimAksi = useCallback(
    async (payload: Record<string, unknown>) => {
      const respons = await fetch(apiPath("/api/aleta-bot/ecourt/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const hasil = await respons.json();
      return hasil?.data ?? hasil;
    },
    []
  );

  const mulai = useCallback(async () => {
    setSibuk(true);
    setCatatan("");
    try {
      const isi = await kirimAksi({ aksi: "mulai" });
      if (isi?.ok && isi?.alasan === "sudah_masuk") {
        setCatatan("Sesi tersimpan masih berlaku. Tidak perlu login lagi.");
        await muat(false);
      } else if (isi?.ok) {
        setCaptcha(isi.captcha || "");
        setFormulir(isi.formulir ?? null);
        if (!isi.captcha) {
          setCatatan("Halaman login terbuka, tetapi gambar captcha tidak ditemukan. Coba kirim tanpa captcha.");
        }
      } else {
        setCatatan(baca(isi?.alasan));
      }
    } catch (error) {
      setCatatan(error instanceof Error ? error.message : "Gagal membuka halaman login.");
    } finally {
      setSibuk(false);
    }
  }, [kirimAksi, muat]);

  const kirim = useCallback(async () => {
    setSibuk(true);
    setCatatan("");
    try {
      const isi = await kirimAksi({ aksi: "kirim", email, sandi, captcha: jawabanCaptcha });
      // Sandi dan captcha dikosongkan APA PUN hasilnya. Membiarkannya di layar
      // setelah login berarti sandi tertinggal di komputer yang mungkin
      // ditinggalkan petugas dalam keadaan terbuka.
      lupakanIsian();
      if (isi?.ok) {
        setCatatan("Login berhasil. Sesi tersimpan dan jembatan tidak perlu login lagi.");
        await muat(false);
      } else {
        setCatatan(baca(isi?.alasan));
      }
    } catch (error) {
      lupakanIsian();
      setCatatan(error instanceof Error ? error.message : "Gagal mengirim login.");
    } finally {
      setSibuk(false);
    }
  }, [email, sandi, jawabanCaptcha, kirimAksi, lupakanIsian, muat]);

  const keluar = useCallback(async () => {
    setSibuk(true);
    setCatatan("");
    try {
      const isi = await kirimAksi({ aksi: "keluar" });
      lupakanIsian();
      setCatatan(isi?.ok ? "Sesi dihapus. Login berikutnya dari awal." : baca(isi?.alasan));
      await muat(false);
    } catch (error) {
      setCatatan(error instanceof Error ? error.message : "Gagal menghapus sesi.");
    } finally {
      setSibuk(false);
    }
  }, [kirimAksi, lupakanIsian, muat]);

  const label = (() => {
    // Keadaan dari bot dipakai lebih dulu - dialah yang membedakan "sudah
    // diperiksa dan hidup" dari "foldernya ada, entah hidup entah tidak".
    if (keadaan) {
      if (keadaan.keadaan === "berlaku") return { teks: "Sesi berlaku", nada: "default" as const };
      if (keadaan.keadaan === "kedaluwarsa")
        return { teks: "Sesi kedaluwarsa", nada: "warning" as const };
      if (keadaan.keadaan === "gerbang")
        return { teks: "Menunggu penegasan", nada: "warning" as const };
      if (keadaan.keadaan === "belum_pernah")
        return { teks: "Belum login", nada: "muted" as const };
      // Inilah yang dulu ditulis "Sesi tersimpan" begitu saja.
      return { teks: "Belum diperiksa", nada: "warning" as const };
    }

    if (!sesi?.tersimpan) return { teks: "Belum login", nada: "muted" as const };
    if (sesi.berlaku === true) return { teks: "Sesi berlaku", nada: "default" as const };
    if (sesi.berlaku === false) return { teks: "Sesi kedaluwarsa", nada: "warning" as const };
    return { teks: "Belum diperiksa", nada: "warning" as const };
  })();

  /** Kapan terakhir diperiksa - supaya pembacanya tahu seberapa baru angkanya. */
  const umurPemeriksaan = (() => {
    if (!keadaan || !keadaan.diperiksaPada) return "";
    const detik = keadaan.umurDetik;
    if (detik === null || detik === undefined) return "baru saja diperiksa";
    if (detik < 60) return "diperiksa baru saja";
    const menit = Math.round(detik / 60);
    return `diperiksa ${menit} menit lalu`;
  })();

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Login e-Court
            {memuat ? null : <Badge variant={label.nada}>{label.teks}</Badge>}
          </CardTitle>
          <CardDescription>
            Login sekali dari sini, lalu jembatan e-Court dapat dijalankan tanpa login lagi selama sesinya masih
            berlaku.
          </CardDescription>

          {/* Nama akun yang sedang tersimpan. Tanpa ini, petugas tidak dapat
              tahu sesi siapa yang sedang dipakai - dan itu menentukan apakah
              perlu login ulang atau tidak. */}
          {keadaan?.namaPengguna ? (
            <p className="mt-1 text-sm">
              <span className="text-muted-foreground">Akun: </span>
              <span className="font-medium">{keadaan.namaPengguna}</span>
              {umurPemeriksaan ? (
                <span className="text-xs text-muted-foreground"> · {umurPemeriksaan}</span>
              ) : null}
            </p>
          ) : keadaan && keadaan.tersimpan ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Nama akun belum terbaca. Tekan Periksa Sesi untuk membacanya dari e-Court.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={sibuk} onClick={() => void muat(true)}>
            Periksa Sesi
          </Button>
          {sesi?.tersimpan ? (
            <Button variant="outline" size="sm" disabled={sibuk} onClick={() => void keluar()}>
              Hapus Sesi
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {pesan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{pesan}</p> : null}
        {catatan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{catatan}</p> : null}

        {!formulir ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {sesi?.berlaku === true
                ? "Sesi masih berlaku. Login ulang hanya perlu bila sesinya nanti kedaluwarsa."
                : "Tekan tombol di bawah. Bot akan membuka halaman login e-Court dan menampilkan captchanya di sini."}
            </p>
            <Button size="sm" disabled={sibuk} onClick={() => void mulai()}>
              {sibuk ? "Membuka…" : "Mulai Login"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ecourt-email">
                  Email e-Court
                </label>
                <Input
                  id="ecourt-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@pa-donggala.go.id"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ecourt-sandi">
                  Sandi
                </label>
                <Input
                  id="ecourt-sandi"
                  type="password"
                  autoComplete="off"
                  value={sandi}
                  onChange={(event) => setSandi(event.target.value)}
                />
              </div>
            </div>

            {captcha ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ecourt-captcha">
                  Ketik ulang kode pada gambar
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Gambar captcha dari halaman e-Court yang sedang dibuka bot. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={captcha}
                    alt="Kode captcha dari halaman login e-Court"
                    className="h-12 rounded border border-border bg-white"
                  />
                  <Input
                    id="ecourt-captcha"
                    autoComplete="off"
                    value={jawabanCaptcha}
                    onChange={(event) => setJawabanCaptcha(event.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
            ) : (
              <p className="rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
                Gambar captcha tidak ditemukan pada halaman. Coba kirim tanpa captcha — bila e-Court menolak, tekan
                Mulai Login lagi.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={sibuk || !email || !sandi} onClick={() => void kirim()}>
                {sibuk ? "Mengirim…" : "Masuk"}
              </Button>
              <Button variant="outline" size="sm" disabled={sibuk} onClick={lupakanIsian}>
                Batal
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Sandi diteruskan langsung ke e-Court dan tidak disimpan di portal maupun di ALETA Bot. Yang bertahan
              setelah login hanya cookie sesi di server, sama seperti login langsung di e-Court.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
