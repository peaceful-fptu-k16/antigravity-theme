param(
    [switch]$Startup,
    [switch]$NoStartup,
    [string]$NodePath = '',
    [string]$DataDir = ''
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginRoot = Split-Path -Parent $ScriptDir
$DaemonJs = Join-Path $PluginRoot 'scripts\theme-daemon.mjs'
$BuildJs = Join-Path $PluginRoot 'scripts\build-payload.mjs'

if (-not $DataDir) {
    if ($env:PLUGIN_DATA) {
        $DataDir = $env:PLUGIN_DATA
    } elseif ($env:AGY_THEME_DATA_DIR) {
        $DataDir = $env:AGY_THEME_DATA_DIR
    } else {
        $DataDir = Join-Path $env:USERPROFILE '.gemini\antigravity\plugin_data\theme-studio'
    }
}

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$PayloadJs = Join-Path $DataDir 'dist\theme_payload.js'
$PidFile = Join-Path $DataDir 'daemon.pid'
$VbsPath = Join-Path $DataDir 'silent-start.vbs'
$LauncherVbsPath = Join-Path $DataDir 'launch-antigravity.vbs'
$LauncherStatePath = Join-Path $DataDir 'launcher_state.json'

function Test-NodeBinary {
    param([string]$CandidatePath)
    if (-not $CandidatePath -or -not (Test-Path $CandidatePath)) { return $null }
    try {
        $majorText = (& $CandidatePath -p "process.versions.node.split('.')[0]" 2>$null)
        $major = 0
        if ([int]::TryParse(($majorText -as [string]).Trim(), [ref]$major) -and $major -ge 22) {
            return $CandidatePath
        }
    } catch {}
    return $null
}

function Find-NodeExe {
    if ($NodePath) {
        $verified = Test-NodeBinary $NodePath
        if ($verified) { return $verified }
        Write-Error "Provided -NodePath is missing or older than Node.js 22: $NodePath"
    }

    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) {
        $verified = Test-NodeBinary $cmd.Source
        if ($verified) { return $verified }
        $foundMajor = (& $cmd.Source -p "process.versions.node.split('.')[0]" 2>$null)
        Write-Warning "[install-win] Node in PATH is v$foundMajor (< 22); searching for Node.js >= 22..."
    }

    $fallbacks = @(
        'C:\Program Files\nodejs\node.exe',
        'C:\Program Files (x86)\nodejs\node.exe',
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'),
        (Join-Path $env:APPDATA 'nvm\current\node.exe'),
        (Join-Path $env:USERPROFILE '.volta\bin\node.exe'),
        (Join-Path $env:USERPROFILE 'scoop\shims\node.exe')
    )
    foreach ($cand in $fallbacks) {
        $verified = Test-NodeBinary $cand
        if ($verified) { return $verified }
    }

    $discovered = Get-ChildItem -Path $env:LOCALAPPDATA -Filter 'node.exe' -Recurse -Depth 2 -ErrorAction SilentlyContinue
    foreach ($item in $discovered) {
        $verified = Test-NodeBinary $item.FullName
        if ($verified) { return $verified }
    }

    Write-Error "Node.js >= 22 not found. Install Node.js >= 22 (or pass -NodePath C:\path\to\node.exe)."
}

$NodeExe = Find-NodeExe
Write-Host "[install-win] Using Node.js: $NodeExe"
Write-Host "[install-win] Plugin root:   $PluginRoot"
Write-Host "[install-win] Data dir:      $DataDir"

Write-Host "[install-win] Compiling runtime payload..."
& $NodeExe $BuildJs --root-dir $PluginRoot --data-dir $DataDir
if ($LASTEXITCODE -ne 0) {
    Write-Error "build-payload.mjs failed with exit code $LASTEXITCODE."
}

