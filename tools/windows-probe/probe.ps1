$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') { throw 'Disposable Windows runner only' }
$root = Join-Path $env:RUNNER_TEMP ('hms-native-' + $env:GITHUB_RUN_ID + '-' + $env:GITHUB_RUN_ATTEMPT)
$bin = Join-Path $root 'runtime'
$reportPath = Join-Path $env:RUNNER_TEMP 'hms-windows-probe-report.json'
$report = [ordered]@{ complete=$false; head=$env:GITHUB_SHA; os=(Get-CimInstance Win32_OperatingSystem).Caption; build=[Environment]::OSVersion.VersionString; architecture=$env:PROCESSOR_ARCHITECTURE; image=$env:ImageVersion; checks=@(); cleanup=$false }
$cleanupDetails=@(); $childProcesses=@(); $probeSids=@(); $cleanupOk=$true; $script:roundtripAttempted=$false
$users = @(); $ruleNames = @(); $credentials = @{}
$prefix = 'hms' + ($env:GITHUB_RUN_ID.Substring([Math]::Max(0,$env:GITHUB_RUN_ID.Length-9)))
function Add-Check($name,$value) { $script:report.checks += @{name=$name;value=$value} }
function New-Credential($name) {
  $rng=[Security.Cryptography.RandomNumberGenerator]::Create(); $bytes=New-Object byte[] 32; $rng.GetBytes($bytes); $rng.Dispose()
  $password='Hms!9'+[Convert]::ToBase64String($bytes)
  Write-Output ('::add-mask::' + $password) | Out-Host
  $secret=ConvertTo-SecureString $password -AsPlainText -Force
  $password=$null
  $user=New-LocalUser -Name $name -Password $secret -AccountExpires (Get-Date).AddHours(1) -UserMayNotChangePassword -Description 'Disposable HMS CI probe'
  $script:users += $name
  Add-LocalGroupMember -SID 'S-1-5-32-545' -Member $name
  return @{sid=$user.SID.Value;credential=(New-Object Management.Automation.PSCredential(($env:COMPUTERNAME+'\'+$name),$secret))}
}
function Assert-PrivateAcl($path,$sid) {
  $actual=Get-Acl -LiteralPath $path
  Assert-AclValue $actual $sid
}
function Assert-AclValue($actual,$sid) {
  if (-not $actual.AreAccessRulesProtected) { throw 'Private owner/inheritance mismatch' }
  $rules=@($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  if ($rules.Count -ne 3 -or @($rules | Where-Object {$_.IdentityReference.Value -notin @($sid,'S-1-5-18','S-1-5-32-544') -or $_.AccessControlType -ne 'Allow'}).Count) { throw 'Private SID allowlist mismatch' }
  Add-Check 'privateAcl' @{owner=$actual.GetOwner([Security.Principal.SecurityIdentifier]).Value;protected=$true;allowSids=@($rules | ForEach-Object {$_.IdentityReference.Value})}
}
function Cleanup-Result($component,$ok,$errorRecord) {
    $item=@{component=$component;ok=[bool]$ok}
    if ($null -ne $errorRecord) { $item.exceptionType=$errorRecord.Exception.GetType().FullName; $item.hresult=[int]$errorRecord.Exception.HResult }
    $script:cleanupDetails += $item
    if (-not $ok) { $script:cleanupOk=$false }
  }
function Scan-PrivateReport {
  param($candidate)
  $script:scanDiagnostic=@{reason='missing-list';reportMatches=0;childLogMatches=0;postgresLogMatches=0;otherLogMatches=0;listCount=0;nonStringCount=0}
  $secretPath=Join-Path $probeHome 'roundtrip-secrets.json'
  if (-not (Test-Path $secretPath)) {return $false}
  try {
    $raw=[IO.File]::ReadAllText($secretPath)
    $root=ConvertFrom-Json -InputObject $raw
    if ($root -isnot [object[]]) {$script:scanDiagnostic.reason='invalid-list';return $false}
    $script:scanDiagnostic.listCount=[int]$root.Count
    foreach ($item in $root) {if ($item -isnot [string]) {$script:scanDiagnostic.nonStringCount++}}
    if ($root.Count -notin @(6,8,10) -or $script:scanDiagnostic.nonStringCount -ne 0) {$script:scanDiagnostic.reason='invalid-list';return $false}
    foreach ($item in $root) {if ($item.Length -le 12) {$script:scanDiagnostic.reason='invalid-list';return $false}}
    $secrets=$root
    $scan=@(@{category='reportMatches';text=($candidate | ConvertTo-Json -Depth 10)})
    foreach ($f in @(Get-ChildItem $probeHome -File | Where-Object {$_.Name -match '\.(log|err)$'})) {
      $category=if ($f.Name -like 'child-*') {'childLogMatches'} elseif ($f.Name -eq 'postgres-private.log') {'postgresLogMatches'} else {'otherLogMatches'}
      $scan += @{category=$category;text=[IO.File]::ReadAllText($f.FullName)}
    }
    foreach ($secret in $secrets) {
      if ($secret -isnot [string]) {$script:scanDiagnostic.reason='invalid-list';return $false}
      if ($secret.Length -gt 12) {
        foreach ($entry in $scan) {if ($entry.text.Contains($secret)) {$script:scanDiagnostic[$entry.category]++}}
      }
    }
    $matches=$script:scanDiagnostic.reportMatches+$script:scanDiagnostic.childLogMatches+$script:scanDiagnostic.postgresLogMatches+$script:scanDiagnostic.otherLogMatches
    $script:scanDiagnostic.reason=if ($matches) {'value-detected'} else {'clean'}
    return ($matches -eq 0)
  } catch {$script:scanDiagnostic.reason='scan-read-error';return $false}
}
function Read-PgStages($stageDir) {
  $path=Join-Path $stageDir 'postgres-stages.txt'
  $result=@{count=0}
  if (Test-Path $path) {
    $tokens=@([IO.File]::ReadAllLines($path))
    $allowed=@('entered','initdb-before','initdb-after','hba-before','hba-after','config-before','config-after','start-before','start-after','query-before','query-after','modules-before','modules-after','listener-before','listener-after','dump-before','dump-after','restore-before','restore-after','stop-before','stop-after','initdb-failed','start-failed','start-timeout','migrate-before','migrate-after','backup-before','backup-after','api-before','api-after','app-stop-before','app-stop-after','dump-failed','restore-failed','stop-failed')
    if ($tokens.Count -le 64 -and @($tokens | Where-Object {$_ -notin $allowed}).Count -eq 0) {
      $result.count=$tokens.Count
      if ($tokens.Count) {$result.last=$tokens[-1]}
    } else {$result.invalid=$true}
  }
  return $result
}
function Scoped-Processes {
  foreach ($process in @(Get-CimInstance Win32_Process -ErrorAction Stop)) {
    $staged=$process.ExecutablePath -and $process.ExecutablePath.StartsWith($bin+'\',[StringComparison]::OrdinalIgnoreCase)
    $owned=$false
    # Query owner SID, never command line. Scope external hosts by the ephemeral users.
    $owner=Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid -ErrorAction SilentlyContinue
    if ($null -ne $owner -and $owner.ReturnValue -eq 0) {$owned=$owner.Sid -in $script:probeSids}
    if ($staged -or $owned) { $process }
  }
}
function Stop-ScopedProcesses {
  $before=@(Scoped-Processes)
  $safe=@($before | ForEach-Object {@{name=[IO.Path]::GetFileName($_.Name);pid=[int]$_.ProcessId;parentPid=[int]$_.ParentProcessId}})
  foreach ($process in $before) {
    try {
      $handle=Get-Process -Id $process.ProcessId -ErrorAction Stop
      # Revalidate CIM PID against creation time to avoid killing an unrelated reused PID.
      $current=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$process.ProcessId)
      if ($null -ne $current -and $current.CreationDate -eq $process.CreationDate) {
        Stop-Process -InputObject $handle -Force -ErrorAction Stop
        $null=$handle.WaitForExit(10000)
      }
    } catch {
      if (Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue) {Cleanup-Result 'process-stop' $false $_}
    }
  }
  $after=@(Scoped-Processes)
  return @{before=$safe;remaining=$after.Count}
}
function Child($mode,$probeHome,$credential) {
  $logBase=if ($mode -eq 'identity') {$bootstrap} else {$probeHome}
  $log=Join-Path $logBase ('child-'+$mode+'.log')
  # Negative user must not get write permission in the protected home.
  $start=@{FilePath="$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe";ArgumentList=@('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $bin 'child.ps1')+'"'),'-Mode',$mode,'-ProbeHome',('"'+$probeHome+'"'));Credential=$credential;LoadUserProfile=$true;PassThru=$true;WorkingDirectory=$bin}
  if ($mode -ne 'negative') { $start.RedirectStandardOutput=$log; $start.RedirectStandardError=($log+'.err') }
  $p=Start-Process @start
  $null=$p.Handle
  $script:childProcesses += $p.Id
  $seconds=if ($mode -eq 'roundtrip') {420} else {180}
  if (-not $p.WaitForExit($seconds*1000)) {
    $timeout=@{mode=$mode;seconds=$seconds}
    if ($mode -eq 'postgres' -or $mode -eq 'roundtrip') {$timeout.pgStages=Read-PgStages $probeHome}
    $timeout.probePortListenerCount=@(Get-NetTCPConnection -LocalPort 55773 -State Listen -ErrorAction SilentlyContinue).Count
    Add-Check 'childTimeout' $timeout
    $snapshot=Stop-ScopedProcesses
    Add-Check 'timeoutProcesses' $snapshot
    throw 'Credential child timeout'
  }
  $p.Refresh()
  if ($p.ExitCode -ne 0) {
    $failure=@{mode=$mode;exitCode=$p.ExitCode}
    if ($mode -eq 'postgres' -or $mode -eq 'roundtrip') {$failure.pgStages=Read-PgStages $probeHome}
    $diagnosticPath=Join-Path $probeHome ($mode+'.failure.json')
    if (-not (Test-Path $diagnosticPath) -and $mode -eq 'identity') { $diagnosticPath=Join-Path $bootstrap ($mode+'.failure.json') }
    if (Test-Path $diagnosticPath) {
      $d=Get-Content $diagnosticPath -Raw | ConvertFrom-Json
      if ($d.exceptionType -match '^[A-Za-z0-9_.+`]+$') {$failure.exceptionType=$d.exceptionType}
      $failure.line=[int]$d.line; $failure.hresult=[int]$d.hresult
    }
    Add-Check 'childFailure' $failure
    throw ('Credential child failed at '+$mode+'; private raw logs omitted')
  }
}
try {
  if ($report.architecture -ne 'AMD64') { throw 'Windows x64 required' }
  $a=New-Credential ($prefix+'a'); $b=New-Credential ($prefix+'b')
  $credentials.a=$a.credential; $credentials.b=$b.credential
  $probeSids=@($a.sid,$b.sid)
  # Grant traversal only on the unique root, RX on staged runtime only.
  & icacls.exe $root /grant ('*'+$a.sid+':(RX)') ('*'+$b.sid+':(RX)') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Stage traversal grant failed' }
  & icacls.exe $bin /grant ('*'+$a.sid+':(OI)(CI)(RX)') ('*'+$b.sid+':(OI)(CI)(RX)') /T /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Runtime RX grant failed' }
  # Nonsecret protected bootstrap has only A, Administrators and SYSTEM.
  $bootstrap=Join-Path $root 'bootstrap'
  New-Item $bootstrap -ItemType Directory | Out-Null
  & icacls.exe $bootstrap /inheritance:r /grant:r ('*'+$a.sid+':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Bootstrap ACL failed' }
  Assert-PrivateAcl $bootstrap $a.sid
  $probeHome=Join-Path $bootstrap 'private probe تجربة'
  if (Test-Path $probeHome) { throw 'Child private target must be absent' }
  Child 'identity' $probeHome $a.credential
  $identity=Get-Content (Join-Path $probeHome 'identity.json') -Raw | ConvertFrom-Json
  if ($identity.sid -ne $a.sid -or $identity.admin -or -not $identity.sentinelRead -or $identity.owner -ne $a.sid) { throw 'Child identity mismatch' }
  Assert-PrivateAcl $probeHome $a.sid
  Child 'negative' $probeHome $b.credential
  Add-Check 'otherOrdinaryUserDenied' $true
  Child 'network-before' $probeHome $a.credential
  $before=Get-Content (Join-Path $probeHome 'network-before.json') -Raw | ConvertFrom-Json
  if (-not $before.external -or -not $before.loopback) { throw 'Network baseline inconclusive' }
  if ((Invoke-WebRequest 'https://nodejs.org/' -UseBasicParsing -TimeoutSec 20).StatusCode -ne 200) { throw 'Parent baseline failed' }
  $profiles=@(Get-NetFirewallProfile)
  Add-Check 'firewallProfiles' @($profiles | ForEach-Object {@{name=[string]$_.Name;enabled=[bool]$_.Enabled}})
  if (@($profiles | Where-Object {-not $_.Enabled}).Count) { $report['failureCategory']='egress not testable: disabled firewall profile'; throw 'Firewall profile disabled; no profile mutation permitted' }
  $paths=@((Join-Path $bin 'node.exe'),(Join-Path $bin 'schema-engine.exe')) + @('postgres','initdb','pg_ctl','psql','pg_dump','pg_restore','createdb' | ForEach-Object {Join-Path $bin ('pg/bin/'+$_.ToString()+'.exe')})
  $i=0
  foreach ($p in $paths) {
    $name='HMS-probe-'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT+'-'+$i; $i++
    New-NetFirewallRule -Name $name -DisplayName $name -Direction Outbound -Action Block -Program $p -Profile Any -RemoteAddress @('0.0.0.0-126.255.255.255','128.0.0.0-255.255.255.255','::/1','8000::/1') | Out-Null
    $ruleNames += $name
  }
  Child 'network-after' $probeHome $a.credential
  $after=Get-Content (Join-Path $probeHome 'network-after.json') -Raw | ConvertFrom-Json
  if ($after.external -or -not $after.loopback) { throw 'Path-scoped egress rule ineffective' }
  $parent=(Invoke-WebRequest 'https://nodejs.org/' -UseBasicParsing -TimeoutSec 20).StatusCode -eq 200
  if (-not $parent) { throw 'Runner control external access changed' }
  Add-Check 'network' @{baseline=$true;copiedNodeExternalBlocked=$true;scope='node.exe path only';loopback=$true;parentExternal=$true;rules=@($ruleNames);programs=$paths}
  Child 'native' $probeHome $a.credential
  Add-Check 'native' (Get-Content (Join-Path $probeHome 'native.json') -Raw | ConvertFrom-Json)
  Child 'postgres' $probeHome $a.credential
  $pg=Get-Content (Join-Path $probeHome 'postgres.json') -Raw | ConvertFrom-Json
  Add-Check 'postgres' @{query=$pg.query;loopback=$pg.loopback;listenerAddress=$pg.listenerAddress;modules=$pg.modules}
  if (@(Get-NetTCPConnection -LocalPort $pg.port -State Listen -ErrorAction SilentlyContinue).Count) { throw 'Probe listener remains' }
  $script:roundtripAttempted=$true
  Child 'roundtrip' $probeHome $a.credential
  $roundtrip=Get-Content (Join-Path $probeHome 'roundtrip-result.json') -Raw | ConvertFrom-Json
  foreach ($key in @('backupRestore','negativeControl','sourceUnchanged','gracefulAppClose','runtimeDdlDenied','apiHealth','apiDbEndpoint')) {
    if ($roundtrip.PSObject.Properties.Name -notcontains $key -or $roundtrip.$key -ne $true) { throw 'Roundtrip required gate missing or false' }
  }
  if ($roundtrip.emptyTables.Count -ne 0 -or $roundtrip.appExitCode -ne 0 -or $roundtrip.listenerAddress -ne '127.0.0.1') { throw 'Roundtrip result contract failed' }
  Add-Check 'roundtrip' $roundtrip
  Add-Check 'roundtripStages' (Read-PgStages $probeHome)
  if (-not (Test-Path (Join-Path $probeHome 'roundtrip-secrets.json'))) { throw 'Required generated-value scan list missing' }
  if (Test-Path (Join-Path $probeHome 'fictional-roundtrip.dump')) { throw 'Private dump remains' }
  $runtime=@($pg.modules | Where-Object {$_.name -in @('VCRUNTIME140.dll','VCRUNTIME140_1.dll','MSVCP140.dll')})
  if ($runtime.Count -ne 3) { throw 'VC++ x64 runtime prerequisite missing' }
  Add-Check 'vcRuntimePrerequisite' @{status='prerequisite-not-bundled';modules=$runtime}
  if (@(Get-NetTCPConnection -LocalPort 55773 -State Listen -ErrorAction SilentlyContinue).Count) { throw 'Roundtrip listener remains' }
  Assert-PrivateAcl $probeHome $a.sid
  if ((Get-Acl -LiteralPath $probeHome).GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $a.sid) { throw 'Final owner mismatch' }
  $report['secretScan']=Scan-PrivateReport $report
  if (-not $report.secretScan) { throw 'Generated-value scan failed' }
  $report.complete=$true
} catch {
  # Do not emit raw native/credential exception strings. Preserve failure stage only.
  $report['failure']=@{exceptionType=$_.Exception.GetType().FullName;line=[int]$_.InvocationInfo.ScriptLineNumber;hresult=[int]$_.Exception.HResult}
  throw 'Bounded Windows native probe failed; sanitized report retained'
} finally {
  if ($script:roundtripAttempted) {
    $null=Scan-PrivateReport $report
    $scanSummary=$script:scanDiagnostic
    $listExists=Test-Path (Join-Path $probeHome 'roundtrip-secrets.json')
    $generatorEntered=Test-Path (Join-Path $probeHome 'roundtrip-generator-entered.txt')
    $stages=Read-PgStages $probeHome
    $preGenerator=@('entered','initdb-before','initdb-after','hba-before','hba-after','config-before','config-after','start-before','start-after','start-failed','start-timeout','initdb-failed','query-before','query-after','modules-before','modules-after','listener-before','listener-after','stop-before','stop-after','stop-failed')
    $provenBeforeGenerator=(-not $generatorEntered -and -not $listExists -and -not $report.complete -and $stages.ContainsKey('last') -and $stages.last -in $preGenerator)
    if ($provenBeforeGenerator) {$report['secretScan']='helper-generator-not-entered';Add-Check 'roundtripStages' $stages}
    elseif ($listExists -and (Scan-PrivateReport $report)) {$report['secretScan']=$true}
    else {$report=[ordered]@{complete=$false;head=$env:GITHUB_SHA;secretScan=$false;scanFailure=$scanSummary.reason;scanDiagnostic=$scanSummary;markerPresent=[bool]$generatorEntered;listPresent=[bool]$listExists;checks=@(@{name='roundtripStages';value=$stages})}}
    $helperFailurePath=Join-Path $probeHome 'helper-failure.json'
    if (Test-Path $helperFailurePath) {
      try {$helperFailure=Get-Content $helperFailurePath -Raw | ConvertFrom-Json
        if ($helperFailure.phase -in @('preflight','preflight-path','migrate','seed','roles','snapshot','dump','restore','compare','api-env','api-cleanup','api-runtime','api-ddl','api-fork','api-fork-load','api-fork-create','api-fork-listen','api-health','api-demo','api-patients','close')) {$report['helperFailure']=$helperFailure.phase} else {$report['helperFailure']='invalid'}
        if ($helperFailure.childTermination -in @('not-started','running','exit-zero','exit-startup','exit-deadline','exit-close','exit-other','signal')) {$report['childTermination']=$helperFailure.childTermination} else {$report['childTermination']='invalid'}
      } catch {}
    }
    Remove-Item (Join-Path $probeHome 'roundtrip-secrets.json') -Force -ErrorAction SilentlyContinue
  }
  $cleanupOk=@($cleanupDetails | Where-Object {-not $_.ok}).Count -eq 0
  foreach ($name in $ruleNames) {
    try { Remove-NetFirewallRule -Name $name -ErrorAction Stop; Cleanup-Result 'firewall-rule' (-not [bool](Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue)) $null } catch {Cleanup-Result 'firewall-rule' $false $_}
  }
  try {
    $state=Stop-ScopedProcesses
    $report['cleanupProcesses']=$state
    Cleanup-Result 'processes-absent' ($state.remaining -eq 0) $null
  } catch {Cleanup-Result 'process-enumeration' $false $_}
  foreach ($name in $users) {
    $sid=$null
    try { $sid=(Get-LocalUser -Name $name -ErrorAction Stop).SID.Value } catch {Cleanup-Result 'user-lookup' $false $_}
    try {
      Remove-LocalUser -Name $name -ErrorAction Stop
      Cleanup-Result 'user-absent' (-not [bool](Get-LocalUser -Name $name -ErrorAction SilentlyContinue)) $null
    } catch {Cleanup-Result 'user-remove' $false $_}
    if ($null -ne $sid) {
      try {
        Get-CimInstance Win32_UserProfile | Where-Object {$_.SID -eq $sid} | Remove-CimInstance -ErrorAction Stop
        Cleanup-Result 'profile-absent' (-not [bool](Get-CimInstance Win32_UserProfile | Where-Object {$_.SID -eq $sid})) $null
      } catch {Cleanup-Result 'profile-remove' $false $_}
    }
  }
  $credentials.Clear()
  $report['cleanupDetails']=$cleanupDetails
  if (@($cleanupDetails | Where-Object {-not $_.ok}).Count) {$cleanupOk=$false}
  $report['remainingStagedProcessCount']=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($bin+'\',[StringComparison]::OrdinalIgnoreCase)}).Count
  if ($report.remainingStagedProcessCount -ne 0) {$cleanupOk=$false}
  $report.cleanup=$cleanupOk
  if (-not $cleanupOk) {$report.complete=$false}
  $report | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8
  if ($script:roundtripAttempted -and $report.secretScan -eq $false) { Write-Error 'Generated-value scan failed; only minimal diagnostics retained' }
  if (-not $cleanupOk) { Write-Error 'Probe cleanup incomplete on disposable runner' }
}
