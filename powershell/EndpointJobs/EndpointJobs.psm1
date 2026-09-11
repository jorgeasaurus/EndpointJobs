# Generated from the canonical API contract by npm run docs:api.
$script:EndpointToolNames = @{}
$toolNames = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'EndpointTools.json') -Raw | ConvertFrom-Json
foreach ($toolName in $toolNames.PSObject.Properties) {
    $script:EndpointToolNames[$toolName.Name] = $toolName.Value
}

. (Join-Path $PSScriptRoot 'Private/ConvertTo-EndpointJobsQueryString.ps1')
. (Join-Path $PSScriptRoot 'Private/Invoke-EndpointJobsRequest.ps1')
. (Join-Path $PSScriptRoot 'Public/Get-EndpointJob.ps1')

Export-ModuleMember -Function 'Get-EndpointJob'
