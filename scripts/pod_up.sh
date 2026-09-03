#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
POD_NAME="library-app-test"
MAX_WAIT=120

if [ "${SKIP_BUILD:-}" = "1" ]; then
  echo "Skipping image build (SKIP_BUILD=1)..."
else
  echo "Building container images..."
  # The Spring profile is baked into the native executable during AOT
  # processing, so the pod image has to be built with the test profile.
  podman build --build-arg SPRING_PROFILE=test \
    -t localhost/library-app-server:test "$PROJECT_DIR/server" &
  podman build -t localhost/library-app-client:test "$PROJECT_DIR/client" &
  podman build -t localhost/library-app-mock-openai:test "$PROJECT_DIR/mock_openai_server" &
  wait
fi

echo "Cleaning up existing pod..."
podman kube down "$PROJECT_DIR/test/test-pod.yaml" 2>/dev/null || true

echo "Starting pod..."
podman kube play "$PROJECT_DIR/test/test-pod.yaml"

container_state() {
  podman inspect "$1" \
    --format 'status={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}}' \
    2>&1 || true
}

dump_logs() {
  for c in $CONTAINERS; do
    echo "$c" | grep -q "infra" && continue
    echo "=== $c === $(container_state "$c")"
    podman logs "$c" 2>&1 | tail -20
  done
}

wait_healthy() {
  local container=$1
  echo "  Waiting for $container..."
  ELAPSED=0
  # Run each container's healthcheck on demand instead of reading
  # .State.Health.Status: Podman 5 on GitHub runners never schedules or
  # records probe runs, so the status alone never becomes "healthy".
  until podman healthcheck run "$container" > /dev/null 2>&1; do
    # A container that has already exited is never going to pass its probe, and
    # its state carries the reason a crash or a failed exec leaves no logs.
    if [ "$(podman inspect "$container" --format '{{.State.Status}}' 2>/dev/null)" = "exited" ]; then
      echo "$container exited before becoming healthy: $(container_state "$container")"
      dump_logs
      exit 1
    fi
    if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
      echo "Timeout waiting for $container to become healthy: $(container_state "$container")"
      dump_logs
      exit 1
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done
  echo "  $container is healthy"
}

echo "Waiting for all containers to become healthy..."
CONTAINERS=$(podman pod inspect "$POD_NAME" --format '{{range .Containers}}{{.Name}} {{end}}')

for container in $CONTAINERS; do
  if echo "$container" | grep -q "infra"; then
    continue
  fi
  wait_healthy "$container"
done

# The server has now migrated an empty database. A deployment to production
# starts against a database that already carries the changelog, and that is a
# different code path in the native executable: Liquibase recomputes the
# checksum of every applied changeset before anything runs, reaching
# reflection that a first migration never touches (see LiquibaseNativeHints).
# Restart the server once so the pod exercises that path too - the executable
# is serving again within a second, so this costs nothing noticeable.
echo "Restarting the server against the migrated database..."
podman restart "$POD_NAME-server" > /dev/null
wait_healthy "$POD_NAME-server"

echo "All services are ready!"
