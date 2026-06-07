const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const SSH_HOST = '91.98.150.199';
const SSH_USER = 'root';
const SSH_PASS = 'itv@6213#fred';

async function verifyVPS() {
  console.log('=============================================');
  console.log('    VERIFYING VPS CONTAINER STATUS & API     ');
  console.log('=============================================');

  try {
    console.log(`Connecting to Hetzner VPS: ${SSH_HOST}...`);
    await ssh.connect({
      host: SSH_HOST,
      username: SSH_USER,
      password: SSH_PASS
    });
    console.log('✔ Connected to VPS successfully.\n');

    // 1. Check docker container status
    console.log('--- 1. Checking Active Docker Containers ---');
    const containerRes = await ssh.execCommand('docker ps');
    console.log(containerRes.stdout || 'No containers running!');
    console.log('---------------------------------------------\n');

    // 2. Check Backend API internally
    console.log('--- 2. Checking Backend API (Internal) ---');
    console.log('Curling backend directly on port 5000 inside container...');
    const apiRes = await ssh.execCommand('docker exec itv_backend curl -s http://localhost:5000/');
    console.log(`Response: "${apiRes.stdout.trim()}"`);
    if (apiRes.stdout.includes('running') || apiRes.stdout.includes('API')) {
      console.log('✔ Success: Backend container internal health is OK.');
    } else {
      console.warn('⚠ Warning: Unexpected internal response or curl failure.');
    }
    console.log('---------------------------------------------\n');

    // 3. Check Nginx Routing
    console.log('--- 3. Checking Nginx API Routing ---');
    console.log('Curling Nginx with Host header "api.interplanetary.tv"...');
    // Nginx listens on port 80 of the host, we send a request to localhost with the API host header.
    const nginxRes = await ssh.execCommand('curl -s -H "Host: api.interplanetary.tv" http://localhost/api/media-assets');
    
    try {
      const data = JSON.parse(nginxRes.stdout);
      console.log(`✔ Success: Nginx routed correctly.`);
      console.log(`  Retrieved ${data.length} media assets from production database.`);
      if (data.length > 0) {
        console.log(`  First Asset Title: "${data[0].title}"`);
      }
    } catch (e) {
      console.error('❌ Failed: Nginx did not return valid JSON media assets.');
      console.log('Raw output:', nginxRes.stdout || '(Empty)');
      if (nginxRes.stderr) console.error('Error info:', nginxRes.stderr);
    }
    console.log('---------------------------------------------\n');

  } catch (err) {
    console.error('❌ SSH Verification failed:', err.message);
  } finally {
    ssh.dispose();
    console.log('Disconnected from VPS.');
    process.exit(0);
  }
}

verifyVPS();
