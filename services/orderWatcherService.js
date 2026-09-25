// services/orderWatcherService.js
// → Monitors ORDER_HEAD / ORDER_BODY
// → Detects new PD orders
// → Reads ACC_CODE
// → Reads MAKE_CODE
// → Reads COST_CODE
// → Fetches ACC_MAST
// → Fetches MAKE_MAST
// → Fetches COST_MAST
// → Prepares combined master data

const oracledb = require("oracledb");

const {
  getOracleConnection,
} = require("../config/oracleDb");

let orderWatcherInterval = null;
let orderWatcherInitialized = false;

const processedOrderRecords = new Set();

// ============================================================================
// GET ORDER MASTER DATA
// ============================================================================

const getOrderMasterData = async (vrno) => {
  let connection;

  try {
    connection = await getOracleConnection();

    console.log(
      `[ORDER_WATCHER] Fetching order master references for VRNO: ${vrno}`
    );

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
      console.log(
        `[ORDER_WATCHER] No order data found for VRNO: ${vrno}`
      );

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

      let accountMaster = null;
      let makeMaster = null;
      let costMaster = null;

      if (ACC_CODE) {
        const accountResult = await connection.execute(
          `
          SELECT
            ACC_CODE,
            ACC_NAME,
            ACC_TYPE
          FROM ACC_MAST
          WHERE ACC_CODE = :accCode
          `,
          {
            accCode: ACC_CODE,
          },
          {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
          }
        );

        accountMaster =
          accountResult.rows &&
          accountResult.rows.length > 0
            ? accountResult.rows[0]
            : null;
      }

      if (MAKE_CODE) {
        const makeResult = await connection.execute(
          `
          SELECT
            MAKE_CODE,
            MAKE_NAME
          FROM MAKE_MAST
          WHERE MAKE_CODE = :makeCode
          `,
          {
            makeCode: MAKE_CODE,
          },
          {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
          }
        );

        makeMaster =
          makeResult.rows &&
          makeResult.rows.length > 0
            ? makeResult.rows[0]
            : null;
      }

      if (COST_CODE) {
        const costResult = await connection.execute(
          `
          SELECT
            COST_CODE,
            COST_NAME
          FROM COST_MAST
          WHERE COST_CODE = :costCode
          `,
          {
            costCode: COST_CODE,
          },
          {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
          }
        );

        costMaster =
          costResult.rows &&
          costResult.rows.length > 0
            ? costResult.rows[0]
            : null;
      }

      const masterData = {
        vrno: VRNO,

        orderReferences: {
          accCode: ACC_CODE,
          makeCode: MAKE_CODE,
          costCode: COST_CODE,
        },

        accountMaster,
        makeMaster,
        costMaster,
      };

      results.push(masterData);
    }

    return results;
  } catch (error) {
    console.error(
      `[ORDER_WATCHER] Failed to get master data for VRNO ${vrno}:`,
      error.message
    );

    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error(
          "[ORDER_WATCHER] Failed to release Oracle connection:",
          error.message
        );
      }
    }
  }
};

// ============================================================================
// READ CURRENT PD ORDERS
// ============================================================================

const getCurrentOrderRecords = async () => {
  let connection;

  try {
    connection = await getOracleConnection();

    const result = await connection.execute(
      `
      SELECT
        OH.VRNO,
        OH.ACC_CODE,
        OB.MAKE_CODE,
        OB.COST_CODE
      FROM ORDER_HEAD OH, ORDER_BODY OB
      WHERE OH.VRNO = OB.VRNO
        AND OH.TRANTYPE = 'PD'
      `,
      {},
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );

    return result.rows || [];
  } catch (error) {
    console.error(
      "[ORDER_WATCHER] Failed to read ORDER_HEAD / ORDER_BODY:",
      error.message
    );

    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error(
          "[ORDER_WATCHER] Failed to release watcher connection:",
          error.message
        );
      }
    }
  }
};

// ============================================================================
// CREATE UNIQUE RECORD SIGNATURE
// ============================================================================

