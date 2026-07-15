@{
    Severity = @('Error', 'Warning')
    ExcludeRules = @(
        # The public API uses the conventional singular PowerShell noun.
        'PSUseSingularNouns'
    )
}
