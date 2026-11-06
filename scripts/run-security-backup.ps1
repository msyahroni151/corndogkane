param(
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$ConfigPath
)
$ErrorActionPreference='Stop'
try {
  # Start the existing local cluster before backing up or verifying cloud restores.
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'database.ps1') start
  if ($LASTEXITCODE -ne 0) { throw 'Database lokal belum siap untuk backup.' }
  & $NodePath (Join-Path $PSScriptRoot 'security-backup.cjs') $ConfigPath
  exit $LASTEXITCODE
} catch {
  Write-Error 'Backup gagal dimulai. Periksa kesiapan database lokal; kredensial tidak ditampilkan.'
  exit 1
}
