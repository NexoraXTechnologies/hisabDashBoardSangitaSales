const {
  apiGet,
  apiPost,
} = require("../../utils/apiUtils/externalApiClient.js");

const MINE_MASTER_MODULE_CODE = "CSTM-000002";
const COST_CENTER_MODULE_CODE = "CSTM-000001";

const getCustomMasterData = async ({
  moduleCode,
  dbName,
  authtoken,
  loginuser,
}) => {
  const response = await apiGet(
    "/users/customMaster/data/getAll",
    {
      dbName,
      authtoken,
      loginuser,
      params: {
        moduleCode,
        offset: 0,
        limit: 500,
      },
    }
  );

  return response;
};

const customMasterAlreadyExists = async ({
  moduleCode,
  code,
  name,
  dbName,
  authtoken,
  loginuser,
}) => {
  const response = await getCustomMasterData({
    moduleCode,
    dbName,
    authtoken,
    loginuser,
  });

  const records =
    response?.data ||
    response?.records ||
    response?.result ||
    [];

  if (!Array.isArray(records)) {
    return false;
  }

  const normalizedCode = String(code || "")
    .trim()
    .toLowerCase();

  const normalizedName = String(name || "")
    .trim()
    .toLowerCase();

  return records.some((record) => {
    const existingCode = String(
      record?.code ||
      record?.data?.code ||
      ""
    )
      .trim()
      .toLowerCase();

    const existingName = String(
      record?.name ||
      record?.data?.name ||
      ""
    )
      .trim()
      .toLowerCase();

    return (
      existingCode === normalizedCode ||
      (
        existingCode === normalizedCode &&
        existingName === normalizedName
      )
    );
  });
};
const saveCustomMasterData = async ({
  moduleCode,
  code,
  name,
  dbName,
  authtoken,
  loginuser,
}) => {
  if (!moduleCode) {
    throw new Error("moduleCode is required");
  }

  if (!code) {
    throw new Error("Custom master code is required");
  }

  if (!name) {
    throw new Error("Custom master name is required");
  }

  const payload = {
    moduleCode,
    data: {
      code,
      name,
    },
  };

  console.log(
    `[FINEZ_CUSTOM_MASTER] Saving ${moduleCode}:`,
    payload
  );

  try {
    const response = await apiPost(
      "/users/customMaster/data/save",
      payload,
      {
        dbName,
        authtoken,
        loginuser,
      }
    );

    console.log(
      `[FINEZ_CUSTOM_MASTER] Saved successfully ${moduleCode} - ${code}`
    );

    return response;
  } catch (error) {
    if (error?.status === 409) {
      console.log(
        `[FINEZ_CUSTOM_MASTER] Duplicate found. Skipping ${moduleCode} - ${code} - ${name}`
      );

      return {
        success: true,
        skipped: true,
        reason: "ALREADY_EXISTS",
        moduleCode,
        code,
        name,
      };
    }

    console.error(
      `[FINEZ_CUSTOM_MASTER] Failed to save ${moduleCode} - ${code}:`,
      error
    );

    throw error;
  }
};

const saveMineMaster = async ({
  makeMaster,
  dbName,
  authtoken,
  loginuser,
}) => {
  if (!makeMaster) {
    console.log(
      "[FINEZ_CUSTOM_MASTER] Mine Master not found. Skipping."
    );

    return null;
  }

  if (
    !makeMaster.MAKE_CODE ||
    !makeMaster.MAKE_NAME
  ) {
    console.log(
      "[FINEZ_CUSTOM_MASTER] Mine Master code/name missing. Skipping.",
      makeMaster
    );

    return null;
  }

  return saveCustomMasterData({
    moduleCode: MINE_MASTER_MODULE_CODE,
    code: makeMaster.MAKE_CODE,
    name: makeMaster.MAKE_NAME,
    dbName,
    authtoken,
    loginuser,
  });
};

const saveCostCenter = async ({
  costMaster,
  dbName,
  authtoken,
  loginuser,
}) => {
  if (!costMaster) {
    console.log(
      "[FINEZ_CUSTOM_MASTER] Cost Center not found. Skipping."
    );

    return null;
  }

  if (
    !costMaster.COST_CODE ||
    !costMaster.COST_NAME
  ) {
    console.log(
      "[FINEZ_CUSTOM_MASTER] Cost Center code/name missing. Skipping.",
      costMaster
    );

    return null;
  }

  return saveCustomMasterData({
    moduleCode: COST_CENTER_MODULE_CODE,
    code: costMaster.COST_CODE,
    name: costMaster.COST_NAME,
    dbName,
    authtoken,
    loginuser,
  });
};

const syncPurchaseOrderMastersToFinez = async ({
  purchaseOrderData,
  dbName,
  authtoken,
  loginuser,
}) => {
  if (
    !Array.isArray(purchaseOrderData) ||
    purchaseOrderData.length === 0
  ) {
    console.log(
      "[FINEZ_CUSTOM_MASTER] Purchase order data not found."
    );

    return;
  }

  for (const order of purchaseOrderData) {
    console.log(
      `[FINEZ_CUSTOM_MASTER] Syncing masters for purchase order ${order.vrno}`
    );

    await saveMineMaster({
      makeMaster: order.makeMaster,
      dbName,
      authtoken,
      loginuser,
    });

    await saveCostCenter({
      costMaster: order.costMaster,
      dbName,
      authtoken,
      loginuser,
    });

    console.log(
      `[FINEZ_CUSTOM_MASTER] Master sync completed for ${order.vrno}`
    );
  }
};

module.exports = {
  getCustomMasterData,
  customMasterAlreadyExists,
  saveCustomMasterData,
  saveMineMaster,
  saveCostCenter,
  syncPurchaseOrderMastersToFinez,
};