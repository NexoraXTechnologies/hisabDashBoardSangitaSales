const oracledb = require("oracledb");

const {
  getOracleConnection,
} = require("../../config/oracleDb");

const getMakeMasterByCode = async (makeCode) => {
  let connection;

  try {
    if (!makeCode) {
      return null;
    }

    connection = await getOracleConnection();

    const result = await connection.execute(
      `
      SELECT
        MAKE_CODE,
        MAKE_NAME
      FROM MAKE_MAST
      WHERE MAKE_CODE = :makeCode
      `,
      {
        makeCode,
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );

    return result.rows && result.rows.length > 0
      ? result.rows[0]
      : null;
  } catch (error) {
    console.error(
      `[MAKE_MASTER] Failed to fetch MAKE_CODE ${makeCode}:`,
      error.message
    );

    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
};

module.exports = {
  getMakeMasterByCode,
};