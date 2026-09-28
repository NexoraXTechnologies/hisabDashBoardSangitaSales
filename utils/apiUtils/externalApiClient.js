const axios = require("axios");

const EXTERNAL_API_BASE_URL =
  process.env.EXTERNAL_API_BASE_URL;

const normalizeBaseUrl = (url) => {
  if (!url) {
    throw new Error(
      "EXTERNAL_API_BASE_URL is not configured"
    );
  }

  return String(url)
    .trim()
    .replace(/\/+$/, "");
};

const externalApiClient = axios.create({
  baseURL: normalizeBaseUrl(
    EXTERNAL_API_BASE_URL
  ),
  timeout: 60000,
  headers: {
    Accept: "application/json",
  },
});

externalApiClient.interceptors.request.use(
  (config) => {
    const headers = config.headers || {};

    console.log(
      "[EXTERNAL_API] Request:",
      {
        method:
          config.method?.toUpperCase(),

        url:
          `${config.baseURL || ""}${config.url || ""}`,

        params:
          config.params || {},

        hasDbName:
          Boolean(
            headers["x-db-name"] ||
            headers.get?.("x-db-name")
          ),

        hasAuthToken:
          Boolean(
            headers["authtoken"] ||
            headers.get?.("authtoken")
          ),

        hasLoginUser:
          Boolean(
            headers["loginuser"] ||
            headers.get?.("loginuser")
          ),
      }
    );

    return config;
  },
  (error) => {
    console.error(
      "[EXTERNAL_API] Request interceptor error:",
      error.message
    );

    return Promise.reject(
      error
    );
  }
);

externalApiClient.interceptors.response.use(
  (response) => {
    console.log(
      "[EXTERNAL_API] Response:",
      {
        method:
          response.config?.method?.toUpperCase(),

        url:
          response.config?.url,

        status:
          response.status,
      }
    );

    return response;
  },
  (error) => {
    const normalizedError = {
      success: false,

      status:
        error.response?.status ||
        500,

      code:
        error.response?.data?.code ||
        error.code ||
        "EXTERNAL_API_ERROR",

      message:
        error.response?.data?.message ||
        error.message ||
        "External API request failed",

      error:
        error.response?.data ||
        null,
    };

    console.error(
      "[EXTERNAL_API] Error:",
      {
        method:
          error.config?.method?.toUpperCase(),

        url:
          error.config?.url,

        status:
          error.response?.status,

        code:
          normalizedError.code,

        message:
          normalizedError.message,

        responseType:
          typeof error.response?.data,
      }
    );

    return Promise.reject(
      normalizedError
    );
  }
);

const buildHeaders = ({
  dbName,
  authtoken,
  loginuser,
  additionalHeaders = {},
} = {}) => {
  const headers = {
    ...additionalHeaders,
  };

  if (dbName) {
    headers["x-db-name"] =
      dbName;
  }

  if (authtoken) {
    headers["authtoken"] =
      authtoken;
  }

  if (loginuser) {
    headers["loginuser"] =
      loginuser;
  }

  return headers;
};

const apiGet = async (
  url,
  {
    dbName,
    authtoken,
    loginuser,
    params = {},
    headers = {},
    ...config
  } = {}
) => {
  const response =
    await externalApiClient.get(
      url,
      {
        ...config,

        params,

        headers:
          buildHeaders({
            dbName,
            authtoken,
            loginuser,
            additionalHeaders:
              headers,
          }),
      }
    );

  return response.data;
};

const apiPost = async (
  url,
  data = {},
  {
    dbName,
    authtoken,
    loginuser,
    headers = {},
    ...config
  } = {}
) => {
  const response =
    await externalApiClient.post(
      url,
      data,
      {
        ...config,

        headers:
          buildHeaders({
            dbName,
            authtoken,
            loginuser,

            additionalHeaders: {
              "Content-Type":
                "application/json",

              ...headers,
            },
          }),
      }
    );

  return response.data;
};

const apiPut = async (
  url,
  data = {},
  {
    dbName,
    authtoken,
    loginuser,
    headers = {},
    ...config
  } = {}
) => {
  const response =
    await externalApiClient.put(
      url,
      data,
      {
        ...config,

        headers:
          buildHeaders({
            dbName,
            authtoken,
            loginuser,

            additionalHeaders: {
              "Content-Type":
                "application/json",

              ...headers,
            },
          }),
      }
    );

  return response.data;
};

const apiPatch = async (
  url,
  data = {},
  {
    dbName,
    authtoken,
    loginuser,
    headers = {},
    ...config
  } = {}
) => {
  const response =
    await externalApiClient.patch(
      url,
      data,
      {
        ...config,

        headers:
          buildHeaders({
            dbName,
            authtoken,
            loginuser,

            additionalHeaders: {
              "Content-Type":
                "application/json",

              ...headers,
            },
          }),
      }
    );

  return response.data;
};

const apiDelete = async (
  url,
  {
    dbName,
    authtoken,
    loginuser,
    data,
    params = {},
    headers = {},
    ...config
  } = {}
) => {
  const response =
    await externalApiClient.delete(
      url,
      {
        ...config,

        params,

        data,

        headers:
          buildHeaders({
            dbName,
            authtoken,
            loginuser,
            additionalHeaders:
              headers,
          }),
      }
    );

  return response.data;
};

module.exports = {
  externalApiClient,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
};