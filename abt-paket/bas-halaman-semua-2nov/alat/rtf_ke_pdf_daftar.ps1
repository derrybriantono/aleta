# rtf_ke_pdf_daftar.ps1 -Daftar <berkas: kode<TAB>path rtf> -Out <folder pdf> -Log <berkas log>
# Ekspor SELURUH halaman tiap RTF ke PDF lewat Word (satu proses Word, ditutup di akhir). Dijalankan langsung (tanpa powershell bersarang) dari alat PowerShell
# dengan TEMP/TMP = D:\Aplikasi\aleta\tmp. Word perlu beberapa menit untuk dokumen pertama bila laptop sibuk. Lanjutannya: periksa_pdf.py.
param([string]$Daftar, [string]$Out, [string]$Log)
New-Item -ItemType Directory -Force $Out | Out-Null
Set-Content $Log 'mulai'
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($baris in (Get-Content -Encoding UTF8 $Daftar)) {
    if (-not $baris.Trim()) { continue }
    $k = $baris.Split("`t")
    $kode = $k[0]; $p = $k[1]
    try {
      $d = $w.Documents.Open($p, $false, $true)
      $pdf = Join-Path (Resolve-Path $Out).Path ($kode + '.pdf')
      $d.ExportAsFixedFormat($pdf, 17, $false, 0, 0)
      Add-Content $Log ("{0}`t{1}" -f $kode, $d.ComputeStatistics(2))
      $d.Close([ref]0)
    } catch {
      Add-Content $Log ("{0}`tGALAT {1}" -f $kode, $_.Exception.Message)
    }
  }
} finally {
  $w.Quit()
  Add-Content $Log 'selesai'
}
