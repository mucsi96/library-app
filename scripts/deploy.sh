#!/bin/bash

set -euo pipefail

: "${AZURE_KEYVAULT_NAME:?Environment variable AZURE_KEYVAULT_NAME is required}"
: "${SERVER_IMAGE:?Set the versioned server image to deploy}"
if [[ ! "$SERVER_IMAGE" =~ ^ghcr\.io/.+(:[1-9][0-9]*|@sha256:[a-f0-9]{64})$ ]]; then
    printf '%s\n' 'SERVER_IMAGE must use GHCR with a release version or sha256 digest.' >&2
    exit 1
fi

AZURE_KEYVAULT_ENDPOINT="https://${AZURE_KEYVAULT_NAME}.vault.azure.net/"
SERVER_RELEASE_NAME=library-server
CLIENT_RELEASE_NAME=library-client

# Create a temporary file in /dev/shm (RAM) to avoid writing to disk
KUBECONFIG=$(mktemp /dev/shm/kubeconfig.XXXXXX)
export KUBECONFIG

# Ensure the temporary file is deleted when the script exits
trap 'rm -f "$KUBECONFIG"' EXIT

"$(dirname "$0")/pull_kubeconfig.sh"

HOSTNAME=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name hostname --query value -o tsv)
API_CLIENT_ID=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name api-client-id --query value -o tsv)
AUTH_CONFIG=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name forward-auth-config --query value -o tsv)
AUTH_RELEASE=$(jq -er '.release_name | select(type == "string" and length > 0)' <<<"$AUTH_CONFIG")
PROXY_AUTH=$(jq -ce '.auth | select(.proxyService | type == "string" and length > 0) | select(.proxyPort | type == "number") | select(.mode == "api-token")' <<<"$AUTH_CONFIG")
CLIENT_STORAGE_CONFIG=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name client-storage-config --query value -o tsv)
CLIENT_ORIGIN=$(jq -er '.hostname | select(test("^[a-z0-9.-]+\\.web\\.core\\.windows\\.net$"))' <<<"$CLIENT_STORAGE_CONFIG")

echo "Updating Helm repositories..."
helm repo add mucsi96 https://mucsi96.github.io/k8s-helm-charts --force-update

springAppChartVersion=37.0.0
staticClientAppChartVersion=5.0.0
helm status "$AUTH_RELEASE" --namespace library >/dev/null
helm show chart mucsi96/spring-app --version "$springAppChartVersion" >/dev/null
helm show chart mucsi96/static-client-app --version "$staticClientAppChartVersion" >/dev/null

echo "Deploying server: $SERVER_IMAGE using spring-app chart $springAppChartVersion"

# The server is a GraalVM native executable, so there is no JVM metaspace, no
# code cache and no JIT-compiled code to hold: it idles far below what the
# 512Mi request assumed for the JRE image, hence the smaller request. The
# request is what the scheduler reserves around the clock, so it is sized for
# idle. Over 36h in production RSS averaged 100Mi and peaked at 136Mi; the
# working set peaked at 216Mi.
#
# The limit is the opposite question and stays where it is: it has to cover the
# idle footprint plus the 512Mi heap the image is capped at, which an import
# can transiently fill with both photos and their base64 copies (see the
# ENTRYPOINT in server/Dockerfile - keep the two in step).
helm upgrade $SERVER_RELEASE_NAME mucsi96/spring-app \
    --install \
    --reset-values \
    --version $springAppChartVersion \
    --set-string image="$SERVER_IMAGE" \
    --set host=$HOSTNAME \
    --set basePath=/api \
    --set-json auth="$PROXY_AUTH" \
    --set clientId=$API_CLIENT_ID \
    --set serviceAccountName=library-api-workload-identity \
    --set env.AZURE_KEYVAULT_ENDPOINT=$AZURE_KEYVAULT_ENDPOINT \
    --set env.STORAGE_DIRECTORY=/app/storage \
    --set persistentVolumeClaims[0].name=library-app-pvc \
    --set persistentVolumeClaims[0].accessMode=ReadWriteOnce \
    --set persistentVolumeClaims[0].volumeName=library-app \
    --set persistentVolumeClaims[0].mountPath=/app/storage \
    --set persistentVolumeClaims[0].storageClassName="" \
    --set persistentVolumeClaims[0].storage=5Gi \
    --set resources.requests.memory=128Mi \
    --set resources.requests.cpu=100m \
    --set resources.limits.memory=768Mi \
    --set resources.limits.cpu=500m \
    --wait

echo "Deploying static client gateway using chart $staticClientAppChartVersion"

helm upgrade $CLIENT_RELEASE_NAME mucsi96/static-client-app \
    --install \
    --reset-values \
    --version $staticClientAppChartVersion \
    --set-string staticOrigin="$CLIENT_ORIGIN" \
    --set host=$HOSTNAME \
    --set-json auth="$PROXY_AUTH" \
    --wait
