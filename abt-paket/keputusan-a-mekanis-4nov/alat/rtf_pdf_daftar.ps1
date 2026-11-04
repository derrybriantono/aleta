# RTF -> PDF lewat Word (laptop), daftar berkas dari berkas teks (satu jalur per baris). Dibuka baca-saja; PDF di samping RTF.
param([string]$Daftar)
$berkas = Get-Content -LiteralPath $Daftar -Encoding UTF8
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($b in $berkas) {
    if (-not $b) { continue }
    $p = [System.IO.Path]::GetFullPath($b)
    try {
      $d = $w.Documents.Open($p, $false, $true)
      $hal = $d.ComputeStatistics(2)
      $pdf = [System.IO.Path]::ChangeExtension($p, '.pdf')
      $d.SaveAs2($pdf, 17)
      $d.Close([ref]0)
      Write-Output "PDF`t$hal`t$pdf"
    } catch {
      Write-Output "GALAT`t$($_.Exception.Message)`t$p"
    }
  }
} finally {
  $w.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
