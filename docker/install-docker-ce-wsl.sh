#!/usr/bin/env bash
# ============================================================================
# install-docker-ce-wsl.sh
# ----------------------------------------------------------------------------
# Install Docker CE + Compose plugin inside WSL2 Ubuntu (22.04) without
# Docker Desktop. Creates a working `docker compose up` workflow for the
# ExpenseTracker local dev setup.
#
# Usage (from a WSL Ubuntu shell, NOT from PowerShell):
#   bash /mnt/d/JamProject/ExpenseTracker/docker/install-docker-ce-wsl.sh
#
# Will prompt for the sudo password. Total install time: ~2-4 min depending on
# network and whether the kernel modules need to load.
# ============================================================================
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

CURRENT_USER="${USER:-$(whoami)}"
log() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

log "Step 1/7  apt update"
sudo apt-get update -qq

log "Step 2/7  install prereqs (ca-certificates, curl, gnupg)"
sudo apt-get install -y -qq ca-certificates curl gnupg

log "Step 3/7  add Docker apt repository"
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu jammy stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

log "Step 4/7  apt update with Docker repo"
sudo apt-get update -qq

log "Step 5/7  install docker-ce + compose plugin"
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

log "Step 6/7  verify install"
docker --version
docker compose version

log "Step 7/7  start dockerd in background + add user to docker group"
sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
sleep 6
if ! docker ps >/dev/null 2>&1; then
    echo "dockerd did not start cleanly. Last 30 lines of /tmp/dockerd.log:"
    tail -n 30 /tmp/dockerd.log
    exit 1
fi
sudo usermod -aG docker "$CURRENT_USER"

cat <<EOF

\033[1;32m✓ Docker CE + Compose installed and running.\033[0m

Next steps:

  1. CLOSE this WSL session and re-open it (so the new 'docker' group
     membership applies). Then verify:
         docker ps
     It should print the header line and zero rows, NOT "permission denied".

  2. From the project root on the Windows host, bring up Postgres:
         cd /mnt/d/JamProject/ExpenseTracker
         make db-up
         docker compose -f docker/postgres.yml ps

  3. Run backend migrations:
         cd /mnt/d/JamProject/ExpenseTracker/backend
         dotnet ef database update \\
             --project src/ExpenseTracker.Infrastructure \\
             --startup-project src/ExpenseTracker.Api

  4. (Optional) Mark the Phase 0 docker checkpoint as verified in
     docs/PLAN.md.

To stop the daemon later:    sudo pkill dockerd
To start it again:           sudo nohup dockerd >/tmp/dockerd.log 2>&1 &

EOF
