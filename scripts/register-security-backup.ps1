param([Parameter(Mandatory=$true)][string]$NodePath,[Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference='Stop'
$appDirectory=Split-Path -Parent $PSScriptRoot
$backupScript=Join-Path $PSScriptRoot 'run-security-backup.ps1'
$nodeResolved=(Resolve-Path -LiteralPath $NodePath).Path
$configResolved=(Resolve-Path -LiteralPath $ConfigPath).Path
$identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$argument='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$backupScript+'" -NodePath "'+$nodeResolved+'" -ConfigPath "'+$configResolved+'"'
$taskAction=New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe') -Argument $argument -WorkingDirectory $appDirectory
$dailyTrigger=New-ScheduledTaskTrigger -Daily -At '02:15'
$logonTrigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$taskPrincipal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$taskSettings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'CorndogKane-SecurityBackup' -Action $taskAction -Trigger @($dailyTrigger,$logonTrigger) -Principal $taskPrincipal -Settings $taskSettings -Description 'Backup terenkripsi lokal dan online dengan uji pemulihan. Tidak menghapus data bisnis.' -Force | Out-Null
Get-ScheduledTask -TaskName 'CorndogKane-SecurityBackup' | Select-Object TaskName,State
