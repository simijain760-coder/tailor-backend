#!/usr/bin/env node

// ============================================
// Setup Tailor Software Database on Aiven
// Using Node.js for SSL support
// ============================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupDatabase() {
  //console.log('🚀 Setting up Tailor Software database on Aiven...\n');

  // Get password from user
  const password = await question('Enter your Aiven MySQL password: ');
  //console.log('');

  // Aiven MySQL Connection Details
  const config = {
    host: 'tailor-app-simijain760-6a6f.d.aivencloud.com',
    port: 24456,
    user: 'avnadmin',
    password: password,
    database: 'defaultdb',
    ssl: {
      rejectUnauthorized: false  // Allow self-signed certificates
    },
    multipleStatements: true  // Allow multiple SQL statements
  };

  try {
    // Test connection
    //console.log('📡 Testing connection to Aiven...');
    const connection = await mysql.createConnection(config);
    await connection.execute('SELECT 1');
    //console.log('✅ Connected successfully!\n');

    // Read schema file
    //console.log('📖 Reading database schema...');
    let schema = fs.readFileSync('../database_schema_mysql.sql', 'utf8');
    //console.log('✅ Schema loaded!\n');

    // Remove DELIMITER statements and change // to ; (not supported in Node.js)
    schema = schema.replace(/^\s*DELIMITER.*$/gm, '');
    schema = schema.replace(/\/\/\s*$/gm, ';');

    // Execute schema
    //console.log('📊 Importing database schema...');
    await connection.query(schema);
    //console.log('✅ Database schema imported successfully!\n');

    // Close connection
    await connection.end();
    //console.log('🎉 Setup complete! Your tailor software is ready to use with Aiven!\n');

  } catch (error) {
    //console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setupDatabase();

