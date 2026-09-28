const {
  apiGet,
  apiPost,
} = require("../../utils/apiUtils/externalApiClient.js");

const {
  getPurchaseOrderTransactionData,
} = require("../purchaseOrder/purchaseOrderService");

const MINE_MASTER_MODULE_CODE = "CSTM-000002";
const COST_CENTER_MODULE_CODE = "CSTM-000001";

const normalizeValue = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const toAmount = (value) => {
  return toNumber(value).toFixed(2);
};


// ⭐ GET FINEZ VENDOR

const getFineZVendorByLhsCode = async ({
  accCode,
  dbName,
  authtoken,
  loginuser,
}) => {
  const normalizedAccCode =
    normalizeValue(accCode);

  let offset = 0;

  const limit = 100;

  while (true) {
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

    const items =
      response?.data?.items ||
      [];

    const account = items.find((item) => {
      return (
        normalizeValue(
          item?.dynamicFields?.LHSACCCode
        ) === normalizedAccCode
      );
    });

    if (account) {
      return account;
    }

    const hasNextPage =
      response?.data?.pagination?.hasNextPage === true;

    if (!hasNextPage) {
      return null;
    }

    offset += limit;
  }
};


// ⭐ GET FINEZ CUSTOM MASTER

const getFineZCustomMasterByCode = async ({
  moduleCode,
  code,
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

  const records =
    response?.data?.items ||
    response?.data ||
    response?.records ||
    response?.result ||
    [];

  if (!Array.isArray(records)) {
    return null;
  }

  const normalizedCode =
    normalizeValue(code);

  return (
    records.find((record) => {
      const existingCode =
        record?.code ||
        record?.data?.code ||
        "";

      return (
        normalizeValue(existingCode) ===
        normalizedCode
      );
    }) || null
  );
};


// ⭐ GET FINEZ PRODUCT
// Update API/response mapping here once your exact Product Master GET API is confirmed.

const getFineZProductByLhsCode = async ({
  itemCode,
  dbName,
  authtoken,
  loginuser,
}) => {
  const response = await apiGet(
    "/users/productMaster/getAll",
    {
      dbName,
      authtoken,
      loginuser,
      params: {
        offset: 0,
        limit: 500,
      },
    }
  );

  const products =
    response?.data?.items ||
    response?.data ||
    [];

  if (!Array.isArray(products)) {
    return null;
  }

  const normalizedItemCode =
    normalizeValue(itemCode);

  return (
    products.find((product) => {
      const lhsItemCode =
        product?.dynamicFields?.LHSItemCode ||
        product?.itemCode ||
        product?.productCode ||
        "";

      return (
        normalizeValue(lhsItemCode) ===
        normalizedItemCode
      );
    }) || null
  );
};


// ⭐ BUILD PURCHASE ORDER PAYLOAD

const buildPurchaseOrderPayload = ({
  rows,
  vendor,
  mineMaster,
  costCenter,
  products,
}) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      "Purchase order rows are required"
    );
  }

  const firstRow = rows[0];

  let totalQuantity = 0;
  let totalGrossAmount = 0;
  let totalTaxAmount = 0;
  let totalNetAmount = 0;

  const pOrdBody = rows.map((row, index) => {
    const product =
      products[index];

    const quantity =
      toNumber(row.QTYORDER) -
      toNumber(row.QTYCANCELLED);

    const rate =
      toNumber(row.RATE);

    const grossAmount =
      quantity * rate;

    const taxableAmount =
      row.TAX_ONAMOUNT !== null &&
      row.TAX_ONAMOUNT !== undefined
        ? toNumber(row.TAX_ONAMOUNT)
        : grossAmount;

    const taxPercentage =
      toNumber(row.TAX_RATE1);

    const taxAmount =
      toNumber(row.TAX_AMOUNT1);

    const cgstPercentage =
      taxPercentage
        ? taxPercentage / 2
        : 0;

    const sgstPercentage =
      taxPercentage
        ? taxPercentage / 2
        : 0;

    const cgstAmount =
      taxAmount
        ? taxAmount / 2
        : 0;

    const sgstAmount =
      taxAmount
        ? taxAmount / 2
        : 0;

    const netAmount =
      taxableAmount +
      taxAmount;

    totalQuantity += quantity;
    totalGrossAmount += grossAmount;
    totalTaxAmount += taxAmount;
    totalNetAmount += netAmount;

    return {
      productCode:
        product?.productCode || "",

      productName:
        product?.productName || "",

      productId:
        product?._id || "",

      productDescription:
        product?.productDescription ||
        product?.productName ||
        "",

      description:
        product?.productDescription ||
        product?.productName ||
        "",

      productHSNCode:
        product?.productHSNCode ||
        product?.hsnCode ||
        "",

      remarks:
        row.AFIELD8 || "",

      quantity:
        String(quantity),

      unit:
        product?.unit ||
        product?.uom ||
        "",

      uom:
        product?.uom ||
        product?.unit ||
        "",

      rate:
        String(rate),

      gross:
        toAmount(grossAmount),

      grossAmount:
        toAmount(grossAmount),

      discount: "",

      discountPercentage: "",

      discountAmount:
        "0.00",

      taxableAmount:
        toAmount(taxableAmount),

      cgst:
        cgstPercentage
          ? String(cgstPercentage)
          : "",

      cgstPercentage:
        cgstPercentage
          ? String(cgstPercentage)
          : "",

      cgstAmount:
        toAmount(cgstAmount),

      sgst:
        sgstPercentage
          ? String(sgstPercentage)
          : "",

      sgstPercentage:
        sgstPercentage
          ? String(sgstPercentage)
          : "",

      sgstAmount:
        toAmount(sgstAmount),

      igst: "",

      igstPercentage: "",

      igstAmount:
        "0.00",

      taxAmount:
        toAmount(taxAmount),

      otherAmount:
        "0.00",

      netAmount:
        toAmount(netAmount),

      netTotal:
        toAmount(netAmount),
    };
  });

  return {
    pOrdVoucherDate:
      firstRow.VRDATE,

    pOrdVendorCode:
      vendor.accountCode,

    pOrdVendorName:
      vendor.accountName,

    pOrdPurchaseAccount: "",

    pOrdStatus:
      "open",

    pOrdRemark: "",

    transportOrderNumber: "",

    trip_order: "",

    lr_no: "",

    driver: "",

    vehicleCode: "",

    vehicleName: "",

    customMasters: {
      "Mine Master": {
        code:
          mineMaster?.code ||
          mineMaster?.data?.code ||
          firstRow.MAKE_CODE,

        name:
          mineMaster?.name ||
          mineMaster?.data?.name ||
          "",
      },

      "Cost Center": {
        code:
          costCenter?.code ||
          costCenter?.data?.code ||
          firstRow.COST_CODE,

        name:
          costCenter?.name ||
          costCenter?.data?.name ||
          "",
      },
    },

    pOrdBody,

    pOrdFooter: {
      grossAmount:
        toAmount(totalGrossAmount),

      discountAmount:
        "0.00",

      cgstAmount:
        toAmount(totalTaxAmount / 2),

      sgstAmount:
        toAmount(totalTaxAmount / 2),

      igstAmount:
        "0.00",

      taxAmount:
        toAmount(totalTaxAmount),

      otherAmount:
        "0.00",

      netAmount:
        toAmount(totalNetAmount),

      adjustedAmount:
        "0",

      balanceAmount:
        toAmount(totalNetAmount),

      totalQuantity,

      totalGrossAmount:
        toAmount(totalGrossAmount),

      totalDiscountAmount:
        "0.00",

      totalCgstAmount:
        toAmount(totalTaxAmount / 2),

      totalSgstAmount:
        toAmount(totalTaxAmount / 2),

      totalIgstAmount:
        "0.00",

      totalTaxAmount:
        toAmount(totalTaxAmount),

      totalOtherAmount:
        "0.00",

      totalNetAmount:
        toAmount(totalNetAmount),
    },
  };
};


// ⭐ SEND PURCHASE ORDER

const sendPurchaseOrderToBookEZ = async ({
  vrno,
  dbName,
  authtoken,
  loginuser,
}) => {
  console.log(
    `[FINEZ_PURCHASE_ORDER] Processing ${vrno}`
  );

  const rows =
    await getPurchaseOrderTransactionData(
      vrno
    );

  if (!rows.length) {
    throw new Error(
      `Purchase order ${vrno} not found`
    );
  }

  const firstRow =
    rows[0];

  const [
    vendor,
    mineMaster,
    costCenter,
  ] = await Promise.all([
    getFineZVendorByLhsCode({
      accCode:
        firstRow.ACC_CODE,

      dbName,
      authtoken,
      loginuser,
    }),

    getFineZCustomMasterByCode({
      moduleCode:
        MINE_MASTER_MODULE_CODE,

      code:
        firstRow.MAKE_CODE,

      dbName,
      authtoken,
      loginuser,
    }),

    getFineZCustomMasterByCode({
      moduleCode:
        COST_CENTER_MODULE_CODE,

      code:
        firstRow.COST_CODE,

      dbName,
      authtoken,
      loginuser,
    }),
  ]);

  if (!vendor) {
    throw new Error(
      `FineEZ vendor not found for ACC_CODE ${firstRow.ACC_CODE}`
    );
  }

  if (!mineMaster) {
    throw new Error(
      `FineEZ Mine Master not found for MAKE_CODE ${firstRow.MAKE_CODE}`
    );
  }

  if (!costCenter) {
    throw new Error(
      `FineEZ Cost Center not found for COST_CODE ${firstRow.COST_CODE}`
    );
  }

  const products = [];

  for (const row of rows) {
    const product =
      await getFineZProductByLhsCode({
        itemCode:
          row.ITEM_CODE,

        dbName,
        authtoken,
        loginuser,
      });

    if (!product) {
      throw new Error(
        `FineEZ Product not found for Oracle ITEM_CODE ${row.ITEM_CODE}`
      );
    }

    products.push(product);
  }

  const payload =
    buildPurchaseOrderPayload({
      rows,
      vendor,
      mineMaster,
      costCenter,
      products,
    });

  console.log(
    `[FINEZ_PURCHASE_ORDER] Final payload for ${vrno}:`
  );

  console.dir(
    payload,
    {
      depth: null,
    }
  );

//   const response = await apiPost(
//     "/users/bookez/purchaseFlow/purchaseOrder/save",
//     payload,
//     {
//       dbName,
//       authtoken,
//       loginuser,
//     }
//   );

//   console.log(
//     `[FINEZ_PURCHASE_ORDER] Purchase order ${vrno} saved successfully`
//   );

  return response;
};

module.exports = {
  getFineZVendorByLhsCode,
  getFineZCustomMasterByCode,
  getFineZProductByLhsCode,
  buildPurchaseOrderPayload,
  sendPurchaseOrderToBookEZ,
};