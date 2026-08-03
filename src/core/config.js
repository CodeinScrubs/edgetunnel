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
	DEBUG_LEGACY_TEXT: undefined,
	ENABLE_KV_LOG: undefined,
	OFF_LOG: undefined,
	ENABLE_KV_PROXY_CACHE: undefined,
	ALLOW_INVALID_UUID_DERIVATION: undefined,
	PRELOAD_RACE_DIAL: undefined,
	CONNECT_TIMEOUT_MS: undefined,
	DNS_TIMEOUT_MS: undefined,
	DNS_TOTAL_TIMEOUT_MS: undefined,
	DOH_SUBREQUEST_BUDGET: undefined,
	DIAL_STAGGER_MS: undefined,
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
	DOWNLINK_BACKPRESSURE_HWM_BYTES: undefined,
	DOWNLINK_GRAIN_PACKET_BYTES: undefined,
	// Uplink queue backstops. Env-readable since the queue factory took its caps as parameters, but absent
	// from every declared surface until now, so nothing documented that they were tunable at all.
	UPLINK_QUEUE_MAX_BYTES: undefined,
	UPLINK_QUEUE_MAX_ITEMS: undefined,
	FIRST_BYTE_TIMEOUT_MS: undefined,
	IDLE_TIMEOUT_MS: undefined,
	PROXYIP_FALLBACK: undefined,
	DOH_URL_FALLBACK: undefined,
	FORCE_PROXY_HOSTS: undefined,
};

// Advanced engine defaults. Keep these behavior-preserving unless benchmark data says otherwise.
export const ENGINE_DEFAULTS = {
	DEFAULT_SOCKS5_WHITELIST: ['*tapecontent.net', '*cloudatacdn.com', '*loadshare.org', '*cdn-centaurus.com', 'scholar.google.com'],
	PAGES_STATIC_URL: 'https://edt-pages.github.io',
	ENGLISH_STATIC_PAGE_CACHE_MAX_ENTRIES: 32,
	WS_EARLY_DATA_MAX_BYTES: 8 * 1024,
	UPLINK_BUNDLE_TARGET_BYTES: 16 * 1024,
	UPLINK_QUEUE_MAX_BYTES: 16 * 1024 * 1024,
	UPLINK_QUEUE_MAX_ITEMS: 4096,
	DOWNLINK_GRAIN_PACKET_BYTES: 32 * 1024,
	DOWNLINK_GRAIN_TAIL_THRESHOLD: 512,
	DOWNLINK_GRAIN_QUIET_MS: 0,
	// Downstream backpressure: cap how much un-delivered data buffers in the isolate before the
	// reader from the remote is paused. Prevents unbounded RAM growth (and isolate OOM / dropped
	// connections) on large downloads when the client link is slower than the origin.
	DOWNLINK_BACKPRESSURE_HWM_BYTES: 256 * 1024,
	// WebSocket downstream pacing: when the runtime exposes bufferedAmount, pause reading the
	// remote once the socket's outbound buffer exceeds this, so a slow client can't OOM the isolate.
	WS_BUFFERED_AMOUNT_LIMIT_BYTES: 1 * 1024 * 1024,
	WS_BUFFERED_AMOUNT_MAX_WAIT_MS: 1000,
	GRPC_MAX_FRAME_PAYLOAD_BYTES: 4 * 1024 * 1024,
	XHTTP_FIRST_PACKET_MAX_BYTES: 64 * 1024,
	PROXY_RESOLUTION_CACHE_VERSION: 3,
	PROXY_RESOLUTION_CACHE_MAX_L1_ENTRIES: 64,
	PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS: 8,
	PROXY_RESOLUTION_CACHE_FRESH_TTL_MS: 10 * 60 * 1000,
	PROXY_RESOLUTION_CACHE_STALE_TTL_MS: 6 * 60 * 60 * 1000,
	PROXY_RESOLUTION_CACHE_KV_WRITE_COOLDOWN_MS: 60 * 1000,
	// Floor between ANY two proxy-cache KV writes IN ONE ISOLATE (3 min => <=480/day/isolate). This is a
	// per-isolate clock, NOT an account-wide one: several isolates or colos each keep their own, so this
	// bounds write RATE but cannot by itself guarantee the free-plan 1000/day account quota. Set
	// ENABLE_KV_PROXY_CACHE=0 if this namespace is shared with panel config.
	PROXY_RESOLUTION_CACHE_KV_MIN_GLOBAL_INTERVAL_MS: 3 * 60 * 1000,
	PROXY_ENDPOINT_FAILURE_COOLDOWN_MS: 10 * 60 * 1000,
	PROXY_ENDPOINT_FAILURE_COOLDOWN_THRESHOLD: 2,
	PROXY_ENDPOINT_HEALTH_MAX_AGE_MS: 24 * 60 * 60 * 1000,
	PROXY_CONNECT_TIMEOUT_DEFAULT_MS: 850,
	PROXY_CONNECT_TIMEOUT_MIN_MS: 400,
	PROXY_CONNECT_TIMEOUT_MAX_MS: 5000,
	REQUEST_LOG_DEFAULT_READ_LIMIT: 500,
	REQUEST_LOG_MAX_READ_LIMIT: 1000,
	REQUEST_LOG_DEFAULT_TTL_SECONDS: 7 * 24 * 60 * 60,
	REQUEST_LOG_MIN_TTL_SECONDS: 60 * 60,
	REQUEST_LOG_MAX_TTL_SECONDS: 30 * 24 * 60 * 60,
	REQUEST_LOG_DEDUPE_TTL_SECONDS: 30 * 60,
	DOH_LOOKUP_TIMEOUT_MS: 850,
	DNS_RESULT_CACHE_MAX_ENTRIES: 256,
	DNS_RESULT_CACHE_MIN_TTL_MS: 30 * 1000,
	DNS_RESULT_CACHE_MAX_TTL_MS: 5 * 60 * 1000,
	DNS_RESULT_NEGATIVE_TTL_MS: 30 * 1000,
	HASH_CACHE_MAX_ENTRIES: 256,
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
