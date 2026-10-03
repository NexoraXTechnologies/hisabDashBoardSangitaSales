const {
  getCurrentGrnRecords,
} = require("../grn/grnService");

const {
  sendGrnToBookEZ,
} = require("../finez/finezGrnService");

let grnWatcherInterval = null;
let grnWatcherInitialized = false;
let grnWatcherRunning = false;

const processedGrnRecords = new Set();


// ★★★ CREATE GRN SIGNATURE
const createGrnRecordSignature = (record) => {
  return [
    record.VRNO || "",
    record.ACC_CODE || "",
  ].join("|");
};


// ★★★ INITIALIZE GRN WATCHER BASELINE
const initializeGrnWatcher = async () => {
  const currentRecords =
    await getCurrentGrnRecords();

  for (const record of currentRecords) {
    processedGrnRecords.add(
      createGrnRecordSignature(record)
    );
  }

  grnWatcherInitialized = true;

  console.log(
    `[GRN_WATCHER] Baseline initialized with ${processedGrnRecords.size} records`
  );
};


// ★★★ CHECK NEW GRN RECORDS
const checkForNewGrnRecords = async () => {
  if (!grnWatcherInitialized) {
    return;
  }

  // ★ Prevent overlapping watcher executions
  if (grnWatcherRunning) {
    console.log(
      "[GRN_WATCHER] Previous check still running. Skipping this cycle."
    );

    return;
  }

  grnWatcherRunning = true;

  try {
    const currentRecords =
      await getCurrentGrnRecords();

    for (const record of currentRecords) {
      const signature =
        createGrnRecordSignature(record);

      if (
        processedGrnRecords.has(signature)
      ) {
        continue;
      }

      console.log(
        `[GRN_WATCHER] New GRN detected: ${record.VRNO}`
      );

      try {
        // ★ Send GRN to BookEZ
        await sendGrnToBookEZ({
          vrno:
            record.VRNO,

          dbName:
            process.env.FINEZ_DB_NAME,

          authtoken:
            process.env.FINEZ_AUTH_TOKEN,

          loginuser:
            process.env.FINEZ_LOGIN_USER,
        });

        // ★ Mark processed only after success
        processedGrnRecords.add(
          signature
        );

        console.log(
          `[GRN_WATCHER] GRN processed successfully: ${record.VRNO}`
        );
      } catch (error) {
        console.error(
          `[GRN_WATCHER] Failed to process GRN ${record.VRNO}:`,
          error
        );

        // ★ Do not mark processed here
        // ★ It will retry in the next watcher cycle
      }
    }
  } finally {
    grnWatcherRunning = false;
  }
};


// ★★★ START GRN WATCHER
const startGrnWatcher = async () => {
  if (grnWatcherInterval) {
    return;
  }

  const intervalMs = Number(
    process.env.GRN_WATCH_INTERVAL_MS ||
      5000
  );

  await initializeGrnWatcher();

  grnWatcherInterval =
    setInterval(() => {
      checkForNewGrnRecords().catch(
        (error) => {
          console.error(
            "[GRN_WATCHER] Error while checking new GRN records:",
            error
          );
        }
      );
    }, intervalMs);

  console.log(
    `[GRN_WATCHER] Started with ${intervalMs}ms interval`
  );
};


// ★★★ STOP GRN WATCHER
const stopGrnWatcher = () => {
  if (!grnWatcherInterval) {
    return;
  }

  clearInterval(
    grnWatcherInterval
  );

  grnWatcherInterval = null;

  console.log(
    "[GRN_WATCHER] Stopped"
  );
};


module.exports = {
  startGrnWatcher,
  stopGrnWatcher,
};