// IMPORTANT: This is a placeholder file and will not work out of the box.
// You will need to install a MySQL client library like 'mysql2'
// and manage your credentials securely using environment variables.

// Example of installing the required package:
// npm install mysql2

// Example of setting up environment variables in a .env.local file:
// DB_HOST=your-rds-endpoint.amazonaws.com
// DB_USER=your-username
// DB_PASSWORD=your-password
// DB_DATABASE=your-database-name

import mysql from 'mysql2/promise';

// Basic connection configuration
// It is strongly recommended to use environment variables for sensitive data.
const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  // Add a connection timeout to prevent long waits
  connectTimeout: 5000, 
};

let connection: mysql.Connection | null = null;

/**
 * Establishes a connection to the database. It does not reuse connections.
 * @returns A promise that resolves to the database connection object.
 */
export async function getDbConnection() {
    if (!process.env.DB_HOST) {
        throw new Error('Database configuration is missing. Please check your .env.local file.');
    }
    try {
      const newConnection = await mysql.createConnection(connectionConfig);
      connection = newConnection;
      return connection;
    } catch (error) {
      console.error('Error connecting to the database:', error);
      // Re-throw the error so it can be caught by the caller
      throw error;
    }
}

/**
 * Closes the current database connection if it exists.
 */
export async function closeDbConnection() {
    if (connection) {
        await connection.end();
        connection = null;
    }
}


/**
 * Example function to query the database.
 * NOTE: You would call this from your server-side code (e.g., in API Routes or Server Actions).
 * @param query The SQL query string.
 * @param params Optional parameters for the query.
 * @returns A promise that resolves to the query results.
 */
export async function queryDatabase(query: string, params: any[] = []) {
  const conn = await getDbConnection();
  try {
    const [results] = await conn.execute(query, params);
    return results;
  } catch (error) {
    console.error('Error executing query:', error);
    // In a real application, you might want to throw the error
    // or return a more specific error message.
    throw new Error('Database query failed.');
  } finally {
      if (conn) {
          await conn.end();
      }
  }
}

// Example usage (for demonstration purposes):
/*
async function getItems() {
  try {
    const results = await queryDatabase('SELECT * FROM inventory_items');
    console.log(results);
  } catch (error) {
    console.error(error);
  }
}
*/
