const http = require('http');
http.get('http://localhost:3000/api/trades', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.success && json.data.length > 0) {
                console.log('API Keys:');
                Object.keys(json.data[0]).forEach(k => console.log(k));
            }
        } catch (e) { console.error(e); }
        process.exit();
    });
});
