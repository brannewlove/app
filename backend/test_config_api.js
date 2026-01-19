const http = require('http');

async function testGet() {
    return new Promise((resolve) => {
        http.get('http://localhost:3000/api/backup/config', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('GET /config:', data);
                resolve(JSON.parse(data));
            });
        });
    });
}

async function testPost(enabled) {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/backup/config',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('POST /config:', data);
                resolve(JSON.parse(data));
            });
        });
        req.write(JSON.stringify({ enabled }));
        req.end();
    });
}

async function runTests() {
    console.log('--- Testing GET ---');
    await testGet();

    console.log('\n--- Testing POST (false) ---');
    await testPost(false);

    console.log('\n--- Testing GET again ---');
    const result = await testGet();
    console.log('Final status:', result.data.auto_backup_enabled === false ? 'SUCCESS' : 'FAILED');

    console.log('\n--- Testing POST (true) ---');
    await testPost(true);
}

runTests();
