const https = require('https');

function checkUrl(url, options = {}) {
  return new Promise((resolve) => {
    console.log(`Checking URL: ${url}`);
    const parsed = new URL(url);
    const req = https.get(url, {
      timeout: 10000,
      headers: {
        'Origin': 'http://localhost:5174',
        'User-Agent': 'Mozilla/5.0'
      },
      ...options
    }, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      resolve(true);
    });

    req.on('error', (err) => {
      console.error('Error fetching URL:', err.message);
      resolve(false);
    });

    req.on('timeout', () => {
      console.error('Request timed out!');
      req.destroy();
      resolve(false);
    });
  });
}

async function run() {
  await checkUrl('https://service.webvideocore.net/CL1olYogIrDWvwqiIKK7eCoSiToCqb5RE_X6Xw6pZb3iDRcRVK9tgBJ7C8kqu-3F7VMt4goqby6Ilvvt1eO06PmldaO-z8sM2K_N_FFAEoI=/a_9c5gb34w0co4.m3u8');
  process.exit(0);
}

run();
