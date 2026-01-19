const http = require('http');

http.get('http://localhost:3000/api/assets?onlyReplacements=true', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const parsed = JSON.parse(data);
        console.log('Success:', parsed.success);
        console.log('Count:', parsed.data.length);
        if (parsed.data.length > 0) {
            console.log('First Item:', parsed.data[0].asset_number, 'Replacement:', parsed.data[0].replacement);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
