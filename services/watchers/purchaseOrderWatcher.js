const oracledb = require("oracledb");

const {
  getOracleConnection,
} = require("../../config/oracleDb");

const {
  getPurchaseOrderData,
} = require("../purchaseOrder/purchaseOrderService");

let orderWatcherInterval = null;
let orderWatcherInitialized = false;

const processedOrderRecords = new Set();

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
  } finally {
    if (connection) {
      await connection.close();
    }
  }
};

const createOrderRecordSignature = (record) => {
  return [
    record.VRNO || "",
    record.ACC_CODE || "",
    record.MAKE_CODE || "",
    record.COST_CODE || "",
  ].join("|");
};

const initializeOrderWatcher = async () => {
  const currentRecords = await getCurrentOrderRecords();

  for (const record of currentRecords) {
    processedOrderRecords.add(
      createOrderRecordSignature(record)
    );
  }

  orderWatcherInitialized = true;

  console.log(
    `[ORDER_WATCHER] Baseline initialized with ${processedOrderRecords.size} records`
  );
};

const checkForNewOrderRecords = async () => {
  if (!orderWatcherInitialized) {
    return;
  }

  const currentRecords = await getCurrentOrderRecords();

  for (const record of currentRecords) {
    const signature =
      createOrderRecordSignature(record);

    if (processedOrderRecords.has(signature)) {
      continue;
    }

    processedOrderRecords.add(signature);

    console.log(
      `[ORDER_WATCHER] New purchase order detected: ${record.VRNO}`
    );

    const purchaseOrderData =
      await getPurchaseOrderData(record.VRNO);

    console.dir(
      purchaseOrderData,
      {
        depth: null,
      }
    );

    // ⭐ Future
    // await sendPurchaseOrderToBookEZ(purchaseOrderData);
  }
};

const startOrderWatcher = async () => {
  if (orderWatcherInterval) {
    return;
  }

  const intervalMs = Number(
    process.env.ORDER_WATCH_INTERVAL_MS || 5000
  );

  await initializeOrderWatcher();

  orderWatcherInterval = setInterval(
    checkForNewOrderRecords,
    intervalMs
  );

  console.log(
    `[ORDER_WATCHER] Started with ${intervalMs}ms interval`
  );
};

const stopOrderWatcher = () => {
  if (!orderWatcherInterval) {
    return;
  }

  clearInterval(orderWatcherInterval);

  orderWatcherInterval = null;

  console.log("[ORDER_WATCHER] Stopped");
};

module.exports = {
  startOrderWatcher,
  stopOrderWatcher,
};