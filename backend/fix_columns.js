const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

(async () => {
    const config = {
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || 'IClwx6F2VTbLZsEx',
        database: 'assetdb',
        port: 3306
    };

    try {
        const conn = await mysql.createConnection(config);
        console.log('Connected.');

        // Fix confirmed_assets
        try {
            const [cols] = await conn.query("SHOW COLUMNS FROM confirmed_assets LIKE 'asset_id'");
            if (cols.length > 0) {
                console.log('Renaming asset_id to asset_number in confirmed_assets...');
                await conn.query("ALTER TABLE confirmed_assets CHANGE asset_id asset_number VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
                console.log('confirmed_assets fixed.');
            } else {
                console.log('confirmed_assets already has correct columns (or assert_id missing).');
            }
        } catch (e) {
            console.log('confirmed_assets fix error:', e.message);
        }

        // Fix trade
        try {
            const [cols] = await conn.query("SHOW COLUMNS FROM trade LIKE 'asset_id'");
            if (cols.length > 0) {
                console.log('Renaming asset_id to asset_number in trade...');
                await conn.query("ALTER TABLE trade CHANGE asset_id asset_number VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
                console.log('trade fixed.');
            } else {
                console.log('trade already has correct columns (or asset_id missing).');
            }
        } catch (e) {
            console.log('trade fix error:', e.message);
        }

        // Verify
        const [cCols] = await conn.query("SHOW COLUMNS FROM confirmed_assets");
        console.log('confirmed_assets cols:', cCols.map(c => c.Field).join(', '));
        const [tCols] = await conn.query("SHOW COLUMNS FROM trade");
        console.log('trade cols:', tCols.map(c => c.Field).join(', '));

        conn.end();
    } catch (e) {
        console.log('Init Error:', e.message);
    }
})();
