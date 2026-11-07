// Only used by the local wx.request fallback; callContainer does not need a base URL.
export const API_BASE_URL = 'http://127.0.0.1:4000/api'

// Enable after deploying the Spring Boot image to WeChat Cloud Hosting.
export const USE_CLOUD_CONTAINER = true
export const CLOUD_ENV_ID = 'flowboard-prod-d4gwhtcgf4f33533c'
export const CLOUD_SERVICE_NAME = 'flowboard-api'

// Password login is a local development fallback; production uses the gateway-injected openid.
export const ENABLE_PASSWORD_LOGIN = !USE_CLOUD_CONTAINER
