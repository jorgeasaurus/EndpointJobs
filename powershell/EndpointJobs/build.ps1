<#
.SYNOPSIS
    Analyzes, tests, builds, or cleans the EndpointJobs module.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Bootstrap', 'Analyze', 'Test', 'Build', 'CI', 'Clean')]
    [string]$Task = 'CI'
)

$ErrorActionPreference = 'Stop'
$moduleName = 'EndpointJobs'
$buildRoot = Join-Path $PSScriptRoot 'build'
$buildDirectory = Join-Path $buildRoot $moduleName
$buildDependencies = [ordered]@{
    Pester = [version]'5.8.0'
    PSScriptAnalyzer = [version]'1.25.0'
}

function Install-BuildDependency {
    foreach ($dependency in $buildDependencies.GetEnumerator()) {
        $installed = Get-Module -ListAvailable -Name $dependency.Key |
            Where-Object { $_.Version -eq $dependency.Value } |
            Select-Object -First 1
        if (-not $installed) {
            Install-Module -Name $dependency.Key -RequiredVersion $dependency.Value -Scope CurrentUser -Force
        }
    }
}

function Import-BuildDependency {
    param(
        [Parameter(Mandatory)]
        [ValidateSet('Pester', 'PSScriptAnalyzer')]
        [string]$Name
    )

    $requiredVersion = $buildDependencies[$Name]
    $available = Get-Module -ListAvailable -Name $Name |
        Where-Object { $_.Version -eq $requiredVersion } |
        Select-Object -First 1
    if (-not $available) {
        throw "Install $Name $requiredVersion before running this task, or run -Task Bootstrap."
    }

    Import-Module -Name $Name -RequiredVersion $requiredVersion -Force
}

function Invoke-Analyze {
    Import-BuildDependency -Name PSScriptAnalyzer
    $issues = @(Invoke-ScriptAnalyzer -Path $PSScriptRoot -Recurse -Settings (Join-Path $PSScriptRoot 'PSScriptAnalyzerSettings.psd1'))
    if ($issues.Count -gt 0) {
        $issues | Format-Table -AutoSize
        throw "PSScriptAnalyzer found $($issues.Count) issue(s)."
    }
}

function Invoke-Test {
    Import-BuildDependency -Name Pester
    $configuration = New-PesterConfiguration
    $configuration.Run.Path = Join-Path $PSScriptRoot 'Tests'
    $configuration.Run.Exit = $false
    $configuration.Run.PassThru = $true
    $configuration.Output.Verbosity = 'Detailed'
    $result = Invoke-Pester -Configuration $configuration
    if ($result.Result -ne 'Passed') {
        throw "Pester did not pass: $($result.Result)."
    }
}

function Invoke-Build {
    if (Test-Path $buildDirectory) {
        Remove-Item -Path $buildDirectory -Recurse -Force
    }
    New-Item -Path $buildDirectory -ItemType Directory -Force | Out-Null

    foreach ($item in @('EndpointJobs.psd1', 'EndpointJobs.psm1', 'Private', 'Public')) {
        Copy-Item -Path (Join-Path $PSScriptRoot $item) -Destination $buildDirectory -Recurse -Force
    }

    $builtManifest = Join-Path $buildDirectory 'EndpointJobs.psd1'
    Test-ModuleManifest -Path $builtManifest | Out-Null
    $builtModule = Import-Module -Name $builtManifest -Force -PassThru
    $exportedFunctions = @($builtModule.ExportedFunctions.Keys)
    if ($exportedFunctions.Count -ne 1 -or $exportedFunctions[0] -ne 'Get-EndpointJob') {
        throw 'Built module does not export the expected command.'
    }
    Remove-Module -Name $moduleName -Force
}

function Invoke-Clean {
    if (Test-Path $buildRoot) {
        Remove-Item -Path $buildRoot -Recurse -Force
    }
}

switch ($Task) {
    'Bootstrap' { Install-BuildDependency }
    'Analyze' { Invoke-Analyze }
    'Test' { Invoke-Test }
    'Build' { Invoke-Build }
    'Clean' { Invoke-Clean }
    'CI' {
        Invoke-Analyze
        Invoke-Test
        Invoke-Build
    }
}
