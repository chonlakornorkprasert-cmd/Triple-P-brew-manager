param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [string]$Region = "asia-southeast1",
  [string]$ServiceName = "triple-p-brew-manager",
  [string]$InstanceName = "triple-p-db",
  [string]$DatabaseName = "triple_p_brew",
  [string]$DatabaseUser = "triple_p_app",
  [string]$Repository = "triple-p",
  [switch]$PublicAccess
)

$ErrorActionPreference = "Stop"
$Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$ServiceName`:latest"
$ConnectionName = "$ProjectId`:$Region`:$InstanceName"
$ServiceAccount = "triple-p-run@$ProjectId.iam.gserviceaccount.com"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "gcloud CLI was not found. Install Google Cloud CLI or run this script in Cloud Shell."
}

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

$instance = gcloud sql instances describe $InstanceName --format="value(name)" 2>$null
if (-not $instance) {
  gcloud sql instances create $InstanceName --database-version=POSTGRES_15 --edition=ENTERPRISE --tier=db-f1-micro --region=$Region --availability-type=zonal --storage-type=SSD --storage-size=10 --storage-auto-increase
}

gcloud sql databases describe $DatabaseName --instance=$InstanceName 2>$null
if ($LASTEXITCODE -ne 0) { gcloud sql databases create $DatabaseName --instance=$InstanceName }

$securePassword = Read-Host "PostgreSQL password for $DatabaseUser" -AsSecureString
$password = [System.Net.NetworkCredential]::new("", $securePassword).Password
gcloud sql users create $DatabaseUser --instance=$InstanceName --password=$password 2>$null
if ($LASTEXITCODE -ne 0) { gcloud sql users set-password $DatabaseUser --instance=$InstanceName --password=$password }

gcloud secrets describe triple-p-db-password 2>$null
if ($LASTEXITCODE -ne 0) {
  $password | gcloud secrets create triple-p-db-password --data-file=-
} else {
  $password | gcloud secrets versions add triple-p-db-password --data-file=-
}
$password = $null

gcloud iam service-accounts describe $ServiceAccount 2>$null
if ($LASTEXITCODE -ne 0) { gcloud iam service-accounts create triple-p-run --display-name="Triple P Cloud Run" }
gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$ServiceAccount" --role="roles/cloudsql.client" --quiet
gcloud secrets add-iam-policy-binding triple-p-db-password --member="serviceAccount:$ServiceAccount" --role="roles/secretmanager.secretAccessor" --quiet

gcloud artifacts repositories describe $Repository --location=$Region 2>$null
if ($LASTEXITCODE -ne 0) { gcloud artifacts repositories create $Repository --repository-format=docker --location=$Region }
gcloud builds submit --tag $Image .

$commonArgs = @(
  "--image=$Image",
  "--region=$Region",
  "--service-account=$ServiceAccount",
  "--set-cloudsql-instances=$ConnectionName",
  "--set-env-vars=INSTANCE_UNIX_SOCKET=/cloudsql/$ConnectionName,DB_USER=$DatabaseUser,DB_NAME=$DatabaseName,DB_POOL_MAX=5",
  "--set-secrets=DB_PASSWORD=triple-p-db-password:latest"
)

gcloud run jobs deploy "$ServiceName-migrate" @commonArgs --command=npm --args=run,db:init --max-retries=1 --task-timeout=10m
gcloud run jobs execute "$ServiceName-migrate" --region=$Region --wait
if ($PublicAccess) {
  gcloud run deploy $ServiceName @commonArgs --allow-unauthenticated --port=8080 --min=0 --max=3 --memory=512Mi --cpu=1
} else {
  gcloud run deploy $ServiceName @commonArgs --port=8080 --min=0 --max=3 --memory=512Mi --cpu=1
}

gcloud run services describe $ServiceName --region=$Region --format="value(status.url)"
