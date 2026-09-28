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


// 🟣⭐ FORMAT ORACLE DATE

const formatOracleDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
};


// 🟣⭐ GET FINEZ VENDOR USING LHS ACC CODE

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

  console.log(
    `[FINEZ_PURCHASE_ORDER] Looking for vendor using LHSACCCode: ${accCode}`
  );

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

    console.log(
      `[FINEZ_PURCHASE_ORDER] Checking ${items.length} vendor(s), offset ${offset}`
    );

    const account = items.find((item) => {
      return (
        normalizeValue(
          item?.dynamicFields?.LHSACCCode
        ) === normalizedAccCode
      );
    });

    if (account) {
      console.log(
        `[FINEZ_PURCHASE_ORDER] Vendor resolved ${accCode} → ${account.accountCode} - ${account.accountName}`
      );

      return account;
    }

    const hasNextPage =
      response?.data?.pagination?.hasNextPage === true;

    if (!hasNextPage) {
      console.log(
        `[FINEZ_PURCHASE_ORDER] Vendor not found for LHSACCCode: ${accCode}`
      );

      return null;
    }

    offset += limit;
  }
};


// 🟣⭐ GET FINEZ CUSTOM MASTER USING ORACLE CODE

const getFineZCustomMasterByCode = async ({
  moduleCode,
  code,
  dbName,
  authtoken,
  loginuser,
}) => {
  console.log(
    `[FINEZ_PURCHASE_ORDER] Looking for Custom Master ${moduleCode} using code: ${code}`
  );

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
    console.log(
      `[FINEZ_PURCHASE_ORDER] Invalid Custom Master response for ${moduleCode}`
    );

    return null;
  }

  const normalizedCode =
    normalizeValue(code);

  const customMaster =
    records.find((record) => {
      const existingCode =
        record?.code ||
        record?.data?.code ||
        "";

      return (
        normalizeValue(existingCode) ===
        normalizedCode
      );
    }) || null;

  if (customMaster) {
    console.log(
      `[FINEZ_PURCHASE_ORDER] Custom Master resolved ${moduleCode} - ${code}`
    );

    console.dir(
      customMaster,
      {
        depth: null,
      }
    );
  } else {
    console.log(
      `[FINEZ_PURCHASE_ORDER] Custom Master not found ${moduleCode} - ${code}`
    );
  }

  return customMaster;
};


// 🟣⭐ GET PRODUCT USING dynamicFields.LHSItemCode

const getFineZProductByLhsCode = async ({
  itemCode,
  dbName,
  authtoken,
  loginuser,
}) => {
  console.log(
    `[FINEZ_PURCHASE_ORDER] Looking for product using LhsItemCode: ${itemCode}`
  );

  const normalizedItemCode =
    normalizeValue(itemCode);

  let offset = 0;

  const limit = 200;

  while (true) {
    const response = await apiGet(
      "/productMaster/getAllProduct",
      {
        dbName,
        authtoken,
        loginuser,
        params: {
          offset,
          limit,
        },
      }
    );

    const products =
      response?.data?.items ||
      [];

    console.log(
      `[FINEZ_PURCHASE_ORDER] Checking ${products.length} product(s), offset ${offset}`
    );

    if (!Array.isArray(products)) {
      console.log(
        "[FINEZ_PURCHASE_ORDER] Invalid Product Master response"
      );

      console.dir(
        response,
        {
          depth: null,
        }
      );

      return null;
    }

    // 🟣⭐ Log available LHS item mappings
    console.log(
      "[FINEZ_PURCHASE_ORDER] Available Product LhsItemCode mappings:"
    );

    for (const product of products) {
      console.log(
        `  ${product.productCode || ""} -> ${
          product?.dynamicFields?.LhsItemCode ||
          product?.dynamicFields?.LHSItemCode ||
          ""
        }`
      );
    }

    const product =
      products.find((product) => {
        // 🟣⭐ Actual DB field is LhsItemCode
        const lhsItemCode =
          product?.dynamicFields?.LhsItemCode ||
          product?.dynamicFields?.LHSItemCode ||
          "";

        return (
          normalizeValue(lhsItemCode) ===
          normalizedItemCode
        );
      }) || null;

    if (product) {
      console.log(
        `[FINEZ_PURCHASE_ORDER] Product resolved ${itemCode} → ${product.productCode || ""} - ${product.productName || ""}`
      );

      console.dir(
        product,
        {
          depth: null,
        }
      );

      return product;
    }

    const hasNextPage =
      response?.data?.pagination?.hasNextPage === true;

    if (!hasNextPage) {
      console.log(
        `[FINEZ_PURCHASE_ORDER] Product not found for LhsItemCode: ${itemCode}`
      );

      return null;
    }

    offset += limit;
  }
};


// 🟣⭐ BUILD FINAL PURCHASE ORDER PAYLOAD

const buildPurchaseOrderPayload = ({
  rows,
  vendor,
  mineMaster,
  costCenter,
  products,
}) => {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    throw new Error(
      "Purchase order rows are required"
    );
  }

  const firstRow =
    rows[0];

  let totalQuantity = 0;
  let totalGrossAmount = 0;
  let totalDiscountAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  let totalIgstAmount = 0;
  let totalTaxAmount = 0;
  let totalOtherAmount = 0;
  let totalNetAmount = 0;

  const pOrdBody =
    rows.map((row, index) => {
      const product =
        products[index];

      // 🟣⭐ Excel Mapping: QTYORDER → quantity
      const quantity =
        toNumber(row.QTYORDER);

      // 🟣⭐ Excel Mapping: RATE → rate
      const rate =
        toNumber(row.RATE);

      // 🟣⭐ Excel Mapping: TAX_ONAMOUNT → gross
      const grossAmount =
        toNumber(row.TAX_ONAMOUNT);

      /*
       * 🟣⭐ Not mapped/provided currently.
       * Keep empty/zero instead of inventing values.
       */

      const discountAmount = 0;

      const cgstAmount = 0;

      const sgstAmount = 0;

      const igstAmount = 0;

      const taxAmount = 0;

      const otherAmount = 0;

      const taxableAmount =
        grossAmount -
        discountAmount;

      const netAmount =
        taxableAmount +
        taxAmount +
        otherAmount;

      totalQuantity +=
        quantity;

      totalGrossAmount +=
        grossAmount;

      totalDiscountAmount +=
        discountAmount;

      totalCgstAmount +=
        cgstAmount;

      totalSgstAmount +=
        sgstAmount;

      totalIgstAmount +=
        igstAmount;

      totalTaxAmount +=
        taxAmount;

      totalOtherAmount +=
        otherAmount;

      totalNetAmount +=
        netAmount;

      return {
        // 🟣⭐ Product Master data resolved using Oracle ITEM_CODE
        productCode:
          product?.productCode ||
          "",

        productName:
          product?.productName ||
          "",

        productId:
          product?._id ||
          product?.productId ||
          "",

        productDescription:
          product?.productDescription ||
          product?.description ||
          "",

        description:
          product?.productDescription ||
          product?.description ||
          "",

        productHSNCode:
          product?.productHSNCode ||
          product?.hsnCode ||
          "",

        remarks: "",

        quantity:
          String(quantity),

        // 🟣⭐ Take UOM from Product Master
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

        // 🟣⭐ Not supplied by current mapping
        discount: "",

        discountPercentage: "",

        discountAmount:
          toAmount(discountAmount),

        taxableAmount:
          toAmount(taxableAmount),

        // 🟣⭐ Tax mapping not finalized yet
        cgst: "",

        cgstPercentage: "",

        cgstAmount:
          toAmount(cgstAmount),

        sgst: "",

        sgstPercentage: "",

        sgstAmount:
          toAmount(sgstAmount),

        igst: "",

        igstPercentage: "",

        igstAmount:
          toAmount(igstAmount),

        taxAmount:
          toAmount(taxAmount),

        otherAmount:
          toAmount(otherAmount),

        netAmount:
          toAmount(netAmount),

        netTotal:
          toAmount(netAmount),
      };
    });

  // 🟣⭐ Extract Custom Master actual code/name

  const mineCode =
    mineMaster?.code ||
    mineMaster?.data?.code ||
    firstRow.MAKE_CODE ||
    "";

  const mineName =
    mineMaster?.name ||
    mineMaster?.data?.name ||
    "";

  const costCenterCode =
    costCenter?.code ||
    costCenter?.data?.code ||
    firstRow.COST_CODE ||
    "";

  const costCenterName =
    costCenter?.name ||
    costCenter?.data?.name ||
    "";

  const payload = {
    // 🟣⭐ Excel Mapping: VRNO → lhsPoVrNo
    lhsPoVrNo:
      firstRow.VRNO || "",

    // 🟣⭐ Excel Mapping: VRDATE → Purchase Order Date
    pOrdVoucherDate:
      formatOracleDate(
        firstRow.VRDATE
      ),

    // 🟣⭐ ACC_CODE resolved from FineEZ Account Master
    pOrdVendorCode:
      vendor?.accountCode ||
      "",

    pOrdVendorName:
      vendor?.accountName ||
      "",

    pOrdPurchaseAccount: "",

    pOrdStatus:
      "open",

    // 🟣⭐ Excel Mapping: ENTRY_REMARK → Remarks
    pOrdRemark:
      firstRow.ENTRY_REMARK ||
      "",

    transportOrderNumber: "",

    trip_order: "",

    lr_no: "",

    driver: "",

    vehicleCode: "",

    vehicleName: "",

    // 🟣⭐ Excel Mapping:
    // MAKE_CODE → Mine Master
    // COST_CODE → Cost Center
    customMasters: {
      "Mine Master": {
        code:
          mineCode,

        name:
          mineName,
      },

      "Cost Center": {
        code:
          costCenterCode,

        name:
          costCenterName,
      },
    },

    pOrdBody,

    pOrdFooter: {
      grossAmount:
        toAmount(
          totalGrossAmount
        ),

      discountAmount:
        toAmount(
          totalDiscountAmount
        ),

      cgstAmount:
        toAmount(
          totalCgstAmount
        ),

      sgstAmount:
        toAmount(
          totalSgstAmount
        ),

      igstAmount:
        toAmount(
          totalIgstAmount
        ),

      taxAmount:
        toAmount(
          totalTaxAmount
        ),

      otherAmount:
        toAmount(
          totalOtherAmount
        ),

      netAmount:
        toAmount(
          totalNetAmount
        ),

      adjustedAmount:
        "0",

      balanceAmount:
        toAmount(
          totalNetAmount
        ),

      totalQuantity,

      totalGrossAmount:
        toAmount(
          totalGrossAmount
        ),

      totalDiscountAmount:
        toAmount(
          totalDiscountAmount
        ),

      totalCgstAmount:
        toAmount(
          totalCgstAmount
        ),

      totalSgstAmount:
        toAmount(
          totalSgstAmount
        ),

      totalIgstAmount:
        toAmount(
          totalIgstAmount
        ),

      totalTaxAmount:
        toAmount(
          totalTaxAmount
        ),

      totalOtherAmount:
        toAmount(
          totalOtherAmount
        ),

      totalNetAmount:
        toAmount(
          totalNetAmount
        ),
    },
  };

  return payload;
};


