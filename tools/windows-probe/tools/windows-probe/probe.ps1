$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') { throw 'Disposable Windows runner only' }
$root = Join-Path $env:RUNNER_TEMP ('hms-native-' + $env:GITHUB_RUN_ID + '-' + $env:GITHUB_RUN_ATTEMPT)
$bin = Join-Path $root 'runtime'
$reportPath = Join-Path $env:RUNNER_TEMP 'hms-windows-probe-report.json'
$report = [ordered]@{ complete=$false; head=$env:GITHUB_SHA; os=(Get-CimInstance Win32_OperatingSystem).Caption; build=[Environment]::OSVersion.VersionString; architecture=$env:PROCESSOR_ARCHITECTURE; image=$env:ImageVersion; checks=@(); cleanup=$false }
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
function Set-PrivateAcl($path,$sid) {
  $acl=New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true,$false)
  foreach ($s in @($sid,'S-1-5-18','S-1-5-32-544')) {
    $identity=New-Object Security.Principal.SecurityIdentifier($s)
    $rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $path -AclObject $acl
  $actual=Get-Acl -LiteralPath $path
  if (-not $actual.AreAccessRulesProtected) { throw 'Private owner/inheritance mismatch' }
  $rules=@($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  if ($rules.Count -ne 3 -or @($rules | Where-Object {$_.IdentityReference.Value -notin @($sid,'S-1-5-18','S-1-5-32-544') -or $_.AccessControlType -ne 'Allow'}).Count) { throw 'Private SID allowlist mismatch' }
  Add-Check 'privateAcl' @{owner=$actual.GetOwner([Security.Principal.SecurityIdentifier]).Value;protected=$true;allowSids=@($rules | ForEach-Object {$_.IdentityReference.Value})}
}
function Child($mode,$probeHome,$credential) {
  $log=Join-Path $probeHome ('child-'+$mode+'.log')
  # Negative user must not get write permission in the protected home.
  $start=@{FilePath="$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe";ArgumentList=@('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $bin 'child.ps1')+'"'),'-Mode',$mode,'-ProbeHome',('"'+$probeHome+'"'));Credential=$credential;LoadUserProfile=$true;PassThru=$true;WorkingDirectory=$bin}
  if ($mode -ne 'negative') { $start.RedirectStandardOutput=$log; $start.RedirectStandardError=($log+'.err') }
  $p=Start-Process @start
  $null=$p.Handle
  if (-not $p.WaitForExit(180000)) { Stop-Process -Id $p.Id -Force; throw 'Credential child timeout' }
  $p.Refresh()
  if ($p.ExitCode -ne 0) {
    $failure=@{mode=$mode;exitCode=$p.ExitCode}
    $diagnosticPath=Join-Path $probeHome ($mode+'.failure.json')
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
  # Grant traversal only on the unique root, RX on staged runtime only.
  & icacls.exe $root /grant ('*'+$a.sid+':(RX)') ('*'+$b.sid+':(RX)') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Stage traversal grant failed' }
  & icacls.exe $bin /grant ('*'+$a.sid+':(OI)(CI)(RX)') ('*'+$b.sid+':(OI)(CI)(RX)') /T /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Runtime RX grant failed' }
  $probeHome=Join-Path $root 'private probe تجربة'
  New-Item $probeHome -ItemType Directory | Out-Null; Set-PrivateAcl $probeHome $a.sid
  [IO.File]::WriteAllText((Join-Path $probeHome 'sentinel.txt'),'fictional nonsecret ACL sentinel')
  Child 'identity' $probeHome $a.credential
  $identity=Get-Content (Join-Path $probeHome 'identity.json') -Raw | ConvertFrom-Json
  if ($identity.sid -ne $a.sid -or $identity.admin -or -not $identity.sentinelRead -or $identity.owner -ne $a.sid) { throw 'Child identity mismatch' }
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
  Add-Check 'postgres' @{query=$pg.query;loopback=$pg.loopback;modules=$pg.modules}
  if (@(Get-NetTCPConnection -LocalPort $pg.port -State Listen -ErrorAction SilentlyContinue).Count) { throw 'Probe listener remains' }
  Set-PrivateAcl $probeHome $a.sid
  if ((Get-Acl -LiteralPath $probeHome).GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $a.sid) { throw 'Final owner mismatch' }
  $report.complete=$true
} catch {
  # Do not emit raw native/credential exception strings. Preserve failure stage only.
  $report['failure']=@{exceptionType=$_.Exception.GetType().FullName;line=[int]$_.InvocationInfo.ScriptLineNumber;hresult=[int]$_.Exception.HResult}
  throw 'Bounded Windows native probe failed; sanitized report retained'
} finally {
  $cleanupOk=$true
  foreach ($name in $ruleNames) {
    try { Remove-NetFirewallRule -Name $name -ErrorAction Stop; if (Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue) { $cleanupOk=$false } } catch {$cleanupOk=$false}
  }
  # Kill only remaining descendants whose executable path is inside this unique staging root.
  foreach ($p in @(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($bin+'\',[StringComparison]::OrdinalIgnoreCase)})) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {$cleanupOk=$false}
  }
  foreach ($name in $users) {
    try {
      $u=Get-LocalUser -Name $name -ErrorAction Stop
      $sid=$u.SID.Value
      Remove-LocalUser -Name $name -ErrorAction Stop
      Get-CimInstance Win32_UserProfile | Where-Object {$_.SID -eq $sid} | Remove-CimInstance -ErrorAction Stop
      if (Get-LocalUser -Name $name -ErrorAction SilentlyContinue) {$cleanupOk=$false}
    } catch {$cleanupOk=$false}
  }
  $credentials.Clear()
  $report.cleanup=$cleanupOk
  if (-not $cleanupOk) {$report.complete=$false}
  $report | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8
  if (-not $cleanupOk) { Write-Error 'Probe cleanup incomplete on disposable runner' }
}
