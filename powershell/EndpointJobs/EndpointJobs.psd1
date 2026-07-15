@{
    RootModule        = 'EndpointJobs.psm1'
    ModuleVersion     = '0.1.0'
    GUID              = 'd9bf7f4a-a2c6-464e-8737-440c43a19e3d'
    Author            = 'jorgeasaurus'
    CompanyName       = 'Unknown'
    Copyright         = '(c) 2026 jorgeasaurus. All rights reserved.'
    Description       = 'PowerShell client for the public EndpointJobs API.'
    PowerShellVersion = '5.1'

    FunctionsToExport = @('Get-EndpointJob')
    CmdletsToExport   = @()
    VariablesToExport = @()
    AliasesToExport   = @()

    PrivateData = @{
        PSData = @{
            Tags         = @('EndpointJobs', 'Jobs', 'API')
            ProjectUri   = 'https://github.com/jorgeasaurus/EndpointJobs'
            ReleaseNotes = 'Initial API client with filtering, pagination, and item lookup.'
        }
    }
}
