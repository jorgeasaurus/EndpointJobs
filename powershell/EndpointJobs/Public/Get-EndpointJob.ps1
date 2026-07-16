function Get-EndpointJob {
    <#
    .SYNOPSIS
        Gets active endpoint jobs from endpointjobs.dev.
    .DESCRIPTION
        Lists and filters active jobs, or gets one active job by ID. List requests emit
        job objects by default. Use RawResponse to retain filters and pagination metadata.
    .PARAMETER Id
        The exact job ID returned by a list request.
    .PARAMETER All
        Gets every page matching the supplied filters.
    .PARAMETER RawResponse
        Returns the API response envelope instead of individual job objects.
    .PARAMETER Leadership
        Requires management, executive, or technical-lead roles.
    .EXAMPLE
        Get-EndpointJob -Tool Jamf -Platform macOS -MinimumSalary 150000
    .EXAMPLE
        Get-EndpointJob -Workplace Remote -Leadership -SalaryShown -All
    .EXAMPLE
        Get-EndpointJob -Id 'greenhouse-intercom-7918638'
    #>
    [CmdletBinding(DefaultParameterSetName = 'List')]
    param(
        [Parameter(Mandatory, Position = 0, ValueFromPipeline, ValueFromPipelineByPropertyName, ParameterSetName = 'ById')]
        [ValidateNotNullOrEmpty()]
        [string[]]$Id,

        [Parameter(ParameterSetName = 'List')]
        [ValidateLength(1, 200)]
        [string]$Query,

        [Parameter(ParameterSetName = 'List')]
        [ValidateSet('macOS', 'Windows', 'iOS', 'Android', 'Linux')]
        [string[]]$Platform,

        [Parameter(ParameterSetName = 'List')]
        [ValidateNotNullOrEmpty()]
        [string[]]$Tool,

        [Parameter(ParameterSetName = 'List')]
        [ValidateLength(1, 200)]
        [string]$Location,

        [Parameter(ParameterSetName = 'List')]
        [ValidateSet('Remote', 'Hybrid', 'On-site')]
        [string]$Workplace,

        [Parameter(ParameterSetName = 'List')]
        [switch]$SalaryShown,

        [Parameter(ParameterSetName = 'List')]
        [switch]$Leadership,

        [Parameter(ParameterSetName = 'List')]
        [ValidateSet(80000, 100000, 120000, 150000, 180000, 200000)]
        [int]$MinimumSalary,

        [Parameter(ParameterSetName = 'List')]
        [ValidateSet('Associate', 'Mid', 'Senior', 'Staff', 'Lead', 'Manager')]
        [string]$Seniority,

        [Parameter(ParameterSetName = 'List')]
        [ValidateSet(
            'Endpoint Engineering',
            'macOS Platform',
            'Windows Platform',
            'Workplace Systems',
            'Endpoint Security',
            'Device Compliance',
            'Systems Administration',
            'Automation'
        )]
        [string]$RoleFamily,

        [Parameter(ParameterSetName = 'List')]
        [ValidateSet(1, 7, 14, 30)]
        [int]$Freshness,

        [Parameter(ParameterSetName = 'List')]
        [ValidateSet('newest', 'salary', 'company')]
        [string]$Sort = 'newest',

        [Parameter(ParameterSetName = 'List')]
        [ValidateRange(1, [int]::MaxValue)]
        [int]$Page = 1,

        [Parameter(ParameterSetName = 'List')]
        [ValidateRange(1, 100)]
        [int]$Limit = 20,

        [Parameter(ParameterSetName = 'List')]
        [switch]$All,

        [Parameter(ParameterSetName = 'List')]
        [switch]$RawResponse,

        [Parameter(DontShow)]
        [ValidateNotNull()]
        [uri]$BaseUri = 'https://endpointjobs.dev'
    )

    process {
        $rootUri = $BaseUri.AbsoluteUri.TrimEnd('/')

        if ($PSCmdlet.ParameterSetName -eq 'ById') {
            foreach ($jobId in $Id) {
                $uri = '{0}/api/jobs/{1}' -f $rootUri, [uri]::EscapeDataString($jobId)
                $response = Invoke-EndpointJobsRequest -Uri $uri
                $response.data.PSObject.TypeNames.Insert(0, 'EndpointJobs.Job')
                Write-Output $response.data
            }
            return
        }

        if ($All -and $RawResponse) {
            throw [System.ArgumentException]::new(
                'All and RawResponse cannot be used together because RawResponse represents one page.'
            )
        }

        $parameters = [ordered]@{
            q          = $Query
            platforms  = $Platform
            tools      = $Tool
            location   = $Location
            workplace  = $Workplace
            salary     = if ($SalaryShown) { '1' } else { $null }
            leadership = if ($Leadership) { '1' } else { $null }
            minSalary  = if ($PSBoundParameters.ContainsKey('MinimumSalary')) { $MinimumSalary } else { $null }
            seniority  = $Seniority
            family     = $RoleFamily
            freshness  = if ($PSBoundParameters.ContainsKey('Freshness')) { $Freshness } else { $null }
            sort       = $Sort
            page       = $Page
            limit      = $Limit
        }

        do {
            $queryString = ConvertTo-EndpointJobsQueryString -Parameters $parameters
            $response = Invoke-EndpointJobsRequest -Uri ("$rootUri/api/jobs?$queryString")

            if ($RawResponse) {
                Write-Output $response
                return
            }

            foreach ($job in $response.data) {
                $job.PSObject.TypeNames.Insert(0, 'EndpointJobs.Job')
                Write-Output $job
            }

            $parameters.page = [int]$parameters.page + 1
        } while ($All -and [int]$response.meta.page -lt [int]$response.meta.totalPages)
    }
}
