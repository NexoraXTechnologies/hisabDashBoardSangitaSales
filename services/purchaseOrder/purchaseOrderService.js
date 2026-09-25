const oracledb = require("oracledb");

const {
  getOracleConnection,
} = require("../../config/oracleDb");

const {
  getAccountMasterByCode,
} = require("../masters/accountMasterService");

const {
  getMakeMasterByCode,
} = require("../masters/makeMasterService");

const {
  getCostMasterByCode,
} = require("../masters/costMasterService");

const getPurchaseOrderData = async (vrno) => {
  let connection;

  try {
    connection = await getOracleConnection();

    const orderResult = await connection.execute(
      `
      SELECT
        OH.VRNO,
        OH.ACC_CODE,
        OB.MAKE_CODE,
        OB.COST_CODE
      FROM ORDER_HEAD OH, ORDER_BODY OB
      WHERE OH.VRNO = OB.VRNO
        AND OH.TRANTYPE = 'PD'
        AND OH.VRNO = :vrno
      `,
      {
        vrno,
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );

    if (!orderResult.rows || orderResult.rows.length === 0) {
      return [];
    }

    const results = [];

    for (const order of orderResult.rows) {
      const {
        VRNO,
        ACC_CODE,
        MAKE_CODE,
        COST_CODE,
      } = order;

      const [
        accountMaster,
        makeMaster,
        costMaster,
      ] = await Promise.all([
        getAccountMasterByCode(ACC_CODE),
        getMakeMasterByCode(MAKE_CODE),
        getCostMasterByCode(COST_CODE),
      ]);

      results.push({
        vrno: VRNO,

        orderReferences: {
          accCode: ACC_CODE,
          makeCode: MAKE_CODE,
          costCode: COST_CODE,
        },

        accountMaster,
        makeMaster,
        costMaster,
      });
    }

    return results;
  } catch (error) {
    console.error(
      `[PURCHASE_ORDER] Failed to fetch order ${vrno}:`,
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
  getPurchaseOrderData,
};