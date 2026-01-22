const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initDefaultFilters() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'assetdb',
    };

    const pool = mysql.createPool(dbConfig);
    try {
        const defaults = [
            {
                name: '가용재고',
                page_context: 'assets',
                filter_data: JSON.stringify({ searchQuery: '가용재고', is_protected: true }),
                sort_order: -2
            },
            {
                name: '1인 다PC사용자',
                page_context: 'assets',
                filter_data: JSON.stringify({ searchQuery: '1인 다PC사용자', is_protected: true }),
                sort_order: -1
            }
        ];

        for (const f of defaults) {
            const [existing] = await pool.query('SELECT id FROM saved_filters WHERE name = ? AND page_context = ?', [f.name, f.page_context]);
            if (existing.length === 0) {
                await pool.query('INSERT INTO saved_filters (name, page_context, filter_data, sort_order) VALUES (?, ?, ?, ?)',
                    [f.name, f.page_context, f.filter_data, f.sort_order]);
                console.log(`Inserted default filter: ${f.name}`);
            } else {
                console.log(`Filter already exists: ${f.name}`);
            }
        }
    } catch (err) {
        console.error('Error initializing default filters:', err);
    } finally {
        await pool.end();
    }
}

initDefaultFilters();
