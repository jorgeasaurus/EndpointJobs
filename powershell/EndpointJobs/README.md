# EndpointJobs

PowerShell 5.1+ client for the public, read-only [EndpointJobs API](../../docs/api.md). No authentication is required.

## Install

```powershell
Install-Module -Name EndpointJobs -Scope CurrentUser
```

## Use

```powershell
# Latest jobs
Get-EndpointJob -Limit 10

# Filter jobs
Get-EndpointJob -Tool Jamf -Platform macOS -MinimumSalary 150000
Get-EndpointJob -Workplace Remote -SalaryShown -Freshness 7 -All

# Get one job by ID or from the pipeline
Get-EndpointJob -Id 'greenhouse-intercom-7918638'
Get-EndpointJob -Limit 1 | Get-EndpointJob
```

List requests stream `EndpointJobs.Job` objects. Use `-RawResponse` to retain the API pagination metadata:

```powershell
$response = Get-EndpointJob -Page 2 -Limit 50 -RawResponse
$response.meta
$response.data
```

Run `Get-Help Get-EndpointJob -Full` for every filter and example. API failures are returned as terminating PowerShell errors with the HTTP status and API error code.

## Develop

```powershell
./build.ps1 -Task Bootstrap
./build.ps1 -Task CI
```

[PowerShell Gallery](https://www.powershellgallery.com/packages/EndpointJobs) · [API documentation](../../docs/api.md)
