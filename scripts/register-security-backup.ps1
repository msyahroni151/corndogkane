param([Parameter(Mandatory=$true)][string]$NodePath,[Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference='Stop'
$appDirectory=Split-Path -Parent $PSScriptRoot
$backupScript=Join-Path $PSScriptRoot 'security-backup.cjs'
$nodeResolved=(Resolve-Path -LiteralPath $NodePath).Path
$configResolved=(Resolve-Path -LiteralPath $ConfigPath).Path
$identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$argument='"'+$backupScript+'" "'+$configResolved+'"'
$taskAction=New-ScheduledTaskAction -Execute $nodeResolved -Argument $argument -WorkingDirectory $appDirectory
$dailyTrigger=New-ScheduledTaskTrigger -Daily -At '02:15'
$logonTrigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$taskPrincipal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$taskSettings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'CorndogKane-SecurityBackup' -Action $taskAction -Trigger @($dailyTrigger,$logonTrigger) -Principal $taskPrincipal -Settings $taskSettings -Description 'Backup terenkripsi lokal dan online dengan uji pemulihan. Tidak menghapus data bisnis.' -Force | Out-Null
Get-ScheduledTask -TaskName 'CorndogKane-SecurityBackup' | Select-Object TaskName,State
