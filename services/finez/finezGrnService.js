const {
  apiPost,
} = require("../../utils/apiUtils/externalApiClient.js");

const {
  getGrnTransactionData,
} = require("../grn/grnService");

const {
  getFineZVendorByLhsCode,
  getFineZCustomMasterByCode,
  getFineZProductByLhsCode,
} = require("./finezPurchaseOrderService");

const MINE_MASTER_MODULE_CODE = "CSTM-000001";
const COST_CENTER_MODULE_CODE = "CSTM-000002";

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const toAmount = (value) => {
  return toNumber(value).toFixed(2);
};

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


// ★★★ NEW - BUILD GRN PAYLOAD
const buildGrnPayload = ({
  rows,
  vendor,
  mineMaster,
  costCenter,
  products,
  purchaseOrder,
}) => {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    throw new Error(
      "GRN rows are required"
    );
  }

  const firstRow = rows[0];

  let totalQuantity = 0;
  let totalGrossAmount = 0;
  let totalDiscountAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  let totalIgstAmount = 0;
  let totalTaxAmount = 0;
  let totalOtherAmount = 0;
  let totalNetAmount = 0;

  const grnBody = rows.map((row, index) => {
    const product =
      products[index];

  const quantity =
  toNumber(
    row.QTYRECD
  );

const acceptedQuantity =
  toNumber(
    row.QTYRECD
  );

const rejectedQuantity =
  0;
    const rate =
      toNumber(
        row.RATE
      );

    const grossAmount =
      toNumber(
        row.TAX_ONAMOUNT
      ) ||
      quantity * rate;

    const discountAmount =
      toNumber(
        row.DISCOUNT_AMOUNT
      );

    const taxableAmount =
      grossAmount -
      discountAmount;

    const taxRate =
      toNumber(
        row.TAX_RATE
      );

    const taxAmountValue =
      toNumber(
        row.TAX_AMOUNT
      );

    const taxRate1 =
      toNumber(
        row.TAX_RATE1
      );

    const taxAmount1Value =
      toNumber(
        row.TAX_AMOUNT1
      );

    const hasFirstTax =
      taxRate > 0 ||
      taxAmountValue > 0;

    const hasSecondTax =
      taxRate1 > 0 ||
      taxAmount1Value > 0;

    const hasCgstSgst =
      hasFirstTax &&
      hasSecondTax;

    const cgstPercentage =
      hasCgstSgst
        ? taxRate
        : 0;

    const cgstAmount =
      hasCgstSgst
        ? taxAmountValue
        : 0;

    const sgstPercentage =
      hasCgstSgst
        ? taxRate1
        : 0;

    const sgstAmount =
      hasCgstSgst
        ? taxAmount1Value
        : 0;

    const igstPercentage =
      !hasCgstSgst
        ? (
            taxRate ||
            taxRate1 ||
            0
          )
        : 0;

    const igstAmount =
      !hasCgstSgst
        ? (
            taxAmountValue ||
            taxAmount1Value ||
            0
          )
        : 0;

    const taxAmount =
      cgstAmount +
      sgstAmount +
      igstAmount;

    const otherAmount =
      toNumber(
        row.OTHER_AMOUNT
      );

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

      quantity:
        String(quantity),

      acceptedQuantity:
        String(
          acceptedQuantity
        ),

      rejectedQuantity:
        String(
          rejectedQuantity
        ),

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
        toAmount(
          grossAmount
        ),

      grossAmount:
        toAmount(
          grossAmount
        ),

      discountAmount:
        toAmount(
          discountAmount
        ),

      taxableAmount:
        toAmount(
          taxableAmount
        ),

      cgst:
        cgstPercentage
          ? String(
              cgstPercentage
            )
          : "",

      cgstPercentage:
        cgstPercentage
          ? String(
              cgstPercentage
            )
          : "",

      cgstAmount:
        toAmount(
          cgstAmount
        ),

      sgst:
        sgstPercentage
          ? String(
              sgstPercentage
            )
          : "",

      sgstPercentage:
        sgstPercentage
          ? String(
              sgstPercentage
            )
          : "",

      sgstAmount:
        toAmount(
          sgstAmount
        ),

      igst:
        igstPercentage
          ? String(
              igstPercentage
            )
          : "",

      igstPercentage:
        igstPercentage
          ? String(
              igstPercentage
            )
          : "",

      igstAmount:
        toAmount(
          igstAmount
        ),

      taxAmount:
        toAmount(
          taxAmount
        ),

      otherAmount:
        toAmount(
          otherAmount
        ),

      netAmount:
        toAmount(
          netAmount
        ),

      netTotal:
        toAmount(
          netAmount
        ),
    };
  });

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

  return {
    grnVoucherDate:
      formatOracleDate(
        firstRow.VRDATE
      ),

    grnVendorCode:
      vendor?.accountCode ||
      "",

    grnVendorName:
      vendor?.accountName ||
      "",

    pOrdVoucherNumber:
      purchaseOrder?.pOrdVoucherNumber ||
      "",

    grnStatus:
      "open",

    grnRemark:
      firstRow.ENTRY_REMARK ||
      "",

    transportOrderNumber:
      "",

    trip_order:
      "",

    lr_no:
      "",

    driver:
      "",

    vehicleCode:
      "",

    vehicleName:
      "",

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

    grnBody,

    grnFooter: {
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
};


// ★★★ NEW - SEND GRN TO BOOKEZ
const sendGrnToBookEZ = async ({
  vrno,
  dbName,
  authtoken,
  loginuser,
}) => {
  console.log(
    "============================================================"
  );

  console.log(
    `[FINEZ_GRN] Starting GRN preparation`
  );

  console.log(
    `[FINEZ_GRN] Oracle VRNO: ${vrno}`
  );

  console.log(
    "============================================================"
  );

  const rows =
    await getGrnTransactionData(
      vrno
    );

  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    throw new Error(
      `GRN ${vrno} not found in Oracle`
    );
  }

  console.log(
    `[FINEZ_GRN] ${rows.length} body row(s) received from Oracle`
  );

  console.dir(
    rows,
    {
      depth: null,
    }
  );

  const firstRow =
    rows[0];

  // ★ Resolve header masters
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

  // ★ Resolve products
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

    products.push(
      product
    );
  }

  /*
   * ★ IMPORTANT
   *
   * We still need to resolve Oracle PO reference
   * to actual BookEZ pOrdVoucherNumber.
   *
   * Example target:
   *
   * PORD-11
   */
  const purchaseOrder = {
    pOrdVoucherNumber:
      firstRow.PORD_VOUCHER_NUMBER ||
      "",
  };

  const payload =
    buildGrnPayload({
      rows,
      vendor,
      mineMaster,
      costCenter,
      products,
      purchaseOrder,
    });

  console.log(
    "============================================================"
  );

  console.log(
    `[FINEZ_GRN] FINAL GRN PAYLOAD FOR ${vrno}`
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

  const response =
    await apiPost(
      "/users/bookez/purchaseFlow/grn/save",
      payload,
      {
        dbName,
        authtoken,
        loginuser,
      }
    );

  console.log(
    `[FINEZ_GRN] GRN ${vrno} saved successfully`
  );

  return response;
};


module.exports = {
  buildGrnPayload,
  sendGrnToBookEZ,
};