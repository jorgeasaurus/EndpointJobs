#Requires -Modules Pester

BeforeDiscovery {
    Import-Module (Join-Path $PSScriptRoot '../EndpointJobs.psd1') -Force
}

BeforeAll {
    $modulePath = Join-Path $PSScriptRoot '../EndpointJobs.psd1'
    Import-Module $modulePath -Force
}

Describe 'EndpointJobs module' {
    It 'exports only Get-EndpointJob' {
        @(Get-Command -Module EndpointJobs).Name | Should -Be @('Get-EndpointJob')
    }

    It 'has a valid manifest' {
        { Test-ModuleManifest -Path $modulePath -ErrorAction Stop } | Should -Not -Throw
    }
}

Describe 'Get-EndpointJob' {
    InModuleScope EndpointJobs {
        BeforeEach {
            Mock Invoke-RestMethod {
                [pscustomobject]@{
                    data = @(
                        [pscustomobject]@{ id = 'job-1'; title = 'Endpoint Engineer' }
                    )
                    filters = [pscustomobject]@{}
                    meta = [pscustomobject]@{ page = 1; totalPages = 1 }
                }
            }
        }

        It 'encodes list filters using the API contract' {
            $result = @(Get-EndpointJob -Query 'device & endpoint' -Platform macOS, Windows -Tool 'Jamf Pro', Intune -Workplace Remote -SalaryShown -MinimumSalary 150000 -RoleFamily 'Endpoint Engineering' -Freshness 7 -Limit 50 -BaseUri 'https://example.test')

            $result.id | Should -Be 'job-1'
            Should -Invoke Invoke-RestMethod -Times 1 -ParameterFilter {
                $Uri.AbsoluteUri -eq 'https://example.test/api/jobs?q=device%20%26%20endpoint&platforms=macOS%2CWindows&tools=Jamf%20Pro%2CIntune&workplace=Remote&salary=1&minSalary=150000&family=Endpoint%20Engineering&freshness=7&sort=newest&page=1&limit=50'
            }
        }

        It 'returns the response envelope when RawResponse is selected' {
            $response = Get-EndpointJob -RawResponse -BaseUri 'https://example.test'

            $response.meta.totalPages | Should -Be 1
            $response.data[0].id | Should -Be 'job-1'
        }

        It 'requests every page with All' {
            Mock Invoke-RestMethod {
                $page = if ($Uri.Query -match 'page=2') { 2 } else { 1 }
                [pscustomobject]@{
                    data = @([pscustomobject]@{ id = "job-$page" })
                    meta = [pscustomobject]@{ page = $page; totalPages = 2 }
                }
            }

            $result = @(Get-EndpointJob -All -Limit 100 -BaseUri 'https://example.test')

            $result.id | Should -Be @('job-1', 'job-2')
            Should -Invoke Invoke-RestMethod -Times 2
        }

        It 'gets IDs from pipeline input and URL-encodes them' {
            Mock Invoke-RestMethod {
                [pscustomobject]@{ data = [pscustomobject]@{ id = 'job/one' }; meta = [pscustomobject]@{} }
            }

            $result = @('job/one') | Get-EndpointJob -BaseUri 'https://example.test'

            $result.id | Should -Be 'job/one'
            Should -Invoke Invoke-RestMethod -ParameterFilter {
                $Uri.AbsoluteUri -eq 'https://example.test/api/jobs/job%2Fone'
            }
        }

        It 'surfaces structured API errors with their API code' {
            Mock Invoke-RestMethod {
                $exception = [System.Net.WebException]::new('Bad request')
                $record = [System.Management.Automation.ErrorRecord]::new($exception, 'HttpError', 'InvalidOperation', $Uri)
                $record.ErrorDetails = [System.Management.Automation.ErrorDetails]::new('{"error":{"code":"INVALID_QUERY","message":"Invalid query.","details":["limit is invalid"]}}')
                throw $record
            }

            $thrown = { Get-EndpointJob -BaseUri 'https://example.test' } | Should -Throw -PassThru
            $thrown.FullyQualifiedErrorId | Should -BeLike 'INVALID_QUERY,*'
            $thrown.CategoryInfo.Category | Should -Be 'InvalidData'
            $thrown.Exception.Message | Should -Be 'Invalid query. limit is invalid'
            $thrown.TargetObject.AbsoluteUri | Should -BeLike 'https://example.test/api/jobs?*'
        }

        It 'maps missing jobs to ObjectNotFound' {
            Mock Invoke-RestMethod {
                $exception = [System.Net.WebException]::new('Not found')
                $record = [System.Management.Automation.ErrorRecord]::new($exception, 'HttpError', 'InvalidOperation', $Uri)
                $record.ErrorDetails = [System.Management.Automation.ErrorDetails]::new('{"error":{"code":"JOB_NOT_FOUND","message":"Job not found."}}')
                throw $record
            }

            $thrown = { Get-EndpointJob -Id missing -BaseUri 'https://example.test' } | Should -Throw -PassThru
            $thrown.FullyQualifiedErrorId | Should -BeLike 'JOB_NOT_FOUND,*'
            $thrown.CategoryInfo.Category | Should -Be 'ObjectNotFound'
        }

        It 'preserves transport errors when the response is not an API error' {
            Mock Invoke-RestMethod {
                $exception = [System.Net.WebException]::new('Gateway failure')
                $record = [System.Management.Automation.ErrorRecord]::new($exception, 'HttpError', 'ConnectionError', $Uri)
                $record.ErrorDetails = [System.Management.Automation.ErrorDetails]::new('<html>Bad gateway</html>')
                throw $record
            }

            $thrown = { Get-EndpointJob -BaseUri 'https://example.test' } | Should -Throw -PassThru
            $thrown.FullyQualifiedErrorId | Should -Be 'HttpError'
            $thrown.Exception.Message | Should -Be 'Gateway failure'
        }

        It 'rejects All with RawResponse before making a request' {
            { Get-EndpointJob -All -RawResponse -BaseUri 'https://example.test' } | Should -Throw '*cannot be used together*'
            Should -Invoke Invoke-RestMethod -Times 0
        }
    }
}
