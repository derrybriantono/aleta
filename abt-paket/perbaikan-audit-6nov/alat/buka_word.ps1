# Membuka berkas RTF di Word (baca saja, tanpa menyimpan) dan menghitung halaman; daftar dari berkas teks (satu jalur per baris).
param([string]$Daftar)
$berkas = Get-Content -LiteralPath $Daftar -Encoding UTF8
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($b in $berkas) {
    if (-not $b) { continue }
    try {
      $d = $w.Documents.Open([string]$b, $false, $true)
      $hal = $d.ComputeStatistics(2)
      $d.Close([ref]0)
      Write-Output "BUKA`t$hal`t$b"
    } catch {
      Write-Output "GALAT`t$($_.Exception.Message)`t$b"
    }
  }
} finally {
  $w.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
