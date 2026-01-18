const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "assetdb"
};

async function dumpSchema() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);

        console.log('Fetching table list...');
        const [tables] = await connection.query('SHOW TABLES');
        let schemaSQL = `-- Database Schema Dump\n-- Generated on ${new Date().toLocaleString()}\n\n`;

        schemaSQL += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

        for (const row of tables) {
            const tableName = Object.values(row)[0];
            console.log(`Exporting table: ${tableName}`);

            const [createTableResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createTableSQL = createTableResult[0]['Create Table'];

            schemaSQL += `-- Table structure for table \`${tableName}\`\n`;
            schemaSQL += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            schemaSQL += `${createTableSQL};\n\n`;
        }

        schemaSQL += 'SET FOREIGN_KEY_CHECKS = 1;\n';

        const outputPath = path.join(__dirname, '../DB_SCHEMA.sql');
        fs.writeFileSync(outputPath, schemaSQL);
        console.log(`Schema dumped successfully to ${outputPath}`);

    } catch (err) {
        console.error('Schema dump failed:', err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

dumpSchema();