const createOrderRecordSignature = (record) => {
  return [
    record.VRNO || "",
    record.ACC_CODE || "",
    record.MAKE_CODE || "",
    record.COST_CODE || "",
  ].join("|");
};

// ============================================================================
// INITIALIZE BASELINE
// ============================================================================

const initializeOrderWatcher = async () => {
  try {
    console.log(
      "[ORDER_WATCHER] Initializing current order baseline..."
    );

    const currentRecords =
      await getCurrentOrderRecords();

    for (const record of currentRecords) {
      const signature =
        createOrderRecordSignature(record);

      processedOrderRecords.add(signature);
    }

    orderWatcherInitialized = true;

    console.log(
      `[ORDER_WATCHER] Baseline initialized with ${processedOrderRecords.size} existing records`
    );

    console.log(
      "[ORDER_WATCHER] Existing records will not be processed"
    );
  } catch (error) {
    console.error(
      "[ORDER_WATCHER] Failed to initialize watcher:",
      error.message
    );

    throw error;
  }
};

// ============================================================================
// CHECK NEW ORDERS
// ============================================================================

const checkForNewOrderRecords = async () => {
  try {
    if (!orderWatcherInitialized) {
      return;
    }

    const currentRecords =
      await getCurrentOrderRecords();

    for (const record of currentRecords) {
      const signature =
        createOrderRecordSignature(record);

      if (
        processedOrderRecords.has(signature)
      ) {
        continue;
      }

      processedOrderRecords.add(signature);

      console.log(
        "============================================================"
      );

      console.log(
        "[ORDER_WATCHER] New ORDER_HEAD / ORDER_BODY record detected"
      );

      console.log(
        "[ORDER_WATCHER] VRNO:",
        record.VRNO
      );

      console.log(
        "[ORDER_WATCHER] ACC_CODE:",
        record.ACC_CODE
      );

      console.log(
        "[ORDER_WATCHER] MAKE_CODE:",
        record.MAKE_CODE
      );

      console.log(
        "[ORDER_WATCHER] COST_CODE:",
        record.COST_CODE
      );

      try {
        const masterData =
          await getOrderMasterData(record.VRNO);

        console.log(
          "[ORDER_WATCHER] Master data:"
        );

        console.dir(
          masterData,
          {
            depth: null,
          }
        );

        // ⭐ NEXT STEP:
        // Send this data to BookEZ API
        //
        // await sendOrderToBookEZ(masterData);

      } catch (error) {
        console.error(
          `[ORDER_WATCHER] Failed processing VRNO ${record.VRNO}:`,
          error.message
        );
      }

      console.log(
        "============================================================"
      );
    }
  } catch (error) {
    console.error(
      "[ORDER_WATCHER] Polling error:",
      error.message
    );
  }
};

// ============================================================================
// START WATCHER
// ============================================================================

const startOrderWatcher = async () => {
  try {
    if (orderWatcherInterval) {
      console.log(
        "[ORDER_WATCHER] Watcher already running"
      );

      return;
    }

    const intervalMs = Number(
      process.env.ORDER_WATCH_INTERVAL_MS ||
        5000
    );

    await initializeOrderWatcher();

    console.log(
      `[ORDER_WATCHER] Watching ORDER_HEAD and ORDER_BODY every ${intervalMs}ms`
    );

    orderWatcherInterval = setInterval(
      async () => {
        await checkForNewOrderRecords();
      },
      intervalMs
    );
  } catch (error) {
    console.error(
      "[ORDER_WATCHER] Failed to start watcher:",
      error.message
    );

    throw error;
  }
};

// ============================================================================
// STOP WATCHER
// ============================================================================

const stopOrderWatcher = () => {
  if (!orderWatcherInterval) {
    return;
  }

  clearInterval(orderWatcherInterval);

  orderWatcherInterval = null;

  console.log(
    "[ORDER_WATCHER] Order watcher stopped"
  );
};

module.exports = {
  getOrderMasterData,
  startOrderWatcher,
  stopOrderWatcher,
};