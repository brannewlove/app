const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../backend/utils/db');
const fs = require('fs');

async function dumpSchema() {
    try {
        const [tables] = await pool.query('SHOW TABLES');
        let schemaSQL = `-- Database Schema Dump\n-- Generated on ${new Date().toLocaleString()}\n\n`;

        // Disable foreign key checks to avoid ordering issues
        schemaSQL += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

        for (const row of tables) {
            const tableName = Object.values(row)[0];
            console.log(`Exporting table: ${tableName}`);

            const [createTableResult] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createTableSQL = createTableResult[0]['Create Table'];

            schemaSQL += `-- Table structure for table \`${tableName}\`\n`;
            schemaSQL += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            schemaSQL += `${createTableSQL};\n\n`; // createTableSQL already ends with a parenthesis but no semicolon usually? Actually SHOW CREATE TABLE output usually does not have trailing semicolon.
        }

        schemaSQL += 'SET FOREIGN_KEY_CHECKS = 1;\n';

        const outputPath = path.join(__dirname, '..', 'DB_SCHEMA.sql');
        fs.writeFileSync(outputPath, schemaSQL);
        console.log(`Schema dumped successfully to ${outputPath}`);
        process.exit(0);

    } catch (err) {
        console.error('Schema dump failed:', err);
        process.exit(1);
    }
}

dumpSchema();
