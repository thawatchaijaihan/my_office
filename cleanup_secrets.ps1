# Script to clean up old secret versions in Google Cloud Secret Manager
$project = "jaihan-assistant"

Write-Host "Fetching list of secrets for project $project..."
$secrets = gcloud secrets list --project=$project --format="value(name)"

foreach ($secret in $secrets) {
    if ([string]::IsNullOrWhiteSpace($secret)) { continue }
    
    Write-Host "`nChecking secret: $secret"
    
    # Get all enabled versions, sorted by creation time (newest first)
    # The --sort-by="~created" flag sorts in descending order, so the first one is the latest.
    $versionsOutput = gcloud secrets versions list $secret --project=$project --format="value(name)" --filter="state=enabled" --sort-by="~created"
    
    if ([string]::IsNullOrWhiteSpace($versionsOutput)) {
        Write-Host "  No enabled versions found."
        continue
    }

    # Split output into an array of strings (trimming whitespace)
    $versions = $versionsOutput -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    
    # Check if we have more than one version
    if ($versions.Count -le 1) {
        Write-Host "  Only one version found. Skipping."
        continue
    }

    Write-Host "  Found $($versions.Count) active versions. Keeping the latest one ($($versions[0])) and destroying the rest."

    # Skip the first element (which is the newest/latest) and destroy the rest
    for ($i = 1; $i -lt $versions.Count; $i++) {
        $versionToDestroy = $versions[$i]
        Write-Host "  -> Destroying version $versionToDestroy..."
        gcloud secrets versions destroy $versionToDestroy --secret=$secret --project=$project --quiet
    }
}

Write-Host "`nCleanup complete!"