if (Test-Path $PidFile) {
    $OldPidText = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $OldPid = 0
    if ([int]::TryParse(($OldPidText -as [string]), [ref]$OldPid) -and $OldPid -gt 0) {
        $ExistingProc = Get-Process -Id $OldPid -ErrorAction SilentlyContinue
        if ($ExistingProc -and $ExistingProc.ProcessName -eq 'node') {
            Write-Host "[install-win] Stopping existing daemon (PID $OldPid)..."
            Stop-Process -Id $OldPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 350
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

$WshShell = New-Object -ComObject WScript.Shell

$ShortcutSearchDirs = @(
    [Environment]::GetFolderPath('DesktopDirectory'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    [Environment]::GetFolderPath('Programs'),
    [Environment]::GetFolderPath('CommonPrograms'),
    [Environment]::GetFolderPath('Startup'),
    (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

$SavedShortcuts = @{}
$SavedAgyExe = ''
if (Test-Path $LauncherStatePath) {
    try {
        $PrevState = Get-Content -Path $LauncherStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($PrevState.antigravityExe) { $SavedAgyExe = [string]$PrevState.antigravityExe }
        if ($PrevState.shortcuts) {
            foreach ($entry in $PrevState.shortcuts) {
                if ($entry.shortcutPath) {
                    $SavedShortcuts[$entry.shortcutPath] = $entry
                }
            }
        }
    } catch {}
}

function Find-AntigravityExe {
    if ($SavedAgyExe -and (Test-Path $SavedAgyExe)) { return $SavedAgyExe }

    $running = Get-Process -Name 'Antigravity' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($running -and $running.Path -and (Test-Path $running.Path)) {
        return $running.Path
    }

    $stdCandidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\antigravity\Antigravity.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Antigravity\Antigravity.exe'),
        (Join-Path $env:ProgramFiles 'Antigravity\Antigravity.exe')
    )
    foreach ($c in $stdCandidates) {
        if (Test-Path $c) { return $c }
    }

    foreach ($SearchDir in $ShortcutSearchDirs) {
        $lnks = Get-ChildItem -Path $SearchDir -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue
        foreach ($lnk in $lnks) {
            try {
                $Sc = $WshShell.CreateShortcut($lnk.FullName)
                if ($Sc.TargetPath -and ($Sc.TargetPath -imatch '\\Antigravity\.exe$') -and (Test-Path $Sc.TargetPath)) {
                    return $Sc.TargetPath
                }
            } catch {}
        }
    }
    return ''
}

function Get-ActivePortFile {
    $candidates = @(
        (Join-Path $env:APPDATA 'antigravity\DevToolsActivePort'),
        (Join-Path $env:APPDATA 'Antigravity\DevToolsActivePort')
    )
    foreach ($p in $candidates) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

$EscapedNode = $NodeExe.Replace('"', '""')
$EscapedDaemon = $DaemonJs.Replace('"', '""')
$EscapedRoot = $PluginRoot.Replace('"', '""')
$EscapedData = $DataDir.Replace('"', '""')
$StartupDir = [Environment]::GetFolderPath('Startup')
$StartupShortcutPath = Join-Path $StartupDir 'AntigravityCustomTheme.lnk'

if ($Startup) {
    $VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$EscapedRoot"
WshShell.Run """$EscapedNode"" ""$EscapedDaemon"" --root-dir ""$EscapedRoot"" --data-dir ""$EscapedData""", 0, False
"@
    Set-Content -Path $VbsPath -Value $VbsContent -Encoding Unicode

    foreach ($SearchDir in $ShortcutSearchDirs) {
        Get-ChildItem -Path $SearchDir -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $Sc = $WshShell.CreateShortcut($_.FullName)
                if ($Sc.TargetPath -and ($Sc.TargetPath -imatch '\\Antigravity\.exe$')) {
                    if ($Sc.Arguments -notmatch '--remote-debugging-port') {
                        $Sc.Arguments = ("$($Sc.Arguments) --remote-debugging-port=0").Trim()
                        $Sc.Save()
                        Write-Host "[install-win] Patched CDP flag on shortcut: $($_.FullName)"
                    }
                }
            } catch {}
        }
    }

    $Shortcut = $WshShell.CreateShortcut($StartupShortcutPath)
    $Shortcut.TargetPath = 'wscript.exe'
    $Shortcut.Arguments = """$VbsPath"""
    $Shortcut.WorkingDirectory = $DataDir
    $Shortcut.WindowStyle = 7
    $Shortcut.Description = 'Theme Studio CDP Daemon'
    $Shortcut.Save()
    Write-Host "[install-win] Startup shortcut created: $StartupShortcutPath"

    Write-Host "[install-win] Launching daemon via wscript.exe..."
    Start-Process -FilePath 'wscript.exe' -ArgumentList """$VbsPath""" -WorkingDirectory $DataDir
} elseif ($NoStartup) {
    $VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$EscapedRoot"
WshShell.Run """$EscapedNode"" ""$EscapedDaemon"" --root-dir ""$EscapedRoot"" --data-dir ""$EscapedData"" --exit-on-close", 0, False
"@
    Set-Content -Path $VbsPath -Value $VbsContent -Encoding Unicode
    Write-Host "[install-win] Launching on-demand daemon for current session..."
    Start-Process -FilePath 'wscript.exe' -ArgumentList """$VbsPath""" -WorkingDirectory $DataDir
} else {
    $AgyExe = Find-AntigravityExe
    if (-not $AgyExe) {
        Write-Error "Antigravity.exe could not be located. Start Antigravity once or pass -Startup."
    }

    if (Test-Path $StartupShortcutPath) {
        Remove-Item $StartupShortcutPath -Force -ErrorAction SilentlyContinue
        Write-Host "[install-win] Removed legacy Windows Startup shortcut: $StartupShortcutPath"
    }
    if (Test-Path $VbsPath) {
        Remove-Item $VbsPath -Force -ErrorAction SilentlyContinue
    }

    $EscapedAgy = $AgyExe.Replace('"', '""')
    $LauncherVbs = @"
Option Explicit
Dim WshShell, i, extraArgs, agyCmd, daemonCmd
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$EscapedRoot"

extraArgs = ""
For i = 0 To WScript.Arguments.Count - 1
    extraArgs = extraArgs & " """ & Replace(WScript.Arguments(i), """", """""") & """"
Next

agyCmd = """$EscapedAgy"" --remote-debugging-port=0" & extraArgs
daemonCmd = """$EscapedNode"" ""$EscapedDaemon"" --root-dir ""$EscapedRoot"" --data-dir ""$EscapedData"" --exit-on-close"

WshShell.Run agyCmd, 1, False
WshShell.Run daemonCmd, 0, False
"@
    Set-Content -Path $LauncherVbsPath -Value $LauncherVbs -Encoding Unicode
    Write-Host "[install-win] Generated on-demand launcher: $LauncherVbsPath"

    $WscriptExe = Join-Path $env:SystemRoot 'System32\wscript.exe'
    $PatchedCount = 0

    foreach ($SearchDir in $ShortcutSearchDirs) {
        Get-ChildItem -Path $SearchDir -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $ScPath = $_.FullName
                $Sc = $WshShell.CreateShortcut($ScPath)
                $IsDirectAgy = $Sc.TargetPath -and ($Sc.TargetPath -imatch '\\Antigravity\.exe$')
                $IsAlreadyWrapped = ($Sc.TargetPath -imatch '\\wscript\.exe$') -and ($Sc.Arguments -like "*launch-antigravity.vbs*")

                if ($IsDirectAgy -or $IsAlreadyWrapped) {
                    if ($IsDirectAgy -and -not $SavedShortcuts.ContainsKey($ScPath)) {
                        $SavedShortcuts[$ScPath] = [PSCustomObject]@{
                            shortcutPath     = $ScPath
                            targetPath       = [string]$Sc.TargetPath
                            arguments        = [string]$Sc.Arguments
                            workingDirectory = [string]$Sc.WorkingDirectory
                            iconLocation     = [string]$Sc.IconLocation
                            description      = [string]$Sc.Description
                        }
                    }

                    $OrigArgs = ''
                    if ($SavedShortcuts.ContainsKey($ScPath) -and $SavedShortcuts[$ScPath].arguments) {
                        $OrigArgs = ([string]$SavedShortcuts[$ScPath].arguments -replace '--remote-debugging-port=\S+', '').Trim()
                    }
                    $WrappedArgs = """$LauncherVbsPath"""
                    if ($OrigArgs) { $WrappedArgs = "$WrappedArgs $OrigArgs" }

                    $Sc.TargetPath = $WscriptExe
                    $Sc.Arguments = $WrappedArgs
                    $Sc.WorkingDirectory = (Split-Path -Parent $AgyExe)
                    $Sc.IconLocation = "$AgyExe,0"
                    $Sc.WindowStyle = 1
                    $Sc.Save()
                    $PatchedCount++
                    Write-Host "[install-win] Bound on-demand launcher to shortcut: $ScPath"
                }
            } catch {}
        }
    }

    $ProgramsDir = [Environment]::GetFolderPath('Programs')
    $CustomStartShortcutPath = Join-Path $ProgramsDir 'Antigravity (Custom Theme).lnk'
    $CustomSc = $WshShell.CreateShortcut($CustomStartShortcutPath)
    $CustomSc.TargetPath = $WscriptExe
    $CustomSc.Arguments = """$LauncherVbsPath"""
    $CustomSc.WorkingDirectory = (Split-Path -Parent $AgyExe)
    $CustomSc.IconLocation = "$AgyExe,0"
    $CustomSc.WindowStyle = 1
    $CustomSc.Description = 'Antigravity with Theme Studio (On-Demand)'
    $CustomSc.Save()
    Write-Host "[install-win] Created dedicated Start Menu shortcut: $CustomStartShortcutPath"

    $StateObj = [PSCustomObject]@{
        mode             = 'on-demand'
        antigravityExe   = $AgyExe
        launcherVbs      = $LauncherVbsPath
        shortcuts        = @($SavedShortcuts.Values)
        createdShortcuts = @($CustomStartShortcutPath)
    }
    $StateJson = $StateObj | ConvertTo-Json -Depth 5
    Set-Content -Path $LauncherStatePath -Value $StateJson -Encoding UTF8

    if ($PatchedCount -eq 0) {
        Write-Warning "[install-win] No Antigravity.lnk shortcuts found to wrap. Launch via $CustomStartShortcutPath or $LauncherVbsPath."
    }

    $ActivePortFile = Get-ActivePortFile
    if ($ActivePortFile) {
        Write-Host "[install-win] Active Antigravity CDP session detected; attaching daemon (--exit-on-close)..."
        $AttachVbs = "Set WshShell = CreateObject(""WScript.Shell""): WshShell.CurrentDirectory = ""$EscapedRoot"": WshShell.Run """"""$EscapedNode"""" """"$EscapedDaemon"""" --root-dir """"$EscapedRoot"""" --data-dir """"$EscapedData"""" --exit-on-close"", 0, False"
        $TmpAttach = Join-Path $env:TEMP "agy_attach_$(Get-Random).vbs"
        Set-Content -Path $TmpAttach -Value $AttachVbs -Encoding Unicode
        Start-Process -FilePath 'wscript.exe' -ArgumentList """$TmpAttach""" -WorkingDirectory $DataDir
        Start-Sleep -Milliseconds 600
        Remove-Item $TmpAttach -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "[install-win] Setup complete (On-Demand mode, zero Windows Startup)."
        Write-Host "[install-win] Quit Antigravity completely (System Tray -> Quit) and reopen from Desktop or Start Menu."
        exit 0
    }
}

for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 250
    if (Test-Path $PidFile) {
        $NewPidText = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
        $NewPid = 0
        if ([int]::TryParse(($NewPidText -as [string]), [ref]$NewPid) -and $NewPid -gt 0) {
            if (Get-Process -Id $NewPid -ErrorAction SilentlyContinue) {
                Write-Host "[install-win] Daemon running silently (PID $NewPid)."
                exit 0
            }
        }
    }
}

Write-Warning "[install-win] Daemon did not write daemon.pid in time. Check $DataDir\daemon.log."
exit 1
