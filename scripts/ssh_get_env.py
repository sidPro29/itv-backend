import paramiko
import os
import time
import json
from pathlib import Path

HOST = '91.98.150.199'
USER = 'root'
PASS = 'itv@6213#fred'

CMS_DIST = r'C:\Users\siddh\AndroidStudioProjects\itv-cms\dist'
BACKEND_DIR = r'C:\Users\siddh\AndroidStudioProjects\itv-backend'

def run(client, cmd, label="", timeout=120):
    label = label or cmd[:80]
    print(f"\n>>> {label}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode(errors='replace').strip()
    err = stderr.read().decode(errors='replace').strip()
    if out: print(out[:4000])
    if err and exit_code != 0: print("ERR:", err[:500])
    print(f"[exit: {exit_code}]")
    return out, err, exit_code

def upload_file(sftp, local_path, remote_path):
    try:
        sftp.put(local_path, remote_path)
        print(f"  Uploaded: {os.path.basename(local_path)}")
    except Exception as e:
        print(f"  FAILED: {os.path.basename(local_path)} -> {e}")

def upload_dir(sftp, client, local_dir, remote_dir):
    """Recursively upload a directory"""
    run(client, f"mkdir -p {remote_dir}", f"mkdir {remote_dir}")
    for item in Path(local_dir).rglob('*'):
        if item.is_file():
            rel = item.relative_to(local_dir)
            remote_path = remote_dir + '/' + str(rel).replace('\\', '/')
            # Create parent dir
            parent = '/'.join(remote_path.split('/')[:-1])
            try:
                sftp.mkdir(parent)
            except:
                pass
            upload_file(sftp, str(item), remote_path)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=15)
print("Connected to Hetzner server")

sftp = client.open_sftp()

# ============================================================
# PART 1: Deploy itv-cms
# ============================================================
print("\n" + "="*60)
print("PART 1: Deploying itv-cms")
print("="*60)

run(client, "rm -rf /opt/itv-deploy/cms && mkdir -p /opt/itv-deploy/cms", "Clear old CMS")

print("\nUploading CMS dist files...")
upload_dir(sftp, client, CMS_DIST, '/opt/itv-deploy/cms')
print("CMS files uploaded!")

# ============================================================
# PART 2: Deploy itv-backend updated files
# ============================================================
print("\n" + "="*60)
print("PART 2: Deploying updated backend files")
print("="*60)

# Upload updated backend files
backend_files = [
    ('models/MediaAsset.js', '/opt/itv-deploy/backend/models/MediaAsset.js'),
    ('routes/mediaAssets.js', '/opt/itv-deploy/backend/routes/mediaAssets.js'),
]

for local_rel, remote_path in backend_files:
    local_full = os.path.join(BACKEND_DIR, local_rel)
    if os.path.exists(local_full):
        upload_file(sftp, local_full, remote_path)
    else:
        print(f"  NOT FOUND: {local_full}")

# Rebuild and restart backend
run(client, "cd /opt/itv-deploy && docker compose build backend 2>&1 | tail -8", "Rebuild backend Docker image", timeout=180)
run(client, "cd /opt/itv-deploy && docker compose up -d --force-recreate backend 2>&1", "Restart backend", timeout=60)

time.sleep(5)

# ============================================================
# PART 3: Collect DB structure info
# ============================================================
print("\n" + "="*60)
print("PART 3: DB Structure Info")
print("="*60)

collections = ['mediaassets', 'articles', 'users', 'plans', 'svpcaches']
for col in collections:
    out, _, _ = run(client,
        f'docker exec itv_mongodb mongosh interplanetary_tv --quiet --eval "db.{col}.countDocuments()"',
        f"{col} count"
    )

# Sample document structure from each collection
for col in ['mediaassets', 'articles', 'users', 'plans']:
    run(client,
        f'docker exec itv_mongodb mongosh interplanetary_tv --quiet --eval "JSON.stringify(Object.keys(db.{col}.findOne() || {{}}))"',
        f"{col} field names"
    )

# ============================================================
# PART 4: Verify everything works
# ============================================================
print("\n" + "="*60)
print("PART 4: Final Verification")
print("="*60)

run(client, "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'", "Docker containers")
run(client, "ls -la /opt/itv-deploy/cms/", "CMS files on server")
run(client, "docker exec itv_backend wget -qO- http://localhost:5000/api/media-assets 2>&1 | head -c 300", "API test")
run(client, "docker logs itv_backend --tail=10 2>&1", "Backend logs")

sftp.close()
client.close()
print("\nDeployment complete!")
