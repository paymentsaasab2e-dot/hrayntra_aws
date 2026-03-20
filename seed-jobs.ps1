# PowerShell script to seed jobs in the database
# Run this script from the project root directory

$apiUrl = "http://localhost:5000/api/jobs/seed"

Write-Host "Seeding jobs..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -ContentType "application/json"
    
    if ($response.success) {
        Write-Host "✅ Success! Jobs seeded successfully." -ForegroundColor Green
        Write-Host "Created/Found $($response.data.count) jobs" -ForegroundColor Cyan
        
        if ($response.data.jobs) {
            Write-Host "`nJob Titles:" -ForegroundColor Yellow
            $response.data.jobs | ForEach-Object {
                Write-Host "  - $($_.title) at $($_.company.name)" -ForegroundColor White
            }
        }
    } else {
        Write-Host "❌ Error: $($response.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error seeding jobs:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nMake sure the backend server is running on http://localhost:5000" -ForegroundColor Yellow
}
