// User-editable defaults.
// Cloudflare environment variables and KV/admin settings still override these values.
export const USER_CONFIG = {
	ADMIN: undefined,
	KEY: undefined,
	UUID: undefined,
	HOST: undefined,
	PROXYIP: undefined,
	GO2SOCKS5: undefined,
	URL: undefined,
	DEBUG: undefined,
	ENABLE_KV_LOG: undefined,
	OFF_LOG: undefined,
	ENABLE_KV_PROXY_CACHE: undefined,
	PRELOAD_RACE_DIAL: undefined,
	CONNECT_TIMEOUT_MS: undefined,
	DNS_TIMEOUT_MS: undefined,
	DNS_SERVER: undefined,
	DOH_URL: undefined,
	PATH: undefined,
	TRANSPORT: undefined,
	FP: undefined,
	FINGERPRINT: undefined,
	GRPC_MODE: undefined,
	GRPC_USER_AGENT: undefined,
	SUBNAME: undefined,
	SUB_UPDATE_TIME: undefined,
};

// Advanced engine defaults. Keep these behavior-preserving unless benchmark data says otherwise.
export const ENGINE_DEFAULTS = {
	DEFAULT_SOCKS5_WHITELIST: ['*tapecontent.net', '*cloudatacdn.com', '*loadshare.org', '*cdn-centaurus.com', 'scholar.google.com'],
	PAGES_STATIC_URL: 'https://edt-pages.github.io',
	WS_EARLY_DATA_MAX_BYTES: 8 * 1024,
	UPLINK_BUNDLE_TARGET_BYTES: 16 * 1024,
	UPLINK_QUEUE_MAX_BYTES: 16 * 1024 * 1024,
	UPLINK_QUEUE_MAX_ITEMS: 4096,
	DOWNLINK_GRAIN_PACKET_BYTES: 32 * 1024,
	DOWNLINK_GRAIN_TAIL_THRESHOLD: 512,
	DOWNLINK_GRAIN_QUIET_MS: 0,
	GRPC_MAX_FRAME_PAYLOAD_BYTES: 16 * 1024 * 1024,
	PROXY_RESOLUTION_CACHE_VERSION: 1,
	PROXY_RESOLUTION_CACHE_MAX_L1_ENTRIES: 24,
	PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS: 8,
	PROXY_RESOLUTION_CACHE_FRESH_TTL_MS: 10 * 60 * 1000,
	PROXY_RESOLUTION_CACHE_STALE_TTL_MS: 6 * 60 * 60 * 1000,
	PROXY_RESOLUTION_CACHE_KV_WRITE_COOLDOWN_MS: 60 * 1000,
	PROXY_ENDPOINT_FAILURE_COOLDOWN_MS: 10 * 60 * 1000,
	PROXY_ENDPOINT_FAILURE_COOLDOWN_THRESHOLD: 2,
	PROXY_ENDPOINT_HEALTH_MAX_AGE_MS: 24 * 60 * 60 * 1000,
	PROXY_CONNECT_TIMEOUT_DEFAULT_MS: 850,
	PROXY_CONNECT_TIMEOUT_MIN_MS: 400,
	PROXY_CONNECT_TIMEOUT_MAX_MS: 1500,
	REQUEST_LOG_DEFAULT_READ_LIMIT: 500,
	REQUEST_LOG_MAX_READ_LIMIT: 1000,
	REQUEST_LOG_DEFAULT_TTL_SECONDS: 7 * 24 * 60 * 60,
	REQUEST_LOG_MIN_TTL_SECONDS: 60 * 60,
	REQUEST_LOG_MAX_TTL_SECONDS: 30 * 24 * 60 * 60,
	REQUEST_LOG_DEDUPE_TTL_SECONDS: 30 * 60,
	DOH_LOOKUP_TIMEOUT_MS: 850,
	DNS_TCP_RESPONSE_TIMEOUT_MS: 1200,
	DIAL_STAGGER_MS: 90,
	DEFAULT_DOH_LOOKUP_URL: 'https://cloudflare-dns.com/dns-query',
	DEFAULT_DNS_TCP_SERVER: '8.8.4.4:53',
};

export function applyUserConfigDefaults(env = {}) {
	const merged = Object.create(Object.getPrototypeOf(env) || null);
	for (const key of Reflect.ownKeys(env)) merged[key] = env[key];
	for (const [key, value] of Object.entries(USER_CONFIG)) {
		if (value !== undefined && value !== null && value !== '' && merged[key] === undefined) merged[key] = value;
	}
	return merged;
}
