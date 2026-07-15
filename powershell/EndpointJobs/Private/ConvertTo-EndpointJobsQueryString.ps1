function ConvertTo-EndpointJobsQueryString {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory)]
        [System.Collections.IDictionary]$Parameters
    )

    $parts = foreach ($entry in $Parameters.GetEnumerator()) {
        if ($null -eq $entry.Value -or $entry.Value -eq '' -or
            ($entry.Value -is [array] -and $entry.Value.Count -eq 0)) {
            continue
        }

        $value = if ($entry.Value -is [array]) {
            $entry.Value -join ','
        }
        else {
            [string]$entry.Value
        }

        '{0}={1}' -f [uri]::EscapeDataString([string]$entry.Key), [uri]::EscapeDataString($value)
    }

    $parts -join '&'
}
