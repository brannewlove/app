const mysql = require('mysql2/promise');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

async function exportSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [tables] = await connection.query(`SHOW TABLES`);
        const dbName = process.env.DB_NAME;
        const tableKey = `Tables_in_${dbName}`;

        let schemaContent = `-- Database Schema Export\n-- Generated on: ${new Date().toLocaleString()}\n\n`;
        schemaContent += `CREATE DATABASE IF NOT EXISTS \`${dbName}\`;\nUSE \`${dbName}\`;\n\n`;
        schemaContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

        for (const tableRow of tables) {
            const tableName = tableRow[tableKey];
            const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            schemaContent += `-- Table structure for table \`${tableName}\`\n`;
            schemaContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            schemaContent += createTable[0]['Create Table'] + ';\n\n';
        }

        schemaContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;

        const outputPath = path.join(__dirname, 'DB_SCHEMA.sql');
        await fs.writeFile(outputPath, schemaContent);
        console.log(`Schema successfully exported to: ${outputPath}`);
    } catch (err) {
        console.error('Error exporting schema:', err);
    } finally {
        await connection.end();
    }
}

exportSchema();