// 🟣⭐ PREPARE PURCHASE ORDER
// POST IS INTENTIONALLY COMMENTED FOR NOW

const sendPurchaseOrderToBookEZ = async ({
  vrno,
  dbName,
  authtoken,
  loginuser,
}) => {
  console.log(
    "============================================================"
  );

  console.log(
    `[FINEZ_PURCHASE_ORDER] Starting Purchase Order preparation`
  );

  console.log(
    `[FINEZ_PURCHASE_ORDER] Oracle VRNO: ${vrno}`
  );

  console.log(
    "============================================================"
  );

  const rows =
    await getPurchaseOrderTransactionData(
      vrno
    );

  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    throw new Error(
      `Purchase order ${vrno} not found in Oracle`
    );
  }

  console.log(
    `[FINEZ_PURCHASE_ORDER] ${rows.length} body row(s) received from Oracle`
  );

  console.log(
    "[FINEZ_PURCHASE_ORDER] Oracle Purchase Order rows:"
  );

  console.dir(
    rows,
    {
      depth: null,
    }
  );

  const firstRow =
    rows[0];

  console.log(
    "[FINEZ_PURCHASE_ORDER] Resolving FineEZ masters..."
  );

  console.log(
    `[FINEZ_PURCHASE_ORDER] ACC_CODE: ${firstRow.ACC_CODE}`
  );

  console.log(
    `[FINEZ_PURCHASE_ORDER] MAKE_CODE: ${firstRow.MAKE_CODE}`
  );

  console.log(
    `[FINEZ_PURCHASE_ORDER] COST_CODE: ${firstRow.COST_CODE}`
  );

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
      `FineEZ vendor not found for Oracle ACC_CODE ${firstRow.ACC_CODE}`
    );
  }

  if (!mineMaster) {
    throw new Error(
      `FineEZ Mine Master not found for Oracle MAKE_CODE ${firstRow.MAKE_CODE}`
    );
  }

  if (!costCenter) {
    throw new Error(
      `FineEZ Cost Center not found for Oracle COST_CODE ${firstRow.COST_CODE}`
    );
  }

  console.log(
    "[FINEZ_PURCHASE_ORDER] Header masters resolved successfully"
  );

  const products = [];

  for (const row of rows) {
    console.log(
      `[FINEZ_PURCHASE_ORDER] Resolving product for Oracle ITEM_CODE: ${row.ITEM_CODE}`
    );

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

    products.push(
      product
    );
  }

  console.log(
    `[FINEZ_PURCHASE_ORDER] ${products.length} product(s) resolved successfully`
  );

  const payload =
    buildPurchaseOrderPayload({
      rows,
      vendor,
      mineMaster,
      costCenter,
      products,
    });

  console.log(
    "============================================================"
  );

  console.log(
    `[FINEZ_PURCHASE_ORDER] FINAL PAYLOAD FOR ${vrno}`
  );

  console.log(
    "============================================================"
  );

  console.dir(
    payload,
    {
      depth: null,
    }
  );

  console.log(
    "============================================================"
  );

  console.log(
    `[FINEZ_PURCHASE_ORDER] Payload prepared successfully. API POST is currently disabled.`
  );

  console.log(
    "============================================================"
  );


  // 🟣⭐ KEEP POST COMMENTED UNTIL PAYLOAD IS VERIFIED

  // const response = await apiPost(
  //   "/users/bookez/purchaseFlow/purchaseOrder/save",
  //   payload,
  //   {
  //     dbName,
  //     authtoken,
  //     loginuser,
  //   }
  // );

  // console.log(
  //   `[FINEZ_PURCHASE_ORDER] Purchase order ${vrno} saved successfully`
  // );

  // return response;


  // 🟣⭐ FOR NOW RETURN ONLY GENERATED PAYLOAD

  return payload;
};

module.exports = {
  getFineZVendorByLhsCode,
  getFineZCustomMasterByCode,
  getFineZProductByLhsCode,
  buildPurchaseOrderPayload,
  sendPurchaseOrderToBookEZ,
};