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

// ⭐ ACCOUNT MASTER START


const getVendorAccounts = async ({
  dbName,
  authtoken,
  loginuser,
  offset = 0,
  limit = 100,
}) => {
  const response = await apiGet(
    "/accountMaster/getAllAccounts",
    {
      dbName,
      authtoken,
      loginuser,
      params: {
        offset,
        limit,
        accountType: "vendor",
      },
    }
  );

  return response;
};

const accountMasterAlreadyExists = async ({
  accCode,
  dbName,
  authtoken,
  loginuser,
}) => {
  if (!accCode) {
    return false;
  }

  const normalizedAccCode = String(accCode)
    .trim()
    .toLowerCase();

  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await getVendorAccounts({
      dbName,
      authtoken,
      loginuser,
      offset,
      limit,
    });

    const items =
      response?.data?.items ||
      [];

    const alreadyExists = items.some((account) => {
      const existingLhsAccCode = String(
        account?.dynamicFields?.LHSACCCode ||
        ""
      )
        .trim()
        .toLowerCase();

      return existingLhsAccCode === normalizedAccCode;
    });

    if (alreadyExists) {
      return true;
    }

    const hasNextPage =
      response?.data?.pagination?.hasNextPage === true;

    if (!hasNextPage) {
      return false;
    }

    offset += limit;
  }
};

const saveAccountMaster = async ({
  accountMaster,
  dbName,
  authtoken,
  loginuser,
}) => {
  if (!accountMaster) {
    console.log(
      "[FINEZ_ACCOUNT_MASTER] Account Master not found. Skipping."
    );

    return null;
  }

  if (
    !accountMaster.ACC_CODE ||
    !accountMaster.ACC_NAME
  ) {
    console.log(
      "[FINEZ_ACCOUNT_MASTER] Account code/name missing. Skipping.",
      accountMaster
    );

    return null;
  }

  const alreadyExists =
    await accountMasterAlreadyExists({
      accCode: accountMaster.ACC_CODE,
      dbName,
      authtoken,
      loginuser,
    });

  if (alreadyExists) {
    console.log(
      `[FINEZ_ACCOUNT_MASTER] Duplicate found by LHSACCCode. Skipping ${accountMaster.ACC_CODE} - ${accountMaster.ACC_NAME}`
    );

    return {
      success: true,
      skipped: true,
      reason: "ALREADY_EXISTS",
      accCode: accountMaster.ACC_CODE,
      accountName: accountMaster.ACC_NAME,
    };
  }

  const payload = {
    accountName: accountMaster.ACC_NAME,
    accountType: "vendor",
    accountMobile: "",
    accountEmail: "",
    accountCreditLimit: "",
    accountAddress: "",
    state: "",
    city: "",
    gstNumber: "",
    dynamicFields: {
      LHSACCCode: accountMaster.ACC_CODE,
    },
  };

  console.log(
    `[FINEZ_ACCOUNT_MASTER] Creating vendor ${accountMaster.ACC_CODE}:`,
    payload
  );

  try {
    const response = await apiPost(
      "/accountMaster/createAccount",
      payload,
      {
        dbName,
        authtoken,
        loginuser,
      }
    );

    console.log(
      `[FINEZ_ACCOUNT_MASTER] Saved successfully ${accountMaster.ACC_CODE} - ${accountMaster.ACC_NAME}`
    );

    return response;
  } catch (error) {
    console.error(
      `[FINEZ_ACCOUNT_MASTER] Failed to save ${accountMaster.ACC_CODE} - ${accountMaster.ACC_NAME}:`,
      error
    );

    throw error;
  }
};

// ⭐ ACCOUNT MASTER END


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

    // ⭐ ACCOUNT MASTER
    await saveAccountMaster({
      accountMaster: order.accountMaster,
      dbName,
      authtoken,
      loginuser,
    });

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
    // ⭐ ACCOUNT MASTER
  getVendorAccounts,
  accountMasterAlreadyExists,
  saveAccountMaster,

  syncPurchaseOrderMastersToFinez,
};