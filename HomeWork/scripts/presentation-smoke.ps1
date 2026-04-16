param(
  [string]$ExamSource = "C:\Users\Matan\Documents\newPc\HomeWork\data\exams\exam-1767723989126-jeahd4z\assets\Exercise 6 (2)_1767723989126_jeahd4z.pdf",
  [string]$SubmissionSource = "C:\Users\Matan\Documents\newPc\HomeWork\data\uploads\Exercise 6 (2)_1767723989126_jeahd4z_job-1767732469479-w79nup9.pdf",
  [string]$TitlePrefix = "Presentation Drill Exam"
)

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path "$PSScriptRoot\..")

$webJob = $null

function Wait-Health([int]$MaxSeconds = 120) {
  for ($i = 0; $i -lt $MaxSeconds; $i++) {
    try {
      $healthRaw = curl.exe --silent --show-error --max-time 5 http://localhost:3000/api/health
      if (-not [string]::IsNullOrWhiteSpace($healthRaw)) {
        $health = $healthRaw | ConvertFrom-Json
        if ($health.ok) {
          return $health
        }
      }
    } catch {}
    Start-Sleep -Seconds 1
  }
  throw 'Health endpoint did not become ready in time.'
}

try {
  if (-not (Test-Path -LiteralPath $ExamSource)) {
    throw "Exam source file not found: $ExamSource"
  }
  if (-not (Test-Path -LiteralPath $SubmissionSource)) {
    throw "Submission source file not found: $SubmissionSource"
  }

  New-Item -ItemType Directory -Force -Path '.codex-runlogs' | Out-Null
  $runOnceLog = ".codex-runlogs\worker.runonce.log"
  if (Test-Path $runOnceLog) { Remove-Item $runOnceLog -Force }

  $repoRoot = (Get-Location).Path
  $webJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    pnpm --filter web start
  } -ArgumentList $repoRoot

  $health = Wait-Health

  $title = "$TitlePrefix $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  $examRespRaw = curl.exe --silent --show-error --max-time 120 -F "title=$title" -F "examFile=@$ExamSource;type=application/pdf" http://localhost:3000/api/exams
  $examResp = $examRespRaw | ConvertFrom-Json
  if (-not $examResp.examId) {
    throw "Failed to create exam. Response: $examRespRaw"
  }

  $jobRespRaw = curl.exe --silent --show-error --max-time 120 -F "examId=$($examResp.examId)" -F "questionId=q1" -F "gradingMode=GENERAL" -F "gradingScope=DOCUMENT" -F "submissionMode=pdf" -F "submission=@$SubmissionSource;type=application/pdf" http://localhost:3000/api/jobs
  $jobResp = $jobRespRaw | ConvertFrom-Json
  if (-not $jobResp.jobId) {
    throw "Failed to create job. Response: $jobRespRaw"
  }

  pnpm --filter worker job:run-once *> $runOnceLog

  $jobStatus = $null
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $jobStatusRaw = curl.exe --silent --show-error --max-time 8 "http://localhost:3000/api/jobs/$($jobResp.jobId)"
      if (-not [string]::IsNullOrWhiteSpace($jobStatusRaw)) {
        $jobStatus = $jobStatusRaw | ConvertFrom-Json
        if ($jobStatus.status -eq 'DONE' -or $jobStatus.status -eq 'FAILED') {
          break
        }
      }
    } catch {}
    Start-Sleep -Seconds 2
  }

  $reviewsRaw = curl.exe --silent --show-error --max-time 20 http://localhost:3000/api/reviews
  $reviewsResp = $reviewsRaw | ConvertFrom-Json
  $reviewsCount = if ($reviewsResp.ok -and $reviewsResp.data) { @($reviewsResp.data).Count } else { 0 }

  $summary = [ordered]@{
    healthOk         = $health.ok
    workerAlive      = $health.workerAlive
    createdExamId    = $examResp.examId
    createdJobId     = $jobResp.jobId
    jobFinalStatus   = $jobStatus.status
    reviewsCount     = $reviewsCount
    workerRunOnceLog = $runOnceLog
  }

  $summary | ConvertTo-Json -Depth 4
}
finally {
  if ($webJob) {
    $jobOutput = Receive-Job -Job $webJob -Keep -ErrorAction SilentlyContinue
    if ($jobOutput) {
      $jobOutput | Out-File -FilePath '.codex-runlogs\web.job.log' -Encoding utf8
    }
    Stop-Job -Job $webJob -ErrorAction SilentlyContinue | Out-Null
    Remove-Job -Job $webJob -Force -ErrorAction SilentlyContinue | Out-Null
  }
}
