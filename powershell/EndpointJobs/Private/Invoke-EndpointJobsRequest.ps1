function Invoke-EndpointJobsRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [uri]$Uri
    )

    try {
        Invoke-RestMethod -Uri $Uri -Method Get -ErrorAction Stop
    }
    catch {
        $apiError = $null
        if ($_.ErrorDetails.Message) {
            try {
                $apiError = ($_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction Stop).error
            }
            catch {
                $apiError = $null
            }
        }

        if ($apiError) {
            $message = [string]$apiError.message
            if ($apiError.details) {
                $message = '{0} {1}' -f $message, ($apiError.details -join '; ')
            }

            $category = if ($apiError.code -eq 'JOB_NOT_FOUND') {
                [System.Management.Automation.ErrorCategory]::ObjectNotFound
            }
            else {
                [System.Management.Automation.ErrorCategory]::InvalidData
            }
            $exception = [System.InvalidOperationException]::new($message, $_.Exception)
            $record = [System.Management.Automation.ErrorRecord]::new(
                $exception,
                [string]$apiError.code,
                $category,
                $Uri
            )
            $PSCmdlet.ThrowTerminatingError($record)
        }

        throw
    }
}
