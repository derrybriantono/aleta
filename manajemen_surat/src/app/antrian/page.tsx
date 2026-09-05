"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiPath } from "@/lib/base-path";

/**
 * ============================================================================
 * AMBIL ANTRIAN SIDANG - LAYAR SENTUH RUANG TUNGGU, TANPA LOGIN
 * ============================================================================
 *
 * Yang berdiri di depan layar ini orang yang baru datang ke pengadilan, kerap
 * membawa map, kerap cemas, dan hampir selalu tidak pernah memakai aplikasi
 * ini sebelumnya. Karena itu satu pertanyaan pada satu waktu, huruf besar,
 * dan tidak ada istilah dalam.
 *
 *     1. "Siapa nama Anda?"      -> ketik nama atau nomor perkara
 *     2. "Ini perkara Anda?"     -> tekan kartunya
 *     3. "Anda datang sebagai?"  -> tekan perannya
 *     4. NOMOR ANTRIAN           -> sebesar mungkin, lalu dapat dicetak
 *
 * ============================================================================
 * MENGAPA TIDAK MEMINTA LOGIN
 * ============================================================================
 *
 * Aplikasi antrian yang sudah ada bekerja persis begini - cari, tekan hadir,
 * cetak struk - dan itu sebabnya ia dipakai. Menuntut login untuk mengambil
 * nomor berarti nomornya tidak akan pernah diambil, dan petugas kembali
 * memanggil dengan pengeras suara.
 *
 * Yang menjaga bukan login, melainkan rutenya: tidak ada daftar tanpa dicari,
 * dan kata carinya harus cukup panjang. Lihat catatan di
 * src/app/api/antrian-publik/route.ts.
 *
 * ============================================================================
 * NOMORNYA DARI BOT, TIDAK PERNAH DIHITUNG DI SINI
 * ============================================================================
 *
 * Nomor antrian lahir dari kehadiran PERTAMA pada satu perkara, dan hanya bot
 * yang menentukannya. Menghitungnya ulang di peramban akan menghasilkan angka
 * yang berbeda dari yang tercetak di struk dan yang dikirim lewat WhatsApp -
 * dan dua angka untuk satu orang lebih buruk daripada tidak ada angka.
 */

type Baris = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  jamSidang: string;
  ruangan: string;
  agenda: string;
  penggugat: string[];
  tergugat: string[];
  nomorAntrian: number | null;
  keadaan: string;
  sudahHadir: Array<{ sebutan: string; jam: string }>;
};

type Peran = { kunci: string; label: string; sisi: string };

/** Urutan pihak yang lazim. Lebih dari itu jarang, dan dapat dilewati. */
const URUTAN = ["", "I", "II", "III", "IV"];

