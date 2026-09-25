const oracledb = require("oracledb");

let pool = null;

// ⭐ Oracle 11g requires node-oracledb Thick mode
const initializeOracleClient = () => {
  try {
    const clientLibDir = process.env.ORACLE_CLIENT_LIB_DIR;

    if (!clientLibDir) {
      throw new Error(
        "ORACLE_CLIENT_LIB_DIR is not configured. Oracle 11g requires Oracle Thick mode."
      );
    }

    oracledb.initOracleClient({
      libDir: clientLibDir,
    });

    console.log("[ORACLE_DB] Oracle Client initialized successfully");
    console.log("[ORACLE_DB] Mode: Thick");
    console.log("[ORACLE_DB] Client Library:", clientLibDir);
  } catch (error) {
    console.error(
      "[ORACLE_DB] Failed to initialize Oracle Client:",
      error.message
    );

    throw error;
  }
};

// ⭐ IMPORTANT:
// initOracleClient must run BEFORE createPool/getConnection
initializeOracleClient();

const initializeOraclePool = async () => {
  try {
    if (pool) {
      console.log("[ORACLE_DB] Connection pool already initialized");

      return pool;
    }

    const host = process.env.ORACLE_DB_HOST;
    const port = process.env.ORACLE_DB_PORT || "1521";
    const serviceName = process.env.ORACLE_DB_SERVICE_NAME;
    const user = process.env.ORACLE_DB_USER;
    const password = process.env.ORACLE_DB_PASSWORD;

    const connectString = `${host}:${port}/${serviceName}`;

    console.log("[ORACLE_DB] Initializing Oracle connection pool...");
    console.log("[ORACLE_DB] Host:", host);
    console.log("[ORACLE_DB] Port:", port);
    console.log("[ORACLE_DB] Service:", serviceName);
    console.log("[ORACLE_DB] Connect String:", connectString);

    pool = await oracledb.createPool({
      user,
      password,
      connectString,

      poolMin: Number(
        process.env.ORACLE_DB_POOL_MIN || 1
      ),

      poolMax: Number(
        process.env.ORACLE_DB_POOL_MAX || 5
      ),

      poolIncrement: Number(
        process.env.ORACLE_DB_POOL_INCREMENT || 1
      ),
    });

    console.log(
      "[ORACLE_DB] Connection pool initialized successfully"
    );

    return pool;
  } catch (error) {
    console.error(
      "[ORACLE_DB] Failed to initialize connection pool:",
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

    const connection = await pool.getConnection();

    console.log(
      "[ORACLE_DB] Connection acquired successfully"
    );

    return connection;
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
      "[ORACLE_DB] Database connection test successful"
    );

    console.log(
      "[ORACLE_DB] Test result:",
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
      try {
        await connection.close();

        console.log(
          "[ORACLE_DB] Test connection released"
        );
      } catch (error) {
        console.error(
          "[ORACLE_DB] Failed to release test connection:",
          error.message
        );
      }
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

    console.log(
      "[ORACLE_DB] Connection pool closed successfully"
    );
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
};1 ``