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
            $statusCode = Get-EndpointJobsHttpStatusCode -ErrorRecord $_
            $message = [string]$apiError.message
            if ($apiError.details) {
                $message = '{0} {1}' -f $message, ($apiError.details -join '; ')
            }
            if ($null -ne $statusCode) {
                $message = 'HTTP {0}: {1}' -f $statusCode, $message
            }

            $category = if ($apiError.code -eq 'JOB_NOT_FOUND') {
                [System.Management.Automation.ErrorCategory]::ObjectNotFound
            }
            else {
                [System.Management.Automation.ErrorCategory]::InvalidData
            }
            $exception = [System.InvalidOperationException]::new($message, $_.Exception)
            if ($null -ne $statusCode) {
                $exception | Add-Member -NotePropertyName StatusCode -NotePropertyValue $statusCode
            }
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

function Get-EndpointJobsHttpStatusCode {
    param($ErrorRecord)

    $candidates = @(
        $ErrorRecord.Exception.Response.StatusCode,
        $ErrorRecord.Exception.StatusCode,
        $ErrorRecord.Exception.InnerException.Response.StatusCode,
        $ErrorRecord.Exception.InnerException.StatusCode
    )
    foreach ($candidate in $candidates) {
        if ($null -eq $candidate -or "$candidate" -eq '') { continue }
        $number = 0
        if ([int]::TryParse("$candidate", [ref]$number) -and $number -gt 0) {
            return $number
        }
        if ($candidate -is [System.Enum]) {
            $number = [int]$candidate
            if ($number -gt 0) { return $number }
        }
    }

    return $null
}