export default function AntrianPublikPage() {
  const [cari, setCari] = useState("");
  const [baris, setBaris] = useState<Baris[]>([]);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(false);

  const [dipilih, setDipilih] = useState<Baris | null>(null);
  const [peran, setPeran] = useState<Peran[]>([]);
  const [peranDipilih, setPeranDipilih] = useState("");
  const [urutanPihak, setUrutanPihak] = useState("");
  const [sebagaiKuasa, setSebagaiKuasa] = useState(false);

  const [nomorTerbit, setNomorTerbit] = useState<number | null>(null);
  const [sebutanTerbit, setSebutanTerbit] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const kotakCari = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(apiPath("/api/antrian-publik?peran=1"), { cache: "no-store" });
        const isi = (await r.json()) as { data?: { peran?: Peran[] } };
        const hasil = isi.data ?? (isi as { peran?: Peran[] });
        setPeran(Array.isArray(hasil.peran) ? hasil.peran : []);
      } catch {
        /* daftar peran gagal dimuat - layar tetap dapat mencari */
      }
    })();
  }, []);

  const jalankanCari = useCallback(async (kata: string) => {
    setMemuat(true);
    setPesan("");
    try {
      const r = await fetch(apiPath(`/api/antrian-publik?cari=${encodeURIComponent(kata)}`), {
        cache: "no-store",
      });
      const isi = (await r.json()) as { data?: Record<string, unknown> };
      const hasil = (isi.data ?? isi) as {
        baris?: Baris[];
        pesan?: string;
        available?: boolean;
      };
      setBaris(Array.isArray(hasil.baris) ? hasil.baris : []);
      setPesan(
        hasil.pesan ||
          (hasil.available === false
            ? "Antrian belum dapat dibaca. Silakan menghubungi petugas."
            : "")
      );
    } catch {
      setPesan("Antrian belum dapat dibaca. Silakan menghubungi petugas.");
    } finally {
      setMemuat(false);
    }
  }, []);

  // Dicari setelah orang berhenti mengetik sejenak. Mencari pada tiap huruf
  // membuat layar berkedip sementara orangnya masih mengetik namanya.
  useEffect(() => {
    const kata = cari.trim();
    if (kata.length < 3) {
      setBaris([]);
      setPesan(kata.length > 0 ? "Ketik sekurang-kurangnya 3 huruf." : "");
      return;
    }
    const tunda = setTimeout(() => void jalankanCari(kata), 450);
    return () => clearTimeout(tunda);
  }, [cari, jalankanCari]);

  const ambilNomor = useCallback(async () => {
    if (!dipilih || !peranDipilih) return;
    setSibuk(true);
    try {
      const r = await fetch(apiPath("/api/antrian-publik"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perkaraId: dipilih.perkaraId,
          nomorPerkara: dipilih.nomorPerkara,
          peran: peranDipilih,
          urutanPihak,
          sebagaiKuasa,
        }),
      });
      const isi = (await r.json()) as { data?: Record<string, unknown> };
      const hasil = (isi.data ?? isi) as { ok?: boolean; alasan?: string; sebutan?: string };

      if (hasil.ok === false) {
        setPesan(hasil.alasan || "Nomor antrian belum dapat diterbitkan.");
        setSibuk(false);
        return;
      }

      setSebutanTerbit(String(hasil.sebutan || ""));

      // Nomornya dibaca ULANG dari server, bukan ditebak dari keadaan sebelum
      // pencatatan. Perkara yang pihak lain sudah mengambil nomornya lebih
      // dulu memakai nomor itu juga - satu perkara satu nomor - dan menebak
      // di sini akan menampilkan angka yang berbeda dari yang dipanggil.
      const ulang = await fetch(
        apiPath(`/api/antrian-publik?cari=${encodeURIComponent(dipilih.nomorPerkara)}`),
        { cache: "no-store" }
      );
      const isiUlang = (await ulang.json()) as { data?: { baris?: Baris[] } };
      const daftar = (isiUlang.data ?? (isiUlang as { baris?: Baris[] })).baris || [];
      const terbaru = daftar.find((x) => x.perkaraId === dipilih.perkaraId);
      setNomorTerbit(terbaru?.nomorAntrian ?? null);
    } catch {
      setPesan("Nomor antrian belum dapat diterbitkan. Silakan menghubungi petugas.");
    } finally {
      setSibuk(false);
    }
  }, [dipilih, peranDipilih, urutanPihak, sebagaiKuasa]);

  const mulaiUlang = useCallback(() => {
    setDipilih(null);
    setPeranDipilih("");
    setUrutanPihak("");
    setSebagaiKuasa(false);
    setNomorTerbit(null);
    setSebutanTerbit("");
    setCari("");
    setBaris([]);
    setPesan("");
    kotakCari.current?.focus();
  }, []);

  // ---------------------------------------------------------------- selesai
  if (nomorTerbit !== null || sebutanTerbit) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
        {/* Struk dicetak hitam di atas putih, dan HANYA kartunya.
            window.print() tanpa aturan ini mencetak seluruh layar sentuh
            beserta tombolnya - di atas kertas struk selebar 58 mm, yang
            keluar hanya potongan tombol. */}
        <style>{GAYA_STRUK}</style>

        <div
          id="aleta-struk-antrian"
          className="w-full max-w-xl rounded-3xl border border-emerald-800/50 bg-emerald-950/30 p-8 text-center"
        >
          <p className="text-lg uppercase tracking-widest text-emerald-300/80">Nomor antrian Anda</p>
          <p className="mt-2 text-[8rem] font-bold leading-none tabular-nums text-emerald-300">
            {nomorTerbit ?? "—"}
          </p>
          {sebutanTerbit ? (
            <p className="mt-3 text-2xl text-emerald-100">{sebutanTerbit} tercatat hadir</p>
          ) : null}
          {dipilih ? (
            <div className="mt-5 space-y-1 border-t border-emerald-800/40 pt-4 text-lg">
              <p className="font-semibold">{dipilih.nomorPerkara}</p>
              <p className="text-emerald-100/80">
                {dipilih.jamSidang || "—"}
                {dipilih.ruangan ? ` · ${dipilih.ruangan}` : ""}
              </p>
            </div>
          ) : null}
          <p className="mt-5 text-base text-emerald-100/70">
            Silakan menunggu di ruang tunggu. Nomor Anda akan dipanggil lewat layar dan pengeras
            suara.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-slate-700 px-6 py-4 text-lg text-slate-200 hover:bg-slate-900"
          >
            Cetak
          </button>
          <button
            type="button"
            onClick={mulaiUlang}
            className="rounded-xl bg-emerald-600 px-8 py-4 text-lg font-semibold text-white hover:bg-emerald-500"
          >
            Selesai
          </button>
        </div>
      </main>
    );
  }

  // ------------------------------------------------------ memilih peran
  if (dipilih) {
    const daftarPeran = peran.length > 0 ? peran : BAWAAN_PERAN;

    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-3xl space-y-6">
          <button
            type="button"
            onClick={() => setDipilih(null)}
            className="text-lg text-slate-400 hover:text-slate-100"
          >
            ← Kembali
          </button>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <p className="text-2xl font-semibold">{dipilih.nomorPerkara}</p>
            <p className="mt-1 text-lg text-slate-400">
              {dipilih.jamSidang || "—"}
              {dipilih.ruangan ? ` · ${dipilih.ruangan}` : ""}
            </p>
          </div>

          <div>
            <p className="mb-3 text-2xl font-semibold">Anda datang sebagai apa?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {daftarPeran.map((satu) => (
                <button
                  key={satu.kunci}
                  type="button"
                  onClick={() => setPeranDipilih(satu.kunci)}
                  className={
                    peranDipilih === satu.kunci
                      ? "rounded-2xl bg-emerald-600 px-5 py-6 text-xl font-semibold"
                      : "rounded-2xl border border-slate-700 px-5 py-6 text-xl hover:bg-slate-900"
                  }
                >
                  {satu.label}
                </button>
              ))}
            </div>
          </div>

          {peranDipilih ? (
            <>
              <div>
                <p className="mb-2 text-xl">Yang keberapa? (boleh dilewati)</p>
                <div className="flex flex-wrap gap-2">
                  {URUTAN.map((angka) => (
                    <button
                      key={angka || "tanpa"}
                      type="button"
                      onClick={() => setUrutanPihak(angka)}
                      className={
                        urutanPihak === angka
                          ? "rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold"
                          : "rounded-xl border border-slate-700 px-6 py-4 text-lg hover:bg-slate-900"
                      }
                    >
                      {angka || "Tidak disebut"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 text-lg">
                <input
                  type="checkbox"
                  className="h-6 w-6"
                  checked={sebagaiKuasa}
                  onChange={(e) => setSebagaiKuasa(e.target.checked)}
                />
                Saya kuasa hukumnya
              </label>

              <button
                type="button"
                disabled={sibuk}
                onClick={() => void ambilNomor()}
                className="w-full rounded-2xl bg-emerald-600 px-6 py-7 text-2xl font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {sibuk ? "Menerbitkan…" : "Ambil nomor antrian"}
              </button>
            </>
          ) : null}

          {pesan ? <p className="text-lg text-amber-300">{pesan}</p> : null}
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------- mencari
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Ambil Antrian Sidang</h1>
          <p className="mt-1 text-lg text-slate-400">
            Ketik nama Anda atau nomor perkara untuk menemukan sidang Anda hari ini.
          </p>
        </div>

        <input
          ref={kotakCari}
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Nama Anda atau nomor perkara…"
          autoFocus
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-5 py-6 text-2xl outline-none focus:border-emerald-500"
        />

        {memuat ? <p className="text-lg text-slate-400">Mencari…</p> : null}
        {pesan ? <p className="text-lg text-amber-300">{pesan}</p> : null}

        {!memuat && cari.trim().length >= 3 && baris.length === 0 && !pesan ? (
          <p className="text-lg text-slate-400">
            Tidak ada sidang hari ini yang cocok. Periksa ejaannya, atau tanyakan kepada petugas.
          </p>
        ) : null}

        <div className="space-y-3">
          {baris.map((satu) => (
            <button
              key={satu.perkaraId}
              type="button"
              onClick={() => setDipilih(satu)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/50 p-5 text-left transition hover:border-emerald-600 hover:bg-slate-900"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xl font-semibold">{satu.nomorPerkara}</span>
                {satu.nomorAntrian ? (
                  <span className="rounded-lg bg-emerald-900/60 px-3 py-1 text-lg text-emerald-200">
                    Nomor {satu.nomorAntrian}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-lg text-slate-300">
                {[satu.penggugat[0], satu.tergugat[0]].filter(Boolean).join(" lawan ") || "—"}
              </p>
              <p className="mt-1 text-base text-slate-400">
                {satu.jamSidang || "—"}
                {satu.ruangan ? ` · ${satu.ruangan}` : ""}
                {satu.jenisPerkara ? ` · ${satu.jenisPerkara}` : ""}
              </p>
              {satu.sudahHadir.length > 0 ? (
                <p className="mt-1 text-base text-emerald-300/80">
                  Sudah hadir: {satu.sudahHadir.map((x) => x.sebutan).join(", ")}
                </p>
              ) : null}
            </button>
          ))}
        </div>

        <p className="border-t border-slate-800 pt-4 text-base text-slate-500">
          Nomor antrian terbit dari kehadiran yang pertama pada satu perkara. Bila pihak lawan sudah
          mengambil, nomornya tetap sama - satu perkara satu nomor.
        </p>
      </div>
    </main>
  );
}

/**
 * Aturan cetak struk antrian.
 *
 * Menyembunyikan SISANYA, bukan menyebut satu per satu apa yang harus hilang -
 * yang terakhir gagal begitu ada bagian baru ditambahkan, dan yang tercetak
 * menjadi tombol.
 *
 * Warnanya dibalik menjadi hitam di atas putih: layar sentuh bertema gelap,
 * dan mencetaknya apa adanya menghabiskan tinta sekaligus menghasilkan angka
 * putih yang tidak terbaca di atas kertas.
 */
const GAYA_STRUK = `
@media print {
  body * { visibility: hidden !important; }
  #aleta-struk-antrian, #aleta-struk-antrian * { visibility: visible !important; }
  #aleta-struk-antrian {
    position: absolute !important;
    left: 0; top: 0;
    width: 100%;
    border: none !important;
    background: #fff !important;
    color: #000 !important;
  }
  #aleta-struk-antrian * { color: #000 !important; }
  @page { margin: 8mm; }
}
`;

/**
 * Dipakai hanya bila daftar peran gagal dimuat dari bot. Layar sentuh di ruang
 * tunggu tidak boleh berhenti bekerja karena satu permintaan yang gagal.
 */
const BAWAAN_PERAN: Peran[] = [
  { kunci: "penggugat", label: "Penggugat / Pemohon", sisi: "1" },
  { kunci: "tergugat", label: "Tergugat / Termohon", sisi: "2" },
  { kunci: "saksi", label: "Saksi", sisi: "saksi" },
  { kunci: "kuasa", label: "Kuasa Hukum", sisi: "1" },
];
