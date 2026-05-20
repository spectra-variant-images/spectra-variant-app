#!/usr/bin/env node

// Wait for PostgreSQL database to be ready
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = new Client({ connectionString });

async function waitForDb() {
  let retries = 30; // 30 seconds max
  const delay = 1000;

  for (let i = 0; i < retries; i++) {
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('Database is ready!');
      process.exit(0);
    } catch (err) {
      console.log(`Database not ready yet... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.error('Database failed to connect after retries');
  process.exit(1);
}

waitForDb();
