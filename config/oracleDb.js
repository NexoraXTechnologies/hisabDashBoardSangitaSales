const oracledb = require("oracledb");

let pool = null;

if (
  process.platform === "win32" &&
  process.env.ORACLE_CLIENT_LIB_DIR
) {
  try {
    oracledb.initOracleClient({
      libDir: process.env.ORACLE_CLIENT_LIB_DIR,
    });

    console.log("[ORACLE_DB] Oracle Thick mode initialized");
  } catch (error) {
    console.error(
      "[ORACLE_DB] Failed to initialize Oracle Client:",
      error.message
    );

    throw error;
  }
}

const initializeOraclePool = async () => {
  try {
    if (pool) {
      return pool;
    }

    const host = process.env.ORACLE_DB_HOST;
    const port = process.env.ORACLE_DB_PORT || "1521";
    const serviceName = process.env.ORACLE_DB_SERVICE_NAME;
    const user = process.env.ORACLE_DB_USER;
    const password = process.env.ORACLE_DB_PASSWORD;

    const connectString = `${host}:${port}/${serviceName}`;

    console.log("[ORACLE_DB] Initializing connection pool");
    console.log("[ORACLE_DB] Host:", host);
    console.log("[ORACLE_DB] Port:", port);
    console.log("[ORACLE_DB] Service:", serviceName);

    pool = await oracledb.createPool({
      user,
      password,
      connectString,
      poolMin: Number(process.env.ORACLE_DB_POOL_MIN || 1),
      poolMax: Number(process.env.ORACLE_DB_POOL_MAX || 5),
      poolIncrement: Number(
        process.env.ORACLE_DB_POOL_INCREMENT || 1
      ),
    });

    console.log("[ORACLE_DB] Connection pool initialized successfully");

    return pool;
  } catch (error) {
    console.error(
      "[ORACLE_DB] Pool initialization failed:",
      error.message
    );

    throw error;
  }
};

const getOracleConnection = async () => {
  try {
    if (!pool) {
      await initializeOraclePool();
    }

    return await pool.getConnection();
  } catch (error) {
    console.error(
      "[ORACLE_DB] Failed to get connection:",
      error.message
    );

    throw error;
  }
};

const testOracleConnection = async () => {
  let connection;

  try {
    connection = await getOracleConnection();

    const result = await connection.execute(
      `SELECT 1 FROM DUAL`
    );

    console.log(
      "[ORACLE_DB] Database connection test successful:",
      result.rows
    );

    return true;
  } catch (error) {
    console.error(
      "[ORACLE_DB] Database connection test failed:",
      error.message
    );

    return false;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
};

const closeOraclePool = async () => {
  try {
    if (!pool) {
      return;
    }

    await pool.close(10);

    pool = null;

    console.log("[ORACLE_DB] Connection pool closed");
  } catch (error) {
    console.error(
      "[ORACLE_DB] Failed to close connection pool:",
      error.message
    );

    throw error;
  }
};

module.exports = {
  initializeOraclePool,
  getOracleConnection,
  testOracleConnection,
  closeOraclePool,
};