
const oracledb = require("oracledb");

const {
  getOracleConnection,
} = require("../../config/oracleDb");


// ★★★ GET GRN TRANSACTION DATA BY VRNO
const getGrnTransactionData = async (vrno) => {
  let connection;

  try {
    if (!vrno) {
      throw new Error(
        "GRN VRNO is required"
      );
    }

    console.log(
      "============================================================"
    );

    console.log(
      `[GRN_SERVICE] Fetching GRN data for VRNO: ${vrno}`
    );

    console.log(
      "============================================================"
    );

    connection =
      await getOracleConnection();

    const result =
      await connection.execute(
        `
        SELECT
          GRNH.VRNO,
          GRNH.VRDATE,
          GRNH.ACC_CODE,
          GRNH.TRUCKNO,
          GRNH.AFRATE8,

          GRNB.MAKE_CODE,
          GRNB.COST_CODE,
          GRNB.ITEM_CODE,
          GRNB.QTYRECD,
          GRNB.RATE,
          GRNB.TAX_ONAMOUNT,
          GRNB.ORDER_VRNO,
          GRNB.AFIELD3,
          GRNB.AFIELD4,
          GRNB.AFIELD5,
          GRNB.AFIELD8,
          GRNB.AFIELD9

        FROM
          ITEMTRAN_HEAD GRNH,
          ITEMTRAN_BODY GRNB

        WHERE
          GRNH.VRNO = GRNB.VRNO

          AND GRNH.TRANTYPE = 'PD'

          AND GRNH.TCODE = 'G'

          AND GRNB.ITEM_CODE IN ('T01010001')

          AND GRNH.VRNO = :vrno

        ORDER BY
          GRNH.VRNO
        `,
        {
          vrno,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const rows =
      result?.rows || [];

    console.log(
      `[GRN_SERVICE] ${rows.length} GRN row(s) found for VRNO: ${vrno}`
    );

    if (rows.length > 0) {
      console.log(
        "[GRN_SERVICE] Oracle GRN data:"
      );

      console.dir(
        rows,
        {
          depth: null,
        }
      );
    }

    return rows;
  } catch (error) {
    console.error(
      `[GRN_SERVICE] Failed to fetch GRN ${vrno}:`,
      error
    );

    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();

        console.log(
          `[GRN_SERVICE] Oracle connection closed for GRN: ${vrno}`
        );
      } catch (closeError) {
        console.error(
          "[GRN_SERVICE] Failed to close Oracle connection:",
          closeError
        );
      }
    }
  }
};


// ★★★ GET ALL CURRENT GRN RECORDS
// ★ Used later by GRN watcher for baseline/new GRN detection
const getCurrentGrnRecords = async () => {
  let connection;

  try {
    console.log(
      "[GRN_SERVICE] Fetching current GRN records..."
    );

    connection =
      await getOracleConnection();

    const result =
      await connection.execute(
        `
        SELECT DISTINCT
          GRNH.VRNO,
          GRNH.VRDATE,
          GRNH.ACC_CODE,
          GRNH.TRUCKNO,
          GRNH.AFRATE8
        FROM
          ITEMTRAN_HEAD GRNH,
          ITEMTRAN_BODY GRNB
        WHERE
          GRNH.VRNO = GRNB.VRNO
          AND GRNH.TRANTYPE = 'PD'
          AND GRNH.TCODE = 'G'
          AND GRNB.ITEM_CODE IN ('T01010001')
        ORDER BY
          GRNH.VRNO
        `,
        {},
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const rows =
      result?.rows || [];

    console.log(
      `[GRN_SERVICE] ${rows.length} current GRN(s) found`
    );

    return rows;
  } catch (error) {
    console.error(
      "[GRN_SERVICE] Failed to fetch current GRN records:",
      error
    );

    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error(
          "[GRN_SERVICE] Failed to close Oracle connection:",
          closeError
        );
      }
    }
  }
};


module.exports = {
  getGrnTransactionData,
  getCurrentGrnRecords,
};