const http = require('http');
http.get('http://localhost:3000/api/trades', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        if (json.success && json.data.length > 0) {
            console.log('Keys in API response:');
            console.log(Object.keys(json.data[0]).join(','));
        }
        process.exit();
    });
});
