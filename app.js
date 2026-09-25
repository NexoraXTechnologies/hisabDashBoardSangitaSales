const express = require("express");
const cors = require("cors");

require("dotenv").config();

const {
  initializeOraclePool,
  testOracleConnection,
  closeOraclePool,
} = require("./config/oracleDb");

const {
  startOrderWatcher,
  stopOrderWatcher,
} = require("./services/watchers/purchaseOrderWatcher");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5050;

let oracleConnected = false;

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Oracle Integration Server is running",
    oracle: oracleConnected ? "connected" : "disconnected",
  });
});

app.get("/health", async (req, res) => {
  try {
    const connectionStatus = await testOracleConnection();

    oracleConnected = connectionStatus;

    if (!connectionStatus) {
      return res.status(503).json({
        success: false,
        message: "Oracle Integration Server is running but Oracle Database is disconnected",
        oracle: "disconnected",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Oracle Integration Server is healthy",
      oracle: "connected",
    });
  } catch (error) {
    oracleConnected = false;

    return res.status(500).json({
      success: false,
      message: "Health check failed",
      oracle: "disconnected",
      error: error.message,
    });
  }
});

const connectOracleDatabase = async () => {
  try {
    console.log("[ORACLE_DB] Connecting to Oracle Database...");

    await initializeOraclePool();

    const connectionStatus = await testOracleConnection();

    if (!connectionStatus) {
      oracleConnected = false;

      console.error(
        "[ORACLE_DB] Oracle Database connection failed"
      );

      return;
    }

    oracleConnected = true;

    console.log(
      "[ORACLE_DB] Oracle Database connected successfully"
    );

    // ⭐ Start Purchase Order watcher only after Oracle is connected
    await startOrderWatcher();
  } catch (error) {
    oracleConnected = false;

    console.error(
      "[ORACLE_DB] Failed to connect Oracle Database:",
      error.message
    );
  }
};

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[SERVER] Oracle Integration Server running on port ${PORT}`
  );

  connectOracleDatabase();
});

const shutdown = async (signal) => {
  try {
    console.log(`[SERVER] ${signal} received`);

    server.close(() => {
      console.log("[SERVER] HTTP server closed");
    });

    // ⭐ Stop watcher before closing Oracle pool
    stopOrderWatcher();

    await closeOraclePool();

    console.log("[SERVER] Shutdown completed");
  } catch (error) {
    console.error(
      "[SERVER] Shutdown failed:",
      error.message
    );
  } finally {
    process.exit(0);
  }
};

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});

module.exports = app;