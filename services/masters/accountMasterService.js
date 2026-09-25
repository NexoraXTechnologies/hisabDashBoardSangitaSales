const oracledb = require("oracledb");

const {
  getOracleConnection,
} = require("../../config/oracleDb");

const getAccountMasterByCode = async (accCode) => {
  let connection;

  try {
    if (!accCode) {
      return null;
    }

    connection = await getOracleConnection();

    const result = await connection.execute(
      `
      SELECT
        ACC_CODE,
        ACC_NAME,
        ACC_TYPE
      FROM ACC_MAST
      WHERE ACC_CODE = :accCode
      `,
      {
        accCode,
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
      `[ACCOUNT_MASTER] Failed to fetch ACC_CODE ${accCode}:`,
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
  getAccountMasterByCode,
};