const oracledb = require("oracledb");

const {
  getOracleConnection,
} = require("../../config/oracleDb");

const getCostMasterByCode = async (costCode) => {
  let connection;

  try {
    if (!costCode) {
      return null;
    }

    connection = await getOracleConnection();

    const result = await connection.execute(
      `
      SELECT
        COST_CODE,
        COST_NAME
      FROM COST_MAST
      WHERE COST_CODE = :costCode
      `,
      {
        costCode,
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
      `[COST_MASTER] Failed to fetch COST_CODE ${costCode}:`,
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
  getCostMasterByCode,
};