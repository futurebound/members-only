#! /usr/bin/env node
const dotenv = require('dotenv')
dotenv.config()

const { Client } = require('pg')

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,            
  first_name VARCHAR(100) NOT NULL, 
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL,             
  is_member BOOLEAN DEFAULT FALSE, 
  is_admin BOOLEAN DEFAULT FALSE,     
  created_at TIMESTAMP DEFAULT NOW(),  
  updated_at TIMESTAMP DEFAULT NOW()   
);

INSERT INTO users 
  (first_name, last_name, email, password, is_member, is_admin) 
VALUES
  ('u1', 'u1', 'test@test.com', 'test', false, false),
  ('u', 'u2', 'test2@test.com', 'test2', true, true);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  author_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO messages 
  (title, text, author_id) 
VALUES
  ('T1', 'm1', 1),
  ('T2', 'm2', 1),
  ('T3', 'm3', 2);
`

async function main() {
  console.log('seeding...')
  const client = new Client({
    connectionString: process.env.DB_URI,
  })
  await client.connect()
  await client.query(SQL)
  await client.end()
  console.log('done')
}

main()
