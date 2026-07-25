// Generated from src/worker.js by scripts/build-worker.mjs.
// Edit src/worker.js or src/core/config.js, then run npm run build.
// User-editable defaults.
// Cloudflare environment variables and KV/admin settings still override these values.
const USER_CONFIG = {
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
	FIRST_BYTE_TIMEOUT_MS: undefined,
	IDLE_TIMEOUT_MS: undefined,
	PROXYIP_FALLBACK: undefined,
	DOH_URL_FALLBACK: undefined,
	FORCE_PROXY_HOSTS: undefined,
};

// Advanced engine defaults. Keep these behavior-preserving unless benchmark data says otherwise.
const ENGINE_DEFAULTS = {
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
	PROXY_RESOLUTION_CACHE_VERSION: 1,
	PROXY_RESOLUTION_CACHE_MAX_L1_ENTRIES: 64,
	PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS: 8,
	PROXY_RESOLUTION_CACHE_FRESH_TTL_MS: 10 * 60 * 1000,
	PROXY_RESOLUTION_CACHE_STALE_TTL_MS: 6 * 60 * 60 * 1000,
	PROXY_RESOLUTION_CACHE_KV_WRITE_COOLDOWN_MS: 60 * 1000,
	// Global floor between ANY two proxy-cache KV writes per isolate. Caps total writes so
	// active browsing can't exhaust the free-plan 1000/day KV write quota (3 min => <=480/day).
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

function applyUserConfigDefaults(env = {}) {
	const merged = Object.create(Object.getPrototypeOf(env) || null);
	for (const key of Reflect.ownKeys(env)) merged[key] = env[key];
	for (const [key, value] of Object.entries(USER_CONFIG)) {
		if (value !== undefined && value !== null && value !== '' && merged[key] === undefined) merged[key] = value;
	}
	return merged;
}


const ENGLISH_STATIC_PAGE_CACHE_MAX_ENTRIES = ENGINE_DEFAULTS.ENGLISH_STATIC_PAGE_CACHE_MAX_ENTRIES;
const Version = '2026-06-01 15:49:39';
const DEFAULT_SOCKS5_WHITELIST = ENGINE_DEFAULTS.DEFAULT_SOCKS5_WHITELIST;
let 缓存SOCKS5白名单键 = null, 缓存SOCKS5白名单 = null, 缓存强制反代主机键 = null, 缓存强制反代主机 = null, 调试日志打印 = false, 抑制旧文本日志 = false;
const PROXY_ENDPOINT_CURSOR = new Map();
// env.HOST is a static per-deployment env var, so its parsed form is memoized here instead of
// re-parsed on every request (realistically holds one entry; the size guard is just defensive).
const HOSTS_LIST_CACHE = new Map();
// Adaptive direct-route cache: remembers hosts that consistently fail a DIRECT dial (per colo) and
// routes them straight through ProxyIP for a short window, skipping the wasted direct attempt + the
// failover wait. Bounded + TTL'd so it self-heals — a recovered host is retried after the TTL, and a
// successful direct first byte clears the entry immediately (so transient blips don't pin a good host).
const DIRECT_ROUTE_STATUS_CACHE = new Map();
const DIRECT_ROUTE_FAILURE_THRESHOLD = 2;
const DIRECT_ROUTE_STATUS_TTL_MS = 10 * 60 * 1000;
const DIRECT_ROUTE_STATUS_MAX_ENTRIES = 512;
function getDirectRouteFailed(key) {
	if (!key) return false;
	const now = Date.now();
	const entry = DIRECT_ROUTE_STATUS_CACHE.get(key);
	if (!entry) return false;
	if (now >= entry.expiresAt) { DIRECT_ROUTE_STATUS_CACHE.delete(key); return false; }
	return entry.failures >= DIRECT_ROUTE_FAILURE_THRESHOLD;
}
function recordDirectRouteFailure(key) {
	if (!key) return;
	const now = Date.now();
	const entry = DIRECT_ROUTE_STATUS_CACHE.get(key);
	const failures = (entry && now < entry.expiresAt ? entry.failures : 0) + 1;
	DIRECT_ROUTE_STATUS_CACHE.delete(key);
	DIRECT_ROUTE_STATUS_CACHE.set(key, { failures, expiresAt: now + DIRECT_ROUTE_STATUS_TTL_MS });
	while (DIRECT_ROUTE_STATUS_CACHE.size > DIRECT_ROUTE_STATUS_MAX_ENTRIES) DIRECT_ROUTE_STATUS_CACHE.delete(DIRECT_ROUTE_STATUS_CACHE.keys().next().value);
}
function recordDirectRouteOk(key) {
	if (key) DIRECT_ROUTE_STATUS_CACHE.delete(key);
}
const Pages静态页面 = ENGINE_DEFAULTS.PAGES_STATIC_URL;

const WS早期数据最大字节 = ENGINE_DEFAULTS.WS_EARLY_DATA_MAX_BYTES, WS早期数据最大头长度 = Math.ceil(WS早期数据最大字节 * 4 / 3) + 4;
const 上行合包目标字节 = ENGINE_DEFAULTS.UPLINK_BUNDLE_TARGET_BYTES, 上行队列最大字节 = ENGINE_DEFAULTS.UPLINK_QUEUE_MAX_BYTES, 上行队列最大条目 = ENGINE_DEFAULTS.UPLINK_QUEUE_MAX_ITEMS;
// Ceiling for ONE inbound WS message (see the message handler): the aggregate queue cap cannot bound a single
// huge frame because the runtime buffers it fully before dispatch. 8 MiB is far above any real client's frame
// (xray fragments to tens of KiB) while keeping one frame from dominating the 128 MiB isolate.
const WS单帧最大字节 = 8 * 1024 * 1024;
const 下行Grain包字节 = ENGINE_DEFAULTS.DOWNLINK_GRAIN_PACKET_BYTES, 下行Grain尾部阈值 = ENGINE_DEFAULTS.DOWNLINK_GRAIN_TAIL_THRESHOLD, 下行Grain静默毫秒 = ENGINE_DEFAULTS.DOWNLINK_GRAIN_QUIET_MS;
const 下行背压高水位字节 = ENGINE_DEFAULTS.DOWNLINK_BACKPRESSURE_HWM_BYTES;
const WS缓冲上限字节 = ENGINE_DEFAULTS.WS_BUFFERED_AMOUNT_LIMIT_BYTES, WS缓冲最大等待毫秒 = ENGINE_DEFAULTS.WS_BUFFERED_AMOUNT_MAX_WAIT_MS;
const GRPC_MAX_FRAME_PAYLOAD_BYTES = ENGINE_DEFAULTS.GRPC_MAX_FRAME_PAYLOAD_BYTES;
const XHTTP_FIRST_PACKET_MAX_BYTES = ENGINE_DEFAULTS.XHTTP_FIRST_PACKET_MAX_BYTES;
const PROXY_RESOLUTION_CACHE_VERSION = ENGINE_DEFAULTS.PROXY_RESOLUTION_CACHE_VERSION;
const PROXY_RESOLUTION_CACHE_MAX_L1_ENTRIES = ENGINE_DEFAULTS.PROXY_RESOLUTION_CACHE_MAX_L1_ENTRIES;
const PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS = ENGINE_DEFAULTS.PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS;
const PROXY_RESOLUTION_CACHE_FRESH_TTL_MS = ENGINE_DEFAULTS.PROXY_RESOLUTION_CACHE_FRESH_TTL_MS;
const PROXY_RESOLUTION_CACHE_STALE_TTL_MS = ENGINE_DEFAULTS.PROXY_RESOLUTION_CACHE_STALE_TTL_MS;
const PROXY_RESOLUTION_CACHE_KV_TTL_SECONDS = Math.ceil(PROXY_RESOLUTION_CACHE_STALE_TTL_MS / 1000);
const PROXY_RESOLUTION_CACHE_KV_WRITE_COOLDOWN_MS = ENGINE_DEFAULTS.PROXY_RESOLUTION_CACHE_KV_WRITE_COOLDOWN_MS;
const PROXY_RESOLUTION_CACHE_KV_MIN_GLOBAL_INTERVAL_MS = ENGINE_DEFAULTS.PROXY_RESOLUTION_CACHE_KV_MIN_GLOBAL_INTERVAL_MS;
let 上次代理缓存KV写入 = 0;
const PROXY_ENDPOINT_FAILURE_COOLDOWN_MS = ENGINE_DEFAULTS.PROXY_ENDPOINT_FAILURE_COOLDOWN_MS;
const PROXY_ENDPOINT_FAILURE_COOLDOWN_THRESHOLD = ENGINE_DEFAULTS.PROXY_ENDPOINT_FAILURE_COOLDOWN_THRESHOLD;
const PROXY_ENDPOINT_HEALTH_MAX_AGE_MS = ENGINE_DEFAULTS.PROXY_ENDPOINT_HEALTH_MAX_AGE_MS;
const PROXY_CONNECT_TIMEOUT_DEFAULT_MS = ENGINE_DEFAULTS.PROXY_CONNECT_TIMEOUT_DEFAULT_MS;
const PROXY_CONNECT_TIMEOUT_MIN_MS = ENGINE_DEFAULTS.PROXY_CONNECT_TIMEOUT_MIN_MS;
const PROXY_CONNECT_TIMEOUT_MAX_MS = ENGINE_DEFAULTS.PROXY_CONNECT_TIMEOUT_MAX_MS;
const REQUEST_LOG_ENTRY_PREFIX = 'log:entry:';
const REQUEST_LOG_DEDUPE_PREFIX = 'log:dedupe:';
const REQUEST_LOG_LEGACY_KEY = 'log.json';
const REQUEST_LOG_MAX_REVERSE_TIME = 9999999999999;
const REQUEST_LOG_DEFAULT_READ_LIMIT = ENGINE_DEFAULTS.REQUEST_LOG_DEFAULT_READ_LIMIT;
const REQUEST_LOG_MAX_READ_LIMIT = ENGINE_DEFAULTS.REQUEST_LOG_MAX_READ_LIMIT;
const REQUEST_LOG_DEFAULT_TTL_SECONDS = ENGINE_DEFAULTS.REQUEST_LOG_DEFAULT_TTL_SECONDS;
const REQUEST_LOG_MIN_TTL_SECONDS = ENGINE_DEFAULTS.REQUEST_LOG_MIN_TTL_SECONDS;
const REQUEST_LOG_MAX_TTL_SECONDS = ENGINE_DEFAULTS.REQUEST_LOG_MAX_TTL_SECONDS;
const REQUEST_LOG_DEDUPE_TTL_SECONDS = ENGINE_DEFAULTS.REQUEST_LOG_DEDUPE_TTL_SECONDS;
const DOH_LOOKUP_TIMEOUT_MS = ENGINE_DEFAULTS.DOH_LOOKUP_TIMEOUT_MS;
const DNS_RESULT_CACHE_MAX_ENTRIES = ENGINE_DEFAULTS.DNS_RESULT_CACHE_MAX_ENTRIES;
const DNS_RESULT_CACHE_MIN_TTL_MS = ENGINE_DEFAULTS.DNS_RESULT_CACHE_MIN_TTL_MS;
const DNS_RESULT_CACHE_MAX_TTL_MS = ENGINE_DEFAULTS.DNS_RESULT_CACHE_MAX_TTL_MS;
const DNS_RESULT_NEGATIVE_TTL_MS = ENGINE_DEFAULTS.DNS_RESULT_NEGATIVE_TTL_MS;
const HASH_CACHE_MAX_ENTRIES = ENGINE_DEFAULTS.HASH_CACHE_MAX_ENTRIES;
const DNS_TCP_RESPONSE_TIMEOUT_MS = ENGINE_DEFAULTS.DNS_TCP_RESPONSE_TIMEOUT_MS;
const DNS_MAX_FRAMES_PER_REQUEST = 16;
const REQUEST_LOG_KV_OPS_LIMIT = 35;
const REQUEST_LOG_KV_GET_BATCH_SIZE = 4;
const DIAL_STAGGER_MS = ENGINE_DEFAULTS.DIAL_STAGGER_MS;
const DEFAULT_DOH_LOOKUP_URL = ENGINE_DEFAULTS.DEFAULT_DOH_LOOKUP_URL;
const DEFAULT_DNS_TCP_SERVER = ENGINE_DEFAULTS.DEFAULT_DNS_TCP_SERVER;
const PROXY_RESOLUTION_L1_CACHE = new Map();
const PROXY_RESOLUTION_IN_FLIGHT = new Map();
const DNS_RESULT_CACHE = new Map();
// Wire-format cache for tunneled client DNS queries (forwardataudp -> DoH). Keyed on the whole query
// EXCEPT the 2-byte transaction ID, so only byte-identical questions share an entry (no wrong-answer
// risk). A hit skips the DoH fetch() subrequest entirely, which matters on the free plan's shared
// per-connection budget and cuts first-byte latency on repeat lookups during a browsing session.
const DNS_WIRE_CACHE = new Map();
const SHA224_RESULT_CACHE = new Map();
const MD5MD5_RESULT_CACHE = new Map();
const WORKER_REQUEST_CONTEXT = new WeakMap();
let cachedProxyIPRaw = null;
let cachedProxyIPList = null;

function isEnabledEnvFlag(value) {
	return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function getLruCacheValue(cache, key) {
	if (!cache.has(key)) return undefined;
	const value = cache.get(key);
	cache.delete(key);
	cache.set(key, value);
	return value;
}

function setLruCacheValue(cache, key, value, maxEntries) {
	if (cache.has(key)) cache.delete(key);
	cache.set(key, value);
	while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
	return value;
}

function isKvRequestLoggingEnabled(env = {}) {
	if (isEnabledEnvFlag(env.OFF_LOG)) return false;
	return isEnabledEnvFlag(env.ENABLE_KV_LOG) || isEnabledEnvFlag(env.KV_LOG);
}

function isProxyResolutionKvCacheEnabled(env = {}) {
	// On by default (writes are globally throttled and TTL'd, so they cannot exhaust the KV
	// quota or drop connections). Explicitly disable with OFF_PROXY_CACHE=1 or ENABLE_KV_PROXY_CACHE=0.
	if (isEnabledEnvFlag(env.OFF_PROXY_CACHE) || isEnabledEnvFlag(env.DISABLE_KV_PROXY_CACHE)) return false;
	const explicit = String(env.ENABLE_KV_PROXY_CACHE ?? env.KV_PROXY_CACHE ?? '').trim().toLowerCase();
	if (['0', 'false', 'no', 'off'].includes(explicit)) return false;
	return true;
}

function getDohLookupUrl(env = {}) {
	const raw = String(env?.DOH_URL || env?.DOH_ENDPOINT || '').trim();
	if (!raw) return DEFAULT_DOH_LOOKUP_URL;
	try {
		const url = new URL(raw);
		if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
	} catch (error) { }
	return DEFAULT_DOH_LOOKUP_URL;
}

// Ordered DoH endpoints to try for tunneled DNS: primary (DOH_URL) then a secondary
// (DOH_URL_FALLBACK, default Google) before falling back to plaintext DNS-over-TCP.
function getDohLookupUrls(env = {}) {
	const primary = getDohLookupUrl(env);
	const urls = [primary];
	const fallbackRaw = String(env?.DOH_URL_FALLBACK || 'https://dns.google/dns-query').trim();
	try {
		const u = new URL(fallbackRaw);
		if ((u.protocol === 'https:' || u.protocol === 'http:') && u.href !== primary) urls.push(u.href);
	} catch (error) { }
	return urls;
}

function getDnsTcpEndpoint(env = {}) {
	const raw = String(env?.DNS_SERVER || env?.DNS_TCP_SERVER || DEFAULT_DNS_TCP_SERVER).trim().replace(/^(?:tcp|udp):\/\//i, '');
	const parsed = parsePreferredEndpointText(raw);
	if (!parsed) return { hostname: '8.8.4.4', port: 53 };
	const hostname = parsed.address.startsWith('[') && parsed.address.endsWith(']') ? parsed.address.slice(1, -1) : parsed.address;
	const port = parsed.hasExplicitPort ? Number(parsed.port) : 53;
	if (!hostname || !Number.isInteger(port) || port < 1 || port > 65535) return { hostname: '8.8.4.4', port: 53 };
	return { hostname, port };
}

function normalizeConfigHost(host) {
	let value = String(host || '').trim();
	if (!value) return '';
	try {
		const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
		value = parsed.hostname || parsed.host || value;
	} catch (_) {
		value = value.replace(/^https?:\/\//i, '').split('/')[0];
	}
	if (value.startsWith('[') && value.includes(']')) value = value.slice(1, value.indexOf(']'));
	else if ((value.match(/:/g) || []).length === 1) value = value.slice(0, value.lastIndexOf(':'));
	return value.toLowerCase().trim();
}

function sanitizeDecoyHeaders(headers, decoyOrigin = '', workerOrigin = '') {
	const safe = new Headers(headers);
	for (const header of [
		'set-cookie',
		'set-cookie2',
		'content-security-policy',
		'content-security-policy-report-only',
		'x-content-security-policy',
	]) safe.delete(header);
	const location = safe.get('location');
	if (location) {
		try {
			const redirected = new URL(location, decoyOrigin || undefined);
			if (decoyOrigin && workerOrigin && redirected.origin === decoyOrigin) {
				safe.set('location', `${workerOrigin}${redirected.pathname}${redirected.search}${redirected.hash}`);
			} else {
				safe.delete('location');
			}
		} catch (_) {
			safe.delete('location');
		}
	}
	return safe;
}

function decoyResponse(upstream, decoyOrigin = '', workerOrigin = '') {
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: sanitizeDecoyHeaders(upstream.headers, decoyOrigin, workerOrigin),
	});
}

export default {
	async fetch(request, env, ctx) {
		// Top-level guard: never let an uncaught exception become a Cloudflare 1101 ("Worker threw an
		// exception"). On any unexpected error we serve the nginx camouflage page instead of throwing.
		try {
		env = applyUserConfigDefaults(env);
		const workerRequestContext = { env, ctx, tunnel: null };
		WORKER_REQUEST_CONTEXT.set(request, workerRequestContext);
		let config_JSON;
		let 请求URL文本 = request.url.replace(/%5[Cc]/g, '').replace(/\\/g, '');
		const 请求URL锚点索引 = 请求URL文本.indexOf('#');
		const 请求URL主体部分 = 请求URL锚点索引 === -1 ? 请求URL文本 : 请求URL文本.slice(0, 请求URL锚点索引);
		if (!请求URL主体部分.includes('?') && /%3f/i.test(请求URL主体部分)) {
			const 请求URL锚点部分 = 请求URL锚点索引 === -1 ? '' : 请求URL文本.slice(请求URL锚点索引);
			请求URL文本 = 请求URL主体部分.replace(/%3f/i, '?') + 请求URL锚点部分;
		}
		const url = new URL(请求URL文本);
		const UA = request.headers.get('User-Agent') || 'null';
		const upgradeHeader = (request.headers.get('Upgrade') || '').toLowerCase(), contentType = (request.headers.get('content-type') || '').toLowerCase();
		// The admin-panel password must NEVER fall back to the UUID or KEY: those travel inside every client
		// subscription config, so a leaked node would otherwise hand out the panel password. Admin access requires
		// an explicit admin credential; without one the panel is disabled (the tunnel still works). The broader
		// 身份种子 (which may include UUID/KEY) is kept ONLY as the userID-derivation seed, so this change does not
		// alter userID/subscription/token derivation for any existing deployment.
		const 身份种子 = env.ADMIN || env.admin || env.PASSWORD || env.password || env.pswd || env.TOKEN || env.KEY || env.UUID || env.uuid;
		const 管理员密码 = env.ADMIN || env.admin || env.PASSWORD || env.password || env.pswd || env.TOKEN;
		// The TUNNEL must not be gated on the admin password — a UUID-only deployment (no ADMIN) is valid and must
		// still serve WS/gRPC/XHTTP. Gate tunnel routes on "any credential is configured" and keep 管理员密码 for
		// /login + /admin only. A worker with NO credential at all falls through to the decoy (fails closed).
		const 隧道凭据可用 = Boolean(身份种子);
		const 加密秘钥 = env.KEY || 'default-key-change-with-KEY-env-if-needed';
		const userIDMD5 = await MD5MD5(身份种子 + 加密秘钥);
		const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
		const envUUID = env.UUID || env.uuid;
		const userID = (envUUID && uuidRegex.test(envUUID)) ? envUUID.toLowerCase() : [userIDMD5.slice(0, 8), userIDMD5.slice(8, 12), '4' + userIDMD5.slice(13, 16), '8' + userIDMD5.slice(17, 20), userIDMD5.slice(20)].join('-');
		let hosts;
		if (env.HOST) {
			const hostConfigKey = String(env.HOST);
			hosts = HOSTS_LIST_CACHE.get(hostConfigKey);
			if (!hosts) {
				hosts = (await 整理成数组(env.HOST)).map(normalizeConfigHost).filter(Boolean);
				if (HOSTS_LIST_CACHE.size >= 8) HOSTS_LIST_CACHE.clear();
				HOSTS_LIST_CACHE.set(hostConfigKey, hosts);
			}
		} else {
			hosts = [url.hostname];
		}
		const host = hosts[0];
		const 访问路径 = url.pathname.slice(1).toLowerCase();
		调试日志打印 = ['1', 'true'].includes(String(env.DEBUG || '').toLowerCase());
		// DEBUG_LEGACY_TEXT=0 silences the verbose human-readable `log()` lines while keeping the structured
		// tracer events. The two together doubled tail volume and pushed wrangler tail into sampling mode (which
		// drops messages) — structured-only mode roughly halves output and CPU. Warnings/errors still print.
		抑制旧文本日志 = 调试日志打印 && ['0', 'false', 'off'].includes(String(env.DEBUG_LEGACY_TEXT ?? '').toLowerCase());
		workerRequestContext.tunnel = await createTunnelContext(request, env);
		const 访问IP = request.headers.get('CF-Connecting-IP') || request.headers.get('True-Client-IP') || request.headers.get('X-Real-IP') || request.headers.get('X-Forwarded-For') || request.headers.get('Fly-Client-IP') || request.headers.get('X-Appengine-Remote-Addr') || request.headers.get('X-Cluster-Client-IP') || 'unknown-ip';
		// Tunnel path gate: when a non-root PATH is set, only requests under that path may enter the
		// WS/gRPC/XHTTP tunnel parser; random scanners hitting other paths get the camouflage page
		// instead (less wasted CPU, better stealth). PATH="/" / unset disables the gate.
		// Slash-insensitive on BOTH sides: PATH="mypath" and PATH="/mypath" both match a client
		// gRPC serviceName / WS path of "mypath" or "/mypath". (xray can emit a doubled slash like
		// "//mypath/Tun" for a slash-prefixed gRPC serviceName, so we collapse repeated slashes too.)
		const 期望隧道路径核心 = String(env.PATH || '').trim().toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '');
		const 请求路径核心 = url.pathname.toLowerCase().replace(/\/{2,}/g, '/').replace(/^\/+/, '');
		const 隧道路径匹配 = !期望隧道路径核心 || 请求路径核心 === 期望隧道路径核心 || 请求路径核心.startsWith(期望隧道路径核心 + '/');
		if (访问路径 === 'version' && url.searchParams.get('uuid') === userID) {
			return new Response(JSON.stringify({ Version: Number(String(Version).replace(/\D+/g, '')) }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
		} else if (隧道凭据可用 && upgradeHeader === 'websocket' && 隧道路径匹配) {
			await 反代参数获取(url, userID, workerRequestContext.tunnel);
			log(`[WebSocket] Matched request: ${url.pathname}${url.search}`);
			return await 处理WS请求(request, userID, url);
		} else if (隧道凭据可用 && !访问路径.startsWith('admin/') && 访问路径 !== 'login' && request.method === 'POST' && 隧道路径匹配) {
			await 反代参数获取(url, userID, workerRequestContext.tunnel);
			const referer = request.headers.get('Referer') || '';
			const 命中XHTTP特征 = referer.includes('x_padding');
			if (!命中XHTTP特征 && contentType.startsWith('application/grpc')) {
				log(`[gRPC] Matched request: ${url.pathname}${url.search}`);
				return await 处理gRPC请求(request, userID);
			}
			log(`[XHTTP] Matched request: ${url.pathname}${url.search}`);
			return await 处理XHTTP请求(request, userID);
		} else {
			if (url.protocol === 'http:') return Response.redirect(url.href.replace(`http://${url.hostname}`, `https://${url.hostname}`), 301);
			// Setup helper: the admin panel needs BOTH an explicit ADMIN password AND a bound KV namespace. If the
			// operator visits /login or /admin while either is missing, say exactly what to set instead of silently
			// serving the decoy (which just looks like "the panel is broken"). Scoped to these two paths only and
			// only while misconfigured — once ADMIN + KV are set the normal login flow takes over and this never
			// shows, so ordinary `/` traffic and scanners still see a plain web server. Wording is generic (no
			// "proxy"/protocol terms) to keep the fingerprint minimal.
			const 是管理路径 = 访问路径 === 'login' || 访问路径 === 'admin' || 访问路径.startsWith('admin/');
			const KV已绑定 = Boolean(env.KV && typeof env.KV.get === 'function');
			if (是管理路径 && (!管理员密码 || !KV已绑定)) {
				const 缺少配置 = [];
				if (!管理员密码) 缺少配置.push('the <code>ADMIN</code> environment variable / secret (the admin-panel password)');
				if (!KV已绑定) 缺少配置.push('a <b>KV namespace binding named <code>KV</code></b> (Settings &rarr; Bindings &rarr; add KV namespace)');
				return new Response(管理面板设置提示(缺少配置), { status: 503, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } });
			}
			// Admin disabled (no explicit ADMIN) is a VALID config — the tunnel still runs on the UUID. Ordinary
			// traffic must then look like a plain web server rather than announcing "this is a proxy whose admin
			// panel is unconfigured": serve the same camouflage as any unmatched request. The early return is kept
			// so the routes below can never compare a password against undefined (fail closed).
			if (!管理员密码) return new Response(await nginx(), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
			if (env.KV && typeof env.KV.get === 'function') {
				const 区分大小写访问路径 = url.pathname.slice(1);
				if (区分大小写访问路径 === 加密秘钥 && 加密秘钥 !== 'default-key-change-with-KEY-env-if-needed') {
					const params = new URLSearchParams(url.search);
					params.set('token', await MD5MD5(host + userID));
					return new Response('Redirecting...', { status: 302, headers: { 'Location': `/sub?${params.toString()}` } });
				} else if (访问路径 === 'login') {
					const cookies = request.headers.get('Cookie') || '';
					const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
					if (authCookie === await MD5MD5(UA + 加密秘钥 + 管理员密码)) {
						return new Response('Redirecting...', { status: 302, headers: { 'Location': '/admin' } });
					}
					if (request.method === 'POST') {
						// Bound the pre-auth login body: a login form is tiny, so reject a declared-huge body
						// instead of buffering it (cheap guard against a memory-spike POST from the open internet).
						if (Number(request.headers.get('content-length') || 0) > 4096) return new Response('Payload Too Large', { status: 413 });
						const formData = await request.text();
						const params = new URLSearchParams(formData);
						const 输入密码 = params.get('password');
						if (输入密码 === (typeof 管理员密码 === 'string' ? 管理员密码.replace(/[\r\n]/g, '') : 管理员密码)) {
							const 响应 = new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							响应.headers.set('Set-Cookie', `auth=${await MD5MD5(UA + 加密秘钥 + 管理员密码)}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Strict`);
							return 响应;
						}
					}
					return fetchEnglishStaticPage('/login');
				} else if (访问路径 === 'admin' || 访问路径.startsWith('admin/')) {
					const cookies = request.headers.get('Cookie') || '';
					const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
					if (!authCookie || authCookie !== await MD5MD5(UA + 加密秘钥 + 管理员密码)) return new Response('Redirecting...', { status: 302, headers: { 'Location': '/login' } });
					if (访问路径 === 'admin/log.json') {
						const 日志内容 = await readRequestLogs(env, { limit: url.searchParams.get('limit') });
						return new Response(JSON.stringify(日志内容, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (区分大小写访问路径 === 'admin/getCloudflareUsage') {
						try {
							const Usage_JSON = await getCloudflareUsage(url.searchParams.get('Email'), url.searchParams.get('GlobalAPIKey'), url.searchParams.get('AccountID'), url.searchParams.get('APIToken'));
							return new Response(JSON.stringify(Usage_JSON, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
						} catch (err) {
							const errorResponse = { msg: 'Failed to query request usage: ' + err.message, error: err.message };
							return new Response(JSON.stringify(errorResponse, null, 2), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						}
					} else if (区分大小写访问路径 === 'admin/getADDAPI') {
						if (url.searchParams.get('url')) {
							const 待验证优选URL = url.searchParams.get('url');
							try {
								new URL(待验证优选URL);
								const 请求优选API内容 = await 请求优选API([待验证优选URL], url.searchParams.get('port') || '443');
								let 优选API的IP = 请求优选API内容[0].length > 0 ? 请求优选API内容[0] : 请求优选API内容[1];
								优选API的IP = 优选API的IP.map(item => item.replace(/#(.+)$/, (_, remark) => '#' + decodeURIComponent(remark)));
								return new Response(JSON.stringify({ success: true, data: 优选API的IP }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (err) {
								const errorResponse = { msg: 'Preferred IP API validation failed: ' + err.message, error: err.message };
								return new Response(JSON.stringify(errorResponse, null, 2), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						}
						return new Response(JSON.stringify({ success: false, data: [] }, null, 2), { status: 403, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (访问路径 === 'admin/check') {
						const 代理协议 = ['socks5', 'http', 'https', 'turn', 'sstp'].find(类型 => url.searchParams.has(类型)) || null;
						if (!代理协议) return new Response(JSON.stringify({ error: 'Missing proxy parameter' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						const 代理参数 = url.searchParams.get(代理协议);
						const startTime = Date.now();
						let 检测代理响应;
						try {
							const 检测超时毫秒 = getProxyConnectTimeoutMs(env);
							const parsedProxyAddress = { ...(await 获取SOCKS5账号(代理参数, 获取代理默认端口(代理协议))), timeoutMs: 检测超时毫秒 };
							const { username, password, hostname, port } = parsedProxyAddress;
							const 完整代理参数 = username && password ? `${username}:${password}@${hostname}:${port}` : `${hostname}:${port}`;
							try {
								const 检测主机 = 'cloudflare.com', 检测端口 = 443, encoder = new TextEncoder(), decoder = new TextDecoder();
								const TCP连接 = 创建请求TCP连接器(request);
								let tcpSocket = null, tlsSocket = null;
								try {
									tcpSocket = 代理协议 === 'socks5'
										? await socks5Connect(检测主机, 检测端口, new Uint8Array(0), TCP连接, parsedProxyAddress)
										: 代理协议 === 'turn'
											? await turnConnect(parsedProxyAddress, 检测主机, 检测端口, TCP连接)
											: 代理协议 === 'sstp'
												? await sstpConnect(parsedProxyAddress, 检测主机, 检测端口, TCP连接)
												: (代理协议 === 'https' && isIPHostname(hostname)
													? await httpsConnect(检测主机, 检测端口, new Uint8Array(0), TCP连接, parsedProxyAddress)
													: await httpConnect(检测主机, 检测端口, new Uint8Array(0), 代理协议 === 'https', TCP连接, parsedProxyAddress));
									if (!tcpSocket) throw new Error('Unable to connect to the proxy server');
									tlsSocket = new TlsClient(tcpSocket, { serverName: 检测主机, insecure: true, timeout: 检测超时毫秒 });
									await withOperationTimeout(tlsSocket.handshake(), 检测超时毫秒, 'Proxy check TLS handshake timed out', () => {
										try { tlsSocket?.close() } catch (e) { }
									});
									await withOperationTimeout(tlsSocket.write(encoder.encode(`GET /cdn-cgi/trace HTTP/1.1\r\nHost: ${检测主机}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`)), 检测超时毫秒, 'Proxy check request write timed out', () => {
										try { tlsSocket?.close() } catch (e) { }
									});
									let responseBuffer = new Uint8Array(0), headerEndIndex = -1, contentLength = null, chunked = false;
									const 最大响应字节 = 64 * 1024;
									while (responseBuffer.length < 最大响应字节) {
										const value = await withOperationTimeout(tlsSocket.read(), 检测超时毫秒, 'Proxy check response timed out', () => {
											try { tlsSocket?.close() } catch (e) { }
										});
										if (!value) break;
										if (value.byteLength === 0) continue;
										responseBuffer = 拼接字节数据(responseBuffer, value);
										if (headerEndIndex === -1) {
											const crlfcrlf = responseBuffer.findIndex((_, i) => i < responseBuffer.length - 3 && responseBuffer[i] === 0x0d && responseBuffer[i + 1] === 0x0a && responseBuffer[i + 2] === 0x0d && responseBuffer[i + 3] === 0x0a);
											if (crlfcrlf !== -1) {
												headerEndIndex = crlfcrlf + 4;
												const headers = decoder.decode(responseBuffer.slice(0, headerEndIndex));
												const statusLine = headers.split('\r\n')[0] || '';
												const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
												const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : NaN;
												if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode >= 300) throw new Error(`Proxy check request failed: ${statusLine || 'invalid response'}`);
												const lengthMatch = headers.match(/\r\nContent-Length:\s*(\d+)/i);
												if (lengthMatch) contentLength = parseInt(lengthMatch[1], 10);
												chunked = /\r\nTransfer-Encoding:\s*chunked/i.test(headers);
											}
										}
										if (headerEndIndex !== -1 && contentLength !== null && responseBuffer.length >= headerEndIndex + contentLength) break;
										if (headerEndIndex !== -1 && chunked && decoder.decode(responseBuffer).includes('\r\n0\r\n\r\n')) break;
									}
									if (headerEndIndex === -1) throw new Error('Proxy check response headers are too long or invalid');
									const response = decoder.decode(responseBuffer);
									const ip = response.match(/(?:^|\n)ip=(.*)/)?.[1];
									const loc = response.match(/(?:^|\n)loc=(.*)/)?.[1];
									if (!ip || !loc) throw new Error('Proxy check response is invalid');
									检测代理响应 = { success: true, proxy: 代理协议 + "://" + 完整代理参数, ip, loc, responseTime: Date.now() - startTime };
								} finally {
									try { tlsSocket ? tlsSocket.close() : await tcpSocket?.close?.() } catch (e) { }
								}
							} catch (error) {
								检测代理响应 = { success: false, error: error.message, proxy: 代理协议 + "://" + 完整代理参数, responseTime: Date.now() - startTime };
							}
						} catch (err) {
							检测代理响应 = { success: false, error: err.message, proxy: 代理协议 + "://" + 代理参数, responseTime: Date.now() - startTime };
						}
						return new Response(JSON.stringify(检测代理响应, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					}

					config_JSON = await 读取config_JSON(env, host, userID, UA);

					if (访问路径 === 'admin/init') {
						try {
							config_JSON = await 读取config_JSON(env, host, userID, UA, true);
							ctx?.waitUntil?.(请求日志记录(env, request, 访问IP, 'Init_Config', config_JSON));
							config_JSON.init = 'Configuration has been reset to defaults';
							return new Response(stringifyJSONASCII(config_JSON, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						} catch (err) {
							const errorResponse = { msg: 'Configuration reset failed: ' + err.message, error: err.message };
							return new Response(JSON.stringify(errorResponse, null, 2), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						}
					} else if (request.method === 'POST') {
						if (访问路径 === 'admin/config.json') {
							try {
								const newConfig = await request.json();

								if (!newConfig.UUID || !newConfig.HOST) return new Response(JSON.stringify({ error: 'Configuration is incomplete' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });


								await env.KV.put('config.json', JSON.stringify(newConfig, null, 2));
								ctx?.waitUntil?.(请求日志记录(env, request, 访问IP, 'Save_Config', config_JSON));
								return new Response(JSON.stringify({ success: true, message: 'Configuration saved' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								debugError('Failed to save configuration:', error);
								return new Response(JSON.stringify({ error: 'Failed to save configuration: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (访问路径 === 'admin/cf.json') {
							try {
								const newConfig = await request.json();
								const CF_JSON = { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null };
								if (!newConfig.init || newConfig.init !== true) {
									if (newConfig.Email && newConfig.GlobalAPIKey) {
										CF_JSON.Email = newConfig.Email;
										CF_JSON.GlobalAPIKey = newConfig.GlobalAPIKey;
									} else if (newConfig.AccountID && newConfig.APIToken) {
										CF_JSON.AccountID = newConfig.AccountID;
										CF_JSON.APIToken = newConfig.APIToken;
									} else if (newConfig.UsageAPI) {
										CF_JSON.UsageAPI = newConfig.UsageAPI;
									} else {
										return new Response(JSON.stringify({ error: 'Configuration is incomplete' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
									}
								}


								await env.KV.put('cf.json', JSON.stringify(CF_JSON, null, 2));
								ctx?.waitUntil?.(请求日志记录(env, request, 访问IP, 'Save_Config', config_JSON));
								return new Response(JSON.stringify({ success: true, message: 'Configuration saved' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								debugError('Failed to save configuration:', error);
								return new Response(JSON.stringify({ error: 'Failed to save configuration: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (访问路径 === 'admin/tg.json') {
							try {
								const newConfig = await request.json();
								if (newConfig.init && newConfig.init === true) {
									const TG_JSON = { BotToken: null, ChatID: null };
									await env.KV.put('tg.json', JSON.stringify(TG_JSON, null, 2));
								} else {
									if (!newConfig.BotToken || !newConfig.ChatID) return new Response(JSON.stringify({ error: 'Configuration is incomplete' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
									await env.KV.put('tg.json', JSON.stringify(newConfig, null, 2));
								}
								ctx?.waitUntil?.(请求日志记录(env, request, 访问IP, 'Save_Config', config_JSON));
								return new Response(JSON.stringify({ success: true, message: 'Configuration saved' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								debugError('Failed to save configuration:', error);
								return new Response(JSON.stringify({ error: 'Failed to save configuration: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (区分大小写访问路径 === 'admin/ADD.txt') {
							try {
								const customIPs = await request.text();
								await env.KV.put('ADD.txt', customIPs);
								ctx?.waitUntil?.(请求日志记录(env, request, 访问IP, 'Save_Custom_IPs', config_JSON));
								return new Response(JSON.stringify({ success: true, message: 'Custom IP list saved' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								debugError('Failed to save custom IP list:', error);
								return new Response(JSON.stringify({ error: 'Failed to save custom IP list: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else return new Response(JSON.stringify({ error: 'Unsupported POST request path' }), { status: 404, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (访问路径 === 'admin/config.json') {
						return new Response(stringifyJSONASCII(config_JSON, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
					} else if (区分大小写访问路径 === 'admin/ADD.txt') {
						let 本地优选IP = await env.KV.get('ADD.txt') || 'null';
						if (本地优选IP == 'null') 本地优选IP = (await 生成随机IP(request, config_JSON.优选订阅生成.本地IP库.随机数量, config_JSON.优选订阅生成.本地IP库.指定端口))[1];
						return new Response(本地优选IP, { status: 200, headers: { 'Content-Type': 'text/plain;charset=utf-8', 'asn': String(request.cf?.asn || '0') } });
					} else if (访问路径 === 'admin/cf.json') {
						return new Response(JSON.stringify(request.cf || {}, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					}

					ctx?.waitUntil?.(请求日志记录(env, request, 访问IP, 'Admin_Login', config_JSON));
					return fetchEnglishStaticPage('/admin' + url.search);
				} else if (访问路径 === 'logout' || uuidRegex.test(访问路径)) {
					const 响应 = new Response('Redirecting...', { status: 302, headers: { 'Location': '/login' } });
					响应.headers.set('Set-Cookie', 'auth=; Path=/; Max-Age=0; HttpOnly');
					return 响应;
				} else if (访问路径 === 'sub') {
					const 订阅TOKEN = await MD5MD5(host + userID), 作为优选订阅生成器 = ['1', 'true'].includes(env.BEST_SUB) && url.searchParams.get('host') === 'example.com' && url.searchParams.get('uuid') === '00000000-0000-4000-8000-000000000000' && UA.toLowerCase().includes('tunnel (https://github.com/cmliu/edge');
					const 请求TOKEN = url.searchParams.get('token');
					const 用户客户端请求订阅 = 请求TOKEN === 订阅TOKEN;
					const 当前日序号 = Math.floor(Date.now() / 86400000);
					const 订阅转换后端TOKEN种子 = base64SecretEncode(订阅TOKEN, userID);
					const [今日订阅转换后端专属TOKEN, 昨日订阅转换后端专属TOKEN] = await Promise.all([
						MD5MD5(订阅转换后端TOKEN种子 + 当前日序号),
						MD5MD5(订阅转换后端TOKEN种子 + (当前日序号 - 1)),
					]);
					const 订阅转换后端请求订阅 = 请求TOKEN === 今日订阅转换后端专属TOKEN || 请求TOKEN === 昨日订阅转换后端专属TOKEN;
					if (用户客户端请求订阅 || 订阅转换后端请求订阅 || 作为优选订阅生成器) {
						config_JSON = await 读取config_JSON(env, host, userID, UA);
						if (作为优选订阅生成器) ctx?.waitUntil?.(请求日志记录(env, request, 访问IP, 'Get_Best_SUB', config_JSON, false));
						else ctx?.waitUntil?.(请求日志记录(env, request, 访问IP, 'Get_SUB', config_JSON));
						const ua = UA.toLowerCase();
						const responseHeaders = {
							"content-type": "text/plain; charset=utf-8",
							"Profile-Update-Interval": config_JSON.优选订阅生成.SUBUpdateTime,
							"Profile-web-page-url": url.protocol + '//' + url.host + '/admin',
							"Cache-Control": "no-store",
						};
						if (config_JSON.CF.Usage.success) {
							const pagesSum = config_JSON.CF.Usage.pages;
							const workersSum = config_JSON.CF.Usage.workers;
							const total = Number.isFinite(config_JSON.CF.Usage.max) ? (config_JSON.CF.Usage.max / 1000) * 1024 : 1024 * 100;
							responseHeaders["Subscription-Userinfo"] = `upload=${pagesSum}; download=${workersSum}; total=${total}; expire=4102329600`;
						}
						const subscriptionRequestOptions = getSubscriptionRequestOptions(url, request, ua, 作为优选订阅生成器);
						const isSubConverterRequest = subscriptionRequestOptions.isSubConverterRequest;
						const shouldBase64Subscription = subscriptionRequestOptions.shouldBase64Subscription;
						const 订阅类型 = subscriptionRequestOptions.type;

						if (!ua.includes('mozilla')) responseHeaders["Content-Disposition"] = `attachment; filename*=utf-8''${encodeURIComponent(config_JSON.优选订阅生成.SUBNAME)}`;
						const 协议类型 = ((url.searchParams.has('surge') || ua.includes('surge')) && config_JSON.协议类型 !== 'ss') ? 'tro' + 'jan' : config_JSON.协议类型;
						let 订阅内容 = '';
						if (订阅类型 === 'mixed') {
							const TLS分片参数 = config_JSON.TLS分片 == 'Shadowrocket' ? `&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}` : config_JSON.TLS分片 == 'Happ' ? `&fragment=${encodeURIComponent('3,1,tlshello')}` : '';
							let 完整优选IP = [], 其他节点LINK = '', 反代IP池 = [];

							if (!url.searchParams.has('sub') && config_JSON.优选订阅生成.local) {
								const 完整优选列表 = config_JSON.优选订阅生成.本地IP库.随机IP ? (
									await 生成随机IP(request, config_JSON.优选订阅生成.本地IP库.随机数量, config_JSON.优选订阅生成.本地IP库.指定端口)
								)[0] : await env.KV.get('ADD.txt') ? await 整理成数组(await env.KV.get('ADD.txt')) : (
									await 生成随机IP(request, config_JSON.优选订阅生成.本地IP库.随机数量, config_JSON.优选订阅生成.本地IP库.指定端口)
								)[0];
								const 优选API = [], 优选IP = [], 其他节点 = [];
								for (const 元素 of 完整优选列表) {
									if (元素.toLowerCase().startsWith('sub://')) {
										优选API.push(元素);
									} else {
										const 备注位置 = 元素.indexOf('#');
										const 地址部分 = 备注位置 > -1 ? 元素.slice(0, 备注位置) : 元素;
										const 备注部分 = 备注位置 > -1 ? 元素.slice(备注位置) : '';
										const subMatch = 元素.match(/sub\s*=\s*([^\s&#]+)/i);
										if (subMatch && subMatch[1].trim().includes('.')) {
											const 优选IP作为反代IP = 元素.toLowerCase().includes('proxyip=true');
											if (优选IP作为反代IP) 优选API.push('sub://' + subMatch[1].trim() + "?proxyip=true" + (元素.includes('#') ? ('#' + 元素.split('#')[1]) : ''));
											else 优选API.push('sub://' + subMatch[1].trim() + (元素.includes('#') ? ('#' + 元素.split('#')[1]) : ''));
										} else if (地址部分.toLowerCase().startsWith('https://')) {
											优选API.push(元素);
										} else if (地址部分.toLowerCase().includes('://')) {
											if (元素.includes('#')) {
												const 地址备注分离 = 元素.split('#');
												其他节点.push(地址备注分离[0] + '#' + encodeURIComponent(decodeURIComponent(地址备注分离[1])));
											} else 其他节点.push(元素);
										} else {
											if (地址部分.includes('*')) {
												优选IP.push(替换星号为随机字符(地址部分) + 备注部分);
											} else 优选IP.push(元素);
										}
									}
								}
								const 请求优选API内容 = await 请求优选API(优选API, '443');
								const 合并其他节点数组 = [...new Set(其他节点.concat(请求优选API内容[1]))];
								其他节点LINK = 合并其他节点数组.length > 0 ? 合并其他节点数组.join('\n') + '\n' : '';
								const 优选API的IP = 请求优选API内容[0];
								反代IP池 = 请求优选API内容[3] || [];
								完整优选IP = [...new Set(优选IP.concat(优选API的IP))];
							} else {
								let 优选订阅生成器HOST = url.searchParams.get('sub') || config_JSON.优选订阅生成.SUB;
								const [优选生成器IP数组, 优选生成器其他节点] = await 获取优选订阅生成器数据(优选订阅生成器HOST);
								完整优选IP = 完整优选IP.concat(优选生成器IP数组);
								其他节点LINK += 优选生成器其他节点;
							}
							完整优选IP = expandPreferredEndpointList(完整优选IP);
							const ECHLINK参数 = config_JSON.ECH ? `&ech=${encodeURIComponent((config_JSON.ECHConfig.SNI ? config_JSON.ECHConfig.SNI + '+' : '') + config_JSON.ECHConfig.DNS)}` : '';
							const isLoonOrSurge = ua.includes('loon') || ua.includes('surge');
							const { type: 传输协议, 路径字段名, 域名字段名 } = 获取传输协议配置(config_JSON);
							订阅内容 = 其他节点LINK + 完整优选IP.map(原始地址 => {
								let 节点地址, 节点端口 = "443", 节点备注;
								const preferredEndpoint = parsePreferredEndpoint(原始地址);

								if (preferredEndpoint) {
									节点地址 = preferredEndpoint.address;
									节点端口 = preferredEndpoint.port;
									节点备注 = preferredEndpoint.remark;
								} else {

									debugWarn(`[Subscription] Ignored invalid preferred endpoint: ${原始地址}`);
									return null;
								}

								let 完整节点路径 = config_JSON.完整节点路径;

								const 链式代理匹配 = 节点备注.match(/\$(socks5|http|https|turn|sstp):\/\/([^#\s]+)/i);
								if (链式代理匹配) {
									try {
										const 代理协议 = 链式代理匹配[1].toLowerCase(), 代理参数 = 链式代理匹配[2];
										const 链式代理数据 = { type: 代理协议, ...获取SOCKS5账号(代理参数, 获取代理默认端口(代理协议)) };
										完整节点路径 = `/video/${base64SecretEncode(JSON.stringify(链式代理数据), userID) + (config_JSON.启用0RTT ? '?ed=2560' : '')}`;
										节点备注 = 节点备注.replace(链式代理匹配[0], '').trim() || 节点地址;
									} catch (error) {
										debugWarn(`[Subscription] Chain proxy directive parse failed and was ignored: ${链式代理匹配[0]} (${error && error.message ? error.message : error})`);
									}
								} else if (反代IP池.length > 0) {
									const 匹配到的反代IP = 反代IP池.find(p => p.includes(节点地址));
									if (匹配到的反代IP) 完整节点路径 = (`${config_JSON.PATH}/proxyip=${匹配到的反代IP}`).replace(/\/\//g, '/') + (config_JSON.启用0RTT ? '?ed=2560' : '');
								}
								if (isLoonOrSurge) 完整节点路径 = 完整节点路径.replace(/,/g, '%2C');

								if (协议类型 === 'ss' && !作为优选订阅生成器) {
									if (!config_JSON.SS.TLS) {
										const TLS端口 = [443, 2053, 2083, 2087, 2096, 8443];
										const NOTLS端口 = [80, 2052, 2082, 2086, 2095, 8080];
										节点端口 = String(NOTLS端口[TLS端口.indexOf(Number(节点端口))] ?? 节点端口);
									}
									完整节点路径 = (完整节点路径.includes('?') ? 完整节点路径.replace('?', '?enc=' + config_JSON.SS.加密方式 + '&') : (完整节点路径 + '?enc=' + config_JSON.SS.加密方式)).replace(/([=,])/g, '\\$1');
									if (!isSubConverterRequest) 完整节点路径 = 完整节点路径 + ';mux=0';
									return `${协议类型}://${btoa(config_JSON.SS.加密方式 + ':00000000-0000-4000-8000-000000000000')}@${节点地址}:${节点端口}?plugin=v2${encodeURIComponent('ray-plugin;mode=websocket;host=example.com;path=' + (config_JSON.随机路径 ? 随机路径(完整节点路径) : 完整节点路径) + (config_JSON.SS.TLS ? ';tls' : '')) + ECHLINK参数 + TLS分片参数}#${encodeURIComponent(节点备注)}`;
								} else {
									const 传输路径参数值 = 获取传输路径参数值(config_JSON, 完整节点路径, 作为优选订阅生成器);
									return `${协议类型}://00000000-0000-4000-8000-000000000000@${节点地址}:${节点端口}?security=tls&type=${传输协议 + ECHLINK参数}&${域名字段名}=example.com&fp=${config_JSON.Fingerprint}&sni=example.com&${路径字段名}=${encodeURIComponent(传输路径参数值) + TLS分片参数}&encryption=none#${encodeURIComponent(节点备注)}`;
								}
							}).filter(item => item !== null).join('\n');
						} else {
							const 订阅转换URL = `${config_JSON.订阅转换配置.SUBAPI}/sub?target=${订阅类型}&url=${encodeURIComponent(url.protocol + '//' + url.host + '/sub?target=mixed&token=' + 今日订阅转换后端专属TOKEN + '&asOrg=' + 识别运营商(request) + (url.searchParams.has('sub') && url.searchParams.get('sub') != '' ? `&sub=${url.searchParams.get('sub')}` : ''))}&config=${encodeURIComponent(config_JSON.订阅转换配置.SUBCONFIG)}&emoji=${config_JSON.订阅转换配置.SUBEMOJI}&scv=${config_JSON.跳过证书验证}`;
							try {
								const response = await fetch(订阅转换URL, { headers: { 'User-Agent': 'Subconverter for ' + 订阅类型 + ' edge' + 'tunnel (https://github.com/cmliu/edge' + 'tunnel)' } });
								if (response.ok) {
									订阅内容 = await response.text();
									if (url.searchParams.has('surge') || ua.includes('surge')) 订阅内容 = Surge订阅配置文件热补丁(订阅内容, url.protocol + '//' + url.host + '/sub?token=' + 订阅TOKEN + '&surge', config_JSON);
								} else return new Response('Subscription conversion backend error: ' + response.statusText, { status: response.status });
							} catch (error) {
								return new Response('Subscription conversion backend error: ' + error.message, { status: 403 });
							}
						}

						if (!ua.includes('subconverter') && 用户客户端请求订阅) {
							订阅内容 = finalizeSubscriptionContent(订阅内容, config_JSON);
						}

						if (订阅类型 === 'mixed' && (!ua.includes('mozilla') || shouldBase64Subscription)) 订阅内容 = btoa(订阅内容);

						if (订阅类型 === 'singbox') {
							订阅内容 = await Singbox订阅配置文件热补丁(订阅内容, config_JSON);
							responseHeaders["content-type"] = 'application/json; charset=utf-8';
						} else if (订阅类型 === 'clash') {
							订阅内容 = Clash订阅配置文件热补丁(订阅内容, config_JSON);
							responseHeaders["content-type"] = 'application/x-yaml; charset=utf-8';
						}
						return new Response(订阅内容, { status: 200, headers: responseHeaders });
					}
				} else if (访问路径 === 'locations') {
					const cookies = request.headers.get('Cookie') || '';
					const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
					if (authCookie && authCookie === await MD5MD5(UA + 加密秘钥 + 管理员密码)) return fetch(new Request('https://speed.cloudflare.com/locations', { headers: { 'Referer': 'https://speed.cloudflare.com/' } }));
				} else if (访问路径 === 'robots.txt') return new Response('User-agent: *\nDisallow: /', { status: 200, headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });
			}
			// A KV-less deploy with a derived (non-explicit) UUID still works as a tunnel, so a bare
			// unauthenticated GET / here must NOT betray the proxy: serving the /noKV help page would make
			// an outbound fetch + return 404 on an unauthenticated request (a fingerprint). Fall through to
			// the camouflage/decoy page below instead — it makes zero outbound calls and looks like nginx.
		}

		let 伪装页URL = env.URL || 'nginx';
		if (伪装页URL && 伪装页URL !== 'nginx' && 伪装页URL !== '1101') {
			伪装页URL = 伪装页URL.trim().replace(/\/$/, '');
			if (!伪装页URL.match(/^https?:\/\//i)) 伪装页URL = 'https://' + 伪装页URL;
			if (伪装页URL.toLowerCase().startsWith('http://')) 伪装页URL = 'https://' + 伪装页URL.substring(7);
			try { const u = new URL(伪装页URL); 伪装页URL = u.protocol + '//' + u.host } catch (e) { 伪装页URL = 'nginx' }
		}
		if (伪装页URL === '1101') return new Response(await html1101(url.host, 访问IP), { status: 530, statusText: 'Origin Error', headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
		try {
			const 反代URL = new URL(伪装页URL), 新请求头 = new Headers(request.headers);
			// Never forward our own auth cookie or client-identifying headers to the camouflage origin.
			for (const h of ['cookie', 'authorization', 'proxy-authorization', 'cf-connecting-ip', 'true-client-ip', 'x-real-ip', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host', 'cf-ray', 'cf-ipcountry', 'cdn-loop']) 新请求头.delete(h);
			新请求头.set('Host', 反代URL.host);
			新请求头.set('Referer', 反代URL.origin);
			新请求头.set('Origin', 反代URL.origin);
			if (!新请求头.has('User-Agent') && UA && UA !== 'null') 新请求头.set('User-Agent', UA);
			const 反代响应 = await fetch(反代URL.origin + url.pathname + url.search, { method: request.method, headers: 新请求头, body: request.body });
			const 内容类型 = 反代响应.headers.get('content-type') || '';

			if (/text|javascript|json|xml/.test(内容类型)) {
				// Only buffer+rewrite reasonably small camouflage pages; stream large ones unchanged so a
				// huge/hostile decoy response can't spike isolate memory and disrupt active tunnels.
				if (反代响应.headers.has('content-encoding')) return decoyResponse(反代响应, 反代URL.origin, url.origin);
				const 是否有长度头 = 反代响应.headers.has('content-length');
				const 内容长度 = Number(反代响应.headers.get('content-length') || 0);
				if (!是否有长度头 || !Number.isFinite(内容长度) || 内容长度 < 0 || 内容长度 > 2 * 1024 * 1024) return decoyResponse(反代响应, 反代URL.origin, url.origin);
				const 响应内容 = (await 反代响应.text()).replaceAll(反代URL.host, url.host);
				const responseHeaders = sanitizeDecoyHeaders(反代响应.headers, 反代URL.origin, url.origin);
				responseHeaders.delete('content-length');
				responseHeaders.delete('content-encoding');
				responseHeaders.delete('etag');
				responseHeaders.set('Cache-Control', 'no-store');
				return new Response(响应内容, { status: 反代响应.status, statusText: 反代响应.statusText, headers: responseHeaders });
			}
			return decoyResponse(反代响应, 反代URL.origin, url.origin);
		} catch (error) { }
		return new Response(await nginx(), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
		} catch (顶层错误) {
			try { log(`[fetch] Uncaught error: ${顶层错误?.message || 顶层错误}`); } catch (e) { }
			try {
				return new Response(await nginx(), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
			} catch (e) {
				return new Response('<!DOCTYPE html>\n<html>\n<head>\n<title>Welcome to nginx!</title>\n<style>html { color-scheme: light dark; } body { width: 35em; margin: 0 auto;\nfont-family: Tahoma, Verdana, Arial, sans-serif; }</style>\n</head>\n<body>\n<h1>Welcome to nginx!</h1>\n<p>If you see this page, the nginx web server is successfully installed and\nworking. Further configuration is required.</p>\n\n<p>For online documentation and support please refer to\n<a href="http://nginx.org/">nginx.org</a>.<br/>\nCommercial support is available at\n<a href="http://nginx.com/">nginx.com</a>.</p>\n\n<p><em>Thank you for using nginx.</em></p>\n</body>\n</html>', { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
			}
		}
	}
	// No scheduled()/cron handler: automated background ProxyIP scanning rapidly probes many
	// Cloudflare IPs and triggers network-abuse reports. ProxyIP scanning is manual-only.
};

async function 处理XHTTP请求(request, yourUUID) {
	// Pre-auth failures must be indistinguishable from an ordinary unmatched request: with PATH unset every
	// path matches, so any POST reaches this parser, and a distinctive 400 tells a scanner this is not a plain
	// web server. Same camouflage as the routing tail. The errors below are post-auth (a credential already
	// parsed) and may report real statuses.
	if (!request.body) return new Response(await nginx(), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
	const reader = request.body.getReader();
	const 首包 = await 读取XHTTP首包(reader, yourUUID);
	if (!首包) {
		try { reader.releaseLock() } catch (e) { }
		return new Response(await nginx(), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
	}
	if (isSpeedTestSite(首包.hostname)) {
		try { reader.releaseLock() } catch (e) { }
		return new Response('Forbidden', { status: 403 });
	}
	if (首包.isUDP && 首包.协议 !== 'trojan' && 首包.port !== 53) {
		try { reader.releaseLock() } catch (e) { }
		return new Response('UDP is not supported', { status: 400 });
	}

	const remoteConnWrapper = { socket: null, connectingPromise: null, retryConnect: null };
	remoteConnWrapper.追踪 = 创建连接追踪器('xhttp', request, getWorkerRequestContext(request)?.env);
	绑定请求中止(request, remoteConnWrapper);
	let 当前写入Socket = null;
	let 远端写入器 = null;
	const responseHeaders = new Headers({
		'Content-Type': 'application/octet-stream',
		'X-Accel-Buffering': 'no',
		'Cache-Control': 'no-store'
	});

	const 释放远端写入器 = () => {
		if (远端写入器) {
			try { 远端写入器.releaseLock() } catch (e) { }
			远端写入器 = null;
		}
		当前写入Socket = null;
	};

	const 获取远端写入器 = () => {
		const socket = remoteConnWrapper.socket;
		if (!socket) return null;
		if (socket !== 当前写入Socket) {
			释放远端写入器();
			当前写入Socket = socket;
			远端写入器 = socket.writable.getWriter();
		}
		return 远端写入器;
	};

	let XHTTP上行写入队列 = null;
	let 下行控制器 = null;
	let 下行拉取等待者 = [];
	const 释放下行背压 = () => { if (!下行拉取等待者.length) return; const w = 下行拉取等待者; 下行拉取等待者 = []; for (const r of w) r(); };
	const 等待下行可写 = () => {
		const c = 下行控制器;
		if (!c || typeof c.desiredSize !== 'number' || c.desiredSize > 0) return undefined;
		return new Promise(resolve => 下行拉取等待者.push(resolve));
	};
	return new Response(new ReadableStream({
		pull() { 释放下行背压(); },
		start(controller) {
			下行控制器 = controller;
			// Detached tunnel task so start() returns immediately — otherwise pull() never fires and the
			// downlink backpressure release (释放下行背压) deadlocks at the response HWM. Same fix + rationale
			// as the gRPC handler above; see the downlink-backpressure repro in tunnel-behavior.test.mjs.
			void (async () => {
			let 已关闭 = false;
			let udpRespHeader = 首包.respHeader;
			const 木马UDP上下文 = { 缓存: new Uint8Array(0) };
			const 魏烈思UDP上下文 = { 缓存: new Uint8Array(0) };
			const xhttpBridge = {
				readyState: WebSocket.OPEN,
				send(data) {
					if (已关闭) return;
					try {
						const chunk = data instanceof Uint8Array
							? data
							: data instanceof ArrayBuffer
								? new Uint8Array(data)
								: ArrayBuffer.isView(data)
									? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
									: new Uint8Array(data);
						controller.enqueue(chunk);
					} catch (e) {
						已关闭 = true;
						this.readyState = WebSocket.CLOSED;
						释放下行背压();
						return;
					}
					return 等待下行可写();
				},
				close() {
					if (已关闭) return;
					已关闭 = true;
					释放下行背压();
					this.readyState = WebSocket.CLOSED;
					XHTTP上行写入队列?.清空();
					try {
						const cancelPromise = reader.cancel();
						if (cancelPromise && typeof cancelPromise.catch === 'function') cancelPromise.catch(() => { });
					} catch (e) { }
					try { controller.close() } catch (e) { }
				}
			};

			const 上行写入队列 = XHTTP上行写入队列 = 创建上行写入队列({
				获取写入器: 获取远端写入器,
				释放写入器: 释放远端写入器,
				重试连接: async () => {
					if (typeof remoteConnWrapper.retryConnect !== 'function') throw new Error('retry unavailable');
					await remoteConnWrapper.retryConnect();
				},
				关闭连接: () => {
					closeRemoteSocketQuietly(remoteConnWrapper.socket);
					closeSocketQuietly(xhttpBridge);
				},
				写入开始: () => { remoteConnWrapper.已向远端发送数据 = true; remoteConnWrapper.活跃写入数 = (remoteConnWrapper.活跃写入数 | 0) + 1; }, 写入结束: () => { remoteConnWrapper.活跃写入数 = Math.max(0, (remoteConnWrapper.活跃写入数 | 0) - 1); }, 上行活动: () => { remoteConnWrapper.请求已发送 = true; remoteConnWrapper.记录上行活动?.(); }, 统计上行: remoteConnWrapper.追踪 ? (n) => 追踪上行(remoteConnWrapper.追踪, n) : undefined,
				名称: 'XHTTP upload',
				写入超时毫秒: getUplinkWriteTimeoutMs(getWorkerRequestContext(request).env)
			});
			if (remoteConnWrapper.追踪) remoteConnWrapper.追踪.队列统计 = 上行写入队列.获取统计;

			const 写入远端 = async (payload, allowRetry = true) => {
				return 上行写入队列.写入并等待(payload, allowRetry);
			};

			try {
				if (首包.isUDP) {
					if (首包.rawData?.byteLength) {
						if (首包.协议 === 'trojan') await 转发木马UDP数据(首包.rawData, xhttpBridge, 木马UDP上下文, request);
						else await forwardataudp(首包.rawData, xhttpBridge, udpRespHeader, request, null, 魏烈思UDP上下文, remoteConnWrapper.追踪);
						udpRespHeader = null;
					}
				} else {
					await forwardataTCP(首包.hostname, 首包.port, 首包.rawData, xhttpBridge, 首包.respHeader, remoteConnWrapper, yourUUID, request);
				}

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (!value || value.byteLength === 0) continue;
					if (首包.isUDP) {
						if (首包.协议 === 'trojan') await 转发木马UDP数据(value, xhttpBridge, 木马UDP上下文, request);
						else await forwardataudp(value, xhttpBridge, udpRespHeader, request, null, 魏烈思UDP上下文, remoteConnWrapper.追踪);
						udpRespHeader = null;
					} else {
						if (!(await 写入远端(value))) throw new Error('Remote socket is not ready');
					}
				}

				if (!首包.isUDP) {
					await 上行写入队列.等待空();
					const writer = 获取远端写入器();
					if (writer) {
						try { await writer.close() } catch (e) { }
					}
				}
			} catch (err) {
				if (!是流取消错误(err) && !remoteConnWrapper.客户端已关闭) log(`[XHTTP forwarding] Failed to process: ${err?.message || err}`);
				追踪关闭(remoteConnWrapper.追踪, remoteConnWrapper, err);
				closeRemoteSocketQuietly(remoteConnWrapper.socket); // close the upstream too (WS/gRPC already do)
				closeSocketQuietly(xhttpBridge);
			} finally {
				追踪关闭(remoteConnWrapper.追踪, remoteConnWrapper);
				上行写入队列.清空();
				释放远端写入器();
				释放下行背压();
				try { reader.releaseLock() } catch (e) { }
			}
			})().catch(err => { if (!是流取消错误(err)) log(`[XHTTP tunnel] ${err?.message || err}`); try { 下行控制器?.error?.(err) } catch (e) { } });
		},
		async cancel() {
			remoteConnWrapper.客户端已关闭 = true;
			追踪关闭(remoteConnWrapper.追踪, remoteConnWrapper);
			释放下行背压();
			XHTTP上行写入队列?.清空();
			closeRemoteSocketQuietly(remoteConnWrapper.socket);
			释放远端写入器();
			try { await reader.cancel() } catch (e) { }
			try { reader.releaseLock() } catch (e) { }
		}
	}, new ByteLengthQueuingStrategy({ highWaterMark: getDownlinkBackpressureHwm(getWorkerRequestContext(request).env) })), { status: 200, headers: responseHeaders });
}

function 有效数据长度(data) {
	if (!data) return 0;
	if (typeof data.byteLength === 'number') return data.byteLength;
	if (typeof data.length === 'number') return data.length;
	return 0;
}

async function 读取XHTTP首包(reader, token) {
	const decoder = VLESS文本解码器;

	const 尝试解析魏烈思首包 = (data) => {
		const length = data.byteLength;
		if (length < 18) return { 状态: 'need_more' };
		if (!UUID字节匹配(data, 1, token)) return { 状态: 'invalid' };

		const optLen = data[17];
		const cmdIndex = 18 + optLen;
		if (length < cmdIndex + 1) return { 状态: 'need_more' };

		const cmd = data[cmdIndex];
		if (cmd !== 1 && cmd !== 2) return { 状态: 'invalid' };

		const portIndex = cmdIndex + 1;
		if (length < portIndex + 3) return { 状态: 'need_more' };

		const port = (data[portIndex] << 8) | data[portIndex + 1];
		const addressType = data[portIndex + 2];
		const addressIndex = portIndex + 3;
		let headerLen = -1;
		let hostname = '';

		if (addressType === 1) {
			if (length < addressIndex + 4) return { 状态: 'need_more' };
			hostname = `${data[addressIndex]}.${data[addressIndex + 1]}.${data[addressIndex + 2]}.${data[addressIndex + 3]}`;
			headerLen = addressIndex + 4;
		} else if (addressType === 2) {
			if (length < addressIndex + 1) return { 状态: 'need_more' };
			const domainLen = data[addressIndex];
			if (length < addressIndex + 1 + domainLen) return { 状态: 'need_more' };
			hostname = decoder.decode(data.subarray(addressIndex + 1, addressIndex + 1 + domainLen));
			headerLen = addressIndex + 1 + domainLen;
		} else if (addressType === 3) {
			if (length < addressIndex + 16) return { 状态: 'need_more' };
			const ipv6 = [];
			for (let i = 0; i < 8; i++) {
				const base = addressIndex + i * 2;
				ipv6.push(((data[base] << 8) | data[base + 1]).toString(16));
			}
			hostname = ipv6.join(':');
			headerLen = addressIndex + 16;
		} else return { 状态: 'invalid' };

		if (!hostname) return { 状态: 'invalid' };

		return {
			状态: 'ok',
			结果: {
				协议: 'vl' + 'ess',
				hostname,
				port,
				isUDP: cmd === 2,
				rawData: data.subarray(headerLen),
				respHeader: new Uint8Array([data[0], 0]),
			}
		};
	};

	const 尝试解析木马首包 = (data) => {
		const length = data.byteLength;
		if (length < 58) return { 状态: 'need_more' };
		if (data[56] !== 0x0d || data[57] !== 0x0a) return { 状态: 'invalid' };
		const 密码哈希 = sha224(token);
		const 密码哈希字节 = new TextEncoder().encode(密码哈希);
		for (let i = 0; i < 56; i++) {
			if (data[i] !== 密码哈希字节[i]) return { 状态: 'invalid' };
		}

		const socksStart = 58;
		if (length < socksStart + 2) return { 状态: 'need_more' };
		const cmd = data[socksStart];
		if (cmd !== 1 && cmd !== 3) return { 状态: 'invalid' };
		const isUDP = cmd === 3;

		const atype = data[socksStart + 1];
		let cursor = socksStart + 2;
		let hostname = '';

		if (atype === 1) {
			if (length < cursor + 4) return { 状态: 'need_more' };
			hostname = `${data[cursor]}.${data[cursor + 1]}.${data[cursor + 2]}.${data[cursor + 3]}`;
			cursor += 4;
		} else if (atype === 3) {
			if (length < cursor + 1) return { 状态: 'need_more' };
			const domainLen = data[cursor];
			if (length < cursor + 1 + domainLen) return { 状态: 'need_more' };
			hostname = decoder.decode(data.subarray(cursor + 1, cursor + 1 + domainLen));
			cursor += 1 + domainLen;
		} else if (atype === 4) {
			if (length < cursor + 16) return { 状态: 'need_more' };
			const ipv6 = [];
			for (let i = 0; i < 8; i++) {
				const base = cursor + i * 2;
				ipv6.push(((data[base] << 8) | data[base + 1]).toString(16));
			}
			hostname = ipv6.join(':');
			cursor += 16;
		} else return { 状态: 'invalid' };

		if (!hostname) return { 状态: 'invalid' };
		if (length < cursor + 4) return { 状态: 'need_more' };

		const port = (data[cursor] << 8) | data[cursor + 1];
		if (data[cursor + 2] !== 0x0d || data[cursor + 3] !== 0x0a) return { 状态: 'invalid' };
		const dataOffset = cursor + 4;

		return {
			状态: 'ok',
			结果: {
				协议: 'trojan',
				hostname,
				port,
				isUDP,
				rawData: data.subarray(dataOffset),
				respHeader: null,
			}
		};
	};

	let buffer = new Uint8Array(1024);
	let offset = 0;

	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			if (offset === 0) return null;
			break;
		}

		const chunk = 数据转Uint8Array(value);
		if (offset + chunk.byteLength > XHTTP_FIRST_PACKET_MAX_BYTES) return null;
		if (offset + chunk.byteLength > buffer.byteLength) {
			const newBuffer = new Uint8Array(Math.max(buffer.byteLength * 2, offset + chunk.byteLength));
			newBuffer.set(buffer.subarray(0, offset));
			buffer = newBuffer;
		}

		buffer.set(chunk, offset);
		offset += chunk.byteLength;

		const 当前数据 = buffer.subarray(0, offset);
		const 木马结果 = 尝试解析木马首包(当前数据);
		if (木马结果.状态 === 'ok') return { ...木马结果.结果, reader };

		const 魏烈思结果 = 尝试解析魏烈思首包(当前数据);
		if (魏烈思结果.状态 === 'ok') return { ...魏烈思结果.结果, reader };

		if (木马结果.状态 === 'invalid' && 魏烈思结果.状态 === 'invalid') return null;
	}

	const 最终数据 = buffer.subarray(0, offset);
	const 最终木马结果 = 尝试解析木马首包(最终数据);
	if (最终木马结果.状态 === 'ok') return { ...最终木马结果.结果, reader };
	const 最终魏烈思结果 = 尝试解析魏烈思首包(最终数据);
	if (最终魏烈思结果.状态 === 'ok') return { ...最终魏烈思结果.结果, reader };
	return null;
}

async function 处理gRPC请求(request, yourUUID) {
	// Pre-auth: same camouflage as 处理XHTTP请求 rather than a fingerprintable 400.
	if (!request.body) return new Response(await nginx(), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
	const reader = request.body.getReader();
	const remoteConnWrapper = { socket: null, connectingPromise: null, retryConnect: null };
	remoteConnWrapper.追踪 = 创建连接追踪器('grpc', request, getWorkerRequestContext(request)?.env);
	绑定请求中止(request, remoteConnWrapper);
	let isDnsQuery = false;
	const 木马UDP上下文 = { 缓存: new Uint8Array(0) };
	const 魏烈思UDP上下文 = { 缓存: new Uint8Array(0) };
	let 判断是否是木马 = null;
	let 当前写入Socket = null;
	let 远端写入器 = null;
	let GRPC上行写入队列 = null;

	const grpcHeaders = new Headers({
		'Content-Type': 'application/grpc',
		'grpc-status': '0',
		'X-Accel-Buffering': 'no',
		'Cache-Control': 'no-store'
	});

	const 下行缓存上限 = getDownlinkGrainBytes(getWorkerRequestContext(request).env);
	const 下行刷新间隔 = Math.max(下行Grain静默毫秒, 1);

	// Downstream backpressure: pause the remote->client producer when the response stream's
	// buffer is full (desiredSize<=0), resume when the runtime pulls. Bounds isolate memory.
	let 下行控制器 = null;
	let 下行拉取等待者 = [];
	const 释放下行背压 = () => { if (!下行拉取等待者.length) return; const w = 下行拉取等待者; 下行拉取等待者 = []; for (const r of w) r(); };
	const 等待下行可写 = () => {
		const c = 下行控制器;
		if (!c || typeof c.desiredSize !== 'number' || c.desiredSize > 0) return undefined;
		return new Promise(resolve => 下行拉取等待者.push(resolve));
	};

	return new Response(new ReadableStream({
		pull() { 释放下行背压(); },
		start(controller) {
			下行控制器 = controller;
			// Run the whole tunnel in a DETACHED task so start() returns immediately. Per the WHATWG Streams
			// spec, pull() is NOT called until start()'s promise settles; with the read loop inside an async
			// start(), pull() never fires, so 释放下行背压() (the only downlink backpressure release) never runs
			// and the download deadlocks the moment the response queue fills at the HWM (~256KB). See the
			// "downlink backpressure must not deadlock" repro in scripts/tunnel-behavior.test.mjs.
			void (async () => {
			let 已关闭 = false;
			let 已清理 = false;
			let 发送队列 = [];
			let 队列字节数 = 0;
			let 刷新定时器 = null;
			let 刷新Microtask已排队 = false;
			const grpcBridge = {
				readyState: WebSocket.OPEN,
				send(data) {
					if (已关闭) return;
					const chunk = data instanceof Uint8Array ? data : new Uint8Array(data);
					// Zero-copy fast path for sizeable payloads: enqueue the frame prefix + the payload VIEW
					// instead of allocating a full frame and copying the payload into it. Identical wire bytes,
					// but removes the download path's dominant per-byte CPU cost — the copy is what pushed heavy
					// page loads over the Free plan's 10ms budget (exceededCpu killed the connection mid-load).
					// Safe to enqueue a view: every chunk arriving here owns an orphaned/fresh buffer (the grain
					// sender rebinds pendingBuffer on flush; the direct-send path rebinds readBuffer), so nothing
					// mutates it after we hand it off.
					if (chunk.byteLength >= GRPC_ZERO_COPY_MIN_BYTES) {
						刷新发送队列(true); // ordering: drain anything already batched before emitting the view
						if (!已关闭) {
							try {
								controller.enqueue(encodeGrpcFramePrefix(chunk.byteLength));
								controller.enqueue(chunk);
							} catch (e) {
								已关闭 = true;
								grpcBridge.readyState = WebSocket.CLOSED;
								释放下行背压();
							}
						}
						return 等待下行可写();
					}
					const frame = encodeGrpcDataFrame(chunk);
					发送队列.push(frame);
					队列字节数 += frame.byteLength;
					安排刷新发送队列();
					return 等待下行可写();
				},
				close() {
					if (this.readyState === WebSocket.CLOSED) return;
					刷新发送队列(true);
					已关闭 = true;
					释放下行背压();
					this.readyState = WebSocket.CLOSED;
					GRPC上行写入队列?.清空();
					try {
						const cancelPromise = reader.cancel();
						if (cancelPromise && typeof cancelPromise.catch === 'function') cancelPromise.catch(() => { });
					} catch (e) { }
					try { controller.close() } catch (e) { }
				}
			};

			const 刷新发送队列 = (force = false) => {
				刷新Microtask已排队 = false;
				if (刷新定时器) {
					clearTimeout(刷新定时器);
					刷新定时器 = null;
				}
				if ((!force && 已关闭) || 队列字节数 === 0) return;
				// Single-frame fast path (the common case): 发送队列[0] is already a complete gRPC frame from
				// encodeGrpcDataFrame, so enqueue it directly — skip allocating a merge buffer and copying the
				// whole payload a second time. CPU on multi-MB gRPC downloads correlates with per-chunk copies.
				let out;
				if (发送队列.length === 1) {
					out = 发送队列[0];
				} else {
					out = new Uint8Array(队列字节数);
					let offset = 0;
					for (const item of 发送队列) {
						out.set(item, offset);
						offset += item.byteLength;
					}
				}
				发送队列 = [];
				队列字节数 = 0;
				try {
					controller.enqueue(out);
				} catch (e) {
					已关闭 = true;
					grpcBridge.readyState = WebSocket.CLOSED;
					释放下行背压();
				}
			};

			const 安排刷新发送队列 = () => {
				if (队列字节数 >= 下行缓存上限) {
					刷新发送队列();
					return;
				}
				if (刷新Microtask已排队 || 刷新定时器) return;
				刷新Microtask已排队 = true;
				queueMicrotask(() => {
					刷新Microtask已排队 = false;
					if (已关闭 || 队列字节数 === 0 || 刷新定时器) return;
					刷新定时器 = setTimeout(刷新发送队列, 下行刷新间隔);
				});
			};

			const 关闭连接 = () => {
				if (已清理) return;
				已清理 = true;
				GRPC上行写入队列?.清空();
				if (!已关闭) 刷新发送队列(true);
				已关闭 = true;
				释放下行背压();
				grpcBridge.readyState = WebSocket.CLOSED;
				if (刷新定时器) clearTimeout(刷新定时器);
				if (远端写入器) {
					try { 远端写入器.releaseLock() } catch (e) { }
					远端写入器 = null;
				}
				当前写入Socket = null;
				try { reader.releaseLock() } catch (e) { }
				closeRemoteSocketQuietly(remoteConnWrapper.socket);
				try { controller.close() } catch (e) { }
			};

			const 释放远端写入器 = () => {
				if (远端写入器) {
					try { 远端写入器.releaseLock() } catch (e) { }
					远端写入器 = null;
				}
				当前写入Socket = null;
			};

			const 上行写入队列 = GRPC上行写入队列 = 创建上行写入队列({
				获取写入器: () => {
					const socket = remoteConnWrapper.socket;
					if (!socket) return null;
					if (socket !== 当前写入Socket) {
						释放远端写入器();
						当前写入Socket = socket;
						远端写入器 = socket.writable.getWriter();
					}
					return 远端写入器;
				},
				释放写入器: 释放远端写入器,
				重试连接: async () => {
					if (typeof remoteConnWrapper.retryConnect !== 'function') throw new Error('retry unavailable');
					await remoteConnWrapper.retryConnect();
				},
				关闭连接,
				写入开始: () => { remoteConnWrapper.已向远端发送数据 = true; remoteConnWrapper.活跃写入数 = (remoteConnWrapper.活跃写入数 | 0) + 1; }, 写入结束: () => { remoteConnWrapper.活跃写入数 = Math.max(0, (remoteConnWrapper.活跃写入数 | 0) - 1); }, 上行活动: () => { remoteConnWrapper.请求已发送 = true; remoteConnWrapper.记录上行活动?.(); }, 统计上行: remoteConnWrapper.追踪 ? (n) => 追踪上行(remoteConnWrapper.追踪, n) : undefined,
				名称: 'gRPC upload',
				写入超时毫秒: getUplinkWriteTimeoutMs(getWorkerRequestContext(request).env)
			});
			if (remoteConnWrapper.追踪) remoteConnWrapper.追踪.队列统计 = 上行写入队列.获取统计;

			const 写入远端 = async (payload, allowRetry = true) => {
				return 上行写入队列.写入并等待(payload, allowRetry);
			};

			try {
				let pending = new Uint8Array(0);
				let 正常结束 = false;
				while (true) {
					const { done, value } = await reader.read();
					if (done) { if (pending.byteLength !== 0) throw new Error(`gRPC request ended with an incomplete frame (${pending.byteLength}B pending)`); 正常结束 = true; break; }
					if (!value || value.byteLength === 0) continue;
					const 当前块 = value instanceof Uint8Array ? value : new Uint8Array(value);
					// Until the 魏烈思/木马 header authenticates (a remote socket exists, or this is the DNS path),
					// hold the parser to the small pre-auth frame cap so an unauthenticated peer cannot make it
					// reassemble a multi-MB frame.
					const 已认证 = Boolean(remoteConnWrapper.socket) || isDnsQuery;
					const parsedFrames = parseGrpcFrameChunk(pending, 当前块, 已认证 ? GRPC_MAX_FRAME_PAYLOAD_BYTES : GRPC_PREAUTH_MAX_FRAME_PAYLOAD_BYTES);
					pending = parsedFrames.pending;
					for (const payload of parsedFrames.payloads) {
						if (isDnsQuery) {
							if (判断是否是木马) await 转发木马UDP数据(payload, grpcBridge, 木马UDP上下文, request);
							else await forwardataudp(payload, grpcBridge, null, request, null, 魏烈思UDP上下文, remoteConnWrapper.追踪);
							continue;
						}
						if (remoteConnWrapper.socket) {
							if (!(await 写入远端(payload))) throw new Error('Remote socket is not ready');
						} else {
							const 首包bytes = 数据转Uint8Array(payload);
							if (判断是否是木马 === null) {
								// Authenticate 魏烈思 by UUID first; only fall to the 木马 CRLF heuristic when it isn't ours.
								const 是魏烈思 = 首包bytes.byteLength >= 18 && UUID字节匹配(首包bytes, 1, yourUUID);
								判断是否是木马 = !是魏烈思 && 首包bytes.byteLength >= 58 && 首包bytes[56] === 0x0d && 首包bytes[57] === 0x0a;
							}
							if (判断是否是木马) {
								const 解析结果 = 解析木马请求(首包bytes, yourUUID);
								if (解析结果?.hasError) throw new Error(解析结果.message || 'Invalid trojan request');
								const { port, hostname, rawClientData, isUDP } = 解析结果;
								log(`[gRPC] Trojan first packet: ${hostname}:${port} | UDP: ${isUDP ? 'yes' : 'no'}`);
								if (isSpeedTestSite(hostname)) throw new Error('Speedtest site is blocked');
								if (isUDP) {
									isDnsQuery = true;
									if (有效数据长度(rawClientData) > 0) await 转发木马UDP数据(rawClientData, grpcBridge, 木马UDP上下文, request);
								} else {
									await forwardataTCP(hostname, port, rawClientData, grpcBridge, null, remoteConnWrapper, yourUUID, request);
								}
							} else {
								判断是否是木马 = false;
								const 解析结果 = 解析魏烈思请求(首包bytes, yourUUID);
								if (解析结果?.hasError) throw new Error(解析结果.message || 'Invalid VLESS request');
								const { port, hostname, version, isUDP, rawClientData } = 解析结果;
								log(`[gRPC] VLESS first packet: ${hostname}:${port} | UDP: ${isUDP ? 'yes' : 'no'}`);
								if (isSpeedTestSite(hostname)) throw new Error('Speedtest site is blocked');
								if (isUDP) {
									if (port !== 53) throw new Error('UDP is not supported');
									isDnsQuery = true;
								}
								const respHeader = new Uint8Array([version, 0]);
								grpcBridge.send(respHeader);
								const rawData = rawClientData;
								if (isDnsQuery) {
									if (判断是否是木马) await 转发木马UDP数据(rawData, grpcBridge, 木马UDP上下文, request);
									else await forwardataudp(rawData, grpcBridge, null, request, null, 魏烈思UDP上下文, remoteConnWrapper.追踪);
								}
								else await forwardataTCP(hostname, port, rawData, grpcBridge, null, remoteConnWrapper, yourUUID, request);
							}
						}
					}
					刷新发送队列();
				}
				await 上行写入队列.等待空();
				// Opt-in gRPC duplex half-close (GRPC_HALF_CLOSE_ON_EOF, default off): on a NORMAL request-body
				// EOF, half-close only the upstream writable (FIN) and let the downstream response finish, rather
				// than aborting the whole duplex in the finally. Off by default preserves the proven full-close.
				if (正常结束 && !isDnsQuery && remoteConnWrapper.socket && isGrpcHalfCloseOnEof(getWorkerRequestContext(request).env)) {
					// Capture the EXACT socket + pipe up front: a concurrent reconnect can swap remoteConnWrapper.socket
					// while we're half-closing, and re-reading the mutable property could close the REPLACEMENT socket or
					// await the wrong pipe. Operate only on the socket whose upload just ended.
					const 半关闭Socket = remoteConnWrapper.socket;
					const 半关闭Pipe = remoteConnWrapper.pipePromise;
					释放远端写入器();
					let 半关闭写入器 = null;
					try {
						半关闭写入器 = 半关闭Socket.writable.getWriter();
						await withOperationTimeout(半关闭写入器.close(), 10000, 'gRPC upstream half-close timed out', () => { try { 半关闭Socket.close() } catch (e) { } });
					} catch (e) {
						// On ANY half-close failure (immediate reject or timeout), close THIS socket so the downstream
						// read side ends and the awaited pipe below can't hang on a peer that never EOFs.
						try { 半关闭Socket.close() } catch (e2) { }
					} finally { try { 半关闭写入器?.releaseLock() } catch (e) { } }
					if (半关闭Pipe) { try { await 半关闭Pipe } catch (e) { } }
				}
			} catch (err) {
				// A client-initiated stream cancellation ("Stream was cancelled.") is a normal gRPC lifecycle
				// event, not a tunnel failure — don't log it at error level or record it as reason=error.
				if (!是流取消错误(err) && !remoteConnWrapper.客户端已关闭) log(`[gRPC forwarding] Failed to process: ${err?.message || err}`);
				追踪关闭(remoteConnWrapper.追踪, remoteConnWrapper, err);
			} finally {
				追踪关闭(remoteConnWrapper.追踪, remoteConnWrapper);
				上行写入队列.清空();
				释放远端写入器();
				关闭连接();
			}
			})().catch(err => { if (!是流取消错误(err)) log(`[gRPC tunnel] ${err?.message || err}`); try { 下行控制器?.error?.(err) } catch (e) { } });
		},
		async cancel() {
			remoteConnWrapper.客户端已关闭 = true;
			追踪关闭(remoteConnWrapper.追踪, remoteConnWrapper);
			释放下行背压();
			GRPC上行写入队列?.清空();
			if (远端写入器) {
				try { 远端写入器.releaseLock() } catch (e) { }
				远端写入器 = null;
			}
			当前写入Socket = null;
			closeRemoteSocketQuietly(remoteConnWrapper.socket);
			try { await reader.cancel() } catch (e) { }
			try { reader.releaseLock() } catch (e) { }
		}
	}, new ByteLengthQueuingStrategy({ highWaterMark: getDownlinkBackpressureHwm(getWorkerRequestContext(request).env) })), { status: 200, headers: grpcHeaders });
}

function 是有效WS早期数据(bytes, token) {
	if (!bytes?.byteLength) return false;
	if (bytes.byteLength >= 18 && UUID字节匹配(bytes, 1, token)) return true;
	if (bytes.byteLength < 58 || bytes[56] !== 0x0d || bytes[57] !== 0x0a) return false;

	const trojanPassword = sha224(token);
	for (let i = 0; i < 56; i++) {
		if (bytes[i] !== trojanPassword.charCodeAt(i)) return false;
	}
	return true;
}

function 解码WS早期数据(header, token) {
	if (!header) return null;
	if (header.length > WS早期数据最大头长度) throw new Error('early data is too large');

	let bytes;
	const Uint8ArrayBase64 = /** @type {any} */ (Uint8Array);
	if (typeof Uint8ArrayBase64.fromBase64 === 'function') {
		try {
			bytes = Uint8ArrayBase64.fromBase64(header, { alphabet: 'base64url' });
		} catch (_) { }
	}
	if (!bytes) {
		let normalized = header.replace(/-/g, '+').replace(/_/g, '/');
		const padding = normalized.length % 4;
		if (padding) normalized += '='.repeat(4 - padding);
		let binaryString;
		try {
			binaryString = atob(normalized);
		} catch (_) {
			return null;
		}
		bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
	}

	if (bytes.byteLength > WS早期数据最大字节) throw new Error('early data is too large');
	return 是有效WS早期数据(bytes, token) ? bytes : null;
}


async function 处理WS请求(request, yourUUID, url) {
	const WS套接字对 = new WebSocketPair();
	const [clientSock, serverSock] = Object.values(WS套接字对);
	// Set binaryType BEFORE accept() so every binary frame is delivered as ArrayBuffer (Cloudflare
	// docs: with newer compatibility dates binary frames default to Blob, and binaryType only affects
	// messages dispatched after it is set).
	serverSock.binaryType = 'arraybuffer';
	try { (/** @type {any} */ (serverSock)).accept({ allowHalfOpen: true }) }
	catch (_) { serverSock.accept() }
	let remoteConnWrapper = { socket: null, connectingPromise: null, retryConnect: null };
	remoteConnWrapper.追踪 = 创建连接追踪器('ws', request, getWorkerRequestContext(request)?.env);
	绑定请求中止(request, remoteConnWrapper);
	let isDnsQuery = false;
	let 判断是否是木马 = null;
	const 木马UDP上下文 = { 缓存: new Uint8Array(0) };
	const 魏烈思UDP上下文 = { 缓存: new Uint8Array(0) };
	const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
	const SS模式禁用EarlyData = !!url.searchParams.get('enc');
	let WS上行写入队列 = null;
	let WS显式传输链 = Promise.resolve();
	let WS显式传输停止接收 = false, WS显式传输失败 = false, WS显式传输收尾已入队 = false;
	let WS显式队列字节 = 0, WS显式队列条目 = 0;
	let 判断协议类型 = null, 当前写入Socket = null, 远端写入器 = null;
	let ss上下文 = null, ss初始化任务 = null;

	const 释放远端写入器 = () => {
		if (远端写入器) {
			try { 远端写入器.releaseLock() } catch (e) { }
			远端写入器 = null;
		}
		当前写入Socket = null;
	};

	const 上行写入队列 = WS上行写入队列 = 创建上行写入队列({
		获取写入器: () => {
			const socket = remoteConnWrapper.socket;
			if (!socket) return null;
			if (socket !== 当前写入Socket) {
				释放远端写入器();
				当前写入Socket = socket;
				远端写入器 = socket.writable.getWriter();
			}
			return 远端写入器;
		},
		释放写入器: 释放远端写入器,
		重试连接: async () => {
			if (typeof remoteConnWrapper.retryConnect !== 'function') throw new Error('retry unavailable');
			await remoteConnWrapper.retryConnect();
		},
		关闭连接: () => {
			closeRemoteSocketQuietly(remoteConnWrapper.socket);
			closeSocketQuietly(serverSock);
		},
		写入开始: () => { remoteConnWrapper.已向远端发送数据 = true; remoteConnWrapper.活跃写入数 = (remoteConnWrapper.活跃写入数 | 0) + 1; }, 写入结束: () => { remoteConnWrapper.活跃写入数 = Math.max(0, (remoteConnWrapper.活跃写入数 | 0) - 1); }, 上行活动: () => { remoteConnWrapper.请求已发送 = true; remoteConnWrapper.记录上行活动?.(); }, 统计上行: remoteConnWrapper.追踪 ? (n) => 追踪上行(remoteConnWrapper.追踪, n) : undefined,
		名称: 'WS upload',
		写入超时毫秒: getUplinkWriteTimeoutMs(getWorkerRequestContext(request).env)
	});
	if (remoteConnWrapper.追踪) remoteConnWrapper.追踪.队列统计 = 上行写入队列.获取统计;

	const 写入远端 = async (chunk, allowRetry = true) => {
		return 上行写入队列.写入并等待(chunk, allowRetry);
	};

	// WS first packet must be parsed before a remote TCP socket exists. The upload queue is only
	// valid after forwardataTCP() has created remoteConnWrapper.socket. If we enqueue the first
	// WS frame before parsing it, the queue sees no writer, closes the WebSocket, and VLESS/Trojan
	// WS configs fail while gRPC/XHTTP still work. Wait for an in-flight connect when present,
	// otherwise return false so the caller continues to protocol parsing.
	const 尝试写入已存在远端 = async (chunk, allowRetry = true) => {
		if (remoteConnWrapper.connectingPromise) {
			try { await remoteConnWrapper.connectingPromise } catch (_) { }
		}
		if (!remoteConnWrapper.socket) return false;
		return 写入远端(chunk, allowRetry);
	};

	const 获取SS上下文 = async () => {
		if (ss上下文) return ss上下文;
		if (!ss初始化任务) {
			ss初始化任务 = (async () => {
				const 请求加密方式 = (url.searchParams.get('enc') || '').toLowerCase();
				const 首选加密配置 = SS支持加密配置[请求加密方式] || SS支持加密配置['aes-128-gcm'];
				const 入站候选加密配置 = [首选加密配置, ...Object.values(SS支持加密配置).filter(c => c.method !== 首选加密配置.method)];
				const 入站主密钥任务缓存 = new Map();
				const 取入站主密钥任务 = (config) => {
					if (!入站主密钥任务缓存.has(config.method)) 入站主密钥任务缓存.set(config.method, SS派生主密钥(yourUUID, config.keyLen));
					return 入站主密钥任务缓存.get(config.method);
				};
				const 入站状态 = {
					buffer: new Uint8Array(0),
					hasSalt: false,
					waitPayloadLength: null,
					decryptKey: null,
					nonceCounter: new Uint8Array(SSNonce长度),
					加密配置: null,
				};
				const 初始化入站解密状态 = async () => {
					const lengthCipherTotalLength = 2 + SSAEAD标签长度;
					const 最大盐长度 = Math.max(...入站候选加密配置.map(c => c.saltLen));
					const 最大对齐扫描字节 = 16;
					const 可扫描最大偏移 = Math.min(最大对齐扫描字节, Math.max(0, 入站状态.buffer.byteLength - (lengthCipherTotalLength + Math.min(...入站候选加密配置.map(c => c.saltLen)))));
					for (let offset = 0; offset <= 可扫描最大偏移; offset++) {
						for (const 加密配置 of 入站候选加密配置) {
							const 初始化最小长度 = offset + 加密配置.saltLen + lengthCipherTotalLength;
							if (入站状态.buffer.byteLength < 初始化最小长度) continue;
							const salt = 入站状态.buffer.subarray(offset, offset + 加密配置.saltLen);
							const lengthCipher = 入站状态.buffer.subarray(offset + 加密配置.saltLen, 初始化最小长度);
							const masterKey = await 取入站主密钥任务(加密配置);
							const decryptKey = await SS派生会话密钥(加密配置, masterKey, salt, ['decrypt']);
							const nonceCounter = new Uint8Array(SSNonce长度);
							try {
								const lengthPlain = await SSAEAD解密(decryptKey, nonceCounter, lengthCipher);
								if (lengthPlain.byteLength !== 2) continue;
								const payloadLength = (lengthPlain[0] << 8) | lengthPlain[1];
								if (payloadLength < 0 || payloadLength > 加密配置.maxChunk) continue;
								if (offset > 0) log(`[SS inbound] Detected ${offset}B leading noise and aligned automatically`);
								if (加密配置.method !== 首选加密配置.method) log(`[SS inbound] URL enc=${请求加密方式 || 首选加密配置.method} differs from actual ${加密配置.method}; switched automatically`);
								入站状态.buffer = 入站状态.buffer.subarray(初始化最小长度);
								入站状态.decryptKey = decryptKey;
								入站状态.nonceCounter = nonceCounter;
								入站状态.waitPayloadLength = payloadLength;
								入站状态.加密配置 = 加密配置;
								入站状态.hasSalt = true;
								return true;
							} catch (_) { }
						}
					}
					const 初始化失败判定长度 = 最大盐长度 + lengthCipherTotalLength + 最大对齐扫描字节;
					if (入站状态.buffer.byteLength >= 初始化失败判定长度) {
						throw new Error(`SS handshake decrypt failed (enc=${请求加密方式 || 'auto'}, candidates=${入站候选加密配置.map(c => c.method).join('/')})`);
					}
					return false;
				};
				const 入站解密器 = {
					async 输入(dataChunk) {
						const chunk = 数据转Uint8Array(dataChunk);
						if (chunk.byteLength > 0) 入站状态.buffer = 拼接字节数据(入站状态.buffer, chunk);
						if (!入站状态.hasSalt) {
							const 初始化成功 = await 初始化入站解密状态();
							if (!初始化成功) return [];
						}
						const plaintextChunks = [];
						while (true) {
							if (入站状态.waitPayloadLength === null) {
								const lengthCipherTotalLength = 2 + SSAEAD标签长度;
								if (入站状态.buffer.byteLength < lengthCipherTotalLength) break;
								const lengthCipher = 入站状态.buffer.subarray(0, lengthCipherTotalLength);
								入站状态.buffer = 入站状态.buffer.subarray(lengthCipherTotalLength);
								const lengthPlain = await SSAEAD解密(入站状态.decryptKey, 入站状态.nonceCounter, lengthCipher);
								if (lengthPlain.byteLength !== 2) throw new Error('SS length decrypt failed');
								const payloadLength = (lengthPlain[0] << 8) | lengthPlain[1];
								if (payloadLength < 0 || payloadLength > 入站状态.加密配置.maxChunk) throw new Error(`SS payload length invalid: ${payloadLength}`);
								入站状态.waitPayloadLength = payloadLength;
							}
							const payloadCipherTotalLength = 入站状态.waitPayloadLength + SSAEAD标签长度;
							if (入站状态.buffer.byteLength < payloadCipherTotalLength) break;
							const payloadCipher = 入站状态.buffer.subarray(0, payloadCipherTotalLength);
							入站状态.buffer = 入站状态.buffer.subarray(payloadCipherTotalLength);
							const payloadPlain = await SSAEAD解密(入站状态.decryptKey, 入站状态.nonceCounter, payloadCipher);
							plaintextChunks.push(payloadPlain);
							入站状态.waitPayloadLength = null;
						}
						return plaintextChunks;
					},
				};
				let 出站加密器 = null;
				const SS单批最大字节 = 32 * 1024;
				const 获取出站加密器 = async () => {
					if (出站加密器) return 出站加密器;
					if (!入站状态.加密配置) throw new Error('SS cipher is not negotiated');
					const 出站加密配置 = 入站状态.加密配置;
					const 出站主密钥 = await SS派生主密钥(yourUUID, 出站加密配置.keyLen);
					const 出站随机字节 = crypto.getRandomValues(new Uint8Array(出站加密配置.saltLen));
					const 出站加密密钥 = await SS派生会话密钥(出站加密配置, 出站主密钥, 出站随机字节, ['encrypt']);
					const 出站Nonce计数器 = new Uint8Array(SSNonce长度);
					let 随机字节已发送 = false;
					出站加密器 = {
						async 加密并发送(dataChunk, sendChunk) {
							const plaintextData = 数据转Uint8Array(dataChunk);
							if (!随机字节已发送) {
								await sendChunk(出站随机字节);
								随机字节已发送 = true;
							}
							if (plaintextData.byteLength === 0) return;
							let offset = 0;
							while (offset < plaintextData.byteLength) {
								const end = Math.min(offset + 出站加密配置.maxChunk, plaintextData.byteLength);
								const payloadPlain = plaintextData.subarray(offset, end);
								const lengthPlain = new Uint8Array(2);
								lengthPlain[0] = (payloadPlain.byteLength >>> 8) & 0xff;
								lengthPlain[1] = payloadPlain.byteLength & 0xff;
								const lengthCipher = await SSAEAD加密(出站加密密钥, 出站Nonce计数器, lengthPlain);
								const payloadCipher = await SSAEAD加密(出站加密密钥, 出站Nonce计数器, payloadPlain);
								const frame = new Uint8Array(lengthCipher.byteLength + payloadCipher.byteLength);
								frame.set(lengthCipher, 0);
								frame.set(payloadCipher, lengthCipher.byteLength);
								await sendChunk(frame);
								offset = end;
							}
						},
					};
					return 出站加密器;
				};
				let SS发送队列 = Promise.resolve();
				const SS入队发送 = (chunk) => {
					SS发送队列 = SS发送队列.then(async () => {
						if (serverSock.readyState !== WebSocket.OPEN) return;
						const 已初始化出站加密器 = await 获取出站加密器();
						await 已初始化出站加密器.加密并发送(chunk, async (encryptedChunk) => {
							if (encryptedChunk.byteLength > 0 && serverSock.readyState === WebSocket.OPEN) {
								await WebSocket发送并等待(serverSock, encryptedChunk.buffer);
							}
						});
					}).catch((error) => {
						log(`[SS send] Encryption failed: ${error?.message || error}`);
						closeSocketQuietly(serverSock);
					});
					return SS发送队列;
				};
				const 回包Socket = {
					get readyState() {
						return serverSock.readyState;
					},
					send(data) {
						const chunk = 数据转Uint8Array(data);
						if (chunk.byteLength <= SS单批最大字节) {
							return SS入队发送(chunk);
						}
						for (let i = 0; i < chunk.byteLength; i += SS单批最大字节) {
							SS入队发送(chunk.subarray(i, Math.min(i + SS单批最大字节, chunk.byteLength)));
						}
						return SS发送队列;
					},
					close() {
						closeSocketQuietly(serverSock);
					}
				};
				ss上下文 = {
					入站解密器,
					回包Socket,
					首包已建立: false,
					目标主机: '',
					目标端口: 0,
				};
				return ss上下文;
			})().finally(() => { ss初始化任务 = null });
		}
		return ss初始化任务;
	};

	const 处理SS数据 = async (chunk) => {
		const 上下文 = await 获取SS上下文();
		let 明文块数组 = null;
		try {
			明文块数组 = await 上下文.入站解密器.输入(chunk);
		} catch (err) {
			const msg = err?.message || `${err}`;
			// A steady-state AEAD tag failure surfaces as a WebCrypto DOMException named 'OperationError'
				// whose message ("The operation failed for an operation-specific reason") matches none of the
				// substrings below, so classify by name too — otherwise it falls through to the generic
				// WS-forwarding handler and is logged as an opaque failure instead of a decrypt failure.
				if (err?.name === 'OperationError' || msg.includes('Decryption failed') || msg.includes('SS handshake decrypt failed') || msg.includes('SS length decrypt failed')) {
				log(`[SS inbound] Decryption failed; connection closed: ${msg}`);
				closeSocketQuietly(serverSock);
				return;
			}
			throw err;
		}
		for (const 明文块 of 明文块数组) {
			let 已写入 = false;
			try {
				已写入 = await 尝试写入已存在远端(明文块, false);
			} catch (err) {
				if ((/** @type {any} */ (err))?.isQueueOverflow) throw err;
				已写入 = false;
			}
			if (已写入) continue;
			if (上下文.首包已建立 && 上下文.目标主机 && 上下文.目标端口 > 0) {
				await forwardataTCP(上下文.目标主机, 上下文.目标端口, 明文块, 上下文.回包Socket, null, remoteConnWrapper, yourUUID, request);
				continue;
			}
			const 明文数据 = 数据转Uint8Array(明文块);
			if (明文数据.byteLength < 3) throw new Error('invalid ss data');
			const addressType = 明文数据[0];
			let cursor = 1;
			let hostname = '';
			if (addressType === 1) {
				if (明文数据.byteLength < cursor + 4 + 2) throw new Error('invalid ss ipv4 length');
				hostname = `${明文数据[cursor]}.${明文数据[cursor + 1]}.${明文数据[cursor + 2]}.${明文数据[cursor + 3]}`;
				cursor += 4;
			} else if (addressType === 3) {
				if (明文数据.byteLength < cursor + 1) throw new Error('invalid ss domain length');
				const domainLength = 明文数据[cursor];
				cursor += 1;
				if (明文数据.byteLength < cursor + domainLength + 2) throw new Error('invalid ss domain data');
				hostname = SS文本解码器.decode(明文数据.subarray(cursor, cursor + domainLength));
				cursor += domainLength;
			} else if (addressType === 4) {
				if (明文数据.byteLength < cursor + 16 + 2) throw new Error('invalid ss ipv6 length');
				const ipv6 = [];
				const ipv6View = new DataView(明文数据.buffer, 明文数据.byteOffset + cursor, 16);
				for (let i = 0; i < 8; i++) ipv6.push(ipv6View.getUint16(i * 2).toString(16));
				hostname = ipv6.join(':');
				cursor += 16;
			} else {
				throw new Error(`invalid ss addressType: ${addressType}`);
			}
			if (!hostname) throw new Error(`invalid ss address: ${addressType}`);
			const port = (明文数据[cursor] << 8) | 明文数据[cursor + 1];
			cursor += 2;
			const rawClientData = 明文数据.subarray(cursor);
			if (isSpeedTestSite(hostname)) throw new Error('Speedtest site is blocked');
			上下文.首包已建立 = true;
			上下文.目标主机 = hostname;
			上下文.目标端口 = port;
			await forwardataTCP(hostname, port, rawClientData, 上下文.回包Socket, null, remoteConnWrapper, yourUUID, request);
		}
	};

	const 处理WS入站数据 = async (chunk) => {
		let 当前块字节 = null;
		// Ignore empty frames that arrive before the protocol header is parsed (e.g. a 0-byte
		// keepalive before the remote socket exists), so they never reach the VLESS/Trojan parser.
		if (判断协议类型 === null && !isDnsQuery && 有效数据长度(chunk) === 0) return;
		if (isDnsQuery) {
			if (判断是否是木马) return await 转发木马UDP数据(chunk, serverSock, 木马UDP上下文, request);
			return await forwardataudp(chunk, serverSock, null, request, null, 魏烈思UDP上下文, remoteConnWrapper.追踪);
		}
		if (判断协议类型 === 'ss') {
			await 处理SS数据(chunk);
			return;
		}
		if (await 尝试写入已存在远端(chunk)) return;

		if (判断协议类型 === null) {
			if (url.searchParams.get('enc')) 判断协议类型 = 'ss';
			else {
				当前块字节 = 当前块字节 || 数据转Uint8Array(chunk);
				const bytes = 当前块字节;
				// Authenticate the 魏烈思 UUID first; only fall to the 木马 CRLF heuristic when it isn't ours
				// (a 魏烈思 packet whose bytes 56-57 coincidentally equal CRLF must not be misrouted to 木马).
				const 是魏烈思 = bytes.byteLength >= 18 && UUID字节匹配(bytes, 1, yourUUID);
				判断协议类型 = (!是魏烈思 && bytes.byteLength >= 58 && bytes[56] === 0x0d && bytes[57] === 0x0a) ? 'trojan' : 'vless';
			}
			判断是否是木马 = 判断协议类型 === 'trojan';
			log(`[WS forwarding] Protocol: ${判断协议类型} | From: ${url.host} | UA: ${request.headers.get('user-agent') || 'Unknown'}`);
		}

		if (判断协议类型 === 'ss') {
			await 处理SS数据(chunk);
			return;
		}
		if (await 尝试写入已存在远端(chunk)) return;
		if (判断协议类型 === 'trojan') {
			const 解析结果 = 解析木马请求(chunk, yourUUID);
			if (解析结果?.hasError) throw new Error(解析结果.message || 'Invalid trojan request');
			const { port, hostname, rawClientData, isUDP } = 解析结果;
			if (isSpeedTestSite(hostname)) throw new Error('Speedtest site is blocked');
			if (isUDP) {
				isDnsQuery = true;
				if (有效数据长度(rawClientData) > 0) return 转发木马UDP数据(rawClientData, serverSock, 木马UDP上下文, request);
				return;
			}
			await forwardataTCP(hostname, port, rawClientData, serverSock, null, remoteConnWrapper, yourUUID, request);
		} else {
			判断是否是木马 = false;
			当前块字节 = 当前块字节 || 数据转Uint8Array(chunk);
			const bytes = 当前块字节;
			const 解析结果 = 解析魏烈思请求(bytes, yourUUID);
			if (解析结果?.hasError) throw new Error(解析结果.message || 'Invalid VLESS request');
			const { port, hostname, version, isUDP, rawClientData } = 解析结果;
			if (isSpeedTestSite(hostname)) throw new Error('Speedtest site is blocked');
			if (isUDP) {
				if (port === 53) isDnsQuery = true;
				else throw new Error('UDP is not supported');
			}
			const respHeader = new Uint8Array([version, 0]);
			const rawData = rawClientData;
			if (isDnsQuery) {
				if (判断是否是木马) return 转发木马UDP数据(rawData, serverSock, 木马UDP上下文, request);
				return forwardataudp(rawData, serverSock, respHeader, request, null, 魏烈思UDP上下文, remoteConnWrapper.追踪);
			}
			await forwardataTCP(hostname, port, rawData, serverSock, respHeader, remoteConnWrapper, yourUUID, request);
		}
	};

	const 处理WS显式传输错误 = (err) => {
		if (WS显式传输失败) return;
		WS显式传输失败 = true;
		WS显式传输停止接收 = true;
		WS显式队列字节 = 0;
		WS显式队列条目 = 0;
		const msg = err?.message || `${err}`;
		if (msg.includes('Network connection lost') || msg.includes('ReadableStream is closed')) {
			log(`[WS forwarding] Connection ended: ${msg}`);
		} else {
			log(`[WS forwarding] Failed to process: ${msg}`);
		}
		上行写入队列.清空();
		释放远端写入器();
		closeRemoteSocketQuietly(remoteConnWrapper.socket); // close the upstream directly, not only via the serverSock close cascade
		closeSocketQuietly(serverSock);
	};

	const 追加WS显式传输任务 = (任务) => {
		WS显式传输链 = WS显式传输链.then(任务).catch(处理WS显式传输错误);
		return WS显式传输链;
	};

	const 入队WS显式传输 = (data) => {
		if (WS显式传输停止接收 || WS显式传输失败) return;
		const chunkSize = Math.max(0, 有效数据长度(data));
		const nextBytes = WS显式队列字节 + chunkSize;
		const nextItems = WS显式队列条目 + 1;
		if (nextBytes > 上行队列最大字节 || nextItems > 上行队列最大条目) {
			处理WS显式传输错误(new Error(`[WS explicit transport] Queue overflow: ${nextBytes}B/${nextItems}`));
			return;
		}
		WS显式队列字节 = nextBytes;
		WS显式队列条目 = nextItems;
		追加WS显式传输任务(async () => {
			WS显式队列字节 = Math.max(0, WS显式队列字节 - chunkSize);
			WS显式队列条目 = Math.max(0, WS显式队列条目 - 1);
			if (WS显式传输失败) return;
			await 处理WS入站数据(data);
		});
	};

	const 收尾WS显式传输 = (关闭远端 = false) => {
		if (WS显式传输收尾已入队) return;
		WS显式传输收尾已入队 = true;
		WS显式传输停止接收 = true;
		追加WS显式传输任务(async () => {
			if (WS显式传输失败) return;
			await 上行写入队列.等待空();
			释放远端写入器();
		}).finally(() => {
			// Close the remote only AFTER the serialized message chain drained and the upload queue emptied.
			// Closing it synchronously in the WS 'close' handler raced the chain: a final message queued just
			// before the close frame was still being written when the socket died, so its bytes were lost
			// (truncated uploads / a Telegram send failing right at teardown). Error paths still close at once.
			if (关闭远端) { closeRemoteSocketQuietly(remoteConnWrapper.socket); }
		});
	};

	serverSock.addEventListener('message', (event) => {
		if (typeof event.data === 'string') {
			处理WS显式传输错误(new Error('[WS explicit transport] text frames are not supported'));
			return;
		}
		// Per-MESSAGE ceiling. The aggregate queue cap can't protect the isolate from one huge frame: the
		// runtime fully buffers an inbound WS message before this handler ever sees it, so a single oversized
		// frame is already resident. Reject it here instead of admitting it to the queue and retaining it
		// further. Real clients fragment well below this; the cap is generous enough never to hit normal use.
		const 单帧字节 = 有效数据长度(event.data);
		if (单帧字节 > WS单帧最大字节) {
			处理WS显式传输错误(new Error(`[WS explicit transport] frame too large: ${单帧字节}B`));
			return;
		}
		入队WS显式传输(event.data);
	});
	serverSock.addEventListener('close', () => {
		// Mark this as a CLIENT-initiated close so the downlink pipe doesn't score the (possibly healthy)
		// route as failed or burn a ProxyIP fallback dial on a connection the client already abandoned.
		remoteConnWrapper.客户端已关闭 = true;
		remoteConnWrapper.closeHint = 'client_close';
		追踪关闭(remoteConnWrapper.追踪, remoteConnWrapper);
		closeSocketQuietly(serverSock);
		// The outbound remote socket is closed by 收尾WS显式传输's finalizer — AFTER the message chain drains
		// and the upload queue empties — so a client disconnect still can't leak the socket + a blocked reader
		// (gRPC/XHTTP do this in cancel()), but a final in-flight upload isn't cut off mid-write either.
		收尾WS显式传输(true);
	});
	serverSock.addEventListener('error', (err) => {
		// A WS transport error is a client-side termination too (like 'close'): mark it so the downlink pipe
		// doesn't score the route as failed or spend a ProxyIP fallback dial on an already-dead client.
		remoteConnWrapper.客户端已关闭 = true;
		remoteConnWrapper.closeHint = 'client_ws_error';
		追踪关闭(remoteConnWrapper.追踪, remoteConnWrapper, err?.error || err);
		closeRemoteSocketQuietly(remoteConnWrapper.socket);
		处理WS显式传输错误(err);
	});


	if (!SS模式禁用EarlyData && earlyDataHeader) {
		try {
			const bytes = 解码WS早期数据(earlyDataHeader, yourUUID);
			if (bytes?.byteLength) 入队WS显式传输(bytes.buffer);
		} catch (error) {
			处理WS显式传输错误(error);
		}
	}

	return new Response(null, { status: 101, webSocket: clientSock, headers: { 'Sec-WebSocket-Extensions': '' } });
}

const 木马文本解码器 = new TextDecoder();

function 解析木马请求(buffer, passwordPlainText) {
	const data = 数据转Uint8Array(buffer);
	if (data.byteLength < 58) return { hasError: true, message: "invalid data" };
	let crLfIndex = 56;
	if (data[crLfIndex] !== 0x0d || data[crLfIndex + 1] !== 0x0a) return { hasError: true, message: "invalid header format" };
	const sha224Password = sha224(passwordPlainText);
	for (let i = 0; i < crLfIndex; i++) {
		if (data[i] !== sha224Password.charCodeAt(i)) return { hasError: true, message: "invalid password" };
	}

	const socks5Index = crLfIndex + 2;
	if (data.byteLength < socks5Index + 6) return { hasError: true, message: "invalid S5 request data" };

	const cmd = data[socks5Index];
	if (cmd !== 1 && cmd !== 3) return { hasError: true, message: "unsupported command, only TCP/UDP is allowed" };
	const isUDP = cmd === 3;

	const atype = data[socks5Index + 1];
	let addressLength = 0;
	let addressIndex = socks5Index + 2;
	let address = "";
	switch (atype) {
		case 1: // IPv4
			addressLength = 4;
			if (data.byteLength < addressIndex + addressLength + 4) return { hasError: true, message: "invalid S5 request data" };
			address = `${data[addressIndex]}.${data[addressIndex + 1]}.${data[addressIndex + 2]}.${data[addressIndex + 3]}`;
			break;
		case 3: // Domain
			if (data.byteLength < addressIndex + 1) return { hasError: true, message: "invalid S5 request data" };
			addressLength = data[addressIndex];
			addressIndex += 1;
			if (data.byteLength < addressIndex + addressLength + 4) return { hasError: true, message: "invalid S5 request data" };
			address = 木马文本解码器.decode(data.subarray(addressIndex, addressIndex + addressLength));
			break;
		case 4: // IPv6
			addressLength = 16;
			if (data.byteLength < addressIndex + addressLength + 4) return { hasError: true, message: "invalid S5 request data" };
			const ipv6 = [];
			for (let i = 0; i < 8; i++) {
				const partIndex = addressIndex + i * 2;
				ipv6.push(((data[partIndex] << 8) | data[partIndex + 1]).toString(16));
			}
			address = ipv6.join(":");
			break;
		default:
			return { hasError: true, message: `invalid addressType is ${atype}` };
	}

	if (!address) {
		return { hasError: true, message: `address is empty, addressType is ${atype}` };
	}

	const portIndex = addressIndex + addressLength;
	if (data.byteLength < portIndex + 4) return { hasError: true, message: "invalid S5 request data" };
	const portRemote = (data[portIndex] << 8) | data[portIndex + 1];
	if (data[portIndex + 2] !== 0x0d || data[portIndex + 3] !== 0x0a) return { hasError: true, message: "invalid S5 delimiter" };

	return {
		hasError: false,
		addressType: atype,
		port: portRemote,
		hostname: address,
		isUDP,
		rawClientData: data.subarray(portIndex + 4)
	};
}

const UUID字节缓存 = new Map();
const VLESS文本解码器 = new TextDecoder();

function 读取十六进制半字节(code) {
	if (code >= 48 && code <= 57) return code - 48;
	code |= 32;
	if (code >= 97 && code <= 102) return code - 87;
	return -1;
}

function 获取UUID字节(uuid) {
	const key = String(uuid || '');
	let cached = UUID字节缓存.get(key);
	if (cached) return cached;

	const clean = key.replace(/-/g, '');
	if (clean.length !== 32) return null;

	const bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		const high = 读取十六进制半字节(clean.charCodeAt(i * 2));
		const low = 读取十六进制半字节(clean.charCodeAt(i * 2 + 1));
		if (high < 0 || low < 0) return null;
		bytes[i] = (high << 4) | low;
	}

	if (UUID字节缓存.size >= 32) UUID字节缓存.clear();
	UUID字节缓存.set(key, bytes);
	return bytes;
}

function UUID字节匹配(data, offset, uuid) {
	const expected = 获取UUID字节(uuid);
	if (!expected || data.byteLength < offset + 16) return false;
	for (let i = 0; i < 16; i++) {
		if (data[offset + i] !== expected[i]) return false;
	}
	return true;
}

function 解析魏烈思请求(chunk, token) {
	const data = 数据转Uint8Array(chunk);
	const length = data.byteLength;
	if (length < 24) return { hasError: true, message: 'Invalid data' };
	const version = data[0];
	if (!UUID字节匹配(data, 1, token)) return { hasError: true, message: 'Invalid uuid' };

	const optLen = data[17];
	const cmdIndex = 18 + optLen;
	if (length < cmdIndex + 4) return { hasError: true, message: 'Invalid data' };

	const cmd = data[cmdIndex];
	let isUDP = false;
	if (cmd === 1) { } else if (cmd === 2) { isUDP = true } else { return { hasError: true, message: 'Invalid command' } }

	const portIdx = cmdIndex + 1;
	const port = (data[portIdx] << 8) | data[portIdx + 1];
	let addrValIdx = portIdx + 3, addrLen = 0, hostname = '';
	const addressType = data[portIdx + 2];
	switch (addressType) {
		case 1:
			addrLen = 4;
			if (length < addrValIdx + addrLen) return { hasError: true, message: 'Invalid IPv4 address length' };
			hostname = `${data[addrValIdx]}.${data[addrValIdx + 1]}.${data[addrValIdx + 2]}.${data[addrValIdx + 3]}`;
			break;
		case 2:
			if (length < addrValIdx + 1) return { hasError: true, message: 'Invalid domain length' };
			addrLen = data[addrValIdx];
			addrValIdx += 1;
			if (length < addrValIdx + addrLen) return { hasError: true, message: 'Invalid domain data' };
			hostname = VLESS文本解码器.decode(data.subarray(addrValIdx, addrValIdx + addrLen));
			break;
		case 3:
			addrLen = 16;
			if (length < addrValIdx + addrLen) return { hasError: true, message: 'Invalid IPv6 address length' };
			const ipv6 = [];
			for (let i = 0; i < 8; i++) {
				const base = addrValIdx + i * 2;
				ipv6.push(((data[base] << 8) | data[base + 1]).toString(16));
			}
			hostname = ipv6.join(':');
			break;
		default:
			return { hasError: true, message: `Invalid address type: ${addressType}` };
	}
	if (!hostname) return { hasError: true, message: `Invalid address: ${addressType}` };
	const rawIndex = addrValIdx + addrLen;
	return { hasError: false, addressType, port, hostname, isUDP, rawClientData: data.subarray(rawIndex), version };
}

const SS支持加密配置 = {
	'aes-128-gcm': { method: 'aes-128-gcm', keyLen: 16, saltLen: 16, maxChunk: 0x3fff, aesLength: 128 },
	'aes-256-gcm': { method: 'aes-256-gcm', keyLen: 32, saltLen: 32, maxChunk: 0x3fff, aesLength: 256 },
};

const SSAEAD标签长度 = 16, SSNonce长度 = 12;
const SS子密钥信息 = new TextEncoder().encode('ss-subkey');
const SS文本编码器 = new TextEncoder(), SS文本解码器 = new TextDecoder(), SS主密钥缓存 = new Map();

function 数据转Uint8Array(data) {
	if (data instanceof Uint8Array) return data;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	return new Uint8Array(data || 0);
}

function 拼接字节数据(...chunkList) {
	if (!chunkList || chunkList.length === 0) return new Uint8Array(0);
	const chunks = chunkList.map(数据转Uint8Array);
	const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) { result.set(c, offset); offset += c.byteLength }
	return result;
}

function encodeGrpcVarint(value) {
	let remaining = Number(value) >>> 0;
	const bytes = [];
	while (remaining > 127) {
		bytes.push((remaining & 0x7f) | 0x80);
		remaining >>>= 7;
	}
	bytes.push(remaining);
	return new Uint8Array(bytes);
}

function readGrpcVarint(data, offset = 0) {
	let value = 0;
	for (let index = 0; index < 5; index++) {
		const position = offset + index;
		if (position >= data.byteLength) throw new Error('Invalid gRPC protobuf wrapper: truncated varint length');
		const byte = data[position];
		if (index === 4 && (byte & 0xf0) !== 0) throw new Error('Invalid gRPC protobuf wrapper: varint length exceeds uint32');
		value += (byte & 0x7f) * 2 ** (index * 7); // arithmetic, not `<<` (which wraps at 32 bits)
		if ((byte & 0x80) === 0) return { value, nextOffset: position + 1 };
	}
	throw new Error('Invalid gRPC protobuf wrapper: varint length too long');
}

// Single-allocation gRPC downlink frame: write the header + protobuf field + payload into ONE buffer.
// Byte-identical to the old two-step (encodeGrpcMessagePayload then copy into the frame) but saves the
// intermediate message allocation + a second copy of the payload on every downstream frame.
function encodeGrpcDataFrame(payload) {
	const chunk = 数据转Uint8Array(payload);
	const lenBytes = encodeGrpcVarint(chunk.byteLength);
	const messageLength = 1 + lenBytes.byteLength + chunk.byteLength;
	const frame = new Uint8Array(5 + messageLength);
	frame[0] = 0;
	frame[1] = (messageLength >>> 24) & 0xff;
	frame[2] = (messageLength >>> 16) & 0xff;
	frame[3] = (messageLength >>> 8) & 0xff;
	frame[4] = messageLength & 0xff;
	frame[5] = 0x0a;
	frame.set(lenBytes, 6);
	frame.set(chunk, 6 + lenBytes.byteLength);
	return frame;
}

// Frame PREFIX only — the gRPC 5-byte header + protobuf field tag + varint length for a payload of the given
// size. Enqueuing this followed by the payload VIEW produces byte-identical wire output to
// encodeGrpcDataFrame() while skipping the full-payload copy, which is the dominant per-byte CPU cost of the
// download path. That copy is what pushes a heavy page load past the Free plan's 10ms CPU budget (the runtime
// then kills the invocation with exceededCpu and the page stalls mid-load).
function encodeGrpcFramePrefix(payloadLength) {
	const lenBytes = encodeGrpcVarint(payloadLength);
	const messageLength = 1 + lenBytes.byteLength + payloadLength;
	const prefix = new Uint8Array(6 + lenBytes.byteLength);
	prefix[0] = 0;
	prefix[1] = (messageLength >>> 24) & 0xff;
	prefix[2] = (messageLength >>> 16) & 0xff;
	prefix[3] = (messageLength >>> 8) & 0xff;
	prefix[4] = messageLength & 0xff;
	prefix[5] = 0x0a;
	prefix.set(lenBytes, 6);
	return prefix;
}
// Payloads at/above this size skip the frame copy (prefix + zero-copy view). Below it, batching several tiny
// frames into one enqueue is the better trade.
const GRPC_ZERO_COPY_MIN_BYTES = 4096;

const GRPC_MAX_FIELDS_PER_FRAME = 4096; // legit tunnel frames carry 1 protobuf field; cap adversarial ones
// A single read chunk holds a handful of frames for real xray "gun" traffic (bulk data rides in few large
// frames). Reject a pathological flood of tiny/empty 5-byte frames in one chunk — reachable BEFORE UUID auth
// by a path-knowing peer — so the O(frames) unwrap loop can't burn the whole 10ms CPU budget as a cheap DoS.
const GRPC_MAX_FRAMES_PER_CHUNK = 4096;
// Empty (zero-payload) 5-byte frames carry no tunnel data and are the cheapest flood to generate, so cap them
// far tighter than total frames. Real xray "gun" traffic sends essentially none in a chunk.
const GRPC_MAX_EMPTY_FRAMES_PER_CHUNK = 64;
// Pre-auth frame cap. gRPC framing is parsed BEFORE the UUID is checked, so an unauthenticated peer can make the
// parser reassemble a frame this large — and an INCOMPLETE frame is legitimately retained while waiting for the
// rest, with 2x growth headroom on the reassembly buffer. Under the full 4MiB post-auth cap that let one
// never-authenticating connection pin ~8MiB of a shared 128MiB isolate (releasing consumed tails does NOT help an
// incomplete frame). A real xray "gun" first frame is the 魏烈思 header + first packet (~2-3KiB), so 256KiB keeps
// ~100x headroom while cutting the pre-auth amplification ~16x. The 4MiB cap still applies once authenticated.
const GRPC_PREAUTH_MAX_FRAME_PAYLOAD_BYTES = 256 * 1024;
function readGrpcFrameLength(frameHeader, maxPayloadBytes = GRPC_MAX_FRAME_PAYLOAD_BYTES) {
	const data = 数据转Uint8Array(frameHeader);
	if (data.byteLength < 5) throw new Error('gRPC frame header is incomplete');
	if (data[0] !== 0) throw new Error(`unsupported gRPC compression flag: ${data[0]}`);
	// Unsigned 32-bit big-endian length. Plain arithmetic (not `<<`/`|`, which produce a SIGNED int32 — a
	// top-byte >= 0x80 would go negative and slip past the size cap below on a malformed/hostile frame).
	const grpcLen = data[1] * 0x1000000 + data[2] * 0x10000 + data[3] * 0x100 + data[4];
	if (grpcLen > maxPayloadBytes) throw new Error(`gRPC frame too large: ${grpcLen}B`);
	return grpcLen;
}

function unwrapGrpcMessagePayloads(grpcPayload) {
	const data = 数据转Uint8Array(grpcPayload);
	if (!data.byteLength) return [];
	if (data[0] !== 0x0a) return [data];
	const payloads = [];
	let offset = 0;
	let fieldCount = 0;
	while (offset < data.byteLength) {
		if (++fieldCount > GRPC_MAX_FIELDS_PER_FRAME) throw new Error('gRPC frame has too many protobuf fields');
		if (data[offset] !== 0x0a) throw new Error('Invalid gRPC protobuf wrapper: expected data field');
		const { value: length, nextOffset } = readGrpcVarint(data, offset + 1);
		const end = nextOffset + length;
		if (end > data.byteLength) throw new Error('Invalid gRPC protobuf wrapper: declared length exceeds payload');
		if (length > 0) payloads.push(data.subarray(nextOffset, end));
		offset = end;
	}
	return payloads;
}

// Buffers this parser allocated itself; only these are safe to append into in place.
const GRPC_REASSEMBLY_BUFFERS = new WeakSet();
function parseGrpcFrameChunk(pending, chunk, maxPayloadBytes = GRPC_MAX_FRAME_PAYLOAD_BYTES) {
	const prior = 数据转Uint8Array(pending);
	const current = 数据转Uint8Array(chunk);
	let merged;
	if (!prior.byteLength) {
		merged = current;
	} else if (GRPC_REASSEMBLY_BUFFERS.has(prior.buffer) && prior.buffer.byteLength - (prior.byteOffset + prior.byteLength) >= current.byteLength) {
		// Append into spare capacity of a buffer we own — O(current), not O(prior+current) — so a frame
		// arriving in many small fragments reassembles in O(total) instead of O(total^2) (a DoS vector).
		new Uint8Array(prior.buffer).set(current, prior.byteOffset + prior.byteLength);
		merged = new Uint8Array(prior.buffer, prior.byteOffset, prior.byteLength + current.byteLength);
	} else {
		// Grow into a fresh owned buffer with 2x headroom (also the path for an external/test prior, which
		// must be copied — never mutated in place).
		const needed = prior.byteLength + current.byteLength;
		const backing = new ArrayBuffer(Math.max(needed * 2, 1024));
		GRPC_REASSEMBLY_BUFFERS.add(backing);
		const view = new Uint8Array(backing);
		view.set(prior, 0);
		view.set(current, prior.byteLength);
		merged = new Uint8Array(backing, 0, needed);
	}
	const payloads = [];
	let offset = 0;
	let frameCount = 0, emptyFrameCount = 0;
	while (merged.byteLength - offset >= 5) {
		if (++frameCount > GRPC_MAX_FRAMES_PER_CHUNK) throw new Error('gRPC chunk has too many frames');
		const frameHeader = merged.subarray(offset, offset + 5);
		const grpcLen = readGrpcFrameLength(frameHeader, maxPayloadBytes);
		const frameSize = 5 + grpcLen;
		if (merged.byteLength - offset < frameSize) break;
		if (grpcLen === 0 && ++emptyFrameCount > GRPC_MAX_EMPTY_FRAMES_PER_CHUNK) throw new Error('gRPC chunk has too many empty frames');
		const grpcPayload = merged.subarray(offset + 5, offset + frameSize);
		if (grpcPayload.byteLength) payloads.push(...unwrapGrpcMessagePayloads(grpcPayload));
		offset += frameSize;
	}
	// Don't let a consumed frame's reassembly buffer stay pinned by the leftover view. `subarray` keeps the WHOLE
	// backing ArrayBuffer alive — after a large frame that buffer carries 2x growth headroom, so a zero-length
	// tail could pin multiple MB per connection until the next chunk replaced it. This runs BEFORE UUID auth, so
	// it was a pre-auth memory-amplification vector. Release it when the tail is empty, and copy the tail out when
	// it is small relative to its backing store; keep the zero-copy view when the tail is most of the buffer.
	const remaining = merged.byteLength - offset;
	let nextPending;
	if (remaining === 0) nextPending = new Uint8Array(0);
	else if (remaining * 4 < merged.buffer.byteLength) nextPending = merged.slice(offset);
	else nextPending = merged.subarray(offset);
	return { payloads, pending: nextPending };
}

async function 转发木马UDP数据(chunk, webSocket, 上下文, request) {
	const 当前块 = 数据转Uint8Array(chunk);
	const 缓存块 = 上下文?.缓存 instanceof Uint8Array ? 上下文.缓存 : new Uint8Array(0);
	const input = 缓存块.byteLength ? 拼接字节数据(缓存块, 当前块) : 当前块;
	let cursor = 0;

	while (cursor < input.byteLength) {
		const packetStart = cursor;
		const atype = input[cursor];
		let addrCursor = cursor + 1;
		let addrLen = 0;
		if (atype === 1) addrLen = 4;
		else if (atype === 4) addrLen = 16;
		else if (atype === 3) {
			if (input.byteLength < addrCursor + 1) break;
			addrLen = 1 + input[addrCursor];
		} else throw new Error(`invalid trojan udp addressType: ${atype}`);

		const portCursor = addrCursor + addrLen;
		if (input.byteLength < portCursor + 6) break;

		const port = (input[portCursor] << 8) | input[portCursor + 1];
		const payloadLength = (input[portCursor + 2] << 8) | input[portCursor + 3];
		if (input[portCursor + 4] !== 0x0d || input[portCursor + 5] !== 0x0a) throw new Error('invalid trojan udp delimiter');

		const payloadStart = portCursor + 6;
		const payloadEnd = payloadStart + payloadLength;
		if (input.byteLength < payloadEnd) break;

		const 地址端口头 = input.slice(packetStart, portCursor + 2);
		const payload = input.slice(payloadStart, payloadEnd);
		cursor = payloadEnd;

		if (port !== 53) throw new Error('UDP is not supported');
		if (!payload.byteLength) continue;

		let tcpDNS查询 = payload;
		if (payload.byteLength < 2 || ((payload[0] << 8) | payload[1]) !== payload.byteLength - 2) {
			tcpDNS查询 = new Uint8Array(payload.byteLength + 2);
			tcpDNS查询[0] = (payload.byteLength >>> 8) & 0xff;
			tcpDNS查询[1] = payload.byteLength & 0xff;
			tcpDNS查询.set(payload, 2);
		}

		const dns响应上下文 = { 缓存: new Uint8Array(0) };
		await forwardataudp(tcpDNS查询, webSocket, null, request, (dnsRespChunk) => {
			const 当前响应块 = 数据转Uint8Array(dnsRespChunk);
			const 响应输入 = dns响应上下文.缓存.byteLength ? 拼接字节数据(dns响应上下文.缓存, 当前响应块) : 当前响应块;
			const 响应帧列表 = [];
			let responseCursor = 0;
			while (responseCursor + 2 <= 响应输入.byteLength) {
				const dnsLen = (响应输入[responseCursor] << 8) | 响应输入[responseCursor + 1];
				const dnsStart = responseCursor + 2;
				const dnsEnd = dnsStart + dnsLen;
				if (dnsEnd > 响应输入.byteLength) break;
				const dnsPayload = 响应输入.slice(dnsStart, dnsEnd);
				const frame = new Uint8Array(地址端口头.byteLength + 4 + dnsPayload.byteLength);
				frame.set(地址端口头, 0);
				frame[地址端口头.byteLength] = (dnsPayload.byteLength >>> 8) & 0xff;
				frame[地址端口头.byteLength + 1] = dnsPayload.byteLength & 0xff;
				frame[地址端口头.byteLength + 2] = 0x0d;
				frame[地址端口头.byteLength + 3] = 0x0a;
				frame.set(dnsPayload, 地址端口头.byteLength + 4);
				响应帧列表.push(frame);
				responseCursor = dnsEnd;
			}
			dns响应上下文.缓存 = 响应输入.slice(responseCursor);
			return 响应帧列表.length ? 响应帧列表 : new Uint8Array(0);
		});
	}

	if (上下文) 上下文.缓存 = input.slice(cursor);
}

function SS递增Nonce计数器(counter) {
	for (let i = 0; i < counter.length; i++) { counter[i] = (counter[i] + 1) & 0xff; if (counter[i] !== 0) return }
}

async function SS派生主密钥(passwordText, keyLen) {
	const cacheKey = `${keyLen}:${passwordText}`;
	if (SS主密钥缓存.has(cacheKey)) return SS主密钥缓存.get(cacheKey);
	const deriveTask = (async () => {
		const pwBytes = SS文本编码器.encode(passwordText || '');
		let prev = new Uint8Array(0), result = new Uint8Array(0);
		while (result.byteLength < keyLen) {
			const input = new Uint8Array(prev.byteLength + pwBytes.byteLength);
			input.set(prev, 0); input.set(pwBytes, prev.byteLength);
			prev = await md5Bytes(input);
			result = 拼接字节数据(result, prev);
		}
		return result.slice(0, keyLen);
	})();
	SS主密钥缓存.set(cacheKey, deriveTask);
	while (SS主密钥缓存.size > HASH_CACHE_MAX_ENTRIES) SS主密钥缓存.delete(SS主密钥缓存.keys().next().value);
	try { return await deriveTask }
	catch (error) { SS主密钥缓存.delete(cacheKey); throw error }
}

async function SS派生会话密钥(config, masterKey, salt, usages) {
	const hmacOpts = { name: 'HMAC', hash: 'SHA-1' };
	const saltHmacKey = await crypto.subtle.importKey('raw', salt, hmacOpts, false, ['sign']);
	const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltHmacKey, masterKey));
	const prkHmacKey = await crypto.subtle.importKey('raw', prk, hmacOpts, false, ['sign']);
	const subKey = new Uint8Array(config.keyLen);
	let prev = new Uint8Array(0), written = 0, counter = 1;
	while (written < config.keyLen) {
		const input = 拼接字节数据(prev, SS子密钥信息, new Uint8Array([counter]));
		prev = new Uint8Array(await crypto.subtle.sign('HMAC', prkHmacKey, input));
		const copyLen = Math.min(prev.byteLength, config.keyLen - written);
		subKey.set(prev.subarray(0, copyLen), written);
		written += copyLen; counter += 1;
	}
	return crypto.subtle.importKey('raw', subKey, { name: 'AES-GCM', length: config.aesLength }, false, usages);
}

async function SSAEAD加密(cryptoKey, nonceCounter, plaintext) {
	const iv = nonceCounter.slice();
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, cryptoKey, plaintext);
	SS递增Nonce计数器(nonceCounter);
	return new Uint8Array(ct);
}

async function SSAEAD解密(cryptoKey, nonceCounter, ciphertext) {
	const iv = nonceCounter.slice();
	const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, cryptoKey, ciphertext);
	SS递增Nonce计数器(nonceCounter);
	return new Uint8Array(pt);
}

function closeRemoteSocketQuietly(socket) {
	// A Cloudflare TCP socket's close() is asynchronous and returns a promise that can reject (e.g. the peer
	// already RST'd). Swallow both the synchronous throw AND the async rejection so a routine cleanup during
	// fallback / client-disconnect / handshake failure never surfaces as an unhandled promise rejection.
	try {
		const result = socket?.close?.();
		if (result && typeof result.catch === 'function') result.catch(() => { });
	} catch (e) { }
}

function uniqueDialCandidates(candidates) {
	const unique = [];
	const seen = new Set();
	for (const candidate of candidates || []) {
		if (!candidate || !candidate.hostname || !candidate.port) continue;
		const key = `${String(candidate.hostname).toLowerCase()}:${Number(candidate.port)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(candidate);
	}
	return unique;
}

async function openStaggeredCandidates(candidates, openCandidate, options = {}) {
	const unique = uniqueDialCandidates(candidates);
	if (!unique.length) throw new Error('No dial candidates available');
	if (unique.length === 1) {
		const candidate = unique[0];
		return { socket: await openCandidate(candidate), candidate };
	}
	const staggerMs = Math.max(0, Number(options.staggerMs ?? DIAL_STAGGER_MS) || 0);
	return await new Promise((resolve, reject) => {
		let settled = false, launched = 0, active = 0;
		const failures = [];
		const timers = new Set();
		const controllers = new Set();
		const clearTimers = () => {
			for (const timer of timers) clearTimeout(timer);
			timers.clear();
		};
		const abortLosers = (winnerController = null) => {
			for (const controller of controllers) {
				if (controller !== winnerController) controller.abort();
			}
			controllers.clear();
		};
		const maybeReject = () => {
			if (!settled && launched >= unique.length && active === 0) {
				settled = true;
				clearTimers();
				abortLosers();
				reject(new AggregateError(failures, 'All dial candidates failed'));
			}
		};
		const launchNext = () => {
			if (settled || launched >= unique.length) return;
			const candidate = unique[launched++];
			const controller = new AbortController();
			controllers.add(controller);
			active++;
			Promise.resolve()
				.then(() => openCandidate(candidate, controller.signal))
				.then(socket => {
					active--;
					controllers.delete(controller);
					if (settled) {
						closeRemoteSocketQuietly(socket);
						return;
					}
					settled = true;
					clearTimers();
					abortLosers(controller);
					resolve({ socket, candidate });
				})
				.catch(error => {
					active--;
					controllers.delete(controller);
					if (!controller.signal.aborted) failures.push(error);
					if (!settled && launched < unique.length) {
						clearTimers();
						launchNext();
					}
					maybeReject();
				});
			if (!settled && launched < unique.length) {
				if (staggerMs === 0) queueMicrotask(launchNext);
				else {
					const timer = setTimeout(() => {
						timers.delete(timer);
						launchNext();
					}, staggerMs);
					timers.add(timer);
				}
			}
		};
		launchNext();
	});
}

// A first packet is safe for the worker to replay to a ProxyIP relay (direct→ProxyIP fallback) ONLY when it
// is exactly one standalone TLS ClientHello record and nothing else. That is idempotent (a fresh handshake
// each time) and is the common censorship-recovery case in Iran: direct accepts TCP, gets the ClientHello,
// then the SNI is RST — replaying it through ProxyIP recovers within the same connection. Anything else
// (plaintext HTTP, a POST, a second TLS record, TLS 1.3 0-RTT early data, an unknown protocol) must NOT be
// replayed — it could be non-idempotent — so those close and let the client re-dial instead.
function 是可重放的TLS首包(dataInput) {
	const data = 数据转Uint8Array(dataInput);
	if (data.byteLength < 9) return false;
	if (data[0] !== 0x16) return false;            // TLS handshake record
	if (data[1] !== 0x03) return false;            // record-layer major version 3
	const 记录长度 = (data[3] << 8) | data[4];
	if (记录长度 < 4 || 记录长度 > 18432) return false;
	if (data.byteLength !== 5 + 记录长度) return false; // exactly one record — no trailing record / 0-RTT data
	if (data[5] !== 0x01) return false;            // handshake message type = ClientHello
	const 握手长度 = data[6] * 0x10000 + data[7] * 0x100 + data[8];
	return 握手长度 + 4 === 记录长度;               // the ClientHello spans the whole record
}

async function forwardataTCP(host, portNum, rawData, ws, respHeader, remoteConnWrapper, yourUUID, request = null) {
	validateTunnelTarget(host, portNum);
	追踪记录目标(remoteConnWrapper?.追踪, host, portNum);
	const 拨号开始毫秒 = remoteConnWrapper?.追踪 ? Date.now() : 0;
	const { env, ctx } = getWorkerRequestContext(request);
	const tunnelContext = getRequestTunnelContext(request);
	const parsedProxyAddress = tunnelContext.parsedProxyAddress || {};
	const proxyType = tunnelContext.proxyType;
	const proxyIP = tunnelContext.proxyIP;
	const proxyFallbackEnabled = tunnelContext.proxyFallbackEnabled;
	const proxyGlobalEnabled = tunnelContext.globalProxyEnabled;
	const socksWhitelist = Array.isArray(tunnelContext.socksWhitelist) ? tunnelContext.socksWhitelist : DEFAULT_SOCKS5_WHITELIST;
	const forceProxyHosts = Array.isArray(tunnelContext.forceProxyHosts) ? tunnelContext.forceProxyHosts : [];
	const forceProxyForHost = forceProxyHosts.some(pattern => matchesHostPattern(host, pattern));
	const dialConcurrency = Math.max(1, tunnelContext.tcpDialConcurrency | 0);
	const 已有首包数据 = 有效数据长度(rawData) > 0;
	// A request is "sent" as soon as the first packet carries data (e.g. a ClientHello); a later uplink write
	// also sets this (via 写入开始). A connection that never sets it is a no-request preconnect — the no-data
	// teardown must not treat it as a blackholed route (no cache poison, no fallback).
	if (remoteConnWrapper) remoteConnWrapper.请求已发送 = 已有首包数据;
	// The direct→ProxyIP fallback replays the first packet. That is only replay-safe when the first packet is
	// empty (nothing to replay) or a standalone TLS ClientHello (idempotent). For any other data-carrying
	// first packet, a socket-close/EOF must NOT trigger a replay — close and let the client re-dial instead.
	const 可重放首包 = !已有首包数据 || 是可重放的TLS首包(rawData);
	const 直连首字节超时毫秒 = getDirectFirstByteTimeoutMs(env);
	const 反代首字节超时毫秒 = getProxyFirstByteTimeoutMs(env);
	log(`[TCP forwarding] Target: ${host}:${portNum} | ProxyIP: ${proxyIP} | ProxyIP fallback: ${proxyFallbackEnabled ? 'yes' : 'no'} | Proxy type: ${proxyType || 'proxyip'} | Global: ${proxyGlobalEnabled ? 'yes' : 'no'} | Forced: ${forceProxyForHost ? 'yes' : 'no'}`);
	const 连接超时毫秒 = getProxyConnectTimeoutMs(env);
	const proxyAddressForConnect = { ...parsedProxyAddress, timeoutMs: 连接超时毫秒, dohLookupUrl: getDohLookupUrl(env) };
	let 已通过代理发送首包 = false;
	const TCP连接 = 创建请求TCP连接器(request);

	async function 等待连接建立(remoteSock, timeoutMs = 连接超时毫秒) {
		await socketOpenedWithTimeout(remoteSock, timeoutMs, 'Connection timed out');
	}

	async function 打开TCP连接(address, port, signal = null) {
		const remoteSock = TCP连接({ hostname: address, port });
		const abort = () => { try { remoteSock?.close?.() } catch (e) { } };
		if (signal?.aborted) {
			abort();
			throw new Error('dial aborted');
		}
		signal?.addEventListener?.('abort', abort, { once: true });
		try {
			await 等待连接建立(remoteSock);
			return remoteSock;
		} catch (err) {
			abort();
			throw err;
		} finally {
			signal?.removeEventListener?.('abort', abort);
		}
	}

	async function 写入首包(remoteSock, data) {
		if (有效数据长度(data) <= 0) return;
		const bytes = 数据转Uint8Array(data);
		const writer = remoteSock.writable.getWriter();
		try { await writer.write(bytes); 追踪初始写入(remoteConnWrapper?.追踪, bytes.byteLength); }
		finally { try { writer.releaseLock() } catch (e) { } }
	}

	async function 并发打开候选连接(候选列表) {
		return openStaggeredCandidates(候选列表, (候选, signal) => 打开TCP连接(候选.hostname, 候选.port, signal), { staggerMs: getDialStaggerMs(env) });
	}

	async function 构建预加载竞速候选列表(address, port) {
		if (!tunnelContext.preloadRaceDial || isIPHostname(address)) return null;
		log(`[TCP direct] Preload race dialing enabled; querying A/AAAA records for ${address} concurrently`);
		const dohLookupUrl = getDohLookupUrl(env);
		const [aRecords, aaaaRecords] = await Promise.all([
			DoH查询(address, 'A', dohLookupUrl),
			DoH查询(address, 'AAAA', dohLookupUrl)
		]);
		const ipv4List = [...new Set(aRecords.flatMap(r => {
			const data = r.data;
			return r.type === 1 && typeof data === 'string' && isIPv4(data) ? [data] : [];
		}))];
		const ipv6List = [...new Set(aaaaRecords.flatMap(r => {
			const data = r.data;
			return r.type === 28 && typeof data === 'string' && isIPHostname(data) ? [data] : [];
		}))];
		const 拨号上限 = dialConcurrency;
		const ipList = ipv4List.length >= 拨号上限
			? ipv4List.slice(0, 拨号上限)
			: ipv4List.concat(ipv6List.slice(0, 拨号上限 - ipv4List.length));
		const 使用记录类型 = ipv4List.length > 0
			? (ipList.length > ipv4List.length ? 'A+AAAA' : 'A')
			: 'AAAA';
		if (ipList.length === 0) {
			log(`[TCP direct] No usable A/AAAA records found for ${address}; preload race dialing is unavailable, falling back to the original hostname`);
			return null;
		}
		const 选中IP列表 = ipList;
		log(`[TCP direct] ${address} A records: ${ipv4List.length}, AAAA records: ${ipv6List.length}; using ${使用记录类型} records, race dialing ${选中IP列表.length}/${拨号上限}: ${选中IP列表.join(', ')}`);
		return 选中IP列表.map((hostname, attempt) => ({ hostname, port, attempt, resolvedFrom: address }));
	}

	async function connectDirect(address, port, data = null, 启用预加载 = false) {
		const 预加载候选列表 = 启用预加载 ? await 构建预加载竞速候选列表(address, port) : null;
		const 候选列表 = 预加载候选列表 || [{ hostname: address, port, attempt: 0 }];
		log(预加载候选列表
			? `[TCP direct] Trying ${候选列表.length} concurrent paths: ${候选列表.map(候选 => `${候选.hostname}:${候选.port}`).join(', ')}`
			: `[TCP direct] Trying ${候选列表.length} concurrent paths: ${address}:${port}`);
		let socket = null;
		try {
			const 连接结果 = await 并发打开候选连接(候选列表);
			socket = 连接结果.socket;
			if (预加载候选列表) {
				const winner = 连接结果.candidate;
				log(`[TCP direct] Preload race winner: ${winner.hostname}:${winner.port}, source hostname: ${winner.resolvedFrom || address}`);
			}
			await 写入首包(socket, data);
			return socket;
		} catch (err) {
			try { socket?.close?.() } catch (e) { }
			if (预加载候选列表) log(`[TCP direct] Preload race failed: ${err.message || err}`);
			throw err;
		}
	}

	async function connectProxyIP(address, port, data = null, 所有反代数组 = null, 启用反代失败兜底 = true) {
		if (所有反代数组 && 所有反代数组.length > 0) {
			for (let i = 0; i < 所有反代数组.length; i += dialConcurrency) {
				const 候选列表 = [];
				for (let j = 0; j < dialConcurrency && i + j < 所有反代数组.length; j++) {
					const 反代数组索引 = (getProxyEndpointCursor(proxyIP, host, 所有反代数组.length) + i + j) % 所有反代数组.length;
					const [反代地址, 反代端口] = 所有反代数组[反代数组索引];
					候选列表.push({ hostname: 反代地址, port: 反代端口, index: 反代数组索引 });
				}
				let socket = null, candidate = null, 已尝试写入首包 = false;
				try {
					log(`[ProxyIP connection] Trying ${候选列表.length} concurrent paths: ${候选列表.map(候选 => `${候选.hostname}:${候选.port}`).join(', ')}`);
					const 开始时间 = performance.now();
					const 连接结果 = await 并发打开候选连接(候选列表);
					socket = 连接结果.socket;
					candidate = 连接结果.candidate;
					已尝试写入首包 = 有效数据长度(data) > 0;
					await 写入首包(socket, data);
					const 成功候选 = candidate, 成功开始时间 = 开始时间;
					remoteConnWrapper.反代首字节回调 = () => rememberProxyEndpointResult(env, ctx, proxyIP, [成功候选.hostname, 成功候选.port], true, performance.now() - 成功开始时间, Date.now(), host, yourUUID);
					// A relay that accepted TCP but returned NO byte is strong evidence it is silently broken for this
					// target, so move the cursor PAST it as well as scoring the failure. Without this the cursor still
					// pointed at the winner of the dial and the very next connection re-selected the same dead relay —
					// live capture: both api.onesignal.com attempts picked 136.244.85.65 and both timed out with 0 bytes.
					remoteConnWrapper.反代无数据回调 = () => {
						try { setProxyEndpointCursor(proxyIP, host, 成功候选.index + 1, 所有反代数组.length); } catch (e) { }
						rememberProxyEndpointResult(env, ctx, proxyIP, [成功候选.hostname, 成功候选.port], false, null, Date.now(), host, yourUUID);
					};
					log(`[ProxyIP connection] Connected to: ${candidate.hostname}:${candidate.port} (index: ${candidate.index})`);
					if (remoteConnWrapper.追踪) remoteConnWrapper.追踪.endpoint = `${candidate.hostname}:${candidate.port}`; // correlate the winning endpoint to this connection's route event
					setProxyEndpointCursor(proxyIP, host, candidate.index, 所有反代数组.length);
					return socket;
				} catch (err) {
					try { socket?.close?.() } catch (e) { }
					if (candidate) rememberProxyEndpointResult(env, ctx, proxyIP, [candidate.hostname, candidate.port], false, null, Date.now(), host, yourUUID);
					else for (const 候选 of 候选列表) rememberProxyEndpointResult(env, ctx, proxyIP, [候选.hostname, 候选.port], false, null, Date.now(), host, yourUUID);
					// If the first-packet WRITE was attempted (socket opened, then 写入首包 rejected), delivery is
					// uncertain — replaying a non-replay-safe packet to the next candidate or the direct fallback
					// could re-send non-idempotent data. Abort. A pre-write dial failure is safe to keep rotating.
					if (已尝试写入首包 && !可重放首包) { closeSocketQuietly(ws); throw err; }
					log(`[ProxyIP connection] This connection batch failed: ${err.message || err}`);
				}
			}
		}

		if (启用反代失败兜底) return connectDirect(address, port, data, false);
		else {
			closeSocketQuietly(ws);
			throw new Error('[ProxyIP connection] All ProxyIP connection attempts failed and fallback is disabled; connection terminated.');
		}
	}

	async function connecttoPry(允许发送首包 = true) {
		if (remoteConnWrapper.connectingPromise) {
			await remoteConnWrapper.connectingPromise;
			return;
		}

		const 本次发送首包 = 允许发送首包 && !已通过代理发送首包 && 有效数据长度(rawData) > 0;
		const 本次首包数据 = 本次发送首包 ? rawData : null;

		const 当前连接任务 = (async () => {
			追踪拨号尝试(remoteConnWrapper.追踪);
			remoteConnWrapper.反代首字节回调 = null;
			remoteConnWrapper.反代无数据回调 = null;
			let newSocket;
			if (proxyType === 'socks5') {
				log(`[SOCKS5 proxy] Proxying to: ${host}:${portNum}`);
				newSocket = await socks5Connect(host, portNum, 本次首包数据, TCP连接, proxyAddressForConnect);
			} else if (proxyType === 'http') {
				log(`[HTTP proxy] Proxying to: ${host}:${portNum}`);
				newSocket = await httpConnect(host, portNum, 本次首包数据, false, TCP连接, proxyAddressForConnect);
			} else if (proxyType === 'https') {
				log(`[HTTPS proxy] Proxying to: ${host}:${portNum}`);
				newSocket = isIPHostname(parsedProxyAddress.hostname)
					? await httpsConnect(host, portNum, 本次首包数据, TCP连接, proxyAddressForConnect)
					: await httpConnect(host, portNum, 本次首包数据, true, TCP连接, proxyAddressForConnect);
			} else if (proxyType === 'turn') {
				log(`[TURN proxy] Proxying to: ${host}:${portNum}`);
				newSocket = await turnConnect(proxyAddressForConnect, host, portNum, TCP连接);
				if (有效数据长度(本次首包数据) > 0) {
					// Close the socket if the first-packet write fails, matching connectDirect/connectProxyIP —
					// otherwise a socket that connected but rejected its first write leaks (never assigned to
					// remoteConnWrapper.socket, so nothing else closes it).
					try {
						const writer = newSocket.writable.getWriter();
						try { await writer.write(数据转Uint8Array(本次首包数据)) }
						finally { try { writer.releaseLock() } catch (e) { } }
					} catch (err) { closeRemoteSocketQuietly(newSocket); throw err; }
				}
			} else if (proxyType === 'sstp') {
				log(`[SSTP proxy] Proxying to: ${host}:${portNum}`);
				newSocket = await sstpConnect(proxyAddressForConnect, host, portNum, TCP连接);
				if (有效数据长度(本次首包数据) > 0) {
					try {
						const writer = newSocket.writable.getWriter();
						try { await writer.write(数据转Uint8Array(本次首包数据)) }
						finally { try { writer.releaseLock() } catch (e) { } }
					} catch (err) { closeRemoteSocketQuietly(newSocket); throw err; }
				}
			} else {
				log(`[ProxyIP connection] Proxying to: ${host}:${portNum}`);
				const 所有反代数组 = await 解析地址端口(proxyIP, host, yourUUID, env, ctx);
				const proxyFallbackEndpoint = parsePreferredEndpointText(proxyIP) || { address: proxyIP, port: '443' };
				const proxyFallbackHost = stripIPv6Brackets(proxyFallbackEndpoint.address);
				newSocket = await connectProxyIP(proxyFallbackHost, Number(proxyFallbackEndpoint.port) || 443, 本次首包数据, 所有反代数组, proxyFallbackEnabled);
			}
			if (本次发送首包) 已通过代理发送首包 = true;
			// Install the new socket BEFORE tearing down any previous one, so the previous socket's own pipe
			// sees itself as stale (wrapper.socket !== its socket) and won't close the shared client. Closing the
			// old socket here also prevents a leak when a reconnect replaces a still-open (blackholed) socket.
			const 旧远端Socket = remoteConnWrapper.socket;
			// Client left mid-dial (app backgrounded): close the freshly-dialed socket instead of installing and
			// piping it to a dead client, so a blackholed relay can't pin it open against the connection cap.
			if (remoteConnWrapper.客户端已关闭) { closeRemoteSocketQuietly(newSocket); return; }
			remoteConnWrapper.socket = newSocket;
			// Clear any close hint the superseded (direct) pipe left behind — e.g. 'first_byte_timeout' — so a
			// successful ProxyIP takeover isn't mis-reported with the old route's failure reason.
			remoteConnWrapper.closeHint = null;
			追踪记录路由(remoteConnWrapper.追踪, proxyType || 'proxyip', null, 拨号开始毫秒 ? Date.now() - 拨号开始毫秒 : null);
			if (旧远端Socket && 旧远端Socket !== newSocket) { closeRemoteSocketQuietly(旧远端Socket); }
			// Only close the client transport when THIS socket is still the current one. A later reconnect
			// (e.g. this ProxyIP socket dies on its first uplink write → retryConnect installs a replacement)
			// must not have the stale socket's closed-promise tear down the healthy replacement's client ws.
			// connectStreams (pipeRemoteToClient) is the SOLE owner of client-transport closure — it flushes the
			// final grain buffer before closing. A second closer here (on socket.closed) raced that flush and
			// could drop the final response bytes; just observe the close, never close the client from here.
			newSocket.closed.catch(() => { });
			// Honor FIRST_BYTE_TIMEOUT_MS on the proxy path too (opt-in; 0 = off by default). There is no
			// fallback here (retryFunc=null), so a fired timeout just CLOSES the stream — it never replays
			// the first packet from the worker — turning a blackholed relay (connects, then sends nothing)
			// into a fast client re-dial instead of a frozen tab, and scoring the endpoint as failed via
			// onNoData. Uses the raw configured value (not forced to 0 on a data-carrying first packet)
			// because a clean close is not a worker replay; see the direct path where the timeout is forced
			// to 0 precisely because there it triggers a worker-side retry/replay.
			remoteConnWrapper.pipePromise = pipeRemoteToClient(newSocket, ws, respHeader, null, 反代首字节超时毫秒, { env, wrapper: remoteConnWrapper, onFirstByte: remoteConnWrapper.反代首字节回调, onNoData: remoteConnWrapper.反代无数据回调 });
		})();

		remoteConnWrapper.connectingPromise = 当前连接任务;
		try {
			await 当前连接任务;
		} finally {
			if (remoteConnWrapper.connectingPromise === 当前连接任务) {
				remoteConnWrapper.connectingPromise = null;
			}
		}
	}
	remoteConnWrapper.retryConnect = async () => {
		// Once any downlink byte has reached the client, reconnecting is unsafe: connecttoPry replays the
		// original first packet to a fresh remote, so the client would receive a second response spliced
		// onto the partial one it already got (corruption + a non-idempotent first-packet replay). Refuse
		// the retry — the caller then tears the connection down cleanly and the client re-dials. Mirrors the
		// download path's `!hasData` retry gate. The pre-first-byte case (safe to retry) is unaffected.
		if (remoteConnWrapper.已向客户端下发数据) throw new Error('[TCP forwarding] Upload retry aborted: downlink data already delivered to client');
		// A retry re-dials and replays only the original first packet; any later uplink chunk already sent to
		// the (now-dead) remote can't be reproduced on the new socket, so reconnecting would silently drop it.
		// Refuse — the caller tears down and the client re-dials cleanly. Also skip retries once the client left.
		if (remoteConnWrapper.已向远端发送数据) throw new Error('[TCP forwarding] Upload retry aborted: later uplink data already sent to remote');
		if (remoteConnWrapper.客户端已关闭) throw new Error('[TCP forwarding] Upload retry aborted: client disconnected');
		// The retry replays the original first packet; only do that when it is replay-safe (empty or a
		// standalone TLS ClientHello). Otherwise reconnecting could re-send non-idempotent application data.
		if (!可重放首包) throw new Error('[TCP forwarding] Upload retry aborted: first packet is not a replay-safe TLS ClientHello');
		return connecttoPry(!已通过代理发送首包);
	};

	const 直连路由键 = `${host}:${portNum}|${String(request?.cf?.colo || '')}`;
	const 反代兜底可用 = !!(proxyIP || proxyType);
	const 直连近期失败 = 反代兜底可用 && getDirectRouteFailed(直连路由键);
	if (直连近期失败) log(`[TCP forwarding] Direct route recently failed for ${host}:${portNum}; skipping direct and using proxy`);

	if (forceProxyForHost || 直连近期失败 || (proxyType && (proxyGlobalEnabled || socksWhitelist.some(pattern => matchesHostPattern(host, pattern))))) {
		log(`[TCP forwarding] Proxy route selected: ${forceProxyForHost ? 'forced host rule' : (直连近期失败 ? 'direct route recently failed' : 'SOCKS5/HTTP/HTTPS/TURN/SSTP rule')}`);
		try {
			await connecttoPry();
		} catch (err) {
			log(`[TCP forwarding] SOCKS5/HTTP/HTTPS/TURN/SSTP proxy connection failed: ${err.message}`);
			throw err;
		}
	} else {
		try {
			log(`[TCP forwarding] Trying direct connection to: ${host}:${portNum}`);
			追踪拨号尝试(remoteConnWrapper.追踪);
			const initialSocket = await connectDirect(host, portNum, rawData, true);
			// If the client went away (app backgrounded) while this dial was in flight, the abort handler
			// already fired but couldn't reach this not-yet-installed socket. Close it now so a blackholed
			// remote can't pin it open indefinitely, leaking against the free-plan connection cap.
			if (remoteConnWrapper.客户端已关闭) { closeRemoteSocketQuietly(initialSocket); return; }
			remoteConnWrapper.socket = initialSocket;
			追踪记录路由(remoteConnWrapper.追踪, 'direct', null, 拨号开始毫秒 ? Date.now() - 拨号开始毫秒 : null);
			// First-byte watchdog on the direct path. When the first packet carries NO data it may safely
			// replay to ProxyIP (retryFunc). When it DOES carry data, replay is unsafe (non-idempotent
			// first packet) — but we still arm a CLOSE-ONLY timeout so a blackholed direct connection (connect
			// ok, first packet sent, remote never responds) is torn down and the client re-dials, instead of
			// hanging forever (the idle watchdog can't help — it only arms after the first byte). Upload-safe:
			// the watchdog now resets on uplink activity, so an in-progress upload with a silent downlink is
			// not killed. Both cases record the direct-route failure via onNoData (once, before any retry).
			remoteConnWrapper.pipePromise = pipeRemoteToClient(initialSocket, ws, respHeader,
				async () => {
					if (remoteConnWrapper.socket !== initialSocket) return;
					追踪回退(remoteConnWrapper.追踪, 'direct', proxyType || 'proxyip'); // direct connected then blackholed → ProxyIP
					await connecttoPry();
				},
				直连首字节超时毫秒,
				{ env, wrapper: remoteConnWrapper, 首字节超时仅关闭: !可重放首包, 可重放首包: 可重放首包, onFirstByte: () => recordDirectRouteOk(直连路由键), onNoData: () => { if (remoteConnWrapper.socket === initialSocket) recordDirectRouteFailure(直连路由键); } });
		} catch (err) {
			log(`[TCP forwarding] Direct connection to ${host}:${portNum} failed: ${err.message}`);
			追踪拨号失败(remoteConnWrapper.追踪, 'direct', 拨号开始毫秒 ? Date.now() - 拨号开始毫秒 : null, err);
			if (err instanceof Error && err.name === 'Preload resolution empty') {
				closeSocketQuietly(ws);
				throw err;
			}
			recordDirectRouteFailure(直连路由键);
			// connectDirect() writes the first packet internally, so this failure may be a WRITE failure that
			// already (partially) delivered rawData. Replaying a non-replay-safe first packet to ProxyIP could
			// re-send non-idempotent data, so only fall back when the first packet is empty or a standalone
			// ClientHello; otherwise close and let the client re-dial. (Unchanged for the common ClientHello case.)
			if (!可重放首包) { closeSocketQuietly(ws); throw err; }
			追踪回退(remoteConnWrapper.追踪, 'direct', proxyType || 'proxyip'); // direct dial/first-write failed → ProxyIP
			await connecttoPry();
		}
	}
}

async function readOneDnsTcpFrame(tcpSocket, timeoutMs) {
	const reader = tcpSocket.readable.getReader();
	let buffer = new Uint8Array(0);
	const deadline = Date.now() + Math.max(1, Number(timeoutMs) || DNS_TCP_RESPONSE_TIMEOUT_MS);
	try {
		while (true) {
			if (buffer.byteLength >= 2) {
				const responseLength = (buffer[0] << 8) | buffer[1];
				if (responseLength <= 0) throw new Error('DNS TCP response has invalid length');
				if (responseLength > 65535) throw new Error('DNS TCP response is too large');
				const frameLength = responseLength + 2;
				if (buffer.byteLength >= frameLength) return buffer.slice(0, frameLength);
			}
			if (buffer.byteLength > 65537) throw new Error('DNS TCP response buffer is too large');
			const remainingMs = Math.max(1, deadline - Date.now());
			const { done, value } = await readWithOperationTimeout(reader, remainingMs, 'DNS TCP response timed out');
			if (done) throw new Error('DNS TCP server closed before returning a complete response');
			const chunk = 数据转Uint8Array(value);
			if (!chunk.byteLength) continue;
			buffer = buffer.byteLength ? 拼接字节数据(buffer, chunk) : chunk;
		}
	} finally {
		cancelReaderQuietly(reader);
		try { reader.releaseLock() } catch (e) { }
	}
}

async function readMultipleDnsTcpFrames(tcpSocket, count, timeoutMs) {
	const safeCount = Math.trunc(Number(count));
	if (!Number.isFinite(safeCount) || safeCount <= 0) throw new Error('DNS TCP response count is invalid');
	if (safeCount > DNS_MAX_FRAMES_PER_REQUEST) throw new Error('too many DNS TCP response frames requested');
	const reader = tcpSocket.readable.getReader();
	let buffer = new Uint8Array(0);
	const frames = [];
	const deadline = Date.now() + Math.max(1, Number(timeoutMs) || DNS_TCP_RESPONSE_TIMEOUT_MS);
	const maxBufferedBytes = Math.min(2 * 1024 * 1024, safeCount * 65537);
	try {
		while (frames.length < safeCount) {
			// Cursor through `buffer` and slice the tail once after the loop, instead of re-slicing the
			// whole remaining tail on every extracted frame (was ~O(frames_in_buffer^2) when several
			// complete frames arrived in one read).
			let cursor = 0;
			while (buffer.byteLength - cursor >= 2) {
				const responseLength = (buffer[cursor] << 8) | buffer[cursor + 1];
				if (responseLength <= 0) throw new Error('DNS TCP response has invalid length');
				if (responseLength > 65535) throw new Error('DNS TCP response is too large');
				const frameLength = responseLength + 2;
				if (buffer.byteLength - cursor < frameLength) break;
				frames.push(buffer.slice(cursor, cursor + frameLength));
				cursor += frameLength;
				if (frames.length >= safeCount) break;
			}
			if (cursor > 0) buffer = buffer.slice(cursor);
			if (frames.length >= safeCount) break;
			const remainingMs = Math.max(1, deadline - Date.now());
			const { done, value } = await readWithOperationTimeout(reader, remainingMs, 'DNS TCP response timed out');
			if (done) throw new Error('DNS TCP server closed before returning all response frames');
			const chunk = 数据转Uint8Array(value);
			if (!chunk.byteLength) continue;
			if (buffer.byteLength + chunk.byteLength > maxBufferedBytes) throw new Error('DNS TCP response buffer is too large');
			buffer = buffer.byteLength ? 拼接字节数据(buffer, chunk) : chunk;
		}
		return frames.length === 1 ? frames[0] : 拼接字节数据(...frames);
	} finally {
		cancelReaderQuietly(reader);
		try { reader.releaseLock() } catch (e) { }
	}
}

// Split a buffer of length-prefixed (DNS-over-TCP) frames into the raw DNS messages.
function 解析DNS_TCP帧(data) {
	const frames = [];
	let cursor = 0;
	while (cursor + 2 <= data.byteLength) {
		const len = (data[cursor] << 8) | data[cursor + 1];
		const start = cursor + 2, end = start + len;
		if (len <= 0 || end > data.byteLength) break;
		frames.push(data.subarray(start, end));
		cursor = end;
	}
	return frames;
}

// Primary tunneled-DNS path: forward each length-prefixed query over DoH (RFC 8484
// application/dns-message), returning the response(s) in the same length-prefixed wire format
// the callers expect. Avoids a fresh TCP handshake per DNS query — lower, more consistent latency.
// Key = DoH URL + the query bytes with the 2-byte transaction ID zeroed. Only single-question queries
// (QDCOUNT===1) are cacheable; returns null otherwise. Byte-identical questions => same key => same answer.
function dns线缓存键(dohUrl, query) {
	const q = 数据转Uint8Array(query);
	if (q.byteLength < 12) return null;
	if (((q[4] << 8) | q[5]) !== 1) return null; // QDCOUNT must be exactly 1
	let key = dohUrl + '\n';
	for (let i = 2; i < q.byteLength; i++) key += String.fromCharCode(q[i]);
	return key;
}
function 读取DNS线缓存(key, query) {
	const cached = DNS_WIRE_CACHE.get(key);
	if (!cached) return null;
	if (cached.expiresAt <= Date.now()) { DNS_WIRE_CACHE.delete(key); return null; }
	DNS_WIRE_CACHE.delete(key); DNS_WIRE_CACHE.set(key, cached); // LRU touch
	const q = 数据转Uint8Array(query);
	const out = new Uint8Array(cached.msg);
	out[0] = q[0]; out[1] = q[1]; // restore the caller's transaction ID into the cached response
	return out;
}
// Minimum TTL across a DNS response's answer records, so a positive answer can be cached for its real
// lifetime (clamped to [MIN, MAX]) instead of a flat 30s — far fewer repeat DoH lookups on stable domains
// during a session (less latency + fewer free-plan subrequests). Fail-safe: any short/compressed-mid-name/
// malformed record just returns MIN, i.e. the previous fixed-30s behavior — a parse issue can never cache
// longer than the cap or serve wrong data.
function 解析DNS应答最小TTL毫秒(msg) {
	const q = 数据转Uint8Array(msg);
	if (q.byteLength < 12) return DNS_RESULT_CACHE_MIN_TTL_MS;
	const qd = (q[4] << 8) | q[5];
	const an = (q[6] << 8) | q[7];
	if (qd !== 1 || an < 1) return DNS_RESULT_CACHE_MIN_TTL_MS;
	let p = 12;
	// question name: labels ended by a 0 byte; bail on any compression pointer (rare in a question)
	while (p < q.byteLength && q[p] !== 0) {
		if ((q[p] & 0xc0) !== 0) return DNS_RESULT_CACHE_MIN_TTL_MS;
		p += 1 + q[p];
	}
	p += 1 + 4; // terminating 0 label + QTYPE + QCLASS
	let 最小TTL秒 = Infinity;
	for (let i = 0; i < an; i++) {
		if (p + 1 > q.byteLength) return DNS_RESULT_CACHE_MIN_TTL_MS;
		// answer NAME: a compression pointer (2 bytes) or raw labels ending in 0
		if ((q[p] & 0xc0) === 0xc0) {
			p += 2;
		} else {
			while (p < q.byteLength && q[p] !== 0) {
				if ((q[p] & 0xc0) !== 0) return DNS_RESULT_CACHE_MIN_TTL_MS;
				p += 1 + q[p];
			}
			p += 1;
		}
		if (p + 10 > q.byteLength) return DNS_RESULT_CACHE_MIN_TTL_MS; // TYPE(2)+CLASS(2)+TTL(4)+RDLENGTH(2)
		p += 4; // skip TYPE + CLASS
		const ttl = ((q[p] << 24) | (q[p + 1] << 16) | (q[p + 2] << 8) | q[p + 3]) >>> 0;
		p += 4;
		const rdlen = (q[p] << 8) | q[p + 1];
		p += 2;
		if (p + rdlen > q.byteLength) return DNS_RESULT_CACHE_MIN_TTL_MS;
		p += rdlen;
		最小TTL秒 = Math.min(最小TTL秒, ttl); // include TTL 0 in the minimum (RRSet TTL is the record minimum)
	}
	if (!Number.isFinite(最小TTL秒)) return DNS_RESULT_CACHE_MIN_TTL_MS;
	if (最小TTL秒 <= 0) return 0; // RFC 1035: a TTL-0 answer is for the current transaction only — must not be cached
	return Math.max(DNS_RESULT_CACHE_MIN_TTL_MS, Math.min(DNS_RESULT_CACHE_MAX_TTL_MS, 最小TTL秒 * 1000));
}

function 写入DNS线缓存(key, msg) {
	// Only cache a positive answer (NOERROR rcode + >=1 answer record) so a transient failure / NXDOMAIN
	// / NODATA blip can't be served stale for the TTL. Header: byte3 low nibble = rcode, bytes 6-7 = ANCOUNT.
	if (msg.byteLength < 12 || (msg[3] & 0x0f) !== 0 || ((msg[6] << 8) | msg[7]) === 0) return;
	const ttlMs = 解析DNS应答最小TTL毫秒(msg);
	if (ttlMs <= 0) return; // TTL-0 answer (e.g. per-query CDN rotation) — must not be cached
	const stored = new Uint8Array(msg);
	stored[0] = 0; stored[1] = 0;
	DNS_WIRE_CACHE.set(key, { msg: stored, expiresAt: Date.now() + ttlMs });
	while (DNS_WIRE_CACHE.size > DNS_RESULT_CACHE_MAX_ENTRIES) DNS_WIRE_CACHE.delete(DNS_WIRE_CACHE.keys().next().value);
}

async function DNS经DoH转发(requestData, env, timeoutMs) {
	const frames = 解析DNS_TCP帧(requestData);
	if (!frames.length) throw new Error('no DNS query frames to forward via DoH');
	if (frames.length > DNS_MAX_FRAMES_PER_REQUEST) throw new Error('too many DNS query frames');
	const dohUrls = getDohLookupUrls(env);
	let lastErr = null;
	// Per-frame results preserved across DoH-URL attempts: a fallback URL (or a later batch) only
	// re-fetches frames still missing, so a partial-batch failure never re-spends subrequests on frames
	// that already resolved. Matters on the free plan's shared per-connection (50) subrequest budget.
	const results = new Array(frames.length).fill(null);
	const 封装响应 = (msg) => {
		const framed = new Uint8Array(2 + msg.byteLength);
		framed[0] = (msg.byteLength >>> 8) & 0xff;
		framed[1] = msg.byteLength & 0xff;
		framed.set(msg, 2);
		return framed;
	};
	const 查询单帧 = async (dohUrl, query) => {
		const 缓存键 = dns线缓存键(dohUrl, query);
		if (缓存键) {
			const hit = 读取DNS线缓存(缓存键, query);
			if (hit) return 封装响应(hit);
		}
		const resp = await fetchWithTimeout(dohUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/dns-message', 'accept': 'application/dns-message' },
			body: query,
		}, timeoutMs);
		if (!resp.ok) { try { resp.body?.cancel() } catch (e) { } throw new Error(`DoH HTTP ${resp.status}`); }
		// Reject a declared-oversized body before buffering it (a DNS message can't exceed 64KB; a
		// misbehaving/hostile DoH endpoint shouldn't get to spike isolate memory via arrayBuffer()).
		if (Number(resp.headers?.get?.('content-length') || 0) > 65535) { try { resp.body?.cancel() } catch (e) { } throw new Error('DoH response too large'); }
		const msg = new Uint8Array(await resp.arrayBuffer());
		if (!msg.byteLength) throw new Error('empty DoH response');
		if (msg.byteLength > 65535) throw new Error('DoH response too large'); // a DNS message can't exceed 64KB
		if (缓存键) 写入DNS线缓存(缓存键, msg);
		return 封装响应(msg);
	};
	for (const dohUrl of dohUrls) {
		const 待查询索引 = [];
		for (let i = 0; i < frames.length; i++) if (!results[i]) 待查询索引.push(i);
		if (!待查询索引.length) break;
		for (let offset = 0; offset < 待查询索引.length; offset += 3) {
			const batch = 待查询索引.slice(offset, offset + 3);
			const settled = await Promise.allSettled(batch.map(i => 查询单帧(dohUrl, frames[i])));
			for (let k = 0; k < batch.length; k++) {
				if (settled[k].status === 'fulfilled') results[batch[k]] = settled[k].value;
				else { lastErr = settled[k].reason; log(`[UDP forwarding] DoH via ${dohUrl} failed: ${settled[k].reason?.message || settled[k].reason}`); }
			}
		}
		if (results.every(Boolean)) break;
	}
	if (!results.every(Boolean)) throw lastErr || new Error('all DoH endpoints failed');
	return results.length === 1 ? results[0] : 拼接字节数据(...results);
}

// Fallback tunneled-DNS path: one DNS-over-TCP round trip (legacy behavior) if DoH is unreachable.
async function DNS经TCP转发(requestData, request, timeoutMs) {
	let tcpSocket = null, writer = null;
	try {
		const TCP连接 = 创建请求TCP连接器(request);
		const { env } = getWorkerRequestContext(request);
		const dnsEndpoint = getDnsTcpEndpoint(env);
		log(`[UDP forwarding] DNS-over-TCP fallback -> ${dnsEndpoint.hostname}:${dnsEndpoint.port}`);
		const queryFrames = 解析DNS_TCP帧(requestData);
		if (!queryFrames.length) throw new Error('no DNS query frames to forward');
		if (queryFrames.length > DNS_MAX_FRAMES_PER_REQUEST) throw new Error('too many DNS query frames');
		tcpSocket = TCP连接(dnsEndpoint);
		await socketOpenedWithTimeout(tcpSocket, timeoutMs, 'DNS TCP connect timed out');
		writer = tcpSocket.writable.getWriter();
		await writeWithOperationTimeout(writer, requestData, timeoutMs, 'DNS TCP request write timed out');
		try { writer.releaseLock() } catch (e) { }
		writer = null;
		return await readMultipleDnsTcpFrames(tcpSocket, queryFrames.length, timeoutMs);
	} finally {
		try { writer?.releaseLock?.() } catch (e) { }
		try { tcpSocket?.close?.() } catch (e) { }
	}
}

// Bound tunneled-DNS reassembly: a zero-length or oversized length prefix makes 解析DNS_TCP帧 consume nothing,
// so without a cap a malformed stream grows the retained tail without limit (repro: 20×64KiB of zero-prefix →
// ~1.3MiB). Reject the malformed frame and drop the buffer instead.
const DNS_QUERY_MAX_BYTES = 4096;
const DNS_REASSEMBLY_MAX_BYTES = 128 * 1024;
async function forwardataudp(udpChunk, webSocket, respHeader, request, 响应封装器 = null, udpContext = null, 追踪 = null) {
	// Reassemble length-prefixed DNS query frames across calls. Without this each call parsed only its
	// own chunk and silently dropped any trailing incomplete frame — a query split across two WS
	// messages / stream reads lost its tail and the next chunk's leading bytes were misread as a new
	// frame's length prefix. The Trojan-UDP path already avoids this via 转发木马UDP数据's own accumulator;
	// this gives the direct non-Trojan (魏烈思/裸 UDP) path the same protection when a caller supplies a udpContext.
	let requestData = 数据转Uint8Array(udpChunk);
	if (udpContext) {
		requestData = udpContext.缓存?.byteLength ? 拼接字节数据(udpContext.缓存, requestData) : requestData;
		if (requestData.byteLength >= 2) {
			const 声明长度 = (requestData[0] << 8) | requestData[1];
			if (声明长度 === 0 || 声明长度 > DNS_QUERY_MAX_BYTES) { udpContext.缓存 = new Uint8Array(0); throw new Error(`invalid tunneled DNS frame length: ${声明长度}`); }
		}
		if (requestData.byteLength > DNS_REASSEMBLY_MAX_BYTES) { udpContext.缓存 = new Uint8Array(0); throw new Error('tunneled DNS reassembly limit exceeded'); }
		const completeFrames = 解析DNS_TCP帧(requestData);
		const consumedBytes = completeFrames.reduce((sum, frame) => sum + 2 + frame.byteLength, 0);
		udpContext.缓存 = requestData.subarray(consumedBytes);
		if (!completeFrames.length) return; // no complete frame yet; wait for the rest to arrive
		requestData = requestData.subarray(0, consumedBytes); // forward only complete frames; the tail waits in 缓存 (never write a partial frame to the DNS-over-TCP fallback)
	}
	const requestBytes = requestData.byteLength;
	const dnsStart = 追踪 ? Date.now() : 0;
	let dnsResolver = null;
	try {
		const { env } = getWorkerRequestContext(request);
		const timeoutMs = getDnsTcpResponseTimeoutMs(env);
		log(`[UDP forwarding] Received DNS request: ${requestBytes}B`);
		let rawResponse;
		// DNS_TUNNEL_TCP_FIRST=1 prefers DNS-over-TCP (connect(), no subrequest cost) over DoH (fetch(), one
		// subrequest per query). Useful on the Free plan: a long-lived WS connection shares a 50-subrequest
		// budget, so a client that tunnels its DNS can exhaust it mid-session (→ DNS silently stops). Default
		// keeps DoH-first (fast edge resolver). Enable only if your client routes DNS through the tunnel.
		const 隧道DNS优先TCP = ['1', 'true'].includes(String(env?.DNS_TUNNEL_TCP_FIRST || '').toLowerCase());
		if (隧道DNS优先TCP) {
			try {
				dnsResolver = 'tcp'; rawResponse = await DNS经TCP转发(requestData, request, timeoutMs);
			} catch (tcpError) {
				log(`[UDP forwarding] DNS-over-TCP failed (${tcpError?.message || tcpError}); falling back to DoH`);
				dnsResolver = 'doh'; rawResponse = await DNS经DoH转发(requestData, env, timeoutMs);
			}
		} else {
			try {
				dnsResolver = 'doh'; rawResponse = await DNS经DoH转发(requestData, env, timeoutMs);
			} catch (dohError) {
				log(`[UDP forwarding] DoH failed (${dohError?.message || dohError}); falling back to DNS-over-TCP`);
				dnsResolver = 'tcp'; rawResponse = await DNS经TCP转发(requestData, request, timeoutMs);
			}
		}
		if (!rawResponse || !rawResponse.byteLength) return;
		追踪DNS(追踪, requestBytes, rawResponse.byteLength, { resolver: dnsResolver, latency_ms: dnsStart ? Date.now() - dnsStart : null });
		log(`[UDP forwarding] DNS response: ${rawResponse.byteLength}B`);
		const wrappedResult = 响应封装器 ? await 响应封装器(rawResponse) : rawResponse;
		const fragments = Array.isArray(wrappedResult) ? wrappedResult : [wrappedResult];
		if (!fragments.length || webSocket.readyState !== WebSocket.OPEN) return;
		let vlessHeader = respHeader;
		for (const fragment of fragments) {
			const forwardedResponse = 数据转Uint8Array(fragment);
			if (!forwardedResponse.byteLength || webSocket.readyState !== WebSocket.OPEN) continue;
			if (vlessHeader) {
				const response = new Uint8Array(vlessHeader.length + forwardedResponse.byteLength);
				response.set(vlessHeader, 0);
				response.set(forwardedResponse, vlessHeader.length);
				await WebSocket发送并等待(webSocket, response.buffer);
				vlessHeader = null;
			} else {
				await WebSocket发送并等待(webSocket, forwardedResponse);
			}
		}
	} catch (error) {
		log(`[UDP forwarding] DNS forwarding failed: ${error?.message || error}`);
	}
}

function closeSocketQuietly(socket) {
	try {
		if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
			socket.close();
		}
	} catch (error) { }
}

function formatIdentifier(arr, offset = 0) {
	const hex = [...arr.slice(offset, offset + 16)].map(b => b.toString(16).padStart(2, '0')).join('');
	return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

// Env-overridable, same clamp pattern as getDownlinkGrainBytes/getDownlinkBackpressureHwm. These two
// were previously the only tunables in their family with no per-deployment override.
function getWsBufferedAmountLimitBytes(env) {
	const configured = Number(env?.WS_BUFFERED_AMOUNT_LIMIT_BYTES);
	if (!Number.isFinite(configured) || configured <= 0) return WS缓冲上限字节;
	return Math.max(64 * 1024, Math.min(8 * 1024 * 1024, Math.round(configured)));
}
function getWsBufferedAmountMaxWaitMs(env) {
	const configured = Number(env?.WS_BUFFERED_AMOUNT_MAX_WAIT_MS);
	if (!Number.isFinite(configured) || configured <= 0) return WS缓冲最大等待毫秒;
	return Math.max(100, Math.min(10000, Math.round(configured)));
}

async function WebSocket发送并等待(webSocket, payload, limits = null) {
	const sendResult = webSocket.send(payload);
	if (sendResult && typeof sendResult.then === 'function') await sendResult;
	// Real-WebSocket downstream pacing: gRPC/XHTTP bridges signal backpressure via the awaited
	// promise above; a native WebSocket has no such signal, so when the runtime exposes
	// bufferedAmount we pause until its outbound buffer drains. Bounded so it can never hang.
	const bufferedLimit = limits?.bufferedLimitBytes ?? WS缓冲上限字节;
	const maxWaitMs = limits?.maxWaitMs ?? WS缓冲最大等待毫秒;
	if (typeof webSocket.bufferedAmount === 'number' && webSocket.bufferedAmount > bufferedLimit) {
		let 已等待 = 0;
		while (webSocket.readyState === WebSocket.OPEN && webSocket.bufferedAmount > bufferedLimit && 已等待 < maxWaitMs) {
			await new Promise(r => setTimeout(r, 5));
			已等待 += 5;
		}
	}
}

function 创建上行写入队列({ 获取写入器, 释放写入器, 重试连接, 关闭连接, 上行活动, 写入开始, 写入结束, 统计上行, 名称 = 'Upload queue', 写入超时毫秒 = 0 }) {
	// 写入超时毫秒 > 0 arms an opt-in stuck-writer watchdog (UPLINK_WRITE_TIMEOUT_MS). Default 0 keeps the
	// bare, un-timed write so a legitimately backpressured upload is never aborted.
	const 执行远端写入 = 写入超时毫秒 > 0
		? (w, chunk) => withOperationTimeout(w.write(chunk), 写入超时毫秒, `${名称}: remote write timed out`)
		: (w, chunk) => w.write(chunk);
	let chunks = [];
	let head = 0;
	let queuedBytes = 0;
	// Bytes handed to an in-flight remote write but not yet acknowledged. bundle() drops these from
	// queuedBytes the moment it forms a write, yet the backing memory is still retained until write()
	// resolves — so admission must count them too, or a slow remote lets retained memory reach ~2x the cap.
	let inFlightBytes = 0;
	// DEBUG-only high-water marks surfaced in the connection's close event — lets an AI see whether the
	// upload queue / write latency is a bottleneck before anyone tunes UPLINK_QUEUE_MAX_BYTES / bundle size.
	const 统计 = 调试日志打印 ? { maxQueuedBytes: 0, maxInFlightBytes: 0, maxItems: 0, maxWriteMs: 0, overflowCount: 0 } : null;
	let draining = false;
	let closed = false;
	let bundleBuffer = null;
	let idleResolvers = [];
	let activeCompletions = null;
	// True once any chunk has been successfully written to the remote. After that a reconnect
	// retry is unsafe: 重试连接 reconnects and replays only the original first packet, so retrying
	// once data has already flowed would desync the upstream stream. Mirrors the download path's
	// `!hasData` retry gate (see pipeRemoteToClient).
	let 已交付远端字节 = false;

	const settleCompletions = (completions, err = null) => {
		if (!completions) return;
		for (const completion of completions) {
			if (err) completion.reject(err);
			else completion.resolve();
		}
	};

	const rejectQueued = (err) => {
		for (let i = head; i < chunks.length; i++) {
			const item = chunks[i];
			if (item?.completions) settleCompletions(item.completions, err);
		}
	};

	const compact = () => {
		if (head > 32 && head * 2 >= chunks.length) {
			chunks = chunks.slice(head);
			head = 0;
		}
	};

	const resolveIdle = () => {
		if (queuedBytes || draining || !idleResolvers.length) return;
		const resolvers = idleResolvers;
		idleResolvers = [];
		for (const resolve of resolvers) resolve();
	};

	const clear = (err = null) => {
		const closeErr = err || (closed ? new Error(`${名称}: queue closed`) : null);
		if (closeErr) {
			rejectQueued(closeErr);
			settleCompletions(activeCompletions, closeErr);
			activeCompletions = null;
		}
		chunks = [];
		head = 0;
		queuedBytes = 0;
		resolveIdle();
	};

	const shift = () => {
		if (head >= chunks.length) return null;
		const item = chunks[head];
		chunks[head++] = undefined;
		queuedBytes -= item.chunk.byteLength;
		compact();
		return item;
	};

	const bundle = () => {
		const first = shift();
		if (!first) return null;
		if (head >= chunks.length || first.chunk.byteLength >= 上行合包目标字节) return first;

		let byteLength = first.chunk.byteLength;
		let end = head;
		let allowRetry = first.allowRetry;
		let completions = first.completions || null;
		while (end < chunks.length) {
			const next = chunks[end];
			const nextLength = byteLength + next.chunk.byteLength;
			if (nextLength > 上行合包目标字节) break;
			byteLength = nextLength;
			allowRetry = allowRetry && next.allowRetry;
			if (next.completions) completions = completions ? completions.concat(next.completions) : next.completions;
			end++;
		}
		if (end === head) return first;

		const output = (bundleBuffer ||= new Uint8Array(上行合包目标字节));
		output.set(first.chunk);
		let offset = first.chunk.byteLength;
		while (head < end) {
			const next = chunks[head];
			chunks[head++] = undefined;
			queuedBytes -= next.chunk.byteLength;
			output.set(next.chunk, offset);
			offset += next.chunk.byteLength;
		}
		compact();
		return { chunk: output.subarray(0, byteLength), allowRetry, completions };
	};

	const drain = async () => {
		if (draining || closed) return;
		draining = true;
		try {
			for (; ;) {
				if (closed) break;
				const item = bundle();
				if (!item) break;
				inFlightBytes += item.chunk.byteLength;
				if (统计上行) 统计上行(item.chunk.byteLength);
				if (统计 && inFlightBytes > 统计.maxInFlightBytes) 统计.maxInFlightBytes = inFlightBytes;
				let writer = 获取写入器();
				if (!writer) throw new Error(`${名称}: remote writer unavailable`);
				const completions = item.completions || null;
				activeCompletions = completions;
				// Mark uplink delivery ambiguous the moment the write STARTS (not when it resolves): a write still
				// pending when the remote EOFs has uncertain delivery, so the no-data fallback must not replay the
				// first packet while later bytes may already be on the wire.
				try { 写入开始?.(); } catch (e) { }
				const 写入开始时刻 = 统计 ? Date.now() : 0;
				try {
					try {
						await 执行远端写入(writer, item.chunk);
						if (统计) { const wms = Date.now() - 写入开始时刻; if (wms > 统计.maxWriteMs) 统计.maxWriteMs = wms; }
					} catch (err) {
						释放写入器?.();
						// Delivery is UNCERTAIN once writer.write() was invoked — a rejected write does not prove
						// zero bytes reached the remote. Never resend this chunk on a fresh socket (that could
						// duplicate or corrupt a non-idempotent stream); close and let the client re-dial. The only
						// replay-safe fallback is BEFORE any application write (connectStreams' no-data retry gate
						// + the ClientHello classifier), never here.
						throw err;
					}
					已交付远端字节 = true;
					try { 上行活动?.(); } catch (e) { }
					settleCompletions(completions);
				} catch (err) {
					settleCompletions(completions, err);
					throw err;
				} finally {
					try { 写入结束?.(); } catch (e) { }
					inFlightBytes -= item.chunk.byteLength;
					if (inFlightBytes < 0) inFlightBytes = 0;
					if (activeCompletions === completions) activeCompletions = null;
				}
			}
		} catch (err) {
			closed = true;
			clear(err);
			log(`[${名称}] Write failed: ${err?.message || err}`);
			try { 关闭连接?.(err) } catch (_) { }
		} finally {
			draining = false;
			if (!closed && head < chunks.length) queueMicrotask(drain);
			else resolveIdle();
		}
	};

	const enqueue = (data, allowRetry = true, waitForFlush = false) => {
		if (closed) return false;

		const chunk = 数据转Uint8Array(data);
		if (!chunk.byteLength) return true;
		const nextBytes = queuedBytes + chunk.byteLength;
		const nextItems = chunks.length - head + 1;
		const retainedBytes = nextBytes + inFlightBytes;
		if (retainedBytes > 上行队列最大字节 || nextItems > 上行队列最大条目) {
			closed = true;
			if (统计) 统计.overflowCount++;
			const err = Object.assign(new Error(`${名称}: upload queue overflow (${retainedBytes}B/${nextItems})`), { isQueueOverflow: true });
			clear(err);
			log(`[${名称}] Queue limit exceeded; closing connection`);
			try { 关闭连接?.(err) } catch (_) { }
			throw err;
		}
		if (统计) { if (nextBytes > 统计.maxQueuedBytes) 统计.maxQueuedBytes = nextBytes; if (nextItems > 统计.maxItems) 统计.maxItems = nextItems; }
		let completionPromise = null;
		let completions = null;
		if (waitForFlush) {
			completions = [];
			completionPromise = new Promise((resolve, reject) => completions.push({ resolve, reject }));
		}
		chunks.push({ chunk, allowRetry, completions });
		queuedBytes = nextBytes;
		if (!draining) queueMicrotask(drain);
		return waitForFlush ? completionPromise.then(() => true) : true;
	};

	return {
		获取统计: 统计 ? () => ({ ...统计, queuedBytes, inFlightBytes }) : null,
		写入(data, allowRetry = true) {
			return enqueue(data, allowRetry, false);
		},
		写入并等待(data, allowRetry = true) {
			return enqueue(data, allowRetry, true);
		},
		async 等待空() {
			if (!queuedBytes && !draining) return;
			await new Promise(resolve => idleResolvers.push(resolve));
		},
		清空() {
			closed = true;
			clear();
		}
	};
}

function 创建下行Grain发送器(webSocket, headerData = null, packetCapInput = null, env = null) {
	const wsSendLimits = { bufferedLimitBytes: getWsBufferedAmountLimitBytes(env), maxWaitMs: getWsBufferedAmountMaxWaitMs(env) };
	const packetCapCandidate = Number(packetCapInput);
	const packetCap = Number.isFinite(packetCapCandidate) && packetCapCandidate > 0 ? Math.round(packetCapCandidate) : 下行Grain包字节;
	const tailBytes = packetCap === 下行Grain包字节 ? 下行Grain尾部阈值 : Math.max(512, Math.min(16384, Math.round(packetCap / 32)));
	const lowWaterBytes = Math.max(4096, tailBytes << 3);
	let header = headerData;
	let pendingBuffer = new Uint8Array(packetCap);
	let pendingBytes = 0;
	let flushTimer = null;
	let microtaskQueued = false;
	let generation = 0;
	let scheduledGeneration = 0;
	let waitRounds = 0;
	let flushPromise = null;

	const 发送原始块 = async (chunk) => {
		if (webSocket.readyState !== WebSocket.OPEN) throw new Error('ws.readyState is not open');
		await WebSocket发送并等待(webSocket, chunk, wsSendLimits);
	};

	const 附加响应头 = (chunk) => {
		if (!header) return chunk;
		const merged = new Uint8Array(header.length + chunk.byteLength);
		merged.set(header, 0);
		merged.set(chunk, header.length);
		header = null;
		return merged;
	};

	const flush = async () => {
		while (flushPromise) await flushPromise;
		if (flushTimer) clearTimeout(flushTimer);
		flushTimer = null;
		microtaskQueued = false;
		if (!pendingBytes) return;
		// No defensive copy needed: the next line rebinds pendingBuffer to a fresh array, orphaning this
		// backing buffer, so nothing mutates it while `output` is in flight — a zero-copy view is safe.
		const output = pendingBuffer.subarray(0, pendingBytes);
		pendingBuffer = new Uint8Array(packetCap);
		pendingBytes = 0;
		waitRounds = 0;
		flushPromise = 发送原始块(output).finally(() => { flushPromise = null });
		return flushPromise;
	};

	const scheduleFlush = () => {
		if (flushTimer || microtaskQueued) return;
		microtaskQueued = true;
		scheduledGeneration = generation;
		queueMicrotask(() => {
			microtaskQueued = false;
			if (!pendingBytes || flushTimer) return;
			if (packetCap - pendingBytes < tailBytes) {
				flush().catch(() => closeSocketQuietly(webSocket));
				return;
			}
			flushTimer = setTimeout(() => {
				flushTimer = null;
				if (!pendingBytes) return;
				if (packetCap - pendingBytes < tailBytes) {
					flush().catch(() => closeSocketQuietly(webSocket));
					return;
				}
				if (waitRounds < 2 && (generation !== scheduledGeneration || pendingBytes < lowWaterBytes)) {
					waitRounds++;
					scheduledGeneration = generation;
					scheduleFlush();
					return;
				}
				flush().catch(() => closeSocketQuietly(webSocket));
			}, Math.max(下行Grain静默毫秒, 1));
		});
	};

	return {
		async 直接发送(data) {
			let chunk = 数据转Uint8Array(data);
			if (!chunk.byteLength) return;
			chunk = 附加响应头(chunk);
			await 发送原始块(chunk);
		},
		async 发送(data) {
			let chunk = 数据转Uint8Array(data);
			if (!chunk.byteLength) return;
			chunk = 附加响应头(chunk);
			let offset = 0;
			const totalBytes = chunk.byteLength;
			while (offset < totalBytes) {
				if (!pendingBytes && totalBytes - offset >= packetCap) {
					const sendBytes = Math.min(packetCap, totalBytes - offset);
					const view = offset || sendBytes !== totalBytes ? chunk.subarray(offset, offset + sendBytes) : chunk;
					await 发送原始块(view);
					offset += sendBytes;
					continue;
				}
				const copyBytes = Math.min(packetCap - pendingBytes, totalBytes - offset);
				pendingBuffer.set(chunk.subarray(offset, offset + copyBytes), pendingBytes);
				pendingBytes += copyBytes;
				offset += copyBytes;
				generation++;
				if (pendingBytes === packetCap || packetCap - pendingBytes < tailBytes) await flush();
				else scheduleFlush();
			}
		},
		flush
	};
}

function pipeRemoteToClient(remoteSocket, webSocket, headerData, retryFunc, firstByteTimeoutMs = 0, pipeMeta = null) {
	return connectStreams(remoteSocket, webSocket, headerData, retryFunc, firstByteTimeoutMs, pipeMeta).catch(error => {
		// A stream cancellation (client cancel / our own cleanup) is normal teardown, not a pipe failure — don't
		// emit it as noise (the prior build logged 30 such lines for one browsing session).
		if (!是流取消错误(error) && !(pipeMeta?.wrapper?.客户端已关闭)) log(`[Stream pipe] Remote-to-client pipe failed: ${error?.message || error}`);
		closeSocketQuietly(webSocket);
	});
}

async function connectStreams(remoteSocket, webSocket, headerData, retryFunc, firstByteTimeoutMs = 0, pipeMeta = null) {
	let header = headerData, hasData = false, reader, useBYOB = false;
	let readError = null;
	const 追踪 = pipeMeta?.wrapper?.追踪 || null; // DEBUG-only connection tracer (null when DEBUG off)
	// Fire onFirstByte exactly once, when the remote actually returns data (used for ProxyIP health scoring).
	const 标记首字节 = () => { if (hasData) return; hasData = true; if (首字节计时器) { clearTimeout(首字节计时器); 首字节计时器 = null; } if (pipeMeta?.wrapper) pipeMeta.wrapper.已向客户端下发数据 = true; 追踪首字节(追踪); try { pipeMeta?.onFirstByte?.(); } catch (e) { } };
	const BYOB单次读取上限 = 64 * 1024;
	const downlinkGrainBytes = getDownlinkGrainBytes(pipeMeta?.env);
	const 下行发送器 = 创建下行Grain发送器(webSocket, header, downlinkGrainBytes, pipeMeta?.env);
	header = null;

	try { reader = remoteSocket.readable.getReader({ mode: 'byob' }); useBYOB = true }
	catch (e) { reader = remoteSocket.readable.getReader() }

	// Optional first-byte timeout: if the remote connects but sends nothing within the window, cancel
	// the read. With a retryFunc (direct path) the no-data fallback then tries the ProxyIP relay; without
	// one (proxy path) the stream just closes and the client re-dials. Either way it rescues a blackholed
	// connection instead of hanging. Armed whenever firstByteTimeoutMs > 0 — the caller decides the value
	// (the direct path forces it to 0 on a data-carrying first packet to avoid a replay-triggering retry).
	let 管道已结束 = false;
	// When the caller sends a data-carrying first packet on the direct path, replaying it is unsafe — so a
	// first-byte TIMEOUT must close-only (no retry) while a socket close/EOF may still fall back to ProxyIP.
	// This flag records that the read ended via the timeout, so the retry gate below skips replay in that case.
	const 首字节超时仅关闭 = pipeMeta?.首字节超时仅关闭 === true;
	let 首字节超时触发关闭 = false;
	// A backpressured in-flight uplink write means the client is actively sending — a silent downlink then is
	// NOT a blackhole/stall, so neither watchdog may fire while a write is outstanding. 上行活动 only re-arms on
	// write COMPLETION, so a single write slower than the timeout window would otherwise trip the watchdog
	// mid-upload (the reason FIRST_BYTE_TIMEOUT_MS was unsafe to enable). The queue tracks 活跃写入数 on the wrapper.
	const 上传进行中 = () => ((pipeMeta?.wrapper?.活跃写入数 | 0) > 0);
	const 请求已发送 = () => (pipeMeta?.wrapper?.请求已发送 === true);
	let 首字节计时器 = null;
	const 首字节超时回调 = () => {
		首字节计时器 = null;
		// Never treat a connection as blackholed before the client actually sent a request, and never while an
		// upload write is in flight (that IS the client sending). Otherwise re-arm and keep waiting.
		if (hasData || 管道已结束 || !请求已发送()) return;
		if (上传进行中()) { 安排首字节计时器(); return; }
		if (首字节超时仅关闭) 首字节超时触发关闭 = true;
		if (pipeMeta?.wrapper && !pipeMeta.wrapper.closeHint) pipeMeta.wrapper.closeHint = 'first_byte_timeout';
		cancelReaderQuietly(reader, 'first byte timeout');
	};
	// Arm the first-byte watchdog ONLY after a request has been sent. A browser preconnect (tunnel open + target
	// header, but no ClientHello yet) is not a blackhole — arming on connect made the 3s timeout fire on idle
	// Telegram preconnects, cancel the read, poison the direct-route cache, and shove real loads onto slow ProxyIP
	// (70/76 first-byte timeouts in the long-session capture were one idle Telegram IP). Re-armed when a request
	// arrives (记录上行活动) and after each in-flight write drains.
	const 安排首字节计时器 = () => {
		if (首字节计时器) { clearTimeout(首字节计时器); 首字节计时器 = null; }
		if (管道已结束 || hasData || firstByteTimeoutMs <= 0 || !请求已发送() || 上传进行中()) return;
		首字节计时器 = setTimeout(首字节超时回调, firstByteTimeoutMs);
	};
	安排首字节计时器(); // arms now if the first packet already carried a request (已有首包数据)

	// Optional post-first-byte idle watchdog: once data is flowing, if the remote goes silent for the
	// configured window (a mid-stream stall on a flaky relay), cancel the read so the stream ends and the
	// client re-dials, instead of hanging forever. Off unless IDLE_TIMEOUT_MS is set. Safe: only fires
	// after the first byte (hasData), so it never retries/replays — it just ends the stream like a normal EOF.
	const 空闲超时毫秒 = getIdleTimeoutMs(pipeMeta?.env);
	let 空闲计时器 = null;
	const 空闲超时回调 = () => {
		if (上传进行中()) { 空闲计时器 = setTimeout(空闲超时回调, 空闲超时毫秒); return; }
		if (pipeMeta?.wrapper && !pipeMeta.wrapper.closeHint) pipeMeta.wrapper.closeHint = 'idle_timeout';
		cancelReaderQuietly(reader, 'idle timeout');
	};
	const 重置空闲计时器 = () => {
		if (空闲超时毫秒 <= 0) return;
		if (空闲计时器) clearTimeout(空闲计时器);
		空闲计时器 = setTimeout(空闲超时回调, 空闲超时毫秒);
	};

	// Uplink activity keeps both downlink watchdogs from mis-firing: a connection actively receiving an
	// UPLOAD (client streaming upstream while the remote is legitimately silent) is neither blackholed
	// nor idle, so the first-byte and idle timers must not close it. The uplink write path calls this on
	// every chunk it delivers upstream; it re-arms the timers from "now" so they fire only on genuine
	// two-way silence (a real blackhole/stall), never mid-upload.
	const 记录上行活动 = () => {
		if (管道已结束) return;
		// Before the first downlink byte, uplink activity re-arms the FIRST-BYTE watchdog (an upload with a
		// still-silent downlink is not a blackhole). Only AFTER the first byte does uplink activity re-arm the
		// IDLE watchdog. The idle timer must never arm pre-first-byte, or an IDLE_TIMEOUT_MS smaller than
		// FIRST_BYTE_TIMEOUT_MS would fire before the first-byte deadline and cut the connection early.
		if (hasData) {
			重置空闲计时器();
		} else {
			安排首字节计时器(); // a request may have just been sent -> arm the first-byte watchdog now (no-op until 请求已发送)
		}
	};
	if (pipeMeta?.wrapper) pipeMeta.wrapper.记录上行活动 = 记录上行活动;

	// A reconnect can install a DIFFERENT socket in the wrapper while this pipe is still draining its (now
	// superseded) socket. Such a stale pipe must not forward bytes to — or close — the shared client, nor
	// score route health; that all belongs to the pipe that owns the current socket. Reconnects only happen
	// pre-first-byte (retry is refused once downlink data reached the client), so a stale pipe never has
	// buffered output to lose. Socket identity is a safe generation proxy because connecttoPry installs the
	// replacement BEFORE closing the old socket — there is no window where a superseded pipe still looks current.
	const 仍为当前管道 = () => !(pipeMeta?.wrapper && pipeMeta.wrapper.socket && pipeMeta.wrapper.socket !== remoteSocket);

	try {
		if (!useBYOB) {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (!仍为当前管道()) break; // superseded by a reconnect — stop forwarding to the shared client
				if (!value || value.byteLength === 0) continue;
				标记首字节();
				if (追踪) 追踪下行(追踪, value.byteLength);
				await 下行发送器.发送(value);
				重置空闲计时器();
			}
		} else {
			let readBuffer = new ArrayBuffer(BYOB单次读取上限);
			while (true) {
				const { done, value } = await reader.read(new Uint8Array(readBuffer, 0, BYOB单次读取上限));
				if (done) break;
				if (!仍为当前管道()) break; // superseded by a reconnect — stop forwarding to the shared client
				if (!value || value.byteLength === 0) continue;
				标记首字节();
				if (追踪) 追踪下行(追踪, value.byteLength);
				if (value.byteLength >= downlinkGrainBytes) {
					await 下行发送器.flush();
					await 下行发送器.直接发送(value);
					readBuffer = new ArrayBuffer(BYOB单次读取上限);
				} else {
					await 下行发送器.发送(value);
					readBuffer = value.buffer.byteLength >= BYOB单次读取上限 ? value.buffer : new ArrayBuffer(BYOB单次读取上限);
				}
				重置空闲计时器();
			}
		}
		await 下行发送器.flush();
	} catch (err) { readError = err }
	finally {
		管道已结束 = true;
		// Record WHY the downlink ended so the close event is specific (remote_eof / …_no_data) instead of a
		// generic runtime_cancel — only on a clean loop end with no more-specific hint already set.
		if (!readError && pipeMeta?.wrapper && !pipeMeta.wrapper.closeHint) pipeMeta.wrapper.closeHint = hasData ? 'remote_eof' : (pipeMeta.wrapper.请求已发送 ? 'remote_eof_no_data' : 'no_request_idle');
		if (pipeMeta?.wrapper && pipeMeta.wrapper.记录上行活动 === 记录上行活动) pipeMeta.wrapper.记录上行活动 = null;
		if (首字节计时器) { try { clearTimeout(首字节计时器) } catch (e) { } }
		if (空闲计时器) { try { clearTimeout(空闲计时器) } catch (e) { } }
		try { await reader.cancel() } catch (e) { }
		try { reader.releaseLock() } catch (e) { }
	}
	// A stale pipe (a reconnect installed a different socket) must not touch the shared client transport or
	// route health — connecttoPry already closed its socket; just exit and let the current pipe own teardown.
	if (!仍为当前管道()) { try { remoteSocket?.close?.() } catch (e) { } return; }
	// A client that closed/cancelled before the first downlink byte is not a route failure — don't poison the
	// direct-route cache (onNoData) and don't spend a ProxyIP fallback dial on a connection the client already
	// abandoned. And if a later uplink chunk (beyond the replayable first packet) already reached the remote,
	// a fallback can't reproduce that upstream state (connecttoPry replays only the first packet), so refuse
	// the retry and let the client re-dial rather than hang with lost bytes.
	const 客户端已关闭 = pipeMeta?.wrapper?.客户端已关闭 === true;
	const 后续上行已送达 = pipeMeta?.wrapper?.已向远端发送数据 === true;
	// A no-request PRECONNECT (client opened the tunnel + sent the target header, but no ClientHello/payload)
	// is NOT a blackholed route — the remote has nothing to answer. Capture showed these idle-closing at 30–43s
	// then poisoning the direct-route cache + wasting a ProxyIP fallback, pushing later REAL loads for that host
	// onto the slower proxy. Skip onNoData + fallback unless a request was actually sent. (A sent ClientHello
	// with no reply IS a real blackhole — 请求已发送值 is true then, so it still fails over. The first-byte
	// watchdog now arms only after a request is sent, so its cancellation can never masquerade as a failure here.)
	const 请求已发送值 = pipeMeta?.wrapper?.请求已发送 === true;
	if (!hasData && !客户端已关闭 && 请求已发送值) { try { pipeMeta?.onNoData?.(); } catch (e) { } }
	// 可重放首包 === false means the first packet carried non-idempotent data (not empty, not a lone TLS
	// ClientHello) — replaying it on a fallback is unsafe, so close instead of retrying.
	if (!hasData && retryFunc && 请求已发送值 && !首字节超时触发关闭 && !客户端已关闭 && !后续上行已送达 && pipeMeta?.可重放首包 !== false) {
		try {
			try { remoteSocket?.close?.() } catch (e) { }
			await retryFunc();
			return;
		} catch (retryError) {
			closeSocketQuietly(webSocket);
			throw retryError;
		}
	}
	if (!hasData) { try { remoteSocket?.close?.() } catch (e) { } }
	if (readError) {
		closeSocketQuietly(webSocket);
		throw readError;
	}
	closeSocketQuietly(webSocket);
}

function isSpeedTestSite(hostname) {
	hostname = String(hostname || '').toLowerCase();
	const speedTestDomains = [atob('c3BlZWQuY2xvdWRmbGFyZS5jb20=')];
	if (speedTestDomains.includes(hostname)) {
		return true;
	}

	for (const domain of speedTestDomains) {
		if (hostname.endsWith('.' + domain) || hostname === domain) {
			return true;
		}
	}
	return false;
}

// Bounded cache so forceProxyHosts/socksWhitelist patterns (small, static, admin-configured) aren't
// recompiled into a RegExp on every connection; every lookup after the first is a cache hit.
const HOST_PATTERN_REGEX_CACHE = new Map();
function wildcardPatternToRegex(pattern = '') {
	const key = String(pattern || '');
	let regex = HOST_PATTERN_REGEX_CACHE.get(key);
	if (regex) return regex;
	const escaped = key.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
	regex = new RegExp(`^${escaped}$`, 'i');
	if (HOST_PATTERN_REGEX_CACHE.size >= 256) HOST_PATTERN_REGEX_CACHE.clear();
	HOST_PATTERN_REGEX_CACHE.set(key, regex);
	return regex;
}

function matchesHostPattern(hostname, pattern) {
	const host = String(hostname || '').trim();
	const value = String(pattern || '').trim();
	if (!host || !value) return false;
	try {
		return wildcardPatternToRegex(value).test(host);
	} catch (e) {
		return false;
	}
}


function isValidIPv6Literal(host) {
	let value = String(host || '').trim();
	if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
	if (!value.includes(':') || value.includes(':::')) return false;
	const parts = value.split('::');
	if (parts.length > 2) return false;
	const left = parts[0] ? parts[0].split(':') : [];
	const right = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
	const all = left.concat(right);
	if (all.some(part => !/^[0-9a-fA-F]{1,4}$/.test(part))) return false;
	if (parts.length === 1) return all.length === 8;
	return all.length < 8;
}

function isPrivateOrLocalIPv4(host) {
	const m = String(host || '').match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
	if (!m) return false;
	const a = Number(m[1]), b = Number(m[2]);
	return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
		|| (a === 100 && b >= 64 && b <= 127) // CGNAT 100.64.0.0/10
		|| (a === 198 && (b === 18 || b === 19)); // benchmarking 198.18.0.0/15
}

function isLocalhostName(host) {
	const value = String(host || '').trim().toLowerCase().replace(/\.$/, '');
	return value === 'localhost' || value.endsWith('.localhost');
}

function getFirstIpv6Hextet(host) {
	let value = stripIPv6Brackets(String(host || '').trim()).toLowerCase();
	if (!isValidIPv6Literal(value)) return null;
	if (value.startsWith('::')) return 0;
	const first = value.split(':')[0] || '0';
	const parsed = parseInt(first, 16);
	return Number.isFinite(parsed) ? parsed : null;
}

function isPrivateOrLocalIPv6(host) {
	const value = stripIPv6Brackets(String(host || '').trim()).toLowerCase();
	// Unwrap IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) forms to the embedded IPv4 FIRST —
	// isValidIPv6Literal rejects the mixed-dotted notation, so this must run before it. Prevents e.g.
	// ::ffff:127.0.0.1 or 64:ff9b::a9fe:a9fe smuggling a private target past the guard.
	if (value.startsWith('::ffff:') || value.startsWith('64:ff9b:')) {
		const dotted = value.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
		if (dotted) return isPrivateOrLocalIPv4(dotted[1]);
		const groups = value.split(':').filter(g => g.length > 0);
		if (groups.length >= 2) {
			const hi = parseInt(groups[groups.length - 2], 16), lo = parseInt(groups[groups.length - 1], 16);
			if (Number.isFinite(hi) && Number.isFinite(lo)) return isPrivateOrLocalIPv4(`${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`);
		}
	}
	if (!isValidIPv6Literal(value)) return false;
	if (value === '::' || value === '0:0:0:0:0:0:0:0' || value === '::1' || value === '0:0:0:0:0:0:0:1') return true;
	const first = getFirstIpv6Hextet(value);
	if (first === null) return false;
	return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80; // fc00::/7 ULA, fe80::/10 link-local.
}

function isProbablyValidDomain(host) {
	const value = String(host || '').trim().replace(/\.$/, '');
	if (!value || value.length > 253 || /[\s\0]/.test(value)) return false;
	if (!value.includes('.')) return false;
	const labels = value.split('.');
	// A real domain's rightmost label (TLD) is never all-numeric. Rejecting an all-numeric TLD blocks
	// non-canonical IP forms (127.1, 0177.0.0.1, 999.1.1.1) that otherwise pass here as "domains" and slip
	// past the private-IP checks — an SSRF / DNS-rebind bypass. Canonical IP literals go via isIPHostname.
	if (/^\d+$/.test(labels[labels.length - 1])) return false;
	return labels.every(label => label.length >= 1 && label.length <= 63 && /^[a-zA-Z0-9-]+$/.test(label) && !label.startsWith('-') && !label.endsWith('-'));
}

function validateTunnelTarget(host, port) {
	const hostname = String(host || '').trim();
	const unbracketedHost = stripIPv6Brackets(hostname);
	const portNum = Number(port);
	if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) throw new Error(`invalid target port: ${port}`);
	if (portNum === 25) throw new Error('SMTP port 25 is not allowed');
	if (!hostname) throw new Error('empty target host');
	if (isLocalhostName(hostname)) throw new Error(`localhost target blocked: ${hostname}`);
	if (isPrivateOrLocalIPv4(unbracketedHost)) throw new Error(`private/local target blocked: ${hostname}`);
	if (isPrivateOrLocalIPv6(unbracketedHost)) throw new Error(`private/local IPv6 target blocked: ${hostname}`);
	if (!isIPHostname(hostname) && !isProbablyValidDomain(hostname)) throw new Error(`invalid target hostname: ${hostname}`);
}


async function socks5Connect(targetHost, targetPort, initialData, TCP连接, proxyAddress = {}) {
	const { username, password, hostname, port } = proxyAddress;
	const timeoutMs = getProxyHandshakeTimeoutMs(proxyAddress);
	const socket = TCP连接({ hostname, port }), writer = socket.writable.getWriter(), reader = socket.readable.getReader();
	let pending = new Uint8Array(0);
	const readExact = async (byteCount, message) => {
		while (pending.byteLength < byteCount) {
			const response = await readWithOperationTimeout(reader, timeoutMs, message);
			if (response.done || !response.value) throw new Error(message.replace(' timed out', ' closed before completing'));
			const chunk = 数据转Uint8Array(response.value);
			if (chunk.byteLength) pending = pending.byteLength ? 拼接字节数据(pending, chunk) : chunk;
		}
		const out = pending.slice(0, byteCount);
		pending = pending.slice(byteCount);
		return out;
	};
	try {
		await socketOpenedWithTimeout(socket, timeoutMs, 'SOCKS5 proxy TCP connect timed out');
		const authMethods = username && password ? new Uint8Array([0x05, 0x02, 0x00, 0x02]) : new Uint8Array([0x05, 0x01, 0x00]);
		await writeWithOperationTimeout(writer, authMethods, timeoutMs, 'SOCKS5 proxy method write timed out');
		let response = await readExact(2, 'SOCKS5 proxy handshake timed out');
		if (response[0] !== 0x05) throw new Error('S5 method selection failed');

		const selectedMethod = response[1];
		if (selectedMethod === 0x02) {
			if (!username || !password) throw new Error('S5 requires authentication');
			const userBytes = new TextEncoder().encode(username), passBytes = new TextEncoder().encode(password);
			if (userBytes.byteLength > 255 || passBytes.byteLength > 255) throw new Error('S5 username/password is too long');
			const authPacket = new Uint8Array([0x01, userBytes.length, ...userBytes, passBytes.length, ...passBytes]);
			await writeWithOperationTimeout(writer, authPacket, timeoutMs, 'SOCKS5 proxy authentication write timed out');
			response = await readExact(2, 'SOCKS5 proxy handshake timed out');
			if (response[0] !== 0x01 || response[1] !== 0x00) throw new Error('S5 authentication failed');
		} else if (selectedMethod !== 0x00) throw new Error(`S5 unsupported auth method: ${selectedMethod}`);

		const hostBytes = new TextEncoder().encode(targetHost);
		if (hostBytes.byteLength > 255) throw new Error('S5 target hostname is too long');
		const connectPacket = new Uint8Array([0x05, 0x01, 0x00, 0x03, hostBytes.length, ...hostBytes, targetPort >> 8, targetPort & 0xff]);
		await writeWithOperationTimeout(writer, connectPacket, timeoutMs, 'SOCKS5 proxy CONNECT write timed out');
		response = await readExact(4, 'SOCKS5 proxy handshake timed out');
		if (response[0] !== 0x05 || response[1] !== 0x00) throw new Error('S5 connection failed');
		const atyp = response[3];
		if (atyp === 0x01) await readExact(6, 'SOCKS5 proxy handshake timed out');
		else if (atyp === 0x04) await readExact(18, 'SOCKS5 proxy handshake timed out');
		else if (atyp === 0x03) {
			const length = (await readExact(1, 'SOCKS5 proxy handshake timed out'))[0];
			await readExact(length + 2, 'SOCKS5 proxy handshake timed out');
		} else throw new Error(`S5 unsupported address type: ${atyp}`);

		if (有效数据长度(initialData) > 0) await writeWithOperationTimeout(writer, initialData, timeoutMs, 'SOCKS5 initial data write timed out');
		writer.releaseLock();
		reader.releaseLock();

		// If the proxy bundled the first bytes of the target's response in the same segment as
		// the handshake reply, those bytes are sitting in `pending` (already read off the socket).
		// Stitch them back onto the front of the stream so the inner TLS/HTTP2 doesn't desync.
		if (有效数据长度(pending) > 0) {
			const { readable, writable } = new TransformStream();
			const transformWriter = writable.getWriter();
			await transformWriter.write(pending);
			transformWriter.releaseLock();
			socket.readable.pipeTo(writable).catch(() => { });
			return { readable, writable: socket.writable, closed: socket.closed, close: () => socket.close() };
		}

		return socket;
	} catch (error) {
		try { writer.releaseLock() } catch (e) { }
		try { reader.releaseLock() } catch (e) { }
		try { socket.close() } catch (e) { }
		throw error;
	}
}

async function httpConnect(targetHost, targetPort, initialData, HTTPS代理 = false, TCP连接, proxyAddress = {}) {
	const { username, password, hostname, port } = proxyAddress;
	const timeoutMs = getProxyHandshakeTimeoutMs(proxyAddress);
	const socket = HTTPS代理
		? TCP连接({ hostname, port }, { secureTransport: 'on', allowHalfOpen: false })
		: TCP连接({ hostname, port });
	const writer = socket.writable.getWriter(), reader = socket.readable.getReader();
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();
	try {
		await socketOpenedWithTimeout(socket, timeoutMs, `${HTTPS代理 ? 'HTTPS' : 'HTTP'} proxy TCP connect timed out`);

		const auth = username && password ? `Proxy-Authorization: Basic ${btoa(`${username}:${password}`)}\r\n` : '';
		const request = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n${auth}User-Agent: Mozilla/5.0\r\nConnection: keep-alive\r\n\r\n`;
		await writeWithOperationTimeout(writer, encoder.encode(request), timeoutMs, `${HTTPS代理 ? 'HTTPS' : 'HTTP'} proxy CONNECT write timed out`);
		writer.releaseLock();

		let responseBuffer = new Uint8Array(0), headerEndIndex = -1, bytesRead = 0;
		while (headerEndIndex === -1 && bytesRead < 8192) {
			const { done, value } = await readWithOperationTimeout(reader, timeoutMs, `${HTTPS代理 ? 'HTTPS' : 'HTTP'} proxy CONNECT response timed out`);
			if (done || !value) throw new Error(`${HTTPS代理 ? 'HTTPS' : 'HTTP'} proxy closed the connection before returning a CONNECT response`);
			responseBuffer = 拼接字节数据(responseBuffer, value);
			bytesRead = responseBuffer.length;
			const crlfcrlf = responseBuffer.findIndex((_, i) => i < responseBuffer.length - 3 && responseBuffer[i] === 0x0d && responseBuffer[i + 1] === 0x0a && responseBuffer[i + 2] === 0x0d && responseBuffer[i + 3] === 0x0a);
			if (crlfcrlf !== -1) headerEndIndex = crlfcrlf + 4;
		}

		if (headerEndIndex === -1) throw new Error('Proxy CONNECT response headers are too long or invalid');
		const statusMatch = decoder.decode(responseBuffer.slice(0, headerEndIndex)).split('\r\n')[0].match(/HTTP\/\d\.\d\s+(\d+)/);
		const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : NaN;
		if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode >= 300) throw new Error(`Connection failed: HTTP ${statusCode}`);

		reader.releaseLock();

		if (有效数据长度(initialData) > 0) {
			const 远端写入器 = socket.writable.getWriter();
			try {
				await writeWithOperationTimeout(远端写入器, initialData, timeoutMs, `${HTTPS代理 ? 'HTTPS' : 'HTTP'} proxy initial data write timed out`);
			} finally {
				try { 远端写入器.releaseLock() } catch (e) { }
			}
		}


		if (bytesRead > headerEndIndex) {
			const { readable, writable } = new TransformStream();
			const transformWriter = writable.getWriter();
			await transformWriter.write(responseBuffer.subarray(headerEndIndex, bytesRead));
			transformWriter.releaseLock();
			socket.readable.pipeTo(writable).catch(() => { });
			return { readable, writable: socket.writable, closed: socket.closed, close: () => socket.close() };
		}

		return socket;
	} catch (error) {
		try { writer.releaseLock() } catch (e) { }
		try { reader.releaseLock() } catch (e) { }
		try { socket.close() } catch (e) { }
		throw error;
	}
}

async function httpsConnect(targetHost, targetPort, initialData, TCP连接, proxyAddress = {}) {
	const { username, password, hostname, port } = proxyAddress;
	const timeoutMs = getProxyHandshakeTimeoutMs(proxyAddress);
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();
	let tlsSocket = null;
	const tlsServerName = isIPHostname(hostname) ? '' : stripIPv6Brackets(hostname);
	const 打开HTTPS代理TLS = async (allowChacha = false) => {
		const proxySocket = TCP连接({ hostname, port });
		try {
			await socketOpenedWithTimeout(proxySocket, timeoutMs, 'HTTPS proxy TCP connect timed out');
			const socket = new TlsClient(proxySocket, { serverName: tlsServerName, insecure: true, allowChacha, timeout: timeoutMs });
			await withOperationTimeout(socket.handshake(), timeoutMs, 'HTTPS proxy TLS handshake timed out', () => {
				try { socket.close() } catch (e) { }
			});
			log(`[HTTPS proxy] TLS version: ${socket.isTls13 ? '1.3' : '1.2'} | Cipher: 0x${socket.cipherSuite.toString(16)}${socket.cipherConfig?.chacha ? ' (ChaCha20)' : ' (AES-GCM)'}`);
			return socket;
		} catch (error) {
			closeRemoteSocketQuietly(proxySocket);
			throw error;
		}
	};
	try {
		try {
			tlsSocket = await 打开HTTPS代理TLS(false);
		} catch (error) {
			if (!/cipher|handshake|TLS Alert|ServerHello|Finished|Unsupported|Missing TLS/i.test(error?.message || `${error || ''}`)) throw error;
			log(`[HTTPS proxy] AES-GCM TLS handshake failed, falling back to ChaCha20 compatibility mode: ${error?.message || error}`);
			tlsSocket = await 打开HTTPS代理TLS(true);
		}

		const auth = username && password ? `Proxy-Authorization: Basic ${btoa(`${username}:${password}`)}\r\n` : '';
		const request = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n${auth}User-Agent: Mozilla/5.0\r\nConnection: keep-alive\r\n\r\n`;
		await withOperationTimeout(tlsSocket.write(encoder.encode(request)), timeoutMs, 'HTTPS proxy CONNECT write timed out', () => {
			try { tlsSocket.close() } catch (e) { }
		});

		let responseBuffer = new Uint8Array(0), headerEndIndex = -1, bytesRead = 0;
		while (headerEndIndex === -1 && bytesRead < 8192) {
			const value = await withOperationTimeout(tlsSocket.read(), timeoutMs, 'HTTPS proxy CONNECT response timed out', () => {
				try { tlsSocket.close() } catch (e) { }
			});
			if (!value) throw new Error('HTTPS proxy closed the connection before returning a CONNECT response');
			responseBuffer = 拼接字节数据(responseBuffer, value);
			bytesRead = responseBuffer.length;
			const crlfcrlf = responseBuffer.findIndex((_, i) => i < responseBuffer.length - 3 && responseBuffer[i] === 0x0d && responseBuffer[i + 1] === 0x0a && responseBuffer[i + 2] === 0x0d && responseBuffer[i + 3] === 0x0a);
			if (crlfcrlf !== -1) headerEndIndex = crlfcrlf + 4;
		}

		if (headerEndIndex === -1) throw new Error('HTTPS proxy CONNECT response headers are too long or invalid');
		const statusMatch = decoder.decode(responseBuffer.slice(0, headerEndIndex)).split('\r\n')[0].match(/HTTP\/\d\.\d\s+(\d+)/);
		const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : NaN;
		if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode >= 300) throw new Error(`Connection failed: HTTP ${statusCode}`);

		if (有效数据长度(initialData) > 0) await withOperationTimeout(tlsSocket.write(数据转Uint8Array(initialData)), timeoutMs, 'HTTPS proxy initial data write timed out', () => {
			try { tlsSocket.close() } catch (e) { }
		});
		const bufferedData = bytesRead > headerEndIndex ? responseBuffer.subarray(headerEndIndex, bytesRead) : null;
		let closedSettled = false, resolveClosed, rejectClosed;
		const settleClosed = (settle, value) => {
			if (!closedSettled) {
				closedSettled = true;
				settle(value);
			}
		};
		const closed = new Promise((resolve, reject) => {
			resolveClosed = resolve;
			rejectClosed = reject;
		});
		const close = () => {
			try { tlsSocket.close() } catch (e) { }
			settleClosed(resolveClosed);
		};
		const readable = new ReadableStream({
			async start(controller) {
				try {
					if (有效数据长度(bufferedData) > 0) controller.enqueue(bufferedData);
					while (true) {
						const data = await tlsSocket.read();
						if (!data) break;
						if (data.byteLength > 0) controller.enqueue(data);
					}
					try { controller.close() } catch (e) { }
					settleClosed(resolveClosed);
				} catch (error) {
					try { controller.error(error) } catch (e) { }
					settleClosed(rejectClosed, error);
				}
			},
			cancel() {
				close();
			}
		});
		const writable = new WritableStream({
			async write(chunk) {
				await tlsSocket.write(数据转Uint8Array(chunk));
			},
			close,
			abort(error) {
				close();
				if (error) settleClosed(rejectClosed, error);
			}
		});
		return { readable, writable, closed, close };
	} catch (error) {
		try { tlsSocket?.close() } catch (e) { }
		throw error;
	}
}

function 创建请求TCP连接器(request) {
	const 请求对象 = /** @type {any} */ (request);
	const fetcher = 请求对象?.fetcher;
	if (!fetcher || typeof fetcher.connect !== 'function') throw new Error('request.fetcher.connect unavailable');
	return (options, init) => init === undefined ? fetcher.connect(options) : fetcher.connect(options, init);
}
////////////////////////////////////////////TLSClient by: @Alexandre_Kojeve////////////////////////////////////////////////
const TLS_VERSION_10 = 769, TLS_VERSION_12 = 771, TLS_VERSION_13 = 772;
const CONTENT_TYPE_CHANGE_CIPHER_SPEC = 20, CONTENT_TYPE_ALERT = 21, CONTENT_TYPE_HANDSHAKE = 22, CONTENT_TYPE_APPLICATION_DATA = 23;
const HANDSHAKE_TYPE_CLIENT_HELLO = 1, HANDSHAKE_TYPE_SERVER_HELLO = 2, HANDSHAKE_TYPE_NEW_SESSION_TICKET = 4, HANDSHAKE_TYPE_ENCRYPTED_EXTENSIONS = 8, HANDSHAKE_TYPE_CERTIFICATE = 11, HANDSHAKE_TYPE_SERVER_KEY_EXCHANGE = 12, HANDSHAKE_TYPE_CERTIFICATE_REQUEST = 13, HANDSHAKE_TYPE_SERVER_HELLO_DONE = 14, HANDSHAKE_TYPE_CERTIFICATE_VERIFY = 15, HANDSHAKE_TYPE_CLIENT_KEY_EXCHANGE = 16, HANDSHAKE_TYPE_FINISHED = 20, HANDSHAKE_TYPE_KEY_UPDATE = 24;
const EXT_SERVER_NAME = 0, EXT_SUPPORTED_GROUPS = 10, EXT_EC_POINT_FORMATS = 11, EXT_SIGNATURE_ALGORITHMS = 13, EXT_APPLICATION_LAYER_PROTOCOL_NEGOTIATION = 16, EXT_SUPPORTED_VERSIONS = 43, EXT_PSK_KEY_EXCHANGE_MODES = 45, EXT_KEY_SHARE = 51;

const ALERT_CLOSE_NOTIFY = 0, ALERT_LEVEL_WARNING = 1, ALERT_UNRECOGNIZED_NAME = 112;
const shouldIgnoreTlsAlert = fragment => fragment?.[0] === ALERT_LEVEL_WARNING && fragment?.[1] === ALERT_UNRECOGNIZED_NAME;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const EMPTY_BYTES = new Uint8Array(0);

const CIPHER_SUITES_BY_ID = new Map([
	[4865, { id: 4865, keyLen: 16, ivLen: 12, hash: "SHA-256", tls13: !0 }],
	[4866, { id: 4866, keyLen: 32, ivLen: 12, hash: "SHA-384", tls13: !0 }],
	[4867, { id: 4867, keyLen: 32, ivLen: 12, hash: "SHA-256", tls13: !0, chacha: !0 }],
	[49199, { id: 49199, keyLen: 16, ivLen: 4, hash: "SHA-256", kex: "ECDHE" }],
	[49200, { id: 49200, keyLen: 32, ivLen: 4, hash: "SHA-384", kex: "ECDHE" }],
	[52392, { id: 52392, keyLen: 32, ivLen: 12, hash: "SHA-256", kex: "ECDHE", chacha: !0 }],
	[49195, { id: 49195, keyLen: 16, ivLen: 4, hash: "SHA-256", kex: "ECDHE" }],
	[49196, { id: 49196, keyLen: 32, ivLen: 4, hash: "SHA-384", kex: "ECDHE" }],
	[52393, { id: 52393, keyLen: 32, ivLen: 12, hash: "SHA-256", kex: "ECDHE", chacha: !0 }]
]);
const GROUPS_BY_ID = new Map([[29, "X25519"], [23, "P-256"]]);
const SUPPORTED_SIGNATURE_ALGORITHMS = [2052, 2053, 2054, 1025, 1281, 1537, 1027, 1283, 1539];

const tlsBytes = (...parts) => {
	const flattenBytes = values => values.flatMap(value => value instanceof Uint8Array ? [...value] : Array.isArray(value) ? flattenBytes(value) : "number" == typeof value ? [value] : []);
	return new Uint8Array(flattenBytes(parts))
};
const uint16be = value => [value >> 8 & 255, 255 & value];
const readUint16 = (buffer, offset) => buffer[offset] << 8 | buffer[offset + 1];
const readUint24 = (buffer, offset) => buffer[offset] << 16 | buffer[offset + 1] << 8 | buffer[offset + 2];
const concatBytes = (...chunks) => {
	const nonEmptyChunks = chunks.filter((chunk => chunk && chunk.length > 0)),
		length = nonEmptyChunks.reduce(((total, chunk) => total + chunk.length), 0),
		result = new Uint8Array(length);
	let offset = 0;
	for (const chunk of nonEmptyChunks) result.set(chunk, offset), offset += chunk.length;
	return result
};
const randomBytes = length => crypto.getRandomValues(new Uint8Array(length));
const constantTimeEqual = (left, right) => {
	if (!left || !right || left.length !== right.length) return !1;
	let diff = 0; for (let index = 0; index < left.length; index++) diff |= left[index] ^ right[index];
	return 0 === diff
};
const hashByteLength = hash => "SHA-512" === hash ? 64 : "SHA-384" === hash ? 48 : 32;
async function hmac(hash, key, data) {
	const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash }, !1, ["sign"]);
	return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data))
}
async function digestBytes(hash, data) { return new Uint8Array(await crypto.subtle.digest(hash, data)) }
async function tls12Prf(secret, label, seed, length, hash = "SHA-256") {
	const labelSeed = concatBytes(textEncoder.encode(label), seed);
	let output = new Uint8Array(0),
		currentA = labelSeed;
	for (; output.length < length;) {
		currentA = await hmac(hash, secret, currentA);
		const block = await hmac(hash, secret, concatBytes(currentA, labelSeed));
		output = concatBytes(output, block)
	}
	return output.slice(0, length)
}
async function hkdfExtract(hash, salt, inputKeyMaterial) {
	return salt && salt.length || (salt = new Uint8Array(hashByteLength(hash))), hmac(hash, salt, inputKeyMaterial)
}
async function hkdfExpandLabel(hash, secret, label, context, length) {
	const fullLabel = textEncoder.encode("tls13 " + label);
	return async function (hash, secret, info, length) {
		const hashLen = hashByteLength(hash),
			roundCount = Math.ceil(length / hashLen);
		let output = new Uint8Array(0),
			previousBlock = new Uint8Array(0);
		for (let round = 1; round <= roundCount; round++) previousBlock = await hmac(hash, secret, concatBytes(previousBlock, info, [round])), output = concatBytes(output, previousBlock);
		return output.slice(0, length)
	}(hash, secret, tlsBytes(uint16be(length), fullLabel.length, fullLabel, context.length, context), length)
}
async function generateKeyShare(group = "P-256") {
	const algorithm = "X25519" === group ? { name: "X25519" } : { name: "ECDH", namedCurve: group };
	const keyPair = /** @type {CryptoKeyPair} */ (await crypto.subtle.generateKey(algorithm, !0, ["deriveBits"]));
	const publicKeyRaw = /** @type {ArrayBuffer} */ (await crypto.subtle.exportKey("raw", keyPair.publicKey));
	return { keyPair, publicKeyRaw: new Uint8Array(publicKeyRaw) }
}
async function deriveSharedSecret(privateKey, peerPublicKey, group = "P-256") {
	const algorithm = "X25519" === group ? { name: "X25519" } : { name: "ECDH", namedCurve: group },
		peerKey = await crypto.subtle.importKey("raw", peerPublicKey, algorithm, !1, []),
		bits = "P-384" === group ? 384 : "P-521" === group ? 528 : 256;
	return new Uint8Array(await crypto.subtle.deriveBits(/** @type {any} */({ name: algorithm.name, public: peerKey }), privateKey, bits))
}
async function importAesGcmKey(key, usages) { return crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, !1, usages) }
async function aesGcmEncryptWithKey(cryptoKey, initializationVector, plaintext, additionalData) {
	return new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: initializationVector, additionalData, tagLength: 128 }, cryptoKey, plaintext))
}
async function aesGcmDecryptWithKey(cryptoKey, initializationVector, ciphertext, additionalData) {
	return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: initializationVector, additionalData, tagLength: 128 }, cryptoKey, ciphertext))
}

function rotateLeft32(value, bits) { return (value << bits | value >>> 32 - bits) >>> 0 }

function chachaQuarterRound(state, indexA, indexB, indexC, indexD) {
	state[indexA] = state[indexA] + state[indexB] >>> 0, state[indexD] = rotateLeft32(state[indexD] ^ state[indexA], 16), state[indexC] = state[indexC] + state[indexD] >>> 0, state[indexB] = rotateLeft32(state[indexB] ^ state[indexC], 12), state[indexA] = state[indexA] + state[indexB] >>> 0, state[indexD] = rotateLeft32(state[indexD] ^ state[indexA], 8), state[indexC] = state[indexC] + state[indexD] >>> 0, state[indexB] = rotateLeft32(state[indexB] ^ state[indexC], 7)
}

function chacha20Block(key, counter, nonce) {
	const state = new Uint32Array(16);
	state[0] = 1634760805, state[1] = 857760878, state[2] = 2036477234, state[3] = 1797285236;
	const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
	for (let wordIndex = 0; wordIndex < 8; wordIndex++) state[4 + wordIndex] = keyView.getUint32(4 * wordIndex, !0);
	state[12] = counter;
	const nonceView = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
	state[13] = nonceView.getUint32(0, !0), state[14] = nonceView.getUint32(4, !0), state[15] = nonceView.getUint32(8, !0);
	const workingState = new Uint32Array(state);
	for (let round = 0; round < 10; round++) chachaQuarterRound(workingState, 0, 4, 8, 12), chachaQuarterRound(workingState, 1, 5, 9, 13), chachaQuarterRound(workingState, 2, 6, 10, 14), chachaQuarterRound(workingState, 3, 7, 11, 15), chachaQuarterRound(workingState, 0, 5, 10, 15), chachaQuarterRound(workingState, 1, 6, 11, 12), chachaQuarterRound(workingState, 2, 7, 8, 13), chachaQuarterRound(workingState, 3, 4, 9, 14);
	for (let wordIndex = 0; wordIndex < 16; wordIndex++) workingState[wordIndex] = workingState[wordIndex] + state[wordIndex] >>> 0;
	return new Uint8Array(workingState.buffer.slice(0))
}

function chacha20Xor(key, nonce, data) {
	const output = new Uint8Array(data.length);
	let counter = 1;
	for (let offset = 0; offset < data.length; offset += 64) {
		const block = chacha20Block(key, counter++, nonce),
			blockLength = Math.min(64, data.length - offset);
		for (let index = 0; index < blockLength; index++) output[offset + index] = data[offset + index] ^ block[index]
	}
	return output
}

function poly1305Mac(key, message) {
	const rKey = function (rBytes) {
		const clamped = new Uint8Array(rBytes);
		return clamped[3] &= 15, clamped[7] &= 15, clamped[11] &= 15, clamped[15] &= 15, clamped[4] &= 252, clamped[8] &= 252, clamped[12] &= 252, clamped
	}(key.slice(0, 16)),
		sKey = key.slice(16, 32);
	let accumulator = [0n, 0n, 0n, 0n, 0n];
	const rLimbs = [0x3ffffffn & BigInt(rKey[0] | rKey[1] << 8 | rKey[2] << 16 | rKey[3] << 24), 0x3ffffffn & BigInt(rKey[3] >> 2 | rKey[4] << 6 | rKey[5] << 14 | rKey[6] << 22), 0x3ffffffn & BigInt(rKey[6] >> 4 | rKey[7] << 4 | rKey[8] << 12 | rKey[9] << 20), 0x3ffffffn & BigInt(rKey[9] >> 6 | rKey[10] << 2 | rKey[11] << 10 | rKey[12] << 18), 0x3ffffffn & BigInt(rKey[13] | rKey[14] << 8 | rKey[15] << 16)];
	for (let offset = 0; offset < message.length; offset += 16) {
		const chunk = message.slice(offset, offset + 16),
			paddedChunk = new Uint8Array(17);
		paddedChunk.set(chunk), paddedChunk[chunk.length] = 1, accumulator[0] += BigInt(paddedChunk[0] | paddedChunk[1] << 8 | paddedChunk[2] << 16 | (3 & paddedChunk[3]) << 24), accumulator[1] += BigInt(paddedChunk[3] >> 2 | paddedChunk[4] << 6 | paddedChunk[5] << 14 | (15 & paddedChunk[6]) << 22), accumulator[2] += BigInt(paddedChunk[6] >> 4 | paddedChunk[7] << 4 | paddedChunk[8] << 12 | (63 & paddedChunk[9]) << 20), accumulator[3] += BigInt(paddedChunk[9] >> 6 | paddedChunk[10] << 2 | paddedChunk[11] << 10 | paddedChunk[12] << 18), accumulator[4] += BigInt(paddedChunk[13] | paddedChunk[14] << 8 | paddedChunk[15] << 16 | paddedChunk[16] << 24);
		const product = [0n, 0n, 0n, 0n, 0n];
		for (let accIndex = 0; accIndex < 5; accIndex++)
			for (let rIndex = 0; rIndex < 5; rIndex++) {
				const limbIndex = accIndex + rIndex;
				limbIndex < 5 ? product[limbIndex] += accumulator[accIndex] * rLimbs[rIndex] : product[limbIndex - 5] += accumulator[accIndex] * rLimbs[rIndex] * 5n
			}
		let carry = 0n;
		for (let index = 0; index < 5; index++) product[index] += carry, accumulator[index] = 0x3ffffffn & product[index], carry = product[index] >> 26n;
		accumulator[0] += 5n * carry, carry = accumulator[0] >> 26n, accumulator[0] &= 0x3ffffffn, accumulator[1] += carry
	}
	let tagValue = accumulator[0] | accumulator[1] << 26n | accumulator[2] << 52n | accumulator[3] << 78n | accumulator[4] << 104n;
	tagValue = tagValue + sKey.reduce(((total, byte, index) => total + (BigInt(byte) << BigInt(8 * index))), 0n) & (1n << 128n) - 1n;
	const tag = new Uint8Array(16);
	for (let index = 0; index < 16; index++) tag[index] = Number(tagValue >> BigInt(8 * index) & 0xffn);
	return tag
}

function chacha20Poly1305Encrypt(key, nonce, plaintext, additionalData) {
	const polyKey = chacha20Block(key, 0, nonce).slice(0, 32),
		ciphertext = chacha20Xor(key, nonce, plaintext),
		aadPadding = (16 - additionalData.length % 16) % 16,
		ciphertextPadding = (16 - ciphertext.length % 16) % 16,
		macData = new Uint8Array(additionalData.length + aadPadding + ciphertext.length + ciphertextPadding + 16);
	macData.set(additionalData, 0), macData.set(ciphertext, additionalData.length + aadPadding);
	const lengthView = new DataView(macData.buffer, additionalData.length + aadPadding + ciphertext.length + ciphertextPadding);
	lengthView.setBigUint64(0, BigInt(additionalData.length), !0), lengthView.setBigUint64(8, BigInt(ciphertext.length), !0);
	const tag = poly1305Mac(polyKey, macData);
	return concatBytes(ciphertext, tag)
}

function chacha20Poly1305Decrypt(key, nonce, ciphertext, additionalData) {
	if (ciphertext.length < 16) throw new Error("Ciphertext too short");
	const tag = ciphertext.slice(-16),
		encryptedData = ciphertext.slice(0, -16),
		polyKey = chacha20Block(key, 0, nonce).slice(0, 32),
		aadPadding = (16 - additionalData.length % 16) % 16,
		ciphertextPadding = (16 - encryptedData.length % 16) % 16,
		macData = new Uint8Array(additionalData.length + aadPadding + encryptedData.length + ciphertextPadding + 16);
	macData.set(additionalData, 0), macData.set(encryptedData, additionalData.length + aadPadding);
	const lengthView = new DataView(macData.buffer, additionalData.length + aadPadding + encryptedData.length + ciphertextPadding);
	lengthView.setBigUint64(0, BigInt(additionalData.length), !0), lengthView.setBigUint64(8, BigInt(encryptedData.length), !0);
	const expectedTag = poly1305Mac(polyKey, macData);
	let diff = 0;
	for (let index = 0; index < 16; index++) diff |= tag[index] ^ expectedTag[index];
	if (0 !== diff) throw new Error("ChaCha20-Poly1305 authentication failed");
	return chacha20Xor(key, nonce, encryptedData)
}

const TLS_MAX_PLAINTEXT_FRAGMENT = 16 * 1024;
function buildTlsRecord(contentType, fragment, version = TLS_VERSION_12) {
	const data = 数据转Uint8Array(fragment);
	const record = new Uint8Array(5 + data.byteLength);
	record[0] = contentType;
	record[1] = version >> 8 & 255;
	record[2] = version & 255;
	record[3] = data.byteLength >> 8 & 255;
	record[4] = data.byteLength & 255;
	record.set(data, 5);
	return record;
}
function buildHandshakeMessage(handshakeType, body) { return tlsBytes(handshakeType, (length => [length >> 16 & 255, length >> 8 & 255, 255 & length])(body.length), body) }
class TlsRecordParser {
	constructor() { this.buffer = new Uint8Array(0) }
	feed(chunk) {
		const bytes = 数据转Uint8Array(chunk);
		this.buffer = this.buffer.length ? concatBytes(this.buffer, bytes) : bytes
	}
	next() {
		if (this.buffer.length < 5) return null;
		const contentType = this.buffer[0],
			version = readUint16(this.buffer, 1),
			length = readUint16(this.buffer, 3);
		if (this.buffer.length < 5 + length) return null;
		const fragment = this.buffer.subarray(5, 5 + length);
		return this.buffer = this.buffer.subarray(5 + length), { type: contentType, version, length, fragment }
	}
}
class TlsHandshakeParser {
	constructor() { this.buffer = new Uint8Array(0) }
	feed(chunk) {
		const bytes = 数据转Uint8Array(chunk);
		this.buffer = this.buffer.length ? concatBytes(this.buffer, bytes) : bytes
	}
	next() {
		if (this.buffer.length < 4) return null;
		const handshakeType = this.buffer[0],
			length = readUint24(this.buffer, 1);
		if (this.buffer.length < 4 + length) return null;
		const body = this.buffer.subarray(4, 4 + length),
			raw = this.buffer.subarray(0, 4 + length);
		return this.buffer = this.buffer.subarray(4 + length), { type: handshakeType, length, body, raw }
	}
}

function parseServerHello(body) {
	let offset = 0;
	const legacyVersion = readUint16(body, offset);
	offset += 2;
	const serverRandom = body.slice(offset, offset + 32);
	offset += 32;
	const sessionIdLength = body[offset++],
		sessionId = body.slice(offset, offset + sessionIdLength);
	offset += sessionIdLength;
	const cipherSuite = readUint16(body, offset);
	offset += 2;
	const compression = body[offset++];
	let selectedVersion = legacyVersion,
		keyShare = null,
		alpn = null;
	if (offset < body.length) {
		const extensionsLength = readUint16(body, offset);
		offset += 2;
		const extensionsEnd = offset + extensionsLength;
		for (; offset + 4 <= extensionsEnd;) {
			const extensionType = readUint16(body, offset);
			offset += 2;
			const extensionLength = readUint16(body, offset);
			offset += 2;
			const extensionData = body.slice(offset, offset + extensionLength);
			if (offset += extensionLength, extensionType === EXT_SUPPORTED_VERSIONS && extensionLength >= 2) selectedVersion = readUint16(extensionData, 0);
			else if (extensionType === EXT_KEY_SHARE && extensionLength >= 4) {
				const group = readUint16(extensionData, 0),
					keyLength = readUint16(extensionData, 2);
				keyShare = { group, key: extensionData.slice(4, 4 + keyLength) }
			} else extensionType === EXT_APPLICATION_LAYER_PROTOCOL_NEGOTIATION && extensionLength >= 3 && (alpn = textDecoder.decode(extensionData.slice(3, 3 + extensionData[2])))
		}
	}
	const helloRetryRequestRandom = new Uint8Array([207, 33, 173, 116, 229, 154, 97, 17, 190, 29, 140, 2, 30, 101, 184, 145, 194, 162, 17, 22, 122, 187, 140, 94, 7, 158, 9, 226, 200, 168, 51, 156]);
	return { version: legacyVersion, serverRandom, sessionId, cipherSuite, compression, selectedVersion, keyShare, alpn, isHRR: constantTimeEqual(serverRandom, helloRetryRequestRandom), isTls13: selectedVersion === TLS_VERSION_13 }
}

function parseServerKeyExchange(body) {
	let offset = 1;
	const namedCurve = readUint16(body, offset);
	offset += 2;
	const keyLength = body[offset++];
	return { namedCurve, serverPublicKey: body.slice(offset, offset + keyLength) }
}

function extractLeafCertificate(body, hasContext = 0) {
	let offset = 0;
	if (hasContext) {
		const contextLength = body[offset++];
		offset += contextLength
	}
	if (offset + 3 > body.length) return null;
	const certificateListLength = readUint24(body, offset);
	if (offset += 3, !certificateListLength || offset + 3 > body.length) return null;
	const certificateLength = readUint24(body, offset);
	return offset += 3, certificateLength ? body.slice(offset, offset + certificateLength) : null
}

function parseEncryptedExtensions(body) {
	const parsed = { alpn: null };
	let offset = 2;
	const extensionsEnd = 2 + readUint16(body, 0);
	for (; offset + 4 <= extensionsEnd;) {
		const extensionType = readUint16(body, offset);
		offset += 2;
		const extensionLength = readUint16(body, offset);
		if (offset += 2, extensionType === EXT_APPLICATION_LAYER_PROTOCOL_NEGOTIATION && extensionLength >= 3) {
			const protocolLength = body[offset + 2];
			protocolLength > 0 && offset + 3 + protocolLength <= offset + extensionLength && (parsed.alpn = textDecoder.decode(body.slice(offset + 3, offset + 3 + protocolLength)))
		}
		offset += extensionLength
	}
	return parsed
}

function buildClientHello(clientRandom, serverName, keyShares, { tls13: enableTls13 = !0, tls12: enableTls12 = !0, alpn = null, chacha = !0 } = {}) {
	const cipherIds = [];
	enableTls13 && cipherIds.push(4865, 4866, ...(chacha ? [4867] : [])), enableTls12 && cipherIds.push(49199, 49200, 49195, 49196, ...(chacha ? [52392, 52393] : []));
	const cipherBytes = tlsBytes(...cipherIds.flatMap(uint16be)),
		extensions = [tlsBytes(255, 1, 0, 1, 0)];
	if (serverName) {
		const serverNameBytes = textEncoder.encode(serverName),
			serverNameList = tlsBytes(0, uint16be(serverNameBytes.length), serverNameBytes);
		extensions.push(tlsBytes(uint16be(EXT_SERVER_NAME), uint16be(serverNameList.length + 2), uint16be(serverNameList.length), serverNameList))
	}
	extensions.push(tlsBytes(uint16be(EXT_EC_POINT_FORMATS), 0, 2, 1, 0)), extensions.push(tlsBytes(uint16be(EXT_SUPPORTED_GROUPS), 0, 6, 0, 4, 0, 29, 0, 23));
	const signatureBytes = tlsBytes(...SUPPORTED_SIGNATURE_ALGORITHMS.flatMap(uint16be));
	extensions.push(tlsBytes(uint16be(EXT_SIGNATURE_ALGORITHMS), uint16be(signatureBytes.length + 2), uint16be(signatureBytes.length), signatureBytes));
	const protocols = Array.isArray(alpn) ? alpn.filter(Boolean) : alpn ? [alpn] : [];
	if (protocols.length) {
		const alpnBytes = concatBytes(...protocols.map((protocol => { const protocolBytes = textEncoder.encode(protocol); return tlsBytes(protocolBytes.length, protocolBytes) })));
		extensions.push(tlsBytes(uint16be(EXT_APPLICATION_LAYER_PROTOCOL_NEGOTIATION), uint16be(alpnBytes.length + 2), uint16be(alpnBytes.length), alpnBytes))
	}
	if (enableTls13 && keyShares) {
		let keyShareBytes;
		if (extensions.push(enableTls12 ? tlsBytes(uint16be(EXT_SUPPORTED_VERSIONS), 0, 5, 4, 3, 4, 3, 3) : tlsBytes(uint16be(EXT_SUPPORTED_VERSIONS), 0, 3, 2, 3, 4)), extensions.push(tlsBytes(uint16be(EXT_PSK_KEY_EXCHANGE_MODES), 0, 2, 1, 1)), keyShares?.x25519 && keyShares?.p256) keyShareBytes = concatBytes(tlsBytes(0, 29, uint16be(keyShares.x25519.length), keyShares.x25519), tlsBytes(0, 23, uint16be(keyShares.p256.length), keyShares.p256));
		else if (keyShares?.x25519) keyShareBytes = tlsBytes(0, 29, uint16be(keyShares.x25519.length), keyShares.x25519);
		else if (keyShares?.p256) keyShareBytes = tlsBytes(0, 23, uint16be(keyShares.p256.length), keyShares.p256);
		else {
			if (!(keyShares instanceof Uint8Array)) throw new Error("Invalid keyShares");
			keyShareBytes = tlsBytes(0, 23, uint16be(keyShares.length), keyShares)
		}
		extensions.push(tlsBytes(uint16be(EXT_KEY_SHARE), uint16be(keyShareBytes.length + 2), uint16be(keyShareBytes.length), keyShareBytes))
	}
	const extensionsBytes = concatBytes(...extensions);
	return buildHandshakeMessage(HANDSHAKE_TYPE_CLIENT_HELLO, tlsBytes(uint16be(TLS_VERSION_12), clientRandom, 0, uint16be(cipherBytes.length), cipherBytes, 1, 0, uint16be(extensionsBytes.length), extensionsBytes))
}
const uint64be = sequenceNumber => { const bytes = new Uint8Array(8); return new DataView(bytes.buffer).setBigUint64(0, sequenceNumber, !1), bytes },
	xorSequenceIntoIv = (initializationVector, sequenceNumber) => {
		const nonce = initializationVector.slice(),
			sequenceBytes = uint64be(sequenceNumber);
		for (let index = 0; index < 8; index++) nonce[nonce.length - 8 + index] ^= sequenceBytes[index];
		return nonce
	},
	deriveTrafficKeys = (hash, secret, keyLen, ivLen) => Promise.all([hkdfExpandLabel(hash, secret, "key", EMPTY_BYTES, keyLen), hkdfExpandLabel(hash, secret, "iv", EMPTY_BYTES, ivLen)]);
class TlsClient {
	constructor(socket, options = {}) {
		if (this.socket = socket, this.serverName = options.serverName || "", this.supportTls13 = !1 !== options.tls13, this.supportTls12 = !1 !== options.tls12, !this.supportTls13 && !this.supportTls12) throw new Error("At least one TLS version must be enabled");
		this.alpnProtocols = Array.isArray(options.alpn) ? options.alpn : options.alpn ? [options.alpn] : null, this.allowChacha = options.allowChacha !== false, this.timeout = options.timeout ?? 3e4, this.clientRandom = randomBytes(32), this.serverRandom = null, this.handshakeChunks = [], this.handshakeComplete = !1, this.negotiatedAlpn = null, this.cipherSuite = null, this.cipherConfig = null, this.isTls13 = !1, this.masterSecret = null, this.handshakeSecret = null, this.clientWriteKey = null, this.serverWriteKey = null, this.clientWriteIv = null, this.serverWriteIv = null, this.clientHandshakeKey = null, this.serverHandshakeKey = null, this.clientHandshakeIv = null, this.serverHandshakeIv = null, this.clientAppKey = null, this.serverAppKey = null, this.clientAppIv = null, this.serverAppIv = null, this.clientWriteCryptoKey = null, this.serverWriteCryptoKey = null, this.clientHandshakeCryptoKey = null, this.serverHandshakeCryptoKey = null, this.clientAppCryptoKey = null, this.serverAppCryptoKey = null, this.clientSeqNum = 0n, this.serverSeqNum = 0n, this.recordParser = new TlsRecordParser, this.handshakeParser = new TlsHandshakeParser, this.keyPairs = new Map, this.ecdhKeyPair = null, this.sawCert = !1
	}
	recordHandshake(chunk) { this.handshakeChunks.push(chunk) }
	transcript() { return 1 === this.handshakeChunks.length ? this.handshakeChunks[0] : concatBytes(...this.handshakeChunks) }
	getCipherConfig(cipherSuite) { return CIPHER_SUITES_BY_ID.get(cipherSuite) || null }
	async readChunk(reader) {
		if (!this.timeout) return reader.read();
		let timer;
		try {
			return await Promise.race([
				reader.read(),
				new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("TLS read timeout")), this.timeout) })
			]);
		} finally {
			clearTimeout(timer);
		}
	}
	async readRecordsUntil(reader, predicate, closedError) {
		for (; ;) {
			let record;
			for (; record = this.recordParser.next();)
				if (await predicate(record)) return;
			const { value, done } = await this.readChunk(reader);
			if (done) throw new Error(closedError);
			this.recordParser.feed(value)
		}
	}
	async readHandshakeUntil(reader, predicate, closedError) {
		for (let message; message = this.handshakeParser.next();)
			if (await predicate(message)) return;
		return this.readRecordsUntil(reader, (async record => {
			if (record.type === CONTENT_TYPE_ALERT) {
				if (shouldIgnoreTlsAlert(record.fragment)) return;
				throw new Error(`TLS Alert: ${record.fragment[1]}`);
			}
			if (record.type === CONTENT_TYPE_HANDSHAKE) {
				this.handshakeParser.feed(record.fragment);
				for (let message; message = this.handshakeParser.next();)
					if (await predicate(message)) return 1
			}
		}), closedError)
	}
	async acceptCertificate(certificate) { if (!certificate?.length) throw new Error("Empty certificate"); this.sawCert = !0 }
	async handshake() {
		const [p256Share, x25519Share] = await Promise.all([generateKeyShare("P-256"), generateKeyShare("X25519")]);
		this.keyPairs = new Map([[23, p256Share], [29, x25519Share]]), this.ecdhKeyPair = p256Share.keyPair;
		const reader = this.socket.readable.getReader(),
			writer = this.socket.writable.getWriter();
		try {
			const clientHello = buildClientHello(this.clientRandom, this.serverName, { x25519: x25519Share.publicKeyRaw, p256: p256Share.publicKeyRaw }, { tls13: this.supportTls13, tls12: this.supportTls12, alpn: this.alpnProtocols, chacha: this.allowChacha });
			this.recordHandshake(clientHello), await writer.write(buildTlsRecord(CONTENT_TYPE_HANDSHAKE, clientHello, TLS_VERSION_10));
			const serverHello = await this.receiveServerHello(reader);
			if (serverHello.isHRR) throw new Error("HelloRetryRequest is not supported by TLSClientMini");
			if (serverHello.keyShare?.group && this.keyPairs.has(serverHello.keyShare.group)) {
				const selectedKeyPair = this.keyPairs.get(serverHello.keyShare.group);
				this.ecdhKeyPair = selectedKeyPair.keyPair
			}
			serverHello.isTls13 ? await this.handshakeTls13(reader, writer, serverHello) : await this.handshakeTls12(reader, writer), this.handshakeComplete = !0, this.timeout = 0
		} finally {
			reader.releaseLock(), writer.releaseLock()
		}
	}
	async receiveServerHello(reader) {
		for (; ;) {
			const { value, done } = await this.readChunk(reader);
			if (done) throw new Error("Connection closed waiting for ServerHello");
			let record;
			for (this.recordParser.feed(value); record = this.recordParser.next();) {
				if (record.type === CONTENT_TYPE_ALERT) {
					if (shouldIgnoreTlsAlert(record.fragment)) continue;
					throw new Error(`TLS Alert: level=${record.fragment[0]}, desc=${record.fragment[1]}`);
				}
				if (record.type !== CONTENT_TYPE_HANDSHAKE) continue;
				let message;
				for (this.handshakeParser.feed(record.fragment); message = this.handshakeParser.next();) {
					if (message.type !== HANDSHAKE_TYPE_SERVER_HELLO) continue;
					this.recordHandshake(message.raw);
					const serverHello = parseServerHello(message.body);
					if (this.serverRandom = serverHello.serverRandom, this.cipherSuite = serverHello.cipherSuite, this.cipherConfig = this.getCipherConfig(serverHello.cipherSuite), this.isTls13 = serverHello.isTls13, this.negotiatedAlpn = serverHello.alpn || null, !this.cipherConfig) throw new Error(`Unsupported cipher suite: 0x${serverHello.cipherSuite.toString(16)}`);
					return serverHello
				}
			}
		}
	}
	async handshakeTls12(reader, writer) {
		/** @type {{ namedCurve: number, serverPublicKey: Uint8Array } | null} */
		let serverKeyExchange = null;
		let sawServerHelloDone = !1;
		if (await this.readHandshakeUntil(reader, (async message => {
			switch (message.type) {
				case HANDSHAKE_TYPE_CERTIFICATE: {
					this.recordHandshake(message.raw);
					const certificate = extractLeafCertificate(message.body, 1);
					if (!certificate) throw new Error("Missing TLS 1.2 certificate");
					await this.acceptCertificate(certificate);
					break
				}
				case HANDSHAKE_TYPE_SERVER_KEY_EXCHANGE:
					this.recordHandshake(message.raw), serverKeyExchange = parseServerKeyExchange(message.body);
					break;
				case HANDSHAKE_TYPE_SERVER_HELLO_DONE:
					return this.recordHandshake(message.raw), sawServerHelloDone = !0, 1;
				case HANDSHAKE_TYPE_CERTIFICATE_REQUEST:
					throw new Error("Client certificate is not supported");
				default:
					this.recordHandshake(message.raw)
			}
		}), "Connection closed during TLS 1.2 handshake"), !this.sawCert) throw new Error("Missing TLS 1.2 leaf certificate");
		const serverKeyExchangeData = /** @type {{ namedCurve: number, serverPublicKey: Uint8Array } | null} */ (serverKeyExchange);
		if (!serverKeyExchangeData) throw new Error("Missing TLS 1.2 ServerKeyExchange");
		const curveName = GROUPS_BY_ID.get(serverKeyExchangeData.namedCurve);
		if (!curveName) throw new Error(`Unsupported named curve: 0x${serverKeyExchangeData.namedCurve.toString(16)}`);
		const keyShare = this.keyPairs.get(serverKeyExchangeData.namedCurve);
		if (!keyShare) throw new Error(`Missing key pair for curve: 0x${serverKeyExchangeData.namedCurve.toString(16)}`);
		const preMasterSecret = await deriveSharedSecret(keyShare.keyPair.privateKey, serverKeyExchangeData.serverPublicKey, curveName),
			clientKeyExchange = buildHandshakeMessage(HANDSHAKE_TYPE_CLIENT_KEY_EXCHANGE, tlsBytes(keyShare.publicKeyRaw.length, keyShare.publicKeyRaw));
		this.recordHandshake(clientKeyExchange);
		const hashName = this.cipherConfig.hash;
		this.masterSecret = await tls12Prf(preMasterSecret, "master secret", concatBytes(this.clientRandom, this.serverRandom), 48, hashName);
		const keyLen = this.cipherConfig.keyLen,
			ivLen = this.cipherConfig.ivLen,
			keyBlock = await tls12Prf(this.masterSecret, "key expansion", concatBytes(this.serverRandom, this.clientRandom), 2 * keyLen + 2 * ivLen, hashName);
		this.clientWriteKey = keyBlock.slice(0, keyLen), this.serverWriteKey = keyBlock.slice(keyLen, 2 * keyLen), this.clientWriteIv = keyBlock.slice(2 * keyLen, 2 * keyLen + ivLen), this.serverWriteIv = keyBlock.slice(2 * keyLen + ivLen, 2 * keyLen + 2 * ivLen);
		if (!this.cipherConfig.chacha) [this.clientWriteCryptoKey, this.serverWriteCryptoKey] = await Promise.all([importAesGcmKey(this.clientWriteKey, ["encrypt"]), importAesGcmKey(this.serverWriteKey, ["decrypt"])]);
		await writer.write(buildTlsRecord(CONTENT_TYPE_HANDSHAKE, clientKeyExchange)), await writer.write(buildTlsRecord(CONTENT_TYPE_CHANGE_CIPHER_SPEC, tlsBytes(1)));
		const clientVerifyData = await tls12Prf(this.masterSecret, "client finished", await digestBytes(hashName, this.transcript()), 12, hashName),
			finishedMessage = buildHandshakeMessage(HANDSHAKE_TYPE_FINISHED, clientVerifyData);
		this.recordHandshake(finishedMessage), await writer.write(buildTlsRecord(CONTENT_TYPE_HANDSHAKE, await this.encryptTls12(finishedMessage, CONTENT_TYPE_HANDSHAKE)));
		let sawChangeCipherSpec = !1;
		await this.readRecordsUntil(reader, (async record => {
			if (record.type === CONTENT_TYPE_ALERT) {
				if (shouldIgnoreTlsAlert(record.fragment)) return;
				throw new Error(`TLS Alert: ${record.fragment[1]}`);
			}
			if (record.type === CONTENT_TYPE_CHANGE_CIPHER_SPEC) return void (sawChangeCipherSpec = !0);
			if (record.type !== CONTENT_TYPE_HANDSHAKE || !sawChangeCipherSpec) return;
			const decrypted = await this.decryptTls12(record.fragment, CONTENT_TYPE_HANDSHAKE);
			if (decrypted[0] !== HANDSHAKE_TYPE_FINISHED) return;
			const verifyLength = readUint24(decrypted, 1),
				verifyData = decrypted.slice(4, 4 + verifyLength),
				expectedVerifyData = await tls12Prf(this.masterSecret, "server finished", await digestBytes(hashName, this.transcript()), 12, hashName);
			if (!constantTimeEqual(verifyData, expectedVerifyData)) throw new Error("TLS 1.2 server Finished verify failed");
			return 1
		}), "Connection closed waiting for TLS 1.2 Finished")
	}
	async handshakeTls13(reader, writer, serverHello) {
		const groupName = GROUPS_BY_ID.get(serverHello.keyShare?.group);
		if (!groupName || !serverHello.keyShare?.key?.length) throw new Error("Missing TLS 1.3 key_share");
		const hashName = this.cipherConfig.hash,
			hashLen = hashByteLength(hashName),
			keyLen = this.cipherConfig.keyLen,
			ivLen = this.cipherConfig.ivLen,
			sharedSecret = await deriveSharedSecret(this.ecdhKeyPair.privateKey, serverHello.keyShare.key, groupName),
			earlySecret = await hkdfExtract(hashName, null, new Uint8Array(hashLen)),
			derivedSecret = await hkdfExpandLabel(hashName, earlySecret, "derived", await digestBytes(hashName, EMPTY_BYTES), hashLen);
		this.handshakeSecret = await hkdfExtract(hashName, derivedSecret, sharedSecret);
		const transcriptHash = await digestBytes(hashName, this.transcript()),
			clientHandshakeTrafficSecret = await hkdfExpandLabel(hashName, this.handshakeSecret, "c hs traffic", transcriptHash, hashLen),
			serverHandshakeTrafficSecret = await hkdfExpandLabel(hashName, this.handshakeSecret, "s hs traffic", transcriptHash, hashLen);
		[this.clientHandshakeKey, this.clientHandshakeIv] = await deriveTrafficKeys(hashName, clientHandshakeTrafficSecret, keyLen, ivLen), [this.serverHandshakeKey, this.serverHandshakeIv] = await deriveTrafficKeys(hashName, serverHandshakeTrafficSecret, keyLen, ivLen);
		if (!this.cipherConfig.chacha) [this.clientHandshakeCryptoKey, this.serverHandshakeCryptoKey] = await Promise.all([importAesGcmKey(this.clientHandshakeKey, ["encrypt"]), importAesGcmKey(this.serverHandshakeKey, ["decrypt"])]);
		const serverFinishedKey = await hkdfExpandLabel(hashName, serverHandshakeTrafficSecret, "finished", EMPTY_BYTES, hashLen);
		let serverFinishedReceived = !1;
		const handleHandshakeMessage = async message => {
			switch (message.type) {
				case HANDSHAKE_TYPE_ENCRYPTED_EXTENSIONS: {
					const encryptedExtensions = parseEncryptedExtensions(message.body);
					encryptedExtensions.alpn && (this.negotiatedAlpn = encryptedExtensions.alpn), this.recordHandshake(message.raw);
					break
				}
				case HANDSHAKE_TYPE_CERTIFICATE: {
					const certificate = extractLeafCertificate(message.body, 1);
					if (!certificate) throw new Error("Missing TLS 1.3 certificate");
					await this.acceptCertificate(certificate), this.recordHandshake(message.raw);
					break
				}
				case HANDSHAKE_TYPE_CERTIFICATE_REQUEST:
					throw new Error("Client certificate is not supported");
				case HANDSHAKE_TYPE_CERTIFICATE_VERIFY:
					this.recordHandshake(message.raw);
					break;
				case HANDSHAKE_TYPE_FINISHED: {
					const expectedVerifyData = await hmac(hashName, serverFinishedKey, await digestBytes(hashName, this.transcript()));
					if (!constantTimeEqual(expectedVerifyData, message.body)) throw new Error("TLS 1.3 server Finished verify failed");
					this.recordHandshake(message.raw), serverFinishedReceived = !0;
					break
				}
				default:
					this.recordHandshake(message.raw)
			}
		};
		await this.readRecordsUntil(reader, (async record => {
			if (record.type === CONTENT_TYPE_CHANGE_CIPHER_SPEC || record.type === CONTENT_TYPE_HANDSHAKE) return;
			if (record.type === CONTENT_TYPE_ALERT) {
				if (shouldIgnoreTlsAlert(record.fragment)) return;
				throw new Error(`TLS Alert: ${record.fragment[1]}`);
			}
			if (record.type !== CONTENT_TYPE_APPLICATION_DATA) return;
			const decrypted = await this.decryptTls13Handshake(record.fragment),
				innerType = decrypted[decrypted.length - 1],
				plaintext = decrypted.slice(0, -1);
			if (innerType === CONTENT_TYPE_HANDSHAKE) {
				this.handshakeParser.feed(plaintext);
				for (let message; message = this.handshakeParser.next();)
					if (await handleHandshakeMessage(message), serverFinishedReceived) return 1
			}
		}), "Connection closed during TLS 1.3 handshake");
		const applicationTranscriptHash = await digestBytes(hashName, this.transcript()),
			masterDerivedSecret = await hkdfExpandLabel(hashName, this.handshakeSecret, "derived", await digestBytes(hashName, EMPTY_BYTES), hashLen),
			masterSecret = await hkdfExtract(hashName, masterDerivedSecret, new Uint8Array(hashLen)),
			clientAppTrafficSecret = await hkdfExpandLabel(hashName, masterSecret, "c ap traffic", applicationTranscriptHash, hashLen),
			serverAppTrafficSecret = await hkdfExpandLabel(hashName, masterSecret, "s ap traffic", applicationTranscriptHash, hashLen);
		[this.clientAppKey, this.clientAppIv] = await deriveTrafficKeys(hashName, clientAppTrafficSecret, keyLen, ivLen), [this.serverAppKey, this.serverAppIv] = await deriveTrafficKeys(hashName, serverAppTrafficSecret, keyLen, ivLen);
		if (!this.cipherConfig.chacha) [this.clientAppCryptoKey, this.serverAppCryptoKey] = await Promise.all([importAesGcmKey(this.clientAppKey, ["encrypt"]), importAesGcmKey(this.serverAppKey, ["decrypt"])]);
		const clientFinishedKey = await hkdfExpandLabel(hashName, clientHandshakeTrafficSecret, "finished", EMPTY_BYTES, hashLen),
			clientFinishedVerifyData = await hmac(hashName, clientFinishedKey, await digestBytes(hashName, this.transcript())),
			clientFinishedMessage = buildHandshakeMessage(HANDSHAKE_TYPE_FINISHED, clientFinishedVerifyData);
		this.recordHandshake(clientFinishedMessage), await writer.write(buildTlsRecord(CONTENT_TYPE_APPLICATION_DATA, await this.encryptTls13Handshake(concatBytes(clientFinishedMessage, [CONTENT_TYPE_HANDSHAKE])))), this.clientSeqNum = 0n, this.serverSeqNum = 0n
	}
	async encryptTls12(plaintext, contentType) {
		const sequenceNumber = this.clientSeqNum++,
			sequenceBytes = uint64be(sequenceNumber),
			additionalData = concatBytes(sequenceBytes, [contentType], uint16be(TLS_VERSION_12), uint16be(plaintext.length));
		if (this.cipherConfig.chacha) {
			const nonce = xorSequenceIntoIv(this.clientWriteIv, sequenceNumber);
			return chacha20Poly1305Encrypt(this.clientWriteKey, nonce, plaintext, additionalData)
		}
		const explicitNonce = randomBytes(8);
		if (!this.clientWriteCryptoKey) this.clientWriteCryptoKey = await importAesGcmKey(this.clientWriteKey, ["encrypt"]);
		return concatBytes(explicitNonce, await aesGcmEncryptWithKey(this.clientWriteCryptoKey, concatBytes(this.clientWriteIv, explicitNonce), plaintext, additionalData))
	}
	async decryptTls12(ciphertext, contentType) {
		const sequenceNumber = this.serverSeqNum++,
			sequenceBytes = uint64be(sequenceNumber);
		if (this.cipherConfig.chacha) {
			const nonce = xorSequenceIntoIv(this.serverWriteIv, sequenceNumber);
			return chacha20Poly1305Decrypt(this.serverWriteKey, nonce, ciphertext, concatBytes(sequenceBytes, [contentType], uint16be(TLS_VERSION_12), uint16be(ciphertext.length - 16)))
		}
		const explicitNonce = ciphertext.subarray(0, 8),
			encryptedData = ciphertext.subarray(8);
		if (!this.serverWriteCryptoKey) this.serverWriteCryptoKey = await importAesGcmKey(this.serverWriteKey, ["decrypt"]);
		return aesGcmDecryptWithKey(this.serverWriteCryptoKey, concatBytes(this.serverWriteIv, explicitNonce), encryptedData, concatBytes(sequenceBytes, [contentType], uint16be(TLS_VERSION_12), uint16be(encryptedData.length - 16)))
	}
	async encryptTls13Handshake(plaintext) {
		const nonce = xorSequenceIntoIv(this.clientHandshakeIv, this.clientSeqNum++),
			additionalData = tlsBytes(CONTENT_TYPE_APPLICATION_DATA, 3, 3, uint16be(plaintext.length + 16));
		if (this.cipherConfig.chacha) return chacha20Poly1305Encrypt(this.clientHandshakeKey, nonce, plaintext, additionalData);
		if (!this.clientHandshakeCryptoKey) this.clientHandshakeCryptoKey = await importAesGcmKey(this.clientHandshakeKey, ["encrypt"]);
		return aesGcmEncryptWithKey(this.clientHandshakeCryptoKey, nonce, plaintext, additionalData)
	}
	async decryptTls13Handshake(ciphertext) {
		const nonce = xorSequenceIntoIv(this.serverHandshakeIv, this.serverSeqNum++),
			additionalData = tlsBytes(CONTENT_TYPE_APPLICATION_DATA, 3, 3, uint16be(ciphertext.length));
		const decrypted = this.cipherConfig.chacha ? await chacha20Poly1305Decrypt(this.serverHandshakeKey, nonce, ciphertext, additionalData) : await aesGcmDecryptWithKey(this.serverHandshakeCryptoKey || (this.serverHandshakeCryptoKey = await importAesGcmKey(this.serverHandshakeKey, ["decrypt"])), nonce, ciphertext, additionalData);
		let innerTypeIndex = decrypted.length - 1;
		for (; innerTypeIndex >= 0 && !decrypted[innerTypeIndex];) innerTypeIndex--;
		return innerTypeIndex < 0 ? EMPTY_BYTES : decrypted.slice(0, innerTypeIndex + 1)
	}
	async encryptTls13(data) {
		const plaintext = concatBytes(data, [CONTENT_TYPE_APPLICATION_DATA]),
			nonce = xorSequenceIntoIv(this.clientAppIv, this.clientSeqNum++),
			additionalData = tlsBytes(CONTENT_TYPE_APPLICATION_DATA, 3, 3, uint16be(plaintext.length + 16));
		if (this.cipherConfig.chacha) return chacha20Poly1305Encrypt(this.clientAppKey, nonce, plaintext, additionalData);
		if (!this.clientAppCryptoKey) this.clientAppCryptoKey = await importAesGcmKey(this.clientAppKey, ["encrypt"]);
		return aesGcmEncryptWithKey(this.clientAppCryptoKey, nonce, plaintext, additionalData)
	}
	async decryptTls13(ciphertext) {
		const nonce = xorSequenceIntoIv(this.serverAppIv, this.serverSeqNum++),
			additionalData = tlsBytes(CONTENT_TYPE_APPLICATION_DATA, 3, 3, uint16be(ciphertext.length)),
			plaintext = this.cipherConfig.chacha ? await chacha20Poly1305Decrypt(this.serverAppKey, nonce, ciphertext, additionalData) : await aesGcmDecryptWithKey(this.serverAppCryptoKey || (this.serverAppCryptoKey = await importAesGcmKey(this.serverAppKey, ["decrypt"])), nonce, ciphertext, additionalData);
		let innerTypeIndex = plaintext.length - 1;
		for (; innerTypeIndex >= 0 && !plaintext[innerTypeIndex];) innerTypeIndex--;
		if (innerTypeIndex < 0) return {
			data: EMPTY_BYTES,
			type: 0
		};
		return {
			data: plaintext.slice(0, innerTypeIndex),
			type: plaintext[innerTypeIndex]
		}
	}
	async write(data) {
		if (!this.handshakeComplete) throw new Error("Handshake not complete");
		const plaintext = 数据转Uint8Array(data);
		if (!plaintext.byteLength) return;
		const writer = this.socket.writable.getWriter();
		try {
			const records = [];
			for (let offset = 0; offset < plaintext.byteLength; offset += TLS_MAX_PLAINTEXT_FRAGMENT) {
				const chunk = plaintext.subarray(offset, Math.min(offset + TLS_MAX_PLAINTEXT_FRAGMENT, plaintext.byteLength));
				const encrypted = this.isTls13 ? await this.encryptTls13(chunk) : await this.encryptTls12(chunk, CONTENT_TYPE_APPLICATION_DATA);
				records.push(buildTlsRecord(CONTENT_TYPE_APPLICATION_DATA, encrypted));
			}
			await writer.write(records.length === 1 ? records[0] : concatBytes(...records))
		} finally {
			writer.releaseLock()
		}
	}
	async read() {
		for (; ;) {
			let record;
			for (; record = this.recordParser.next();) {
				if (record.type === CONTENT_TYPE_ALERT) {
					if (record.fragment[1] === ALERT_CLOSE_NOTIFY) return null;
					throw new Error(`TLS Alert: ${record.fragment[1]}`)
				}
				if (record.type !== CONTENT_TYPE_APPLICATION_DATA) continue;
				if (!this.isTls13) return this.decryptTls12(record.fragment, CONTENT_TYPE_APPLICATION_DATA);
				const { data, type } = await this.decryptTls13(record.fragment);
				if (type === CONTENT_TYPE_APPLICATION_DATA) return data;
				if (type === CONTENT_TYPE_ALERT) {
					if (data[1] === ALERT_CLOSE_NOTIFY) return null;
					throw new Error(`TLS Alert: ${data[1]}`)
				}
				if (type !== CONTENT_TYPE_HANDSHAKE) continue;
				let message;
				for (this.handshakeParser.feed(data); message = this.handshakeParser.next();)
					if (message.type !== HANDSHAKE_TYPE_NEW_SESSION_TICKET && message.type === HANDSHAKE_TYPE_KEY_UPDATE) throw new Error("TLS 1.3 KeyUpdate is not supported by TLSClientMini")
			}
			const reader = this.socket.readable.getReader();
			try {
				const { value, done } = await this.readChunk(reader);
				if (done) return null;
				this.recordParser.feed(value)
			} finally {
				reader.releaseLock()
			}
		}
	}
	close() { this.socket.close() }
}

function stripIPv6Brackets(hostname = '') {
	const host = String(hostname || '').trim();
	return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function isIPHostname(hostname = '') {
	const host = stripIPv6Brackets(hostname);
	const ipv4Regex = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
	if (ipv4Regex.test(host)) return true;
	if (!host.includes(':')) return false;
	try {
		new URL(`http://[${host}]/`);
		return true;
	} catch (e) {
		return false;
	}
}

//////////////////////////////////////////////////turnConnect///////////////////////////////////////////////
const CONNECT_TIMEOUT_MS = 9999;
const TURN_STUN_MAGIC_COOKIE = new Uint8Array([0x21, 0x12, 0xa4, 0x42]);
const TURN_STUN_TYPE = {
	ALLOCATE_REQUEST: 0x0003, ALLOCATE_SUCCESS: 0x0103, ALLOCATE_ERROR: 0x0113,
	CREATE_PERMISSION_REQUEST: 0x0008, CREATE_PERMISSION_SUCCESS: 0x0108,
	CONNECT_REQUEST: 0x000a, CONNECT_SUCCESS: 0x010a,
	CONNECTION_BIND_REQUEST: 0x000b, CONNECTION_BIND_SUCCESS: 0x010b
};
const TURN_STUN_ATTR = {
	USERNAME: 0x0006, MESSAGE_INTEGRITY: 0x0008, ERROR_CODE: 0x0009,
	XOR_PEER_ADDRESS: 0x0012, REALM: 0x0014, NONCE: 0x0015,
	REQUESTED_TRANSPORT: 0x0019, CONNECTION_ID: 0x002a
};

async function withTimeout(promise, timeoutMs, message) {
	let timer;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs) })
		]);
	} finally {
		clearTimeout(timer);
	}
}

function isIPv4(value) {
	const parts = String(value || '').split('.');
	return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function turnStunPadding(length) {
	return -length & 3;
}

function createTurnStunAttribute(type, value) {
	const body = 数据转Uint8Array(value);
	const attribute = new Uint8Array(4 + body.byteLength + turnStunPadding(body.byteLength));
	const view = new DataView(attribute.buffer);
	view.setUint16(0, type);
	view.setUint16(2, body.byteLength);
	attribute.set(body, 4);
	return attribute;
}

function createTurnStunMessage(type, transactionId, attributes) {
	const body = 拼接字节数据(...attributes);
	const header = new Uint8Array(20);
	const view = new DataView(header.buffer);
	view.setUint16(0, type);
	view.setUint16(2, body.byteLength);
	header.set(TURN_STUN_MAGIC_COOKIE, 4);
	header.set(transactionId, 8);
	return 拼接字节数据(header, body);
}

function parseTurnErrorCode(data) {
	return data?.byteLength >= 4 ? (data[2] & 7) * 100 + data[3] : 0;
}

function randomTurnTransactionId() {
	return crypto.getRandomValues(new Uint8Array(12));
}

async function addTurnMessageIntegrity(message, key) {
	const signedMessage = new Uint8Array(message);
	const view = new DataView(signedMessage.buffer);
	view.setUint16(2, view.getUint16(2) + 24);
	const hmacKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
	const signature = await crypto.subtle.sign('HMAC', hmacKey, signedMessage);
	return 拼接字节数据(signedMessage, createTurnStunAttribute(TURN_STUN_ATTR.MESSAGE_INTEGRITY, new Uint8Array(signature)));
}

async function readTurnStunMessage(reader, bufferedData = null, timeoutMessage = 'TURN response timed out') {
	let buffer = 有效数据长度(bufferedData) ? 数据转Uint8Array(bufferedData) : new Uint8Array(0);
	const pull = async () => {
		const { done, value } = await withTimeout(reader.read(), CONNECT_TIMEOUT_MS, timeoutMessage);
		if (done) throw new Error('TURN server closed connection');
		if (value?.byteLength) buffer = 拼接字节数据(buffer, value);
	};
	while (buffer.byteLength < 20) await pull();

	const messageLength = 20 + ((buffer[2] << 8) | buffer[3]);
	if (messageLength > 65555) throw new Error('TURN response is too large');
	while (buffer.byteLength < messageLength) await pull();
	const messageBuffer = buffer.subarray(0, messageLength);
	if (TURN_STUN_MAGIC_COOKIE.some((value, index) => messageBuffer[4 + index] !== value)) throw new Error('Invalid TURN/STUN response');

	const view = new DataView(messageBuffer.buffer, messageBuffer.byteOffset, messageBuffer.byteLength);
	const attributes = {};
	for (let offset = 20; offset + 4 <= messageLength;) {
		const type = view.getUint16(offset);
		const length = view.getUint16(offset + 2);
		if (offset + 4 + length > messageBuffer.byteLength) break;
		attributes[type] = messageBuffer.slice(offset + 4, offset + 4 + length);
		offset += 4 + length + turnStunPadding(length);
	}
	return {
		message: { type: view.getUint16(0), attributes },
		extraData: buffer.byteLength > messageLength ? buffer.subarray(messageLength) : null
	};
}

async function writeTurnBytes(writer, bytes, timeoutMessage) {
	await withTimeout(writer.write(bytes), CONNECT_TIMEOUT_MS, timeoutMessage);
}

async function turnConnect(proxy, targetHost, targetPort, TCP连接) {
	proxy = { ...proxy, username: proxy.username ?? null, password: proxy.password ?? null };
	const resolvedTargetHost = stripIPv6Brackets(targetHost);
	/** @type {string | null} */
	let targetIp = isIPv4(resolvedTargetHost) ? resolvedTargetHost : null;
	if (!targetIp) {
		const records = await DoH查询(resolvedTargetHost, 'A', proxy.dohLookupUrl || DEFAULT_DOH_LOOKUP_URL);
		const recordData = records.find(item => item.type === 1 && isIPv4(item.data))?.data;
		targetIp = typeof recordData === 'string' ? recordData : null;
	}
	if (!targetIp) throw new Error(`Could not resolve ${targetHost} to an IPv4 address for TURN CONNECT`);

	const turnHost = stripIPv6Brackets(proxy.hostname);
	let controlSocket = null, dataSocket = null, controlWriter = null, controlReader = null, dataWriter = null, dataReader = null, dataReaderReleased = false;
	const close = () => {
		try { controlSocket?.close?.() } catch (e) { }
		try { dataSocket?.close?.() } catch (e) { }
	};
	const releaseDataReader = () => {
		if (dataReaderReleased) return;
		dataReaderReleased = true;
		try { dataReader?.releaseLock?.() } catch (e) { }
	};

	try {
		controlSocket = TCP连接({ hostname: turnHost, port: proxy.port });
		await withTimeout(controlSocket.opened, CONNECT_TIMEOUT_MS, 'TURN server connection timed out');
		controlWriter = controlSocket.writable.getWriter();
		controlReader = controlSocket.readable.getReader();

		const xorPeerAddress = new Uint8Array(8);
		xorPeerAddress[1] = 1;
		new DataView(xorPeerAddress.buffer).setUint16(2, targetPort ^ 0x2112);
		targetIp.split('.').forEach((value, index) => {
			xorPeerAddress[4 + index] = Number(value) ^ TURN_STUN_MAGIC_COOKIE[index];
		});
		const peerAddress = createTurnStunAttribute(TURN_STUN_ATTR.XOR_PEER_ADDRESS, xorPeerAddress);
		const requestedTransport = new Uint8Array([6, 0, 0, 0]);

		await writeTurnBytes(controlWriter, createTurnStunMessage(
			TURN_STUN_TYPE.ALLOCATE_REQUEST,
			randomTurnTransactionId(),
			[createTurnStunAttribute(TURN_STUN_ATTR.REQUESTED_TRANSPORT, requestedTransport)]
		), 'TURN Allocate request timed out');

		let turnResponse = await readTurnStunMessage(controlReader, null, 'TURN Allocate response timed out');
		let message = turnResponse.message;
		let bufferedData = turnResponse.extraData;
		let integrityKey = null;
		let authAttributes = [];
		const sign = messageToSign => integrityKey ? addTurnMessageIntegrity(messageToSign, integrityKey) : Promise.resolve(messageToSign);

		if (
			message.type === TURN_STUN_TYPE.ALLOCATE_ERROR
			&& proxy.username !== null
			&& proxy.password !== null
			&& parseTurnErrorCode(message.attributes[TURN_STUN_ATTR.ERROR_CODE]) === 401
		) {
			const realmBytes = message.attributes[TURN_STUN_ATTR.REALM];
			const nonce = message.attributes[TURN_STUN_ATTR.NONCE];
			if (!realmBytes || !nonce?.byteLength) throw new Error('TURN authentication challenge is missing realm or nonce');

			const realm = textDecoder.decode(realmBytes);
			integrityKey = await md5Bytes(textEncoder.encode(`${proxy.username}:${realm}:${proxy.password}`));
			authAttributes = [
				createTurnStunAttribute(TURN_STUN_ATTR.USERNAME, textEncoder.encode(proxy.username)),
				createTurnStunAttribute(TURN_STUN_ATTR.REALM, textEncoder.encode(realm)),
				createTurnStunAttribute(TURN_STUN_ATTR.NONCE, nonce)
			];

			const allocateRequest = await addTurnMessageIntegrity(createTurnStunMessage(
				TURN_STUN_TYPE.ALLOCATE_REQUEST,
				randomTurnTransactionId(),
				[
					createTurnStunAttribute(TURN_STUN_ATTR.REQUESTED_TRANSPORT, requestedTransport),
					...authAttributes
				]
			), integrityKey);
			const pipelinedMessages = await Promise.all([
				sign(createTurnStunMessage(TURN_STUN_TYPE.CREATE_PERMISSION_REQUEST, randomTurnTransactionId(), [peerAddress, ...authAttributes])),
				sign(createTurnStunMessage(TURN_STUN_TYPE.CONNECT_REQUEST, randomTurnTransactionId(), [peerAddress, ...authAttributes]))
			]);
			await writeTurnBytes(controlWriter, 拼接字节数据(allocateRequest, ...pipelinedMessages), 'TURN authenticated Allocate request timed out');
			turnResponse = await readTurnStunMessage(controlReader, bufferedData, 'TURN authenticated Allocate response timed out');
			message = turnResponse.message;
			bufferedData = turnResponse.extraData;
		} else if (message.type === TURN_STUN_TYPE.ALLOCATE_SUCCESS) {
			const pipelinedMessages = await Promise.all([
				sign(createTurnStunMessage(TURN_STUN_TYPE.CREATE_PERMISSION_REQUEST, randomTurnTransactionId(), [peerAddress, ...authAttributes])),
				sign(createTurnStunMessage(TURN_STUN_TYPE.CONNECT_REQUEST, randomTurnTransactionId(), [peerAddress, ...authAttributes]))
			]);
			if (pipelinedMessages.length) await writeTurnBytes(controlWriter, 拼接字节数据(...pipelinedMessages), 'TURN pipelined request timed out');
		}

		if (message.type !== TURN_STUN_TYPE.ALLOCATE_SUCCESS) {
			const errorCode = parseTurnErrorCode(message.attributes[TURN_STUN_ATTR.ERROR_CODE]);
			throw new Error(errorCode ? `TURN Allocate failed with ${errorCode}` : 'TURN Allocate failed');
		}

		dataSocket = TCP连接({ hostname: turnHost, port: proxy.port });
		turnResponse = await readTurnStunMessage(controlReader, bufferedData, 'TURN CreatePermission response timed out');
		message = turnResponse.message;
		bufferedData = turnResponse.extraData;
		if (message.type !== TURN_STUN_TYPE.CREATE_PERMISSION_SUCCESS) throw new Error('TURN CreatePermission failed');

		turnResponse = await readTurnStunMessage(controlReader, bufferedData, 'TURN CONNECT response timed out');
		message = turnResponse.message;
		bufferedData = turnResponse.extraData;
		if (message.type !== TURN_STUN_TYPE.CONNECT_SUCCESS || !message.attributes[TURN_STUN_ATTR.CONNECTION_ID]) throw new Error('TURN CONNECT failed');

		await withTimeout(dataSocket.opened, CONNECT_TIMEOUT_MS, 'TURN data connection timed out');
		dataWriter = dataSocket.writable.getWriter();
		dataReader = dataSocket.readable.getReader();
		await writeTurnBytes(dataWriter, await sign(createTurnStunMessage(
			TURN_STUN_TYPE.CONNECTION_BIND_REQUEST,
			randomTurnTransactionId(),
			[
				createTurnStunAttribute(TURN_STUN_ATTR.CONNECTION_ID, message.attributes[TURN_STUN_ATTR.CONNECTION_ID]),
				...authAttributes
			]
		)), 'TURN ConnectionBind request timed out');

		turnResponse = await readTurnStunMessage(dataReader, null, 'TURN ConnectionBind response timed out');
		message = turnResponse.message;
		const extraPayload = turnResponse.extraData;
		if (message.type !== TURN_STUN_TYPE.CONNECTION_BIND_SUCCESS) throw new Error('TURN ConnectionBind failed');

		controlWriter.releaseLock();
		controlWriter = null;
		controlReader.releaseLock();
		controlReader = null;
		dataWriter.releaseLock();
		dataWriter = null;

		const readable = new ReadableStream({
			start(controller) {
				if (extraPayload?.byteLength) controller.enqueue(extraPayload);
			},
			pull(controller) {
				return dataReader.read().then(({ done, value }) => {
					if (done) {
						releaseDataReader();
						controller.close();
					} else if (value?.byteLength) controller.enqueue(new Uint8Array(value));
				});
			},
			cancel() {
				try { dataReader?.cancel?.() } catch (e) { }
				releaseDataReader();
				close();
			}
		});

		return { readable, writable: dataSocket.writable, closed: dataSocket.closed, close };
	} catch (error) {
		try { controlWriter?.releaseLock?.() } catch (e) { }
		try { controlReader?.releaseLock?.() } catch (e) { }
		try { dataWriter?.releaseLock?.() } catch (e) { }
		releaseDataReader();
		close();
		throw error;
	}
}
//////////////////////////////////////////////////sstpConnect///////////////////////////////////////////////
const SSTP_TCP_MSS = 1400;
const SSTP_EMPTY_BYTES = new Uint8Array(0);

function readSstpUint16(bytes, offset = 0) {
	return (bytes[offset] << 8) | bytes[offset + 1];
}

function readSstpUint32(bytes, offset = 0) {
	return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function randomSstpUint16() {
	return readSstpUint16(crypto.getRandomValues(new Uint8Array(2)));
}

function internetChecksum(bytes, offset, length) {
	let sum = 0;
	for (let index = offset; index < offset + length - 1; index += 2) sum += readSstpUint16(bytes, index);
	if (length & 1) sum += bytes[offset + length - 1] << 8;
	while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
	return (~sum) & 0xffff;
}

async function sstpConnect(proxy, targetHost, targetPort, TCP连接) {
	proxy = { ...proxy, username: proxy.username ?? null, password: proxy.password ?? null };
	let bufferedBytes = SSTP_EMPTY_BYTES, pppIdentifier = 1, socket = null, reader = null, writer = null;
	let closedSettled = false, resolveClosed, rejectClosed;
	const closed = new Promise((resolve, reject) => {
		resolveClosed = resolve;
		rejectClosed = reject;
	});
	const settleClosed = (settle, value) => {
		if (closedSettled) return;
		closedSettled = true;
		settle(value);
	};
	const close = () => {
		try { reader?.cancel?.().catch?.(() => { }) } catch (e) { }
		try { reader?.releaseLock?.() } catch (e) { }
		try { writer?.close?.().catch?.(() => { }) } catch (e) { }
		try { writer?.releaseLock?.() } catch (e) { }
		try { socket?.close?.() } catch (e) { }
		settleClosed(resolveClosed);
	};

	const readSocketChunk = async () => {
		const { value, done } = await reader.read();
		if (done || !value) throw new Error('SSTP socket closed');
		return 数据转Uint8Array(value);
	};
	const readBytes = async length => {
		while (bufferedBytes.byteLength < length) {
			const chunk = await readSocketChunk();
			bufferedBytes = bufferedBytes.byteLength ? 拼接字节数据(bufferedBytes, chunk) : chunk;
		}
		const result = bufferedBytes.subarray(0, length);
		bufferedBytes = bufferedBytes.subarray(length);
		return result;
	};
	const readHttpLine = async () => {
		for (; ;) {
			const lineEnd = bufferedBytes.indexOf(10);
			if (lineEnd >= 0) {
				const line = textDecoder.decode(bufferedBytes.subarray(0, lineEnd));
				bufferedBytes = bufferedBytes.subarray(lineEnd + 1);
				return line.replace(/\r$/, '');
			}
			const chunk = await readSocketChunk();
			bufferedBytes = bufferedBytes.byteLength ? 拼接字节数据(bufferedBytes, chunk) : chunk;
		}
	};
	const readPacket = async (timeoutMs = CONNECT_TIMEOUT_MS) => {
		const header = await withTimeout(readBytes(4), timeoutMs, 'SSTP read timeout');
		const length = readSstpUint16(header, 2) & 0x0fff;
		if (length < 4) throw new Error('Invalid SSTP packet length');
		return {
			isControl: (header[1] & 1) !== 0,
			body: length > 4 ? await withTimeout(readBytes(length - 4), timeoutMs, 'SSTP packet body read timeout') : SSTP_EMPTY_BYTES
		};
	};
	const buildSstpDataPacket = pppFrame => {
		const packetLength = 6 + pppFrame.byteLength;
		const packet = new Uint8Array(packetLength);
		packet.set([0x10, 0x00, ((packetLength >> 8) & 0x0f) | 0x80, packetLength & 0xff, 0xff, 0x03]);
		packet.set(pppFrame, 6);
		return packet;
	};
	const buildPppConfigurePacket = (protocol, code, id, options = []) => {
		const optionsLength = options.reduce((size, option) => size + 2 + option.data.byteLength, 0);
		const frame = new Uint8Array(6 + optionsLength);
		const view = new DataView(frame.buffer);
		view.setUint16(0, protocol);
		frame[2] = code;
		frame[3] = id;
		view.setUint16(4, 4 + optionsLength);
		options.reduce((offset, option) => {
			frame[offset] = option.type;
			frame[offset + 1] = 2 + option.data.byteLength;
			frame.set(option.data, offset + 2);
			return offset + 2 + option.data.byteLength;
		}, 6);
		return frame;
	};
	const parsePPPFrame = data => {
		const offset = data.byteLength >= 2 && data[0] === 0xff && data[1] === 0x03 ? 2 : 0;
		if (data.byteLength - offset < 4) return null;
		const protocol = readSstpUint16(data, offset);
		if (protocol === 0x0021) return { protocol, ipPacket: data.subarray(offset + 2) };
		if (data.byteLength - offset < 6) return null;
		return { protocol, code: data[offset + 2], id: data[offset + 3], payload: data.subarray(offset + 6), rawPacket: data.subarray(offset) };
	};
	const parsePppOptions = data => {
		const options = [];
		for (let offset = 0; offset + 2 <= data.byteLength;) {
			const type = data[offset];
			const length = data[offset + 1];
			if (length < 2 || offset + length > data.byteLength) break;
			options.push({ type, data: data.subarray(offset + 2, offset + length) });
			offset += length;
		}
		return options;
	};

	try {
		const serverHost = stripIPv6Brackets(proxy.hostname);
		const serverPort = proxy.port;
		socket = TCP连接({ hostname: serverHost, port: serverPort }, { secureTransport: 'on', allowHalfOpen: false });
		await withTimeout(socket.opened, CONNECT_TIMEOUT_MS, 'SSTP server connection timed out');
		reader = socket.readable.getReader();
		writer = socket.writable.getWriter();

		const displayHost = serverHost.includes(':') ? `[${serverHost}]` : serverHost;
		const httpRequest = textEncoder.encode(
			`SSTP_DUPLEX_POST /sra_{BA195980-CD49-458b-9E23-C84EE0ADCD75}/ HTTP/1.1\r\n`
			+ `Host: ${Number(serverPort) === 443 ? displayHost : `${displayHost}:${serverPort}`}\r\n`
			+ 'Content-Length: 18446744073709551615\r\n'
			+ `SSTPCORRELATIONID: {${crypto.randomUUID()}}\r\n\r\n`
		);
		const encapsulatedProtocol = new Uint8Array(2);
		new DataView(encapsulatedProtocol.buffer).setUint16(0, 1);
		const maximumReceiveUnit = new Uint8Array(2);
		new DataView(maximumReceiveUnit.buffer).setUint16(0, 1500);
		const sstpConnectRequest = new Uint8Array(12 + encapsulatedProtocol.byteLength);
		const sstpConnectView = new DataView(sstpConnectRequest.buffer);
		sstpConnectRequest[0] = 0x10;
		sstpConnectRequest[1] = 0x01;
		sstpConnectView.setUint16(2, sstpConnectRequest.byteLength | 0x8000);
		sstpConnectView.setUint16(4, 0x0001);
		sstpConnectView.setUint16(6, 1);
		sstpConnectRequest[9] = 1;
		sstpConnectView.setUint16(10, 4 + encapsulatedProtocol.byteLength);
		sstpConnectRequest.set(encapsulatedProtocol, 12);

		await withTimeout(writer.write(拼接字节数据(
			httpRequest,
			sstpConnectRequest,
			buildSstpDataPacket(buildPppConfigurePacket(0xc021, 1, pppIdentifier++, [
				{ type: 1, data: maximumReceiveUnit }
			]))
		)), CONNECT_TIMEOUT_MS, 'SSTP HTTP handshake request timed out');

		const statusLine = await withTimeout(readHttpLine(), CONNECT_TIMEOUT_MS, 'SSTP HTTP handshake timed out');
		for (; ;) {
			const line = await withTimeout(readHttpLine(), CONNECT_TIMEOUT_MS, 'SSTP HTTP header read timed out');
			if (line === '') break;
		}
		if (!/HTTP\/\d(?:\.\d)?\s+2\d\d/i.test(statusLine)) throw new Error(`SSTP HTTP handshake failed: ${statusLine || 'invalid status'}`);

		let localLcpAcked = false, peerLcpAcked = false, papRequired = false, papSent = false, papDone = false, ipcpStarted = false, ipcpFinished = false, sourceIp = null;
		const sendPapIfReady = async () => {
			if (!localLcpAcked || !peerLcpAcked || !papRequired || papSent) return;
			if (proxy.username === null || proxy.password === null) throw new Error('SSTP server requires PAP authentication');
			const username = textEncoder.encode(proxy.username);
			const password = textEncoder.encode(proxy.password);
			if (username.byteLength > 255 || password.byteLength > 255) throw new Error('SSTP username/password is too long');
			const papLength = 6 + username.byteLength + password.byteLength;
			const frame = new Uint8Array(2 + papLength);
			const view = new DataView(frame.buffer);
			view.setUint16(0, 0xc023);
			frame[2] = 1;
			frame[3] = pppIdentifier++;
			view.setUint16(4, papLength);
			frame[6] = username.byteLength;
			frame.set(username, 7);
			frame[7 + username.byteLength] = password.byteLength;
			frame.set(password, 8 + username.byteLength);
			await withTimeout(writer.write(buildSstpDataPacket(frame)), CONNECT_TIMEOUT_MS, 'SSTP PAP authentication request timed out');
			papSent = true;
		};
		const startIpcpIfReady = async () => {
			if (!localLcpAcked || !peerLcpAcked || ipcpStarted || (papRequired && !papDone)) return;
			await withTimeout(writer.write(buildSstpDataPacket(buildPppConfigurePacket(0x8021, 1, pppIdentifier++, [
				{ type: 3, data: new Uint8Array(4) }
			]))), CONNECT_TIMEOUT_MS, 'SSTP IPCP request timed out');
			ipcpStarted = true;
		};

		for (let round = 0; round < 50 && !ipcpFinished; round++) {
			const packet = await readPacket(CONNECT_TIMEOUT_MS);
			if (packet.isControl) continue;
			const ppp = parsePPPFrame(packet.body);
			if (!ppp) continue;

			if (ppp.protocol === 0xc021) {
				if (ppp.code === 1) {
					const authOption = parsePppOptions(ppp.payload).find(option => option.type === 3);
					if (authOption?.data?.byteLength >= 2) {
						const authProtocol = readSstpUint16(authOption.data);
						if (authProtocol !== 0xc023) throw new Error(`SSTP unsupported PPP authentication protocol: 0x${authProtocol.toString(16)}`);
						papRequired = true;
					}
					const ack = new Uint8Array(ppp.rawPacket);
					ack[2] = 2;
					await withTimeout(writer.write(buildSstpDataPacket(ack)), CONNECT_TIMEOUT_MS, 'SSTP LCP Configure-Ack timed out');
					peerLcpAcked = true;
					await sendPapIfReady();
					await startIpcpIfReady();
				} else if (ppp.code === 2) {
					localLcpAcked = true;
					await sendPapIfReady();
					await startIpcpIfReady();
				}
				continue;
			}

			if (ppp.protocol === 0xc023) {
				if (ppp.code === 2) {
					papDone = true;
					await startIpcpIfReady();
				} else if (ppp.code === 3) throw new Error('SSTP PAP authentication failed');
				continue;
			}

			if (ppp.protocol === 0x8021) {
				if (ppp.code === 1) {
					const ack = new Uint8Array(ppp.rawPacket);
					ack[2] = 2;
					await withTimeout(writer.write(buildSstpDataPacket(ack)), CONNECT_TIMEOUT_MS, 'SSTP IPCP Configure-Ack timed out');
					await startIpcpIfReady();
				} else if (ppp.code === 3) {
					const addressOption = parsePppOptions(ppp.payload).find(option => option.type === 3);
					if (addressOption?.data?.byteLength === 4) {
						sourceIp = [...addressOption.data].join('.');
						await withTimeout(writer.write(buildSstpDataPacket(buildPppConfigurePacket(0x8021, 1, pppIdentifier++, [
							{ type: 3, data: addressOption.data }
						]))), CONNECT_TIMEOUT_MS, 'SSTP IPCP address request timed out');
						ipcpStarted = true;
					}
				} else if (ppp.code === 2) {
					const addressOption = parsePppOptions(ppp.payload).find(option => option.type === 3);
					if (addressOption?.data?.byteLength === 4) sourceIp = [...addressOption.data].join('.');
					ipcpFinished = true;
				}
			}
		}
		if (!sourceIp) throw new Error('SSTP did not assign an IPv4 address');

		const target = stripIPv6Brackets(targetHost);
		/** @type {string | null} */
		let targetIp = isIPv4(target) ? target : null;
		if (!targetIp) {
			const records = await DoH查询(target, 'A', proxy.dohLookupUrl || DEFAULT_DOH_LOOKUP_URL);
			const recordData = records.find(item => item.type === 1 && isIPv4(item.data))?.data;
			targetIp = typeof recordData === 'string' ? recordData : null;
		}
		if (!targetIp) throw new Error(`Could not resolve ${targetHost} to an IPv4 address for SSTP`);

		const sourcePort = 10000 + (randomSstpUint16() % 50000);
		const sourceAddress = new Uint8Array(String(sourceIp || '').split('.').map(Number));
		const destinationAddress = new Uint8Array(String(targetIp || '').split('.').map(Number));
		let sequenceNumber = readSstpUint32(crypto.getRandomValues(new Uint8Array(4)));
		let acknowledgementNumber = 0;
		const ipHeaderTemplate = new Uint8Array(20);
		ipHeaderTemplate.set([0x45, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 64, 6]);
		ipHeaderTemplate.set(sourceAddress, 12);
		ipHeaderTemplate.set(destinationAddress, 16);
		const tcpPseudoHeader = new Uint8Array(1432);
		tcpPseudoHeader.set(sourceAddress);
		tcpPseudoHeader.set(destinationAddress, 4);
		tcpPseudoHeader[9] = 6;
		const buildTcpFrame = (flags, payload = SSTP_EMPTY_BYTES) => {
			const bytes = 数据转Uint8Array(payload);
			const payloadLength = bytes.byteLength;
			const tcpLength = 20 + payloadLength;
			const ipLength = 20 + tcpLength;
			const sstpLength = 8 + ipLength;
			const frame = new Uint8Array(sstpLength);
			const view = new DataView(frame.buffer);
			frame.set([0x10, 0x00, ((sstpLength >> 8) & 0x0f) | 0x80, sstpLength & 0xff, 0xff, 0x03, 0x00, 0x21]);
			frame.set(ipHeaderTemplate, 8);
			view.setUint16(10, ipLength);
			view.setUint16(12, randomSstpUint16());
			view.setUint16(18, internetChecksum(frame, 8, 20));
			view.setUint16(28, sourcePort);
			view.setUint16(30, targetPort);
			view.setUint32(32, sequenceNumber);
			view.setUint32(36, acknowledgementNumber);
			frame[40] = 0x50;
			frame[41] = flags;
			view.setUint16(42, 65535);
			if (payloadLength) frame.set(bytes, 48);
			tcpPseudoHeader[10] = tcpLength >> 8;
			tcpPseudoHeader[11] = tcpLength & 0xff;
			tcpPseudoHeader.set(frame.subarray(28, 28 + tcpLength), 12);
			view.setUint16(44, internetChecksum(tcpPseudoHeader, 0, 12 + tcpLength));
			return frame;
		};
		const matchIncomingIpPacket = ipPacket => {
			if (ipPacket.byteLength < 40 || ipPacket[9] !== 6) return null;
			const ipHeaderLength = (ipPacket[0] & 0x0f) * 4;
			if (ipPacket.byteLength < ipHeaderLength + 20) return null;
			if (readSstpUint16(ipPacket, ipHeaderLength) !== targetPort) return null;
			if (readSstpUint16(ipPacket, ipHeaderLength + 2) !== sourcePort) return null;
			return {
				flags: ipPacket[ipHeaderLength + 13],
				sequence: readSstpUint32(ipPacket, ipHeaderLength + 4),
				payloadOffset: ipHeaderLength + ((ipPacket[ipHeaderLength + 12] >> 4) & 0x0f) * 4
			};
		};

		await withTimeout(writer.write(buildTcpFrame(0x02)), CONNECT_TIMEOUT_MS, 'SSTP TCP SYN write timed out');
		sequenceNumber = (sequenceNumber + 1) >>> 0;
		let tcpReady = false;
		for (let attempt = 0; attempt < 30; attempt++) {
			const packet = await readPacket(CONNECT_TIMEOUT_MS);
			if (packet.isControl) continue;
			const ppp = parsePPPFrame(packet.body);
			if (!ppp || ppp.protocol !== 0x0021) continue;
			const tcp = matchIncomingIpPacket(ppp.ipPacket);
			if (!tcp || (tcp.flags & 0x12) !== 0x12) continue;
			acknowledgementNumber = (tcp.sequence + 1) >>> 0;
			await withTimeout(writer.write(buildTcpFrame(0x10)), CONNECT_TIMEOUT_MS, 'SSTP TCP ACK write timed out');
			tcpReady = true;
			break;
		}
		if (!tcpReady) throw new Error('TCP handshake through SSTP timed out');

		/** @type {ReadableStreamDefaultController<Uint8Array> | null} */
		let streamController = null;
		const readable = new ReadableStream({
			start(controller) {
				streamController = controller;
			},
			cancel() {
				close();
			}
		});

		(async () => {
			try {
				let pendingChunks = [], pendingLength = 0;
				const flush = () => {
					if (!pendingLength) return;
					if (!streamController) throw new Error('SSTP readable stream is not ready');
					streamController.enqueue(pendingChunks.length === 1 ? pendingChunks[0] : 拼接字节数据(...pendingChunks));
					pendingChunks = [];
					pendingLength = 0;
					writer.write(buildTcpFrame(0x10)).catch(() => { });
				};

				for (; ;) {
					const packet = await readPacket(60000);
					if (packet.isControl) continue;
					const ppp = parsePPPFrame(packet.body);
					if (!ppp || ppp.protocol !== 0x0021) continue;
					const incoming = matchIncomingIpPacket(ppp.ipPacket);
					if (!incoming) continue;

					if (incoming.payloadOffset < ppp.ipPacket.byteLength) {
						const payload = ppp.ipPacket.subarray(incoming.payloadOffset);
						if (payload.byteLength) {
							acknowledgementNumber = (incoming.sequence + payload.byteLength) >>> 0;
							pendingChunks.push(new Uint8Array(payload));
							pendingLength += payload.byteLength;
						}
					}

					if (incoming.flags & 0x01) {
						flush();
						acknowledgementNumber = (acknowledgementNumber + 1) >>> 0;
						writer.write(buildTcpFrame(0x11)).catch(() => { });
						const controller = streamController;
						if (controller) {
							try { controller.close() } catch (e) { }
						}
						close();
						return;
					}

					if (bufferedBytes.byteLength < 4 || pendingLength >= 32768) flush();
				}
			} catch (error) {
				const controller = streamController;
				if (controller) {
					try { controller.error(error) } catch (e) { }
				}
				settleClosed(rejectClosed, error);
				try { socket?.close?.() } catch (e) { }
			}
		})();

		const writable = new WritableStream({
			async write(chunk) {
				const bytes = 数据转Uint8Array(chunk);
				if (!bytes.byteLength) return;
				if (bytes.byteLength <= SSTP_TCP_MSS) {
					await writer.write(buildTcpFrame(0x18, bytes));
					sequenceNumber = (sequenceNumber + bytes.byteLength) >>> 0;
					return;
				}
				const frames = [];
				for (let offset = 0; offset < bytes.byteLength; offset += SSTP_TCP_MSS) {
					const segment = bytes.subarray(offset, Math.min(offset + SSTP_TCP_MSS, bytes.byteLength));
					frames.push(buildTcpFrame(0x18, segment));
					sequenceNumber = (sequenceNumber + segment.byteLength) >>> 0;
				}
				await writer.write(拼接字节数据(...frames));
			},
			close() {
				return writer.write(buildTcpFrame(0x11)).catch(() => { });
			},
			abort(error) {
				close();
				if (error) settleClosed(rejectClosed, error);
			}
		});

		return { readable, writable, closed, close };
	} catch (error) {
		close();
		throw error;
	}
}

/** Internal helper. */
function base64SecretEncode(plaintext, secret) {
	const encoder = new TextEncoder();
	const data = encoder.encode(plaintext);
	const key = encoder.encode(secret);
	if (!key.length) throw new Error('Secret is empty');
	const mixed = new Uint8Array(data.length);

	for (let i = 0; i < data.length; i++) {
		mixed[i] = data[i] ^ key[i % key.length];
	}


	let binary = '';
	for (let i = 0; i < mixed.length; i++) {
		binary += String.fromCharCode(mixed[i]);
	}
	return btoa(binary);
}

/** Internal helper. */
function base64SecretDecode(encoded, secret) {
	const binary = atob(encoded);
	const mixed = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		mixed[i] = binary.charCodeAt(i);
	}

	const encoder = new TextEncoder();
	const key = encoder.encode(secret);
	if (!key.length) throw new Error('Secret is empty');
	const data = new Uint8Array(mixed.length);

	for (let i = 0; i < mixed.length; i++) {
		data[i] = mixed[i] ^ key[i % key.length];
	}

	const decoder = new TextDecoder();
	return decoder.decode(data);
}

function 获取传输协议配置(配置 = {}) {
	const 是gRPC = 配置.传输协议 === 'grpc';
	return {
		type: 是gRPC ? (配置.gRPC模式 === 'multi' ? 'grpc&mode=multi&alpn=h2' : 'grpc&mode=gun&alpn=h2') : (配置.传输协议 === 'xhttp' ? 'xhttp&mode=stream-one' : 'ws'),
		路径字段名: 是gRPC ? 'serviceName' : 'path',
		域名字段名: 是gRPC ? 'authority' : 'host'
	};
}

function 获取传输路径参数值(配置 = {}, 节点路径 = '/', 作为优选订阅生成器 = false) {
	if (配置.传输协议 === 'grpc') return (作为优选订阅生成器 ? '/' : 节点路径).split('?')[0] || '/';
	return 作为优选订阅生成器 ? '/' : (配置.随机路径 ? 随机路径(节点路径) : 节点路径);
}

function log(...args) {
	if (调试日志打印 && !抑制旧文本日志) console.log(...args);
}

function debugWarn(...args) {
	if (调试日志打印) console.warn(...args);
}

function debugError(...args) {
	if (调试日志打印) console.error(...args);
}

// ── Connection tracer (DEBUG-only telemetry) ──────────────────────────────────────────────────────
// When DEBUG is on, each tunnel connection gets a tracer that emits STRUCTURED JSON events (one object per
// console.log, so `wrangler tail --format json` / Workers Logs index the fields and an AI can parse them
// without guessing units). When DEBUG is off, 创建连接追踪器 returns null and every 追踪* helper is a cheap
// no-op — no objects built, no timers, negligible per-chunk cost.
// Events (field `ev`): open · route · dial_fail · fallback · first_byte · stat · dns · close.
// Byte fields are raw integers (bytes / bytes-per-second); the analysis tool formats, not the Worker.
let 连接追踪序号 = 0;
const 连接追踪心跳毫秒默认 = 15000; // periodic `stat` so a long-lived (gRPC "gun") connection stays visible even if the tail attaches mid-stream
function 格式化字节数(n) {
	// Retained for the test suite / any human-readable callers; the tracer itself emits raw integers.
	if (!Number.isFinite(n) || n < 0) return '0B';
	if (n < 1024) return `${Math.round(n)}B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)}MB`;
	return `${(n / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}
function 追踪错误名(err) {
	if (err == null) return null;
	const m = String(err.message || err);
	return m.length > 100 ? m.slice(0, 100) : m;
}
function 是流取消错误(err) {
	// A client/runtime stream cancellation (normal lifecycle) — NOT a tunnel failure. The prior tracer mislabeled
	// every one of these as reason=error because the gRPC catch fired 追踪关闭(...,'error') unconditionally.
	if (!err) return false;
	if (err.name === 'AbortError') return true;
	const m = String(err.message || err).toLowerCase();
	return m.includes('stream was cancelled') || m.includes('stream was canceled') || m.includes('readablestream was canceled') || m.includes('readablestream was cancelled');
}
// `expected:true` means a normal lifecycle end, NOT a tunnel fault. first_byte_timeout is deliberately absent
// (a fired first-byte watchdog = a blackholed route worth surfacing), as are error / queue_overflow.
const 预期关闭原因集 = new Set(['eof', 'request_eof', 'remote_eof', 'remote_eof_no_data', 'no_request_idle', 'client_cancel', 'client_close', 'client_ws_error', 'client_abort', 'runtime_cancel', 'idle_timeout']);
function 分类关闭原因(wrapper, err) {
	if (wrapper?.closeHint) return { reason: wrapper.closeHint, expected: 预期关闭原因集.has(wrapper.closeHint) };
	if (wrapper?.客户端已关闭) return { reason: 'client_cancel', expected: true };
	if (是流取消错误(err)) return { reason: 'runtime_cancel', expected: true };
	if (err?.isQueueOverflow) return { reason: 'queue_overflow', expected: false };
	if (err) return { reason: 'error', expected: false };
	return { reason: 'eof', expected: true };
}
function 追踪发射(s, ev, fields) {
	// One structured object per line = machine-parseable. Gated on 调试日志打印 (a tracer only exists under
	// DEBUG anyway; this belt-and-suspenders keeps it silent if DEBUG is off or in unit tests).
	if (!调试日志打印) return;
	try { console.log({ ev, conn: s.id, t: Date.now(), tr: s.transport, ...fields }); } catch (e) { }
}
function 创建连接追踪器(transport, request = null, env = null) {
	if (!调试日志打印) return null;
	const cf = request?.cf || {};
	const ray = request?.headers?.get?.('CF-Ray') || '';
	// Globally-unique id: CF-Ray is unique per request (so per connection); fall back to a module counter only
	// off-platform (tests). Fixes cross-isolate collisions where two connections both logged as `[conn 1]`.
	const id = ray ? ray.split('-')[0] : ('x' + ((连接追踪序号 = (连接追踪序号 + 1) & 0xffffff)).toString(36));
	const 心跳毫秒 = Math.max(5000, Math.min(300000, Number(env?.DEBUG_STAT_INTERVAL_MS) || 连接追踪心跳毫秒默认));
	const t0 = Date.now();
	const s = {
		id, transport, t0,
		target: null, port: null, route: 'pending', endpoint: null, dialMs: null, ttfbMs: null,
		bytesUp: 0, bytesDown: 0, chunksUp: 0, chunksDown: 0, initialWriteBytes: 0,
		dialAttempts: 0, dialFailures: 0, fallbacks: 0,
		lastStatUp: 0, lastStatDown: 0, lastStatAt: t0, peakUpBps: 0, peakDownBps: 0,
		firstActivityAt: 0, lastActivityAt: 0,
		closeHint: null, closed: false, hb: null, 队列统计: null,
	};
	追踪发射(s, 'open', {
		ip: request?.headers?.get?.('CF-Connecting-IP') || null,
		colo: cf.colo || null, country: cf.country || null, asn: cf.asn || null,
		proto: cf.httpProtocol || null,
		rtt_ms: cf.clientTcpRtt ?? cf.clientQuicRtt ?? null,
		edge_bps: cf.edgeL4?.deliveryRate ?? null,
	});
	try {
		s.hb = setInterval(() => {
			if (s.closed) { try { clearInterval(s.hb) } catch (e) { } return; }
			const { upBps, downBps, moved } = 更新追踪速率峰值(s);
			// Skip a fully-idle heartbeat once a route exists, so an idle DoT/API/DNS connection doesn't flood the tail.
			if (!moved && s.route !== 'pending') return;
			let q = null; try { q = s.队列统计 ? s.队列统计() : null; } catch (e) { }
			// Terminal `close` events are lost for most canceled invocations (the runtime cancels before JS
			// cleanup runs), so mirror the key close fields into each `stat` — an AI can reconstruct most of a
			// connection from its last heartbeat even when no close arrives.
			追踪发射(s, 'stat', {
				secs: Math.round((Date.now() - t0) / 1000), route: s.route, endpoint: s.endpoint, target: s.target, port: s.port,
				ttfb_ms: s.ttfbMs, dial_ms: s.dialMs,
				up_b: s.bytesUp, down_b: s.bytesDown, up_ch: s.chunksUp, down_ch: s.chunksDown,
				up_bps: upBps, down_bps: downBps, peak_up_bps: s.peakUpBps, peak_down_bps: s.peakDownBps,
				dial_attempts: s.dialAttempts, dial_failures: s.dialFailures, fallbacks: s.fallbacks,
				...(q ? { q_max_bytes: q.maxQueuedBytes, q_max_inflight: q.maxInFlightBytes, q_max_items: q.maxItems, q_max_write_ms: q.maxWriteMs, q_overflow: q.overflowCount } : {}),
			});
		}, 心跳毫秒);
	} catch (e) { }
	return s;
}
// Compute the up/down bytes-per-second since the last sample, update the running peaks, and reset the sample
// markers. Called from the heartbeat AND once more inside close — so a connection shorter than one heartbeat
// interval still gets a real peak (the prior tracer reported peak_down_bps=0 for every sub-15s download).
function 更新追踪速率峰值(s, now = Date.now()) {
	const elapsed = Math.max(1, now - s.lastStatAt);
	const upD = s.bytesUp - s.lastStatUp, downD = s.bytesDown - s.lastStatDown;
	const upBps = Math.round(upD * 1000 / elapsed), downBps = Math.round(downD * 1000 / elapsed);
	s.lastStatAt = now; s.lastStatUp = s.bytesUp; s.lastStatDown = s.bytesDown;
	if (upBps > s.peakUpBps) s.peakUpBps = upBps;
	if (downBps > s.peakDownBps) s.peakDownBps = downBps;
	return { upBps, downBps, moved: !!(upD || downD) };
}
function 追踪记录目标(s, host, port) { if (s && !s.target) { s.target = host; s.port = Number(port) || null; } }
function 追踪记录路由(s, route, endpoint, dialMs) {
	if (!s) return;
	s.route = route; if (endpoint) s.endpoint = endpoint; if (dialMs != null) s.dialMs = dialMs;
	追踪发射(s, 'route', { route, endpoint: endpoint || s.endpoint || null, dial_ms: dialMs ?? null, target: s.target, port: s.port });
}
function 追踪拨号尝试(s) { if (s) s.dialAttempts++; }
function 追踪拨号失败(s, route, ms, err) {
	if (!s) return;
	s.dialFailures++;
	追踪发射(s, 'dial_fail', { route, ms: ms ?? null, err: 追踪错误名(err), target: s.target, port: s.port });
}
function 追踪回退(s, from, to) {
	if (!s) return;
	s.fallbacks++;
	追踪发射(s, 'fallback', { from, to, n: s.fallbacks, target: s.target, port: s.port });
}
function 追踪首字节(s) {
	if (!s || s.ttfbMs != null) return;
	s.ttfbMs = Math.round(Date.now() - s.t0);
	追踪发射(s, 'first_byte', { ttfb_ms: s.ttfbMs, route: s.route, target: s.target, port: s.port });
}
function 追踪活动时间(s) {
	const now = Date.now();
	if (!s.firstActivityAt) s.firstActivityAt = now;
	s.lastActivityAt = now;
}
function 追踪上行(s, n) { if (s && n > 0) { s.bytesUp += n; s.chunksUp++; 追踪活动时间(s); } }
function 追踪下行(s, n) { if (s && n > 0) { s.bytesDown += n; s.chunksDown++; 追踪活动时间(s); } }
function 追踪初始写入(s, n) { if (s && n > 0) { s.initialWriteBytes += n; s.bytesUp += n; 追踪活动时间(s); } }
function 追踪DNS(s, upBytes, downBytes, meta) {
	if (!s) return;
	s.route = 'dns'; if (!s.target) { s.target = 'dns'; s.port = 53; }
	if (upBytes > 0) { s.bytesUp += upBytes; s.chunksUp++; }
	if (downBytes > 0) { s.bytesDown += downBytes; s.chunksDown++; 追踪首字节(s); }
	追踪活动时间(s);
	追踪发射(s, 'dns', { up_b: upBytes || 0, down_b: downBytes || 0, ...(meta || {}) });
}
function 追踪关闭(s, reasonOrWrapper, err) {
	if (!s || s.closed) return;
	// Accept an explicit reason string OR a wrapper to classify. The wrapper form lets each teardown site pass
	// its context (closeHint / 客户端已关闭 / error) and get correct expected-vs-error classification, so a
	// normal "Stream was cancelled" no longer counts as an error.
	let reason, expected;
	if (typeof reasonOrWrapper === 'string') { reason = reasonOrWrapper; expected = 预期关闭原因集.has(reason); }
	else { const c = 分类关闭原因(reasonOrWrapper, err); reason = c.reason; expected = c.expected; }
	// Carry a sanitized error string on an UNEXPECTED close so `reason=error` (0-3ms undiagnosable closes in the
	// capture) is actually diagnosable — otherwise, with legacy text off, the cause is lost.
	const errText = (!expected && err) ? 追踪错误名(err) : null;
	s.closed = true;
	if (s.hb) { try { clearInterval(s.hb) } catch (e) { } s.hb = null; }
	更新追踪速率峰值(s); // fold in the final partial interval so a sub-heartbeat connection reports a real peak
	const dur = Math.round(Date.now() - s.t0);
	const activeMs = s.lastActivityAt && s.firstActivityAt ? Math.max(1, s.lastActivityAt - s.firstActivityAt) : 0;
	let q = null;
	try { q = s.队列统计 ? s.队列统计() : null; } catch (e) { }
	追踪发射(s, 'close', {
		reason, expected, dur_ms: dur, route: s.route, target: s.target, port: s.port,
		ttfb_ms: s.ttfbMs, dial_ms: s.dialMs,
		up_b: s.bytesUp, down_b: s.bytesDown, up_ch: s.chunksUp, down_ch: s.chunksDown, init_write_b: s.initialWriteBytes,
		life_down_bps: dur > 0 ? Math.round(s.bytesDown * 1000 / dur) : 0,
		active_down_bps: activeMs > 0 ? Math.round(s.bytesDown * 1000 / activeMs) : 0,
		peak_down_bps: s.peakDownBps, peak_up_bps: s.peakUpBps,
		dial_attempts: s.dialAttempts, dial_failures: s.dialFailures, fallbacks: s.fallbacks,
		...(errText ? { err: errText } : {}),
		...(q ? { q_max_bytes: q.maxQueuedBytes, q_max_inflight: q.maxInFlightBytes, q_max_items: q.maxItems, q_max_write_ms: q.maxWriteMs, q_overflow: q.overflowCount } : {}),
	});
}

// Emit the `close` event when the client disconnects. Most gRPC "gun" invocations are CANCELED by the runtime
// (client closed) before cancel()/finally run, so ~83% of connections never produced a close in the capture.
// request.signal fires on that disconnect — but only when the `enable_request_signal` compatibility flag is set
// in wrangler.toml. No-ops gracefully when the flag/signal is absent (cancel()/finally still cover the rest).
function 绑定请求中止(request, wrapper) {
	const signal = request?.signal;
	if (!wrapper || !signal || typeof signal.addEventListener !== 'function') return;
	const onAbort = () => {
		if (wrapper.客户端已关闭) { if (wrapper.追踪) 追踪关闭(wrapper.追踪, wrapper); return; }
		wrapper.客户端已关闭 = true;
		if (!wrapper.closeHint) wrapper.closeHint = 'client_abort';
		追踪关闭(wrapper.追踪, wrapper); // synchronous close emit before the invocation is torn down
		try { wrapper.socket?.close?.(); } catch (e) { }
	};
	if (signal.aborted) { onAbort(); return; }
	try { signal.addEventListener('abort', onAbort, { once: true }); } catch (e) { }
}

function Clash订阅配置文件热补丁(Clash_原始订阅内容, config_JSON = {}) {
	const uuid = config_JSON?.UUID || null;
	const ECH启用 = Boolean(config_JSON?.ECH);
	const HOSTS = Array.isArray(config_JSON?.HOSTS) ? [...config_JSON.HOSTS] : [];
	const ECH_SNI = config_JSON?.ECHConfig?.SNI || null;
	const ECH_DNS = config_JSON?.ECHConfig?.DNS;
	const 需要处理ECH = Boolean(uuid && ECH启用);
	const gRPCUserAgent = (typeof config_JSON?.gRPCUserAgent === 'string' && config_JSON.gRPCUserAgent.trim()) ? config_JSON.gRPCUserAgent.trim() : null;
	const 需要处理gRPC = config_JSON?.传输协议 === "grpc" && Boolean(gRPCUserAgent);
	const gRPCUserAgentYAML = gRPCUserAgent ? JSON.stringify(gRPCUserAgent) : null;
	let clash_yaml = String(Clash_原始订阅内容 || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/mode:\s*Rule\b/g, 'mode: rule');

	const baseDnsBlock = `dns:
  enable: true
  default-nameserver:
    - 223.5.5.5
    - 119.29.29.29
    - 114.114.114.114
  use-hosts: true
  nameserver:
    - https://sm2.doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - 8.8.4.4
    - 208.67.220.220
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4
      - 127.0.0.1/32
      - 0.0.0.0/32
    domain:
      - '+.google.com'
      - '+.facebook.com'
      - '+.youtube.com'
`;

	const 添加InlineGrpcUserAgent = (text) => text.replace(/grpc-opts:\s*\{([\s\S]*?)\}/i, (all, inner) => {
		if (/grpc-user-agent\s*:/i.test(inner)) return all;
		let content = inner.trim();
		if (content.endsWith(',')) content = content.slice(0, -1).trim();
		const patchedContent = content ? `${content}, grpc-user-agent: ${gRPCUserAgentYAML}` : `grpc-user-agent: ${gRPCUserAgentYAML}`;
		return `grpc-opts: {${patchedContent}}`;
	});
	const 匹配到gRPC网络 = (text) => /(?:^|[,{])\s*network:\s*(?:"grpc"|'grpc'|grpc)(?=\s*(?:[,}\n#]|$))/mi.test(text);
	const 获取代理类型 = (nodeText) => nodeText.match(/type:\s*(\w+)/)?.[1] || 'vl' + 'ess';
	const 获取凭据值 = (nodeText, isFlowStyle) => {
		const credentialField = 获取代理类型(nodeText) === 'trojan' ? 'password' : 'uuid';
		const pattern = new RegExp(`${credentialField}:\\s*${isFlowStyle ? '([^,}\\n]+)' : '([^\\n]+)'}`);
		return nodeText.match(pattern)?.[1]?.trim() || null;
	};
	const 插入NameserverPolicy = (yaml, hostsEntries) => {
		if (/^\s{2}nameserver-policy:\s*(?:\n|$)/m.test(yaml)) {
			return yaml.replace(/^(\s{2}nameserver-policy:\s*\n)/m, `$1${hostsEntries}\n`);
		}
		const lines = yaml.split('\n');
		let dnsBlockEndIndex = -1;
		let inDnsBlock = false;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (/^dns:\s*$/.test(line)) {
				inDnsBlock = true;
				continue;
			}
			if (inDnsBlock && /^[a-zA-Z]/.test(line)) {
				dnsBlockEndIndex = i;
				break;
			}
		}
		const nameserverPolicyBlock = `  nameserver-policy:\n${hostsEntries}`;
		if (dnsBlockEndIndex !== -1) lines.splice(dnsBlockEndIndex, 0, nameserverPolicyBlock);
		else lines.push(nameserverPolicyBlock);
		return lines.join('\n');
	};
	const 添加Flow格式gRPCUserAgent = (nodeText) => {
		if (!匹配到gRPC网络(nodeText) || /grpc-user-agent\s*:/i.test(nodeText)) return nodeText;
		if (/grpc-opts:\s*\{/i.test(nodeText)) return 添加InlineGrpcUserAgent(nodeText);
		return nodeText.replace(/\}(\s*)$/, `, grpc-opts: {grpc-user-agent: ${gRPCUserAgentYAML}}}$1`);
	};
	const 添加Block格式gRPCUserAgent = (nodeLines, topLevelIndent) => {
		const 顶级缩进 = ' '.repeat(topLevelIndent);
		let grpcOptsIndex = -1;
		for (let idx = 0; idx < nodeLines.length; idx++) {
			const line = nodeLines[idx];
			if (!line.trim()) continue;
			const indent = line.search(/\S/);
			if (indent !== topLevelIndent) continue;
			if (/^\s*grpc-opts:\s*(?:#.*)?$/.test(line) || /^\s*grpc-opts:\s*\{.*\}\s*(?:#.*)?$/.test(line)) {
				grpcOptsIndex = idx;
				break;
			}
		}
		if (grpcOptsIndex === -1) {
			let insertIndex = -1;
			for (let j = nodeLines.length - 1; j >= 0; j--) {
				if (nodeLines[j].trim()) {
					insertIndex = j;
					break;
				}
			}
			if (insertIndex >= 0) nodeLines.splice(insertIndex + 1, 0, `${顶级缩进}grpc-opts:`, `${顶级缩进}  grpc-user-agent: ${gRPCUserAgentYAML}`);
			return nodeLines;
		}
		const grpcLine = nodeLines[grpcOptsIndex];
		if (/^\s*grpc-opts:\s*\{.*\}\s*(?:#.*)?$/.test(grpcLine)) {
			if (!/grpc-user-agent\s*:/i.test(grpcLine)) nodeLines[grpcOptsIndex] = 添加InlineGrpcUserAgent(grpcLine);
			return nodeLines;
		}
		let blockEndIndex = nodeLines.length;
		let 子级缩进 = topLevelIndent + 2;
		let 已有gRPCUserAgent = false;
		for (let idx = grpcOptsIndex + 1; idx < nodeLines.length; idx++) {
			const line = nodeLines[idx];
			const trimmed = line.trim();
			if (!trimmed) continue;
			const indent = line.search(/\S/);
			if (indent <= topLevelIndent) {
				blockEndIndex = idx;
				break;
			}
			if (indent > topLevelIndent && 子级缩进 === topLevelIndent + 2) 子级缩进 = indent;
			if (/^grpc-user-agent\s*:/.test(trimmed)) {
				已有gRPCUserAgent = true;
				break;
			}
		}
		if (!已有gRPCUserAgent) nodeLines.splice(blockEndIndex, 0, `${' '.repeat(子级缩进)}grpc-user-agent: ${gRPCUserAgentYAML}`);
		return nodeLines;
	};
	const 添加Block格式ECHOpts = (nodeLines, topLevelIndent) => {
		let insertIndex = -1;
		for (let j = nodeLines.length - 1; j >= 0; j--) {
			if (nodeLines[j].trim()) {
				insertIndex = j;
				break;
			}
		}
		if (insertIndex < 0) return nodeLines;
		const indent = ' '.repeat(topLevelIndent);
		const echOptsLines = [`${indent}ech-opts:`, `${indent}  enable: true`];
		if (ECH_SNI) echOptsLines.push(`${indent}  query-server-name: ${ECH_SNI}`);
		nodeLines.splice(insertIndex + 1, 0, ...echOptsLines);
		return nodeLines;
	};

	if (!/^dns:\s*(?:\n|$)/m.test(clash_yaml)) clash_yaml = baseDnsBlock + clash_yaml;
	if (ECH_SNI && !HOSTS.includes(ECH_SNI)) HOSTS.push(ECH_SNI);

	if (ECH启用 && HOSTS.length > 0) {
		const hostsEntries = HOSTS.map(host => `    "${host}": ${ECH_DNS ? ECH_DNS : ''}`).join('\n');
		clash_yaml = 插入NameserverPolicy(clash_yaml, hostsEntries);
	}

	if (!需要处理ECH && !需要处理gRPC) return clash_yaml;

	const lines = clash_yaml.split('\n');
	const processedLines = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		const trimmedLine = line.trim();

		if (trimmedLine.startsWith('- {')) {
			let fullNode = line;
			let braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
			while (braceCount > 0 && i + 1 < lines.length) {
				i++;
				fullNode += '\n' + lines[i];
				braceCount += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
			}
			if (需要处理gRPC) fullNode = 添加Flow格式gRPCUserAgent(fullNode);
			if (需要处理ECH && 获取凭据值(fullNode, true) === uuid.trim()) {
				fullNode = fullNode.replace(/\}(\s*)$/, `, ech-opts: {enable: true${ECH_SNI ? `, query-server-name: ${ECH_SNI}` : ''}}}$1`);
			}
			processedLines.push(fullNode);
			i++;
		} else if (trimmedLine.startsWith('- name:')) {
			let nodeLines = [line];
			let baseIndent = line.search(/\S/);
			let topLevelIndent = baseIndent + 2;
			i++;
			while (i < lines.length) {
				const nextLine = lines[i];
				const nextTrimmed = nextLine.trim();
				if (!nextTrimmed) {
					nodeLines.push(nextLine);
					i++;
					break;
				}
				const nextIndent = nextLine.search(/\S/);
				if (nextIndent <= baseIndent && nextTrimmed.startsWith('- ')) {
					break;
				}
				if (nextIndent < baseIndent && nextTrimmed) {
					break;
				}
				nodeLines.push(nextLine);
				i++;
			}
			let nodeText = nodeLines.join('\n');
			if (需要处理gRPC && 匹配到gRPC网络(nodeText)) {
				nodeLines = 添加Block格式gRPCUserAgent(nodeLines, topLevelIndent);
				nodeText = nodeLines.join('\n');
			}
			if (需要处理ECH && 获取凭据值(nodeText, false) === uuid.trim()) nodeLines = 添加Block格式ECHOpts(nodeLines, topLevelIndent);
			processedLines.push(...nodeLines);
		} else {
			processedLines.push(line);
			i++;
		}
	}

	return processedLines.join('\n');
}

async function Singbox订阅配置文件热补丁(SingBox_原始订阅内容, config_JSON = {}) {
	const uuid = config_JSON?.UUID || null;
	const fingerprint = config_JSON?.Fingerprint || "chrome";
	const ECH启用 = Boolean(config_JSON?.ECH);
	const ECH_SNI = config_JSON?.ECHConfig?.SNI || "cloudflare-ech.com";
	const sb_json_text = String(SingBox_原始订阅内容 || '');
	try {
		const config = JSON.parse(sb_json_text);
		const 数组化 = value => value === undefined || value === null ? [] : (Array.isArray(value) ? value : [value]);
		const 确保Route = () => config.route = config.route && typeof config.route === 'object' ? config.route : {};
		const 获取DNS规则服务器 = rule => rule && typeof rule === 'object' && !Array.isArray(rule) && typeof rule.server === 'string' ? rule.server : null;
		const 添加规则集 = (type, code) => {
			if (!code || typeof code !== 'string') return null;
			const route = 确保Route(), tag = `${type}-${code}`, ruleSet = Array.isArray(route.rule_set) ? route.rule_set : 数组化(route.rule_set);
			if (!ruleSet.some(item => item?.tag === tag)) {
				const legacyOptions = type === 'geoip' ? route.geoip : route.geosite;
				ruleSet.push({ tag, type: 'remote', format: 'binary', url: `https://raw.githubusercontent.com/SagerNet/sing-${type}/rule-set/${tag}.srs`, ...(legacyOptions?.download_detour ? { download_detour: legacyOptions.download_detour } : {}) });
				config.experimental = config.experimental && typeof config.experimental === 'object' ? config.experimental : {};
				config.experimental.cache_file = config.experimental.cache_file && typeof config.experimental.cache_file === 'object' ? config.experimental.cache_file : {};
				config.experimental.cache_file.enabled ??= true;
			}
			route.rule_set = ruleSet;
			return tag;
		};

		const 迁移规则集字段 = rule => {
			if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return rule;
			if (rule.type === 'logical' && Array.isArray(rule.rules)) {
				rule.rules = rule.rules.map(迁移规则集字段);
				return rule;
			}
			const tags = [];
			for (const geoip of 数组化(rule.geoip)) {
				if (typeof geoip !== 'string') continue;
				if (geoip.toLowerCase() === 'private') rule.ip_is_private = true;
				else tags.push(添加规则集('geoip', geoip));
			}
			for (const sourceGeoip of 数组化(rule.source_geoip)) {
				if (typeof sourceGeoip !== 'string') continue;
				tags.push(添加规则集('geoip', sourceGeoip));
				rule.rule_set_ip_cidr_match_source = true;
			}
			for (const geosite of 数组化(rule.geosite)) if (typeof geosite === 'string') tags.push(添加规则集('geosite', geosite));
			if (tags.length) rule.rule_set = [...new Set([...数组化(rule.rule_set), ...tags].filter(Boolean))];
			delete rule.geoip;
			delete rule.source_geoip;
			delete rule.geosite;
			return rule;
		};

		const 迁移DNS规则 = (rule, rcodeServerMap) => {
			rule = 迁移规则集字段(rule);
			if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return rule;
			if (rule.type === 'logical' && Array.isArray(rule.rules)) {
				rule.rules = rule.rules.map(childRule => 迁移DNS规则(childRule, rcodeServerMap));
				return rule;
			}
			const serverTag = 获取DNS规则服务器(rule);
			if (serverTag && rcodeServerMap.has(serverTag)) {
				for (const key of ['server', 'strategy', 'disable_cache', 'rewrite_ttl', 'client_subnet', 'timeout']) delete rule[key];
				rule.action = 'predefined';
				rule.rcode = rcodeServerMap.get(serverTag);
			} else if (serverTag && !rule.action) rule.action = 'route';
			return rule;
		};

		if (Array.isArray(config.inbounds)) {
			for (const inbound of config.inbounds) {
				if (!inbound || typeof inbound !== 'object' || inbound.type !== 'tun') continue;
				for (const migration of [
					{ targetKey: 'address', sourceKeys: ['inet4_address', 'inet6_address'] },
					{ targetKey: 'route_address', sourceKeys: ['inet4_route_address', 'inet6_route_address'] },
					{ targetKey: 'route_exclude_address', sourceKeys: ['inet4_route_exclude_address', 'inet6_route_exclude_address'] }
				]) {
					const values = 数组化(inbound[migration.targetKey]);
					for (const sourceKey of migration.sourceKeys) values.push(...数组化(inbound[sourceKey]));
					if (values.length) inbound[migration.targetKey] = [...new Set(values)];
					for (const sourceKey of migration.sourceKeys) delete inbound[sourceKey];
				}
				if (inbound.tag) {
					const addedRules = [];
					if (inbound.domain_strategy) addedRules.push({ inbound: inbound.tag, action: 'resolve', strategy: inbound.domain_strategy });
					if (inbound.sniff) {
						const sniffRule = { inbound: inbound.tag, action: 'sniff' };
						if (inbound.sniff_timeout) sniffRule.timeout = inbound.sniff_timeout;
						addedRules.push(sniffRule);
					}
					if (addedRules.length) {
						const route = 确保Route();
						route.rules = [...addedRules, ...数组化(route.rules)];
					}
				}
				delete inbound.sniff;
				delete inbound.sniff_timeout;
				delete inbound.domain_strategy;
			}
		}

		if (config?.route && typeof config.route === 'object' && Array.isArray(config.route.rules)) {
			const 修补路由规则 = rule => {
				rule = 迁移规则集字段(rule);
				if (rule?.type === 'logical' && Array.isArray(rule.rules)) rule.rules = rule.rules.map(修补路由规则);
				else if (rule && typeof rule === 'object' && !Array.isArray(rule) && rule.outbound && !rule.action) rule.action = 'route';
				return rule;
			};
			config.route.rules = config.route.rules.map(修补路由规则);
		}

		const dns = config?.dns;
		if (dns && typeof dns === 'object') {
			const legacyFakeIP = dns.fakeip && typeof dns.fakeip === 'object' ? dns.fakeip : null;
			const rcodeServerMap = new Map();
			const DNS地址协议类型 = { 'tcp:': 'tcp', 'udp:': 'udp', 'tls:': 'tls', 'quic:': 'quic', 'https:': 'https', 'h3:': 'h3' };
			const RCode映射 = { success: 'NOERROR', format_error: 'FORMERR', server_failure: 'SERVFAIL', name_error: 'NXDOMAIN', not_implemented: 'NOTIMP', refused: 'REFUSED' };
			let hasFakeIPServer = false;

			if (Array.isArray(dns.servers)) {
				const migratedServers = [];
				for (const originalServer of dns.servers) {
					if (!originalServer || typeof originalServer !== 'object' || Array.isArray(originalServer)) {
						migratedServers.push(originalServer);
						continue;
					}

					const server = { ...originalServer };
					let parsedAddress = null, parsedRCode = '', rawAddress = typeof server.address === 'string' ? server.address.trim() : '';
					if (rawAddress) {
						const lowerAddress = rawAddress.toLowerCase();
						if (lowerAddress === 'fakeip') parsedAddress = { type: 'fakeip' };
						else if (lowerAddress === 'local') parsedAddress = { type: 'local' };
						else if (lowerAddress.startsWith('rcode://')) {
							parsedAddress = { type: 'rcode' };
							parsedRCode = rawAddress.slice('rcode://'.length).toLowerCase();
						}
						else if (lowerAddress.startsWith('dhcp://')) {
							const dhcpInterface = rawAddress.slice('dhcp://'.length);
							parsedAddress = dhcpInterface && dhcpInterface.toLowerCase() !== 'auto' ? { type: 'dhcp', interface: dhcpInterface } : { type: 'dhcp' };
						} else {
							try {
								const addressURL = new URL(rawAddress);
								const type = DNS地址协议类型[addressURL.protocol.toLowerCase()];
								if (type) {
									const parsedServer = addressURL.hostname?.startsWith('[') && addressURL.hostname.endsWith(']') ? addressURL.hostname.slice(1, -1) : addressURL.hostname;
									parsedAddress = {
										type,
										server: parsedServer || addressURL.host || rawAddress,
										...(addressURL.port ? { server_port: Number(addressURL.port) } : {}),
										...((type === 'https' || type === 'h3') && addressURL.pathname && addressURL.pathname !== '/dns-query' ? { path: addressURL.pathname } : {})
									};
								}
							} catch (_) { }
							if (!parsedAddress) parsedAddress = { type: 'udp', server: rawAddress };
						}
					}

					if (parsedAddress?.type === 'rcode') {
						const rcode = RCode映射[parsedRCode] || 'NOERROR';
						if (typeof server.tag === 'string' && server.tag) {
							rcodeServerMap.set(server.tag, rcode);
							rcodeServerMap.set(server.tag.startsWith('dns_') ? server.tag.slice(4) : `dns_${server.tag}`, rcode);
						}
						continue;
					}

					if (parsedAddress) {
						delete server.address;
						Object.assign(server, parsedAddress);
					}
					if (server.address_resolver !== undefined && server.domain_resolver === undefined) server.domain_resolver = server.address_resolver;
					if (server.address_strategy !== undefined && server.domain_strategy === undefined) server.domain_strategy = server.address_strategy;
					delete server.address_resolver;
					delete server.address_strategy;
					if (server.detour === 'DIRECT') delete server.detour;

					if (server.type === 'fakeip') {
						hasFakeIPServer = true;
						if (legacyFakeIP) {
							for (const key of ['inet4_range', 'inet6_range']) {
								if (legacyFakeIP[key] !== undefined && server[key] === undefined) server[key] = legacyFakeIP[key];
							}
						}
					}
					migratedServers.push(server);
				}
				dns.servers = migratedServers;
			}

			if (legacyFakeIP && !hasFakeIPServer && legacyFakeIP.enabled !== false) {
				const fakeIPServer = { type: 'fakeip', tag: 'fakeip' };
				for (const rule of Array.isArray(dns.rules) ? dns.rules : []) {
					const serverTag = 获取DNS规则服务器(rule);
					if (serverTag && serverTag.toLowerCase().includes('fakeip')) {
						fakeIPServer.tag = serverTag;
						break;
					}
				}
				for (const key of ['inet4_range', 'inet6_range']) {
					if (legacyFakeIP[key] !== undefined) fakeIPServer[key] = legacyFakeIP[key];
				}
				if (Array.isArray(dns.servers)) dns.servers.push(fakeIPServer);
				else dns.servers = [fakeIPServer];
			}

			if (Array.isArray(dns.rules)) {
				const migratedRules = [];
				for (const rule of dns.rules) {
					const serverTag = 获取DNS规则服务器(rule);
					const outbound = 数组化(rule?.outbound);
					const DNS路由选项字段 = new Set(['outbound', 'server', 'action', 'strategy', 'disable_cache', 'rewrite_ttl', 'client_subnet', 'timeout']);
					const isOutboundAnyDNSRule = rule && typeof rule === 'object' && !Array.isArray(rule) && rule.type !== 'logical'
						&& serverTag && outbound.includes('any') && Object.keys(rule).every(key => DNS路由选项字段.has(key));
					if (isOutboundAnyDNSRule) {
						const route = 确保Route();
						if (route.default_domain_resolver === undefined) {
							const resolver = { server: serverTag };
							for (const key of ['strategy', 'disable_cache', 'rewrite_ttl', 'client_subnet', 'timeout']) {
								if (rule[key] !== undefined) resolver[key] = rule[key];
							}
							route.default_domain_resolver = Object.keys(resolver).length === 1 ? resolver.server : resolver;
						}
						continue;
					}
					migratedRules.push(迁移DNS规则(rule, rcodeServerMap));
				}
				dns.rules = migratedRules;
			}

			delete dns.fakeip;
			delete dns.independent_cache;
		}

		if (config?.route && typeof config.route === 'object') {
			delete config.route.geoip;
			delete config.route.geosite;
		}
		if (config?.ntp?.detour === 'DIRECT') delete config.ntp.detour;

		if (Array.isArray(config.outbounds)) {
			const outboundTags = new Set(config.outbounds.map(outbound => outbound?.tag).filter(Boolean));
			const 引用REJECT = value => value === 'REJECT' || (value && typeof value === 'object' && (Array.isArray(value) ? value.some(引用REJECT) : Object.values(value).some(引用REJECT)));
			if (!outboundTags.has('REJECT') && 引用REJECT({ outbounds: config.outbounds, route: config.route })) config.outbounds.push({ type: 'block', tag: 'REJECT' });
		}


		if (uuid) {
			config.outbounds?.forEach(outbound => {

				if ((outbound.uuid && outbound.uuid === uuid) || (outbound.password && outbound.password === uuid)) {

					if (!outbound.tls || typeof outbound.tls !== 'object' || Array.isArray(outbound.tls)) outbound.tls = {};
					outbound.tls.enabled = true;


					if (fingerprint) {
						outbound.tls.utls = {
							enabled: true,
							fingerprint: fingerprint
						};
					}


					if (ECH启用) {
						outbound.tls.ech = {
							enabled: true,
							query_server_name: ECH_SNI,
							//config: `-----BEGIN ECH CONFIGS-----\n${ech_config}\n-----END ECH CONFIGS-----`
						};
					}
				}
			});
		}

		return JSON.stringify(config, null, 2);
	} catch (e) {
		debugError("Singbox hot patch failed:", e);
		return sb_json_text;
	}
}

function Surge订阅配置文件热补丁(content, url, config_JSON) {
	const 每行内容 = content.includes('\r\n') ? content.split('\r\n') : content.split('\n');
	const 完整节点路径 = config_JSON.随机路径 ? 随机路径(config_JSON.完整节点路径) : config_JSON.完整节点路径;
	let 输出内容 = "";
	for (let x of 每行内容) {
		if (x.includes('= tro' + 'jan,') && !x.includes('ws=true') && !x.includes('ws-path=')) {
			const sniMatch = x.match(/(?:^|,\s*)sni=([^,]+)/);
			if (!sniMatch) {
				输出内容 += x + '\n';
				continue;
			}
			const host = sniMatch[1];
			const 备改内容 = `sni=${host}, skip-cert-verify=${config_JSON.跳过证书验证}`;
			const 正确内容 = `sni=${host}, skip-cert-verify=${config_JSON.跳过证书验证}, ws=true, ws-path=${完整节点路径.replace(/,/g, '%2C')}, ws-headers=Host:"${host}"`;
			输出内容 += x.replace(new RegExp(备改内容, 'g'), 正确内容).replace("[", "").replace("]", "") + '\n';
		} else {
			输出内容 += x + '\n';
		}
	}

	const firstNewline = 输出内容.indexOf('\n');
	输出内容 = `#!MANAGED-CONFIG ${url} interval=${config_JSON.优选订阅生成.SUBUpdateTime * 60 * 60} strict=false`
		+ (firstNewline >= 0 ? 输出内容.substring(firstNewline) : '\n' + 输出内容);
	return 输出内容;
}

function clampRequestLogNumber(value, fallback, min, max) {
	const number = Number(value);
	if (!Number.isFinite(number)) return fallback;
	return Math.max(min, Math.min(max, Math.round(number)));
}

function getRequestLogReadLimit(env = {}, explicitLimit = null) {
	return clampRequestLogNumber(explicitLimit ?? env.LOG_READ_LIMIT, REQUEST_LOG_DEFAULT_READ_LIMIT, 1, REQUEST_LOG_MAX_READ_LIMIT);
}

function getRequestLogTtlSeconds(env = {}) {
	if (env.LOG_TTL_SECONDS !== undefined) {
		return clampRequestLogNumber(env.LOG_TTL_SECONDS, REQUEST_LOG_DEFAULT_TTL_SECONDS, REQUEST_LOG_MIN_TTL_SECONDS, REQUEST_LOG_MAX_TTL_SECONDS);
	}
	const days = clampRequestLogNumber(env.LOG_TTL_DAYS, REQUEST_LOG_DEFAULT_TTL_SECONDS / 86400, 1, REQUEST_LOG_MAX_TTL_SECONDS / 86400);
	return days * 86400;
}

function buildRequestLogEntryKey(timestamp = Date.now(), nonce = '') {
	const safeTimestamp = Math.max(0, Math.min(REQUEST_LOG_MAX_REVERSE_TIME, Math.floor(Number(timestamp) || Date.now())));
	const reverseTime = String(REQUEST_LOG_MAX_REVERSE_TIME - safeTimestamp).padStart(13, '0');
	const suffix = String(nonce || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`)
		.replace(/[^a-z0-9-]/gi, '')
		.slice(0, 64) || stableHashText(`${timestamp}|${Math.random()}`);
	return `${REQUEST_LOG_ENTRY_PREFIX}${reverseTime}:${suffix}`;
}

function buildRequestLogDedupeKey(logEntry) {
	return `${REQUEST_LOG_DEDUPE_PREFIX}${stableHashText([
		logEntry?.TYPE || '',
		logEntry?.IP || '',
		logEntry?.URL || '',
		logEntry?.UA || '',
	].join('|'))}`;
}

async function readLegacyRequestLogs(env = {}) {
	if (!env?.KV || typeof env.KV.get !== 'function') return [];
	try {
		const legacy = await env.KV.get(REQUEST_LOG_LEGACY_KEY);
		if (!legacy) return [];
		const parsed = JSON.parse(legacy);
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		debugError(`Failed to read legacy request logs: ${error.message}`);
		return [];
	}
}

async function readRequestLogs(env = {}, options = {}) {
	const limit = getRequestLogReadLimit(env, options.limit);
	if (!env?.KV) return [];
	if (typeof env.KV.list !== 'function' || typeof env.KV.get !== 'function') {
		return readLegacyRequestLogs(env);
	}

	const logs = [];
	let cursor;
	let kvOps = 0;
	let sawEntryKeys = false;
	try {
		do {
			if (kvOps >= REQUEST_LOG_KV_OPS_LIMIT || logs.length >= limit) break;
			const remainingOpsAfterList = Math.max(0, REQUEST_LOG_KV_OPS_LIMIT - kvOps - 1);
			if (!remainingOpsAfterList) break;
			const pageLimit = Math.min(REQUEST_LOG_MAX_READ_LIMIT, remainingOpsAfterList, Math.max(1, limit - logs.length));
			kvOps++;
			const page = await env.KV.list({ prefix: REQUEST_LOG_ENTRY_PREFIX, limit: pageLimit, cursor });
			const keys = Array.isArray(page?.keys) ? page.keys : [];
			if (keys.length) sawEntryKeys = true;
			const values = [];
			const readableKeys = keys.slice(0, Math.min(keys.length, REQUEST_LOG_KV_OPS_LIMIT - kvOps, limit - logs.length));
			for (let i = 0; i < readableKeys.length;) {
				if (kvOps >= REQUEST_LOG_KV_OPS_LIMIT || logs.length + values.length >= limit) break;
				const batchSize = Math.min(REQUEST_LOG_KV_GET_BATCH_SIZE, REQUEST_LOG_KV_OPS_LIMIT - kvOps, limit - logs.length - values.length);
				if (batchSize <= 0) break;
				const batch = readableKeys.slice(i, i + batchSize);
				i += batchSize;
				kvOps += batch.length;
				const batchValues = await Promise.all(batch.map(async key => {
					try {
						const raw = await env.KV.get(key.name);
						if (!raw) return null;
						const parsed = JSON.parse(raw);
						return parsed && typeof parsed === 'object' ? parsed : null;
					} catch (error) {
						return null;
					}
				}));
				values.push(...batchValues);
			}
			for (const value of values) {
				if (value) logs.push(value);
				if (logs.length >= limit) break;
			}
			cursor = page?.cursor;
			if (page?.list_complete !== false || logs.length >= limit || kvOps >= REQUEST_LOG_KV_OPS_LIMIT) break;
		} while (cursor);
	} catch (error) {
		debugError(`Failed to read request logs: ${error.message}`);
	}

	return logs.length || sawEntryKeys ? logs : readLegacyRequestLogs(env);
}

async function writeRequestLogEntry(env = {}, logEntry, requestType = "Get_SUB", now = Date.now()) {
	if (!isKvRequestLoggingEnabled(env)) return false;
	if (!env?.KV || typeof env.KV.put !== 'function') return false;
	const entry = { ...logEntry, TIME: Number(logEntry?.TIME) || now };

	if (requestType !== "Get_SUB") {
		const dedupeKey = buildRequestLogDedupeKey(entry);
		if (typeof env.KV.get === 'function') {
			try {
				if (await env.KV.get(dedupeKey)) return false;
			} catch (error) {
				debugError(`Failed to read request log dedupe key: ${error.message}`);
			}
		}
		try {
			await env.KV.put(dedupeKey, String(entry.TIME), { expirationTtl: REQUEST_LOG_DEDUPE_TTL_SECONDS });
		} catch (error) {
			debugError(`Failed to write request log dedupe key: ${error.message}`);
		}
	}

	await env.KV.put(buildRequestLogEntryKey(entry.TIME), JSON.stringify(entry), { expirationTtl: getRequestLogTtlSeconds(env) });
	return true;
}

async function 请求日志记录(env, request, 访问IP, 请求类型 = "Get_SUB", config_JSON, 是否写入KV日志 = true) {
	try {
		const 当前时间 = new Date();
		const cf = request.cf || {};
		// Don't persist the subscription token (a long-lived, UUID-equivalent credential) verbatim into KV /
		// the admin operation log. Mask it so the log still shows a token was present without leaking it.
		let 记录URL = request.url;
		try {
			const u = new URL(request.url);
			if (u.searchParams.has('token')) { u.searchParams.set('token', '***'); 记录URL = u.toString(); }
		} catch (e) { }
		const 日志内容 = { TYPE: 请求类型, IP: 访问IP, ASN: `AS${cf.asn || '0'} ${cf.asOrganization || 'Unknown'}`, CC: `${cf.country || 'N/A'} ${cf.city || 'N/A'}`, URL: 记录URL, UA: request.headers.get('User-Agent') || 'Unknown', TIME: 当前时间.getTime() };
		if (config_JSON?.TG?.启用) {
			try {
				const TG_TXT = await env.KV.get('tg.json');
				const TG_JSON = JSON.parse(TG_TXT);
				if (TG_JSON?.BotToken && TG_JSON?.ChatID) {
					const 请求时间 = new Date(日志内容.TIME).toLocaleString('en-US', { timeZone: 'UTC' });
					const 请求URL = new URL(日志内容.URL);
					const msg = `<b>#${config_JSON.优选订阅生成.SUBNAME} log notification</b>\n\n` +
						`📌 <b>Type:</b> #${日志内容.TYPE}\n` +
						`🌐 <b>IP:</b> <code>${日志内容.IP}</code>\n` +
						`📍 <b>Location:</b> ${日志内容.CC}\n` +
						`🏢 <b>ASN:</b> ${日志内容.ASN}\n` +
						`🔗 <b>Domain:</b> <code>${请求URL.host}</code>\n` +
						`🔍 <b>Path:</b> <code>${请求URL.pathname + 请求URL.search}</code>\n` +
						`🤖 <b>UA:</b> <code>${日志内容.UA}</code>\n` +
						`📅 <b>Time:</b> ${请求时间} UTC\n` +
						`${config_JSON.CF.Usage.success ? `📊 <b>Request usage:</b> ${config_JSON.CF.Usage.total}/${config_JSON.CF.Usage.max} <b>${((config_JSON.CF.Usage.total / config_JSON.CF.Usage.max) * 100).toFixed(2)}%</b>\n` : ''}`;
					await fetch(`https://api.telegram.org/bot${TG_JSON.BotToken}/sendMessage?chat_id=${TG_JSON.ChatID}&parse_mode=HTML&text=${encodeURIComponent(msg)}`, {
						method: 'GET',
						headers: {
							'Accept': 'text/html,application/xhtml+xml,application/xml;',
							'Accept-Encoding': 'gzip, deflate, br',
							'User-Agent': 日志内容.UA || 'Unknown',
						}
					});
				}
			} catch (error) { debugError(`Failed to read tg.json: ${error.message}`) }
		}
		是否写入KV日志 = Boolean(是否写入KV日志) && isKvRequestLoggingEnabled(env);
		if (!是否写入KV日志) return;
		await writeRequestLogEntry(env, 日志内容, 请求类型, 当前时间.getTime());
	} catch (error) { debugError(`Failed to record log: ${error.message}`) }
}

function 掩码敏感信息(文本, 前缀长度 = 3, 后缀长度 = 2) {
	if (!文本 || typeof 文本 !== 'string') return 文本;
	if (文本.length <= 前缀长度 + 后缀长度) return 文本;

	const 前缀 = 文本.slice(0, 前缀长度);
	const 后缀 = 文本.slice(-后缀长度);
	const 星号数量 = 文本.length - 前缀长度 - 后缀长度;

	return `${前缀}${'*'.repeat(星号数量)}${后缀}`;
}

let md5SubtleSupported = null;

function toUint8ArrayView(data) {
	if (data instanceof Uint8Array) return data;
	if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	return textEncoder.encode(String(data ?? ''));
}

function md5BytesFallback(data) {
	const bytes = Array.from(toUint8ArrayView(data));
	const bitLenLow = (bytes.length * 8) >>> 0;
	const bitLenHigh = Math.floor((bytes.length * 8) / 0x100000000) >>> 0;
	bytes.push(0x80);
	while (bytes.length % 64 !== 56) bytes.push(0);
	for (let i = 0; i < 4; i++) bytes.push((bitLenLow >>> (8 * i)) & 0xff);
	for (let i = 0; i < 4; i++) bytes.push((bitLenHigh >>> (8 * i)) & 0xff);

	let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
	const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
	const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);
	const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;

	for (let offset = 0; offset < bytes.length; offset += 64) {
		const m = [];
		for (let i = 0; i < 16; i++) {
			const base = offset + i * 4;
			m[i] = (bytes[base] | (bytes[base + 1] << 8) | (bytes[base + 2] << 16) | (bytes[base + 3] << 24)) >>> 0;
		}
		let a = a0, b = b0, c = c0, d = d0;
		for (let i = 0; i < 64; i++) {
			let f, g;
			if (i < 16) { f = (b & c) | (~b & d); g = i; }
			else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
			else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
			else { f = c ^ (b | ~d); g = (7 * i) % 16; }
			const nextD = d;
			d = c;
			c = b;
			b = (b + rotl((a + f + k[i] + m[g]) >>> 0, s[i])) >>> 0;
			a = nextD;
		}
		a0 = (a0 + a) >>> 0;
		b0 = (b0 + b) >>> 0;
		c0 = (c0 + c) >>> 0;
		d0 = (d0 + d) >>> 0;
	}

	const out = new Uint8Array(16);
	const writeWord = (offset, word) => {
		out[offset] = word & 0xff;
		out[offset + 1] = (word >>> 8) & 0xff;
		out[offset + 2] = (word >>> 16) & 0xff;
		out[offset + 3] = (word >>> 24) & 0xff;
	};
	writeWord(0, a0);
	writeWord(4, b0);
	writeWord(8, c0);
	writeWord(12, d0);
	return out;
}

function bytesToHex(bytes) {
	return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('').toLowerCase();
}

function md5HexFallback(文本) {
	return bytesToHex(md5BytesFallback(String(文本 || '')));
}

async function md5Bytes(data) {
	const bytes = toUint8ArrayView(data);
	if (md5SubtleSupported !== false) {
		try {
			const 哈希 = await crypto.subtle.digest('MD5', bytes);
			md5SubtleSupported = true;
			return new Uint8Array(哈希);
		} catch (error) {
			md5SubtleSupported = false;
		}
	}
	return md5BytesFallback(bytes);
}

async function md5Hex(文本) {
	try {
		return bytesToHex(await md5Bytes(String(文本 ?? '')));
	} catch (error) {
		return md5HexFallback(文本).toLowerCase();
	}
}

async function MD5MD5(文本) {
	const cacheKey = String(文本);
	const cached = getLruCacheValue(MD5MD5_RESULT_CACHE, cacheKey);
	if (cached !== undefined) return cached;
	const resultPromise = (async () => {
		const 第一次十六进制 = await md5Hex(cacheKey);
		return (await md5Hex(第一次十六进制.slice(7, 27))).toLowerCase();
	})();
	setLruCacheValue(MD5MD5_RESULT_CACHE, cacheKey, resultPromise, HASH_CACHE_MAX_ENTRIES);
	try {
		return await resultPromise;
	} catch (error) {
		if (MD5MD5_RESULT_CACHE.get(cacheKey) === resultPromise) MD5MD5_RESULT_CACHE.delete(cacheKey);
		throw error;
	}
}

function 随机路径(完整节点路径 = "/") {
	const 常用路径目录 = ["about", "account", "acg", "act", "activity", "ad", "ads", "ajax", "album", "albums", "anime", "api", "app", "apps", "archive", "archives", "article", "articles", "ask", "auth", "avatar", "bbs", "bd", "blog", "blogs", "book", "books", "bt", "buy", "cart", "category", "categories", "cb", "channel", "channels", "chat", "china", "city", "class", "classify", "clip", "clips", "club", "cn", "code", "collect", "collection", "comic", "comics", "community", "company", "config", "contact", "content", "course", "courses", "cp", "data", "detail", "details", "dh", "directory", "discount", "discuss", "dl", "dload", "doc", "docs", "document", "documents", "doujin", "download", "downloads", "drama", "edu", "en", "ep", "episode", "episodes", "event", "events", "f", "faq", "favorite", "favourites", "favs", "feedback", "file", "files", "film", "films", "forum", "forums", "friend", "friends", "game", "games", "gif", "go", "go.html", "go.php", "group", "groups", "help", "home", "hot", "htm", "html", "image", "images", "img", "index", "info", "intro", "item", "items", "ja", "jp", "jump", "jump.html", "jump.php", "jumping", "knowledge", "lang", "lesson", "lessons", "lib", "library", "link", "links", "list", "live", "lives", "m", "mag", "magnet", "mall", "manhua", "map", "member", "members", "message", "messages", "mobile", "movie", "movies", "music", "my", "new", "news", "note", "novel", "novels", "online", "order", "out", "out.html", "out.php", "outbound", "p", "page", "pages", "pay", "payment", "pdf", "photo", "photos", "pic", "pics", "picture", "pictures", "play", "player", "playlist", "post", "posts", "product", "products", "program", "programs", "project", "qa", "question", "rank", "ranking", "read", "readme", "redirect", "redirect.html", "redirect.php", "reg", "register", "res", "resource", "retrieve", "sale", "search", "season", "seasons", "section", "seller", "series", "service", "services", "setting", "settings", "share", "shop", "show", "shows", "site", "soft", "sort", "source", "special", "star", "stars", "static", "stock", "store", "stream", "streaming", "streams", "student", "study", "tag", "tags", "task", "teacher", "team", "tech", "temp", "test", "thread", "tool", "tools", "topic", "topics", "torrent", "trade", "travel", "tv", "txt", "type", "u", "upload", "uploads", "url", "urls", "user", "users", "v", "version", "videos", "view", "vip", "vod", "watch", "web", "wenku", "wiki", "work", "www", "zh", "zh-cn", "zh-tw", "zip"];
	const 保留路径 = new Set(['admin', 'login', 'logout', 'sub', 'version', 'robots.txt', 'locations']);
	const 候选路径 = 常用路径目录.filter(item => !保留路径.has(item.toLowerCase()));
	const 随机数 = Math.floor(Math.random() * 3 + 1);
	const 已选择 = new Set();
	while (已选择.size < 随机数 && 已选择.size < 候选路径.length) {
		已选择.add(候选路径[Math.floor(Math.random() * 候选路径.length)]);
	}
	const 随机片段 = [...已选择].join('/');
	const [路径部分, 查询部分 = ''] = String(完整节点路径 || '/').split('?');
	const 规范路径 = ('/' + 路径部分).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
	const 输出路径 = 规范路径 === '/' ? `/${随机片段}` : `${规范路径}/${随机片段}`;
	return 查询部分 ? `${输出路径}?${查询部分}` : 输出路径;
}

function 替换星号为随机字符(内容) {
	if (typeof 内容 !== 'string' || !内容.includes('*')) return 内容;
	const 字符集 = 'abcdefghijklmnopqrstuvwxyz0123456789';
	return 内容.replace(/\*/g, () => {
		let s = '';
		for (let i = 0; i < Math.floor(Math.random() * 14) + 3; i++) s += 字符集[Math.floor(Math.random() * 字符集.length)];
		return s;
	});
}

function getSubscriptionRequestOptions(url, request, ua = '', asPreferredSubGenerator = false) {
	const searchParams = url?.searchParams || new URLSearchParams();
	const userAgent = String(ua || '').toLowerCase();
	const shouldBase64Subscription = searchParams.has('b64') || searchParams.has('base64');
	const isSubConverterRequest = Boolean(
		request?.headers?.get?.('subconverter-request') ||
		request?.headers?.get?.('subconverter-version') ||
		userAgent.includes('subconverter') ||
		userAgent.includes('cf-workers-sub') ||
		asPreferredSubGenerator
	);
	const type = isSubConverterRequest
		? 'mixed'
		: searchParams.has('target')
			? (searchParams.get('target') || 'mixed')
			: searchParams.has('clash') || userAgent.includes('clash') || userAgent.includes('meta') || userAgent.includes('mihomo')
				? 'clash'
				: searchParams.has('sb') || searchParams.has('singbox') || userAgent.includes('singbox') || userAgent.includes('sing-box')
					? 'singbox'
					: searchParams.has('surge') || userAgent.includes('surge')
						? 'surge&ver=4'
						: searchParams.has('quanx') || userAgent.includes('quantumult')
							? 'quanx'
							: searchParams.has('loon') || userAgent.includes('loon')
								? 'loon'
								: 'mixed';
	return { type, isSubConverterRequest, shouldBase64Subscription };
}

function getSubscriptionReplacementHosts(config = {}) {
	const source = Array.isArray(config.HOSTS) ? config.HOSTS : [config.HOST];
	const hosts = source
		.map(host => String(host || '').trim())
		.filter(Boolean);
	return hosts.length ? hosts : ['example.com'];
}

function createSubscriptionHostPicker(config = {}) {
	const hosts = [...getSubscriptionReplacementHosts(config)].sort(() => Math.random() - 0.5);
	let index = 0;
	return () => 替换星号为随机字符(hosts[index++ % hosts.length]);
}

function replaceGeneratedHostPlaceholders(line, host) {
	const encodedHost = encodeURIComponent(host);
	return String(line || '')
		.replace(/(^|[?&;,])((?:host|sni|authority)=)example\.com(?=([?&;,#]|\r?$))/gi, (_, prefix, field) => `${prefix}${field}${host}`)
		.replace(/((?:host|sni|authority)%3D)example\.com(?=($|%26|%3B|%2C|%23|&|;|,|#))/gi, (_, field) => `${field}${encodedHost}`)
		.replace(/^(\s*(?:servername|sni|server_name|authority)\s*:\s*)example\.com(\s*(?:#.*)?)$/i, (_, prefix, suffix) => `${prefix}${host}${suffix}`)
		.replace(/^(\s*Host\s*:\s*)example\.com(\s*(?:#.*)?)$/i, (_, prefix, suffix) => `${prefix}${host}${suffix}`)
		.replace(/("(?:server_name|servername|sni|authority|Host)"\s*:\s*")example\.com(")/g, (_, prefix, suffix) => `${prefix}${host}${suffix}`);
}

function finalizeJsonSubscriptionValue(value, uuid, hostPicker, inheritedHost = null) {
	if (Array.isArray(value)) return value.map(item => finalizeJsonSubscriptionValue(item, uuid, hostPicker, null));
	if (!value || typeof value !== 'object') {
		if (typeof value === 'string') {
			return value
				.replace(/00000000-0000-4000-8000-000000000000/g, uuid)
				.replace(/MDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAw/g, btoa(uuid));
		}
		return value;
	}

	const isGenerated = value.uuid === '00000000-0000-4000-8000-000000000000' || value.password === '00000000-0000-4000-8000-000000000000';
	const host = isGenerated ? (inheritedHost || hostPicker()) : inheritedHost;
	const output = {};
	for (const [key, raw] of Object.entries(value)) {
		let nextValue = finalizeJsonSubscriptionValue(raw, uuid, hostPicker, host);
		if (host && typeof nextValue === 'string' && nextValue === 'example.com' && /^(server_name|servername|sni|authority|Host)$/i.test(key)) {
			nextValue = host;
		}
		output[key] = nextValue;
	}
	return output;
}

function finalizeSubscriptionContent(content, config = {}) {
	const uuid = String(config.UUID || '00000000-0000-4000-8000-000000000000');
	const placeholderUUID = '00000000-0000-4000-8000-000000000000';
	const placeholderUUIDBase64 = 'MDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAw';
	const hostPicker = createSubscriptionHostPicker(config);
	const source = String(content || '');
	const trimmed = source.trim();
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			return JSON.stringify(finalizeJsonSubscriptionValue(JSON.parse(source), uuid, hostPicker), null, 2);
		} catch (e) { }
	}
	const blockStartRegex = /^\s*-\s+(?:name:|\{)/;
	const blocks = [];
	let currentBlock = [];
	for (const part of source.split(/(\r?\n)/)) {
		if (part && part !== '\n' && part !== '\r\n' && blockStartRegex.test(part) && currentBlock.length > 0) {
			blocks.push(currentBlock);
			currentBlock = [];
		}
		currentBlock.push(part);
	}
	if (currentBlock.length > 0) blocks.push(currentBlock);

	return blocks.map(block => {
		const blockText = block.join('');
		const blockHost = (blockText.includes(placeholderUUID) || blockText.includes(placeholderUUIDBase64)) ? hostPicker() : null;
		return block.map(part => {
			if (!part || part === '\n' || part === '\r\n') return part;
			let line = part
				.replace(new RegExp(placeholderUUID, 'g'), uuid)
				.replace(new RegExp(placeholderUUIDBase64, 'g'), btoa(uuid));
			if (blockHost && line.includes('example.com')) line = replaceGeneratedHostPlaceholders(line, blockHost);
			return line;
		}).join('');
	}).join('');
}

function cloneDohAnswer(answer) {
	return {
		...answer,
		rdata: answer?.rdata instanceof Uint8Array ? new Uint8Array(answer.rdata) : answer?.rdata,
	};
}

function readDohCache(cacheKey, now = Date.now()) {
	const cached = getLruCacheValue(DNS_RESULT_CACHE, cacheKey);
	if (!cached || cached.expiresAt <= now) {
		if (cached) DNS_RESULT_CACHE.delete(cacheKey);
		return null;
	}
	return cached.answers.map(cloneDohAnswer);
}

function writeDohCache(cacheKey, answers, now = Date.now()) {
	const ttlValues = (answers || [])
		.map(answer => Number(answer?.TTL))
		.filter(ttl => Number.isFinite(ttl) && ttl >= 0) // include TTL 0 so an all-0 answer isn't floored to 30s
		.map(ttl => ttl * 1000);
	if (ttlValues.length && Math.min(...ttlValues) <= 0) return; // RFC 1035: a TTL-0 answer must not be cached
	const dnsTtlMs = ttlValues.length ? Math.min(...ttlValues) : DNS_RESULT_CACHE_MIN_TTL_MS;
	const ttlMs = Math.max(DNS_RESULT_CACHE_MIN_TTL_MS, Math.min(DNS_RESULT_CACHE_MAX_TTL_MS, dnsTtlMs));
	setLruCacheValue(DNS_RESULT_CACHE, cacheKey, {
		expiresAt: now + ttlMs,
		answers: (answers || []).map(cloneDohAnswer),
	}, DNS_RESULT_CACHE_MAX_ENTRIES);
}

function writeDohNegativeCache(cacheKey, now = Date.now()) {
	const ttlMs = Math.max(1000, Number(DNS_RESULT_NEGATIVE_TTL_MS) || 30 * 1000);
	setLruCacheValue(DNS_RESULT_CACHE, cacheKey, {
		expiresAt: now + ttlMs,
		answers: [],
		negative: true,
	}, DNS_RESULT_CACHE_MAX_ENTRIES);
}

function getDnsRcode(buf) {
	if (!buf || buf.byteLength < 4) return -1;
	return buf[3] & 0x0f;
}

function shouldNegativeCacheDnsResponse(buf, answers) {
	const rcode = getDnsRcode(buf);
	if (rcode === 3) return true; // NXDOMAIN.
	if (rcode === 0 && Array.isArray(answers) && answers.length === 0) return true; // NODATA.
	return false;
}

async function DoH查询(域名, 记录类型, DoH解析服务 = DEFAULT_DOH_LOOKUP_URL) {
	const 开始时间 = performance.now();
	const normalizedDomain = String(域名 || '').trim().toLowerCase();
	const normalizedType = String(记录类型 || 'A').trim().toUpperCase();
	const cacheKey = `${DoH解析服务}\n${normalizedType}\n${normalizedDomain}`;
	const cachedAnswers = readDohCache(cacheKey);
	if (cachedAnswers) return cachedAnswers;
	log(`[DoH lookup] Starting query for ${域名} ${记录类型} via ${DoH解析服务}`);
	try {

		const 类型映射 = { 'A': 1, 'NS': 2, 'CNAME': 5, 'MX': 15, 'TXT': 16, 'AAAA': 28, 'SRV': 33, 'HTTPS': 65 };
		const qtype = 类型映射[normalizedType] || 1;


		const 编码域名 = (name) => {
			const parts = name.endsWith('.') ? name.slice(0, -1).split('.') : name.split('.');
			const bufs = [];
			for (const label of parts) {
				const enc = new TextEncoder().encode(label);
				bufs.push(new Uint8Array([enc.length]), enc);
			}
			bufs.push(new Uint8Array([0]));
			const total = bufs.reduce((s, b) => s + b.length, 0);
			const result = new Uint8Array(total);
			let off = 0;
			for (const b of bufs) { result.set(b, off); off += b.length }
			return result;
		};


		const qname = 编码域名(normalizedDomain);
		const query = new Uint8Array(12 + qname.length + 4);
		const qview = new DataView(query.buffer);
		qview.setUint16(0, crypto.getRandomValues(new Uint16Array(1))[0]); // ID (random per RFC 1035)
		qview.setUint16(2, 0x0100);
		qview.setUint16(4, 1);       // QDCOUNT
		query.set(qname, 12);
		qview.setUint16(12 + qname.length, qtype);
		qview.setUint16(12 + qname.length + 2, 1); // QCLASS = IN


		log(`[DoH lookup] Sending query packet for ${域名} via ${DoH解析服务} (type=${qtype}, ${query.length} bytes)`);
		const response = await fetchWithTimeout(DoH解析服务, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/dns-message',
				'Accept': 'application/dns-message',
			},
			body: query,
		}, DOH_LOOKUP_TIMEOUT_MS);
		if (!response.ok) {
			try { response.body?.cancel() } catch (e) { }
			debugWarn(`[DoH lookup] Request failed for ${域名} ${记录类型} via ${DoH解析服务}; response code: ${response.status}`);
			return [];
		}


		if (Number(response.headers?.get?.('content-length') || 0) > 65535) { try { response.body?.cancel() } catch (e) { } log(`[DoH lookup] Declared response too large for ${域名} via ${DoH解析服务}`); return []; }
		const buf = new Uint8Array(await response.arrayBuffer());
		if (buf.byteLength > 65535) { log(`[DoH lookup] Response too large (${buf.byteLength}B) for ${域名} via ${DoH解析服务}`); return []; }
		const dv = new DataView(buf.buffer);
		const qdcount = dv.getUint16(4);
		const ancount = dv.getUint16(6);
		log(`[DoH lookup] Received response for ${域名} ${记录类型} via ${DoH解析服务} (${buf.length} bytes, ${ancount} answers)`);


		const 解析域名 = (pos) => {
			const labels = [];
			let p = pos, jumped = false, endPos = -1, safe = 128;
			while (p < buf.length && safe-- > 0) {
				const len = buf[p];
				if (len === 0) { if (!jumped) endPos = p + 1; break }
				if ((len & 0xC0) === 0xC0) {
					if (!jumped) endPos = p + 2;
					p = ((len & 0x3F) << 8) | buf[p + 1];
					jumped = true;
					continue;
				}
				labels.push(new TextDecoder().decode(buf.slice(p + 1, p + 1 + len)));
				p += len + 1;
			}
			if (endPos === -1) endPos = p + 1;
			return [labels.join('.'), endPos];
		};


		let offset = 12;
		for (let i = 0; i < qdcount; i++) {
			const [, end] = 解析域名(offset);
			offset = /** @type {number} */ (end) + 4;
		}


		const answers = [];
		for (let i = 0; i < ancount && offset < buf.length; i++) {
			const [name, nameEnd] = 解析域名(offset);
			offset = /** @type {number} */ (nameEnd);
			const type = dv.getUint16(offset); offset += 2;
			offset += 2; // CLASS
			const ttl = dv.getUint32(offset); offset += 4;
			const rdlen = dv.getUint16(offset); offset += 2;
			const rdata = buf.slice(offset, offset + rdlen);
			offset += rdlen;

			let data;
			if (type === 1 && rdlen === 4) {

				data = `${rdata[0]}.${rdata[1]}.${rdata[2]}.${rdata[3]}`;
			} else if (type === 28 && rdlen === 16) {

				const segs = [];
				for (let j = 0; j < 16; j += 2) segs.push(((rdata[j] << 8) | rdata[j + 1]).toString(16));
				data = segs.join(':');
			} else if (type === 16) {

				let tOff = 0;
				const parts = [];
				while (tOff < rdlen) {
					const tLen = rdata[tOff++];
					parts.push(new TextDecoder().decode(rdata.slice(tOff, tOff + tLen)));
					tOff += tLen;
				}
				data = parts.join('');
			} else if (type === 5) {

				const [cname] = 解析域名(offset - rdlen);
				data = cname;
			} else {
				data = Array.from(rdata).map(b => b.toString(16).padStart(2, '0')).join('');
			}
			answers.push({ name, type, TTL: ttl, data, rdata });
		}
		const 耗时 = (performance.now() - 开始时间).toFixed(2);
		log(`[DoH lookup] Query complete for ${域名} ${记录类型} via ${DoH解析服务} in ${耗时}ms with ${answers.length} results${answers.length > 0 ? '\n' + answers.map((a, i) => `  ${i + 1}. ${a.name} type=${a.type} TTL=${a.TTL} data=${a.data}`).join('\n') : ''}`);
		if (answers.length > 0) writeDohCache(cacheKey, answers);
		else if (shouldNegativeCacheDnsResponse(buf, answers)) writeDohNegativeCache(cacheKey);
		return answers;
	} catch (error) {
		const 耗时 = (performance.now() - 开始时间).toFixed(2);
		debugError(`[DoH lookup] Query failed for ${域名} ${记录类型} via ${DoH解析服务} after ${耗时}ms:`, error);
		return [];
	}
}

const ENGLISH_STATIC_PAGE_CACHE = new Map();
const ENGLISH_STATIC_PAGE_IN_FLIGHT = new Map();
const ENGLISH_STATIC_PAGE_CACHE_TTL_MS = 30 * 60 * 1000;
const ENGLISH_UI_TRANSLATIONS = [
	["\u6b63\u5728\u9a8c\u8bc1\u53ef\u7528\u6027\uff0c\u8bf7\u7a0d\u5019...","Checking availability. Please wait..."],
	["\u6b63\u5728\u9a8c\u8bc1\u53ef\u7528\u6027\uff0c\u8bf7\u7a0d\u5019\u2026","Checking availability. Please wait..."],
	["\u8bf7\u9009\u62e9\u4e00\u4e2a\u6709\u6548\u7684","Please select a valid "],
	["\u57df\u540d\u4e0d\u5339\u914d","Domain mismatch"],
	["\u53ef\u7528\u6027","availability"],
	["\u5f53\u65e5\u5fd7\u5927\u5c0f\u8d85\u8fc7\u8be5\u5bb9\u91cf\u4f1a\u81ea\u52a8\u6e05\u7406\u6700\u8001\u7684\u65e5\u5fd7\u8bb0\u5f55","When the log size exceeds this capacity, the oldest log records will be automatically cleared."],
	["\u6839\u636e\u8ba2\u9605\u65f6\u7684\u7f51\u7edc\u81ea\u52a8\u4e0b\u53d1\u5bf9\u5e94\u7f51\u7edc\u7684\u5b98\u65b9\u4f18\u9009","The official selection of the corresponding network is automatically issued based on the network at the time of subscription."],
	["\u8fd9\u5c31\u662f\u4e3a\u4ec0\u4e48\u5728\u4ee5\u4e0b\u573a\u666f\u4e2d\u7ecf\u5e38\u51fa\u73b0\u5f02\u5e38\u60c5\u51b5","This is why exceptions often occur in the following scenarios"],
	["\u901a\u8fc7\u963b\u65ad\u8282\u70b9\u57df\u540d\u7684\u8bbf\u95ee\u6765\u5e72\u6270\u4ee3\u7406\u8fde\u63a5","Interfering with proxy connections by blocking access to node domain names"],
	["\u5c06\u539f\u672c\u4f1a\u660e\u6587\u66b4\u9732\u7684\u57df\u540d\u4fe1\u606f\u4e00\u8d77\u52a0\u5bc6","Encrypt domain name information that would otherwise be exposed in plain text"],
	["\u60a8\u8bbf\u95ee\u6ca1\u6709\u88ab\u5c01\u7684\u56fd\u5916\u7ad9\u70b9\u6240\u4f7f\u7528\u7684","The one you use to access foreign sites that are not blocked"],
	["\u76ee\u6807\u7ad9\u770b\u5230\u7684\u901a\u5e38\u5c31\u662f\u65b0\u52a0\u5761\u9644\u8fd1\u7684","What you see at the target station is usually around Singapore."],
	["\u963b\u65ad\u4e86\u901a\u8fc7\u57df\u540d\u7cbe\u51c6\u5c01\u9501\u8282\u70b9\u7684\u624b\u6bb5","Blocking the means of accurately blocking nodes through domain names"],
	["\u60a8\u5f53\u524d\u8bbf\u95ee\u7ba1\u7406\u9762\u677f\u4f7f\u7528\u7684\u57df\u540d\u662f","The domain name you are currently using to access the management panel is"],
	["\u76ee\u6807\u7ad9\u770b\u5230\u7684\u662f\u8df3\u677f\u670d\u52a1\u5668\u5728\u8bbf\u95ee","What the target station sees is that the springboard server is accessing"],
	["\u5916\u90e8\u89c2\u5bdf\u5230\u7684\u57df\u540d\u5c06\u7edf\u4e00\u663e\u793a\u4e3a","Externally observed domain names will be uniformly displayed as"],
	["\u662f\u5426\u5728\u66f4\u65b0\u8ba2\u9605\u65f6\u8986\u76d6\u4e86\u539f\u6709\u7684","Whether the original one is overwritten when updating the subscription"],
	["\u7531\u4e8e\u8fd9\u79cd\u963b\u65ad\u5927\u591a\u662f\u81ea\u52a8\u5316\u7b56\u7565","Since most of this blocking is an automated strategy"],
	["\u8def\u5f84\u6a21\u677f\u4e2d\u5fc5\u987b\u5b58\u5728\u8def\u5f84\u5360\u4f4d\u7b26","Path placeholder must be present in path template"],
	["\u8fc7\u4e00\u6bb5\u65f6\u95f4\u8282\u70b9\u53c8\u53ef\u80fd\u6062\u590d\u6b63\u5e38","After a while, the node may return to normal."],
	["\u5e26\u6765\u8f83\u9ad8\u7684\u5c01\u9501\u6210\u672c\u548c\u526f\u4f5c\u7528","bring higher blockade costs and side effects"],
	["\u5e76\u4e14\u77e5\u9053\u4f60\u8fde\u63a5\u7684\u662f\u54ea\u4e2a\u57df\u540d","And know which domain name you are connecting to"],
	["\u6d41\u91cf\u6570\u636e\u672c\u8eab\u4f9d\u65e7\u662f\u52a0\u5bc6\u4f20\u8f93","The traffic data itself is still encrypted for transmission"],
	["\u81f3\u5c11\u5728\u76ee\u524d\u9636\u6bb5\u4ecd\u7136\u975e\u5e38\u6709\u6548","At least at this stage it is still very effective"],
	["\u91cd\u7f6e\u914d\u7f6e\u5c06\u4f1a\u521d\u59cb\u5316\u6240\u6709\u8bbe\u7f6e","Resetting the configuration will initialize all settings"],
	["\u4ee5\u83b7\u5f97\u66f4\u597d\u7684\u6027\u80fd\u548c\u517c\u5bb9\u6027","for better performance and compatibility"],
	["\u4f60\u5f53\u524d\u9879\u76ee\u7684\u5df2\u88ab\u5899\u7684\u57df\u540d","The blocked domain name of your current project"],
	["\u5176\u539f\u56e0\u5e76\u4e0d\u662f\u8282\u70b9\u771f\u7684\u5931\u6548","The reason is not that the node really fails"],
	["\u53ca\u540e\u7eed\u7248\u672c\u5c06\u9646\u7eed\u505c\u6b62\u652f\u6301","and subsequent versions will gradually stop supporting"],
	["\u5982\u679c\u8282\u70b9\u53ef\u4ee5\u6b63\u5e38\u8fde\u63a5\u4f7f\u7528","If the node can be connected and used normally"],
	["\u63a5\u53e3\u8fd4\u56de\u7ed3\u679c\u5c06\u663e\u793a\u5728\u8fd9\u91cc","The result returned by the interface will be displayed here"],
	["\u65e0\u6cd5\u770b\u5230\u4f60\u8bbf\u95ee\u7684\u5177\u4f53\u5185\u5bb9","Can't see the specific content you visited"],
	["\u76f4\u63a5\u4f7f\u7528\u5927\u4f6c\u4f18\u9009\u597d\u7684\u7ed3\u679c","Directly use the best results selected by the boss"],
	["\u8bf7\u5148\u786e\u8ba4\u90e8\u7f72\u73af\u5883\u6ee1\u8db3\u8981\u6c42","Please first confirm that the deployment environment meets the requirements"],
	["\u8fd9\u610f\u5473\u7740\u751f\u6210\u7684\u8ba2\u9605\u914d\u7f6e\u5c06","This means that the generated subscription configuration will"],
	["\u4ecd\u7136\u4f1a\u66b4\u9732\u4e00\u4e2a\u5173\u952e\u4fe1\u606f","still exposes a key piece of information"],
	["\u4f7f\u7528\u8282\u70b9\u7684\u4f2a\u88c5\u57df\u540d\u89e3\u6790","Using node's masquerade domain name resolution"],
	["\u5730\u5740\u9700\u8981\u7528\u4e2d\u62ec\u53f7\u62ec\u8d77\u6765","The address needs to be enclosed in brackets"],
	["\u5bf9\u94fe\u8def\u7684\u5c01\u88c5\u4e0e\u4f2a\u88c5\u80fd\u529b","Link encapsulation and camouflage capabilities"],
	["\u5f53\u524d\u914d\u7f6e\u7684\u8282\u70b9\u4f2a\u88c5\u57df\u540d","Currently configured node camouflage domain name"],
	["\u60a8\u8bbf\u95ee\u56fd\u5185\u7ad9\u70b9\u6240\u4f7f\u7528\u7684","The one you use to access domestic sites"],
	["\u60a8\u8bbf\u95ee\u5899\u5916\u7ad9\u70b9\u6240\u4f7f\u7528\u7684","The one you use to access sites outside the wall"],
	["\u65e0\u6cd5\u83b7\u53d6\u771f\u5b9e\u7684\u8282\u70b9\u57df\u540d","Unable to obtain the real node domain name"],
	["\u7528\u4e8e\u79fb\u52a8\u7aef\u5e03\u5c40\u7684\u5360\u4f4d\u7b26","Placeholders for mobile layouts"],
	["\u771f\u5b9e\u88ab\u5899\u7684\u57df\u540d\u5df2\u88ab\u9690\u85cf","The real blocked domain name has been hidden"],
	["\u81ea\u5b9a\u4e49\u8ba2\u9605\u8f6c\u6362\u914d\u7f6e\u6587\u4ef6","Custom subscription conversion profile"],
	["\u867d\u7136\u4e0d\u77e5\u9053\u4f60\u5728\u8bbf\u95ee\u4ec0\u4e48","Although I don\u2019t know what you are visiting"],
	["\u4e0d\u8981\u8986\u76d6\u8ba2\u9605\u4e2d\u81ea\u5e26\u7684","Do not overwrite the ones that come with your subscription"],
	["\u5217\u8868\u4e2d\u9009\u62e9\u53ef\u7528\u7684\u4ee3\u7406","Select an available proxy from the list"],
	["\u5426\u5219\u8282\u70b9\u53ef\u80fd\u65e0\u6cd5\u8fde\u63a5","Otherwise the node may not be able to connect"],
	["\u5728\u6027\u80fd\u4e0d\u4f73\u7684\u8001\u8bbe\u5907\u4e0a","On older devices with poor performance"],
	["\u5982\u679c\u4f60\u5e0c\u671b\u4e86\u89e3\u66f4\u5b8c\u6574","If you want to know more completely"],
	["\u672a\u914d\u7f6e\u4e3a\u8282\u70b9\u4f2a\u88c5\u57df\u540d","Not configured as node camouflage domain name"],
	["\u786e\u5b9a\u662f\u5426\u5b8c\u5168\u91cd\u7f6e\u914d\u7f6e","Determine whether to completely reset the configuration"],
	["\u8ba2\u9605\u8f6c\u6362\u540e\u7aef\u8bbe\u7f6e\u5f39\u7a97","Subscription conversion backend settings pop-up window"],
	["\u8bf7\u8f93\u5165\u60a8\u7684\u7ba1\u7406\u5458\u5bc6\u7801","Please enter your administrator password"],
	["\u8df3\u8fc7\u8bc1\u4e66\u9a8c\u8bc1\u8b66\u544a\u5f39\u7a97","Skip certificate verification warning pop-up window"],
	["\u8f93\u5165\u8ba2\u9605\u8f6c\u6362\u540e\u7aef\u5730\u5740","Enter the subscription conversion backend address"],
	["\u4e3a\u4ec0\u4e48\u9700\u8981\u53cd\u4ee3\u6a21\u5f0f","Why we need anti-generation model"],
	["\u4f18\u9009\u8ba2\u9605\u751f\u6210\u5668\u793a\u4f8b","Preferred subscription generator example"],
	["\u4fdd\u5b58\u914d\u7f6e\u540e\u5373\u53ef\u751f\u6548","It will take effect after saving the configuration"],
	["\u5219\u5f00\u542f\u8be5\u529f\u80fd\u5c06\u5bfc\u81f4","then turning this feature on will result in"],
	["\u5b9e\u9645\u901a\u4fe1\u5185\u5bb9\u5df2\u7ecf\u88ab","The actual communication content has been"],
	["\u5c31\u662f\u8282\u70b9\u7684\u4f2a\u88c5\u57df\u540d","It is the disguised domain name of the node"],
	["\u6279\u91cf\u6d4b\u8bd5\u771f\u94fe\u63a5\u5ef6\u8fdf","Batch test real link delay"],
	["\u662f\u5426\u53ef\u7528\u9700\u81ea\u884c\u9a8c\u8bc1","Availability needs to be verified by yourself"],
	["\u6bcf\u65e5\u8bf7\u6c42\u6570\u91cd\u7f6e\u6e05\u96f6","The number of daily requests is reset to zero"],
	["\u7b56\u7565\u7ec4\u81ea\u52a8\u9009\u62e9\u8282\u70b9","Policy group automatically selects nodes"],
	["\u9700\u8981\u6c47\u805a\u7684\u8ba2\u9605\u5730\u5740","Subscription addresses that need to be aggregated"],
	["\u4e00\u884c\u4e00\u4e2a\u8282\u70b9\u57df\u540d","One node domain name per line"],
	["\u4e0d\u4f1a\u4f7f\u7528\u5f53\u524d\u57df\u540d","The current domain name will not be used"],
	["\u4e3a\u4e86\u907f\u514d\u8282\u70b9\u5931\u8054","In order to avoid node loss of connection"],
	["\u4eca\u65e5\u4f7f\u7528\u60c5\u51b5\u603b\u8ba1","Total usage today"],
	["\u504f\u6280\u672f\u7ec6\u8282\u7684\u8bf4\u660e","Explanation of technical details"],
	["\u52a0\u89e3\u5bc6\u901f\u5ea6\u4f1a\u53d8\u6162","Encryption and decryption speed will be slower"],
	["\u53ef\u4ee5\u907f\u514d\u57df\u540d\u963b\u65ad","Can avoid domain name blocking"],
	["\u5728\u7ebf\u4f18\u9009\u5168\u5c4f\u6a21\u5757","Online preferred full screen module"],
	["\u5728\u8282\u70b9\u5217\u8868\u4e2d\u67e5\u627e","Find in node list"],
	["\u5982\u679c\u51fa\u73b0\u4ee5\u4e0b\u60c5\u51b5","If the following situation occurs"],
	["\u5982\u679c\u8282\u70b9\u65e0\u6cd5\u8fde\u63a5","If the node cannot connect"],
	["\u5c31\u8fd1\u673a\u623f\u5904\u7406\u8bf7\u6c42","Handle requests in the nearest computer room"],
	["\u5e76\u5c1d\u8bd5\u8fde\u63a5\u8be5\u8282\u70b9","and try to connect to the node"],
	["\u5f53\u524d\u8ba2\u9605\u914d\u7f6e\u4e2d\u5df2","The current subscription configuration already contains"],
	["\u624d\u80fd\u9002\u914d\u8def\u5f84\u53cd\u4ee3","To adapt to path inversion"],
	["\u6807\u7b7e\u5c06\u663e\u793a\u5728\u8fd9\u91cc","Tags will appear here"],
	["\u6838\u5fc3\u5b89\u5168\u7b56\u7565\u8c03\u6574","Core security policy adjustments"],
	["\u6bcf\u884c\u8f93\u5165\u4e00\u4e2a\u57df\u540d","Enter one domain name per line"],
	["\u6bd4\u5982\u4f18\u9009\u5230\u65b0\u52a0\u5761","For example, it is best to go to Singapore"],
	["\u6bdb\u73bb\u7483\u6548\u679c\u906e\u76d6\u5c42","Frosted glass effect cover"],
	["\u6dfb\u52a0\u94fe\u5f0f\u4ee3\u7406\u8282\u70b9","Add chain proxy node"],
	["\u7684\u8282\u70b9\u8fdb\u884c\u4ee3\u7406\u65f6","When the node is acting as a proxy"],
	["\u7ad9\u70b9\u6240\u4f7f\u7528\u7684\u843d\u5730","The landing used by the site"],
	["\u7b49\u5f85\u52a0\u8f7d\u66f4\u65b0\u65e5\u5fd7","Waiting for update log to load"],
	["\u7b49\u5f85\u6e90\u7801\u6df7\u6dc6\u91cd\u7ec4","Waiting for source code obfuscation and reorganization"],
	["\u7b80\u5355\u4e14\u76f4\u89c2\u7684\u65b9\u6cd5","Simple and intuitive method"],
	["\u8282\u70b9\u4ecd\u7136\u65e0\u6cd5\u4f7f\u7528","Node is still unavailable"],
	["\u8ba2\u9605\u8f6c\u6362\u914d\u7f6e\u6587\u4ef6","Subscribe to conversion profiles"],
	["\u8bef\u4f24\u5927\u91cf\u6b63\u5e38\u4f7f\u7528","Accidental injury caused by normal use in large quantities"],
	["\u8bf7\u5728\u9ad8\u624b\u6a21\u5f0f\u4e0b\u7684","Please use it in master mode"],
	["\u8def\u5f84\u6a21\u677f\u914d\u7f6e\u5f39\u7a97","Path template configuration pop-up window"],
	["\u91cd\u7f6e\u914d\u7f6e\u786e\u8ba4\u5f39\u7a97","Reset configuration confirmation pop-up window"],
	["\u9700\u7b49\u5f85\u4e0a\u4e0b\u6e38\u66f4\u65b0","Need to wait for upstream and downstream updates"],
	["\u4e2d\u624b\u52a8\u586b\u5199\u4e00\u4e2a","Manually fill in one"],
	["\u4e3a\u4ec0\u4e48\u9700\u8981\u53cd\u4ee3","Why is counter-generation needed?"],
	["\u4e3a\u5f53\u524d\u57df\u540d\u5f00\u542f","Enable for current domain name"],
	["\u4e5f\u5c31\u662f\u8282\u70b9\u57df\u540d","That is, the node domain name"],
	["\u4ee3\u7406\u9a8c\u8bc1\u6a21\u6001\u6846","Agent verification modal box"],
	["\u4f18\u9009\u8ba2\u9605\u751f\u6210\u5668","Preferred subscription generator"],
	["\u4f1a\u5e26\u6765\u4ec0\u4e48\u95ee\u9898","What problems will it cause?"],
	["\u4f1a\u8ddf\u7740\u4ee3\u7406\u53d8\u5316","Will change with the agent"],
	["\u4f20\u8f93\u4e0e\u52a0\u5bc6\u8bf4\u660e","Transmission and Encryption Instructions"],
	["\u4f60\u6b63\u5728\u51c6\u5907\u5173\u95ed","you are preparing to close"],
	["\u4f7f\u7528\u9ed8\u8ba4\u5185\u7f6e\u7684","Use the default built-in"],
	["\u52a0\u5bc6\u5ba2\u6237\u7aef\u95ee\u5019","Encrypted client greeting"],
	["\u53ea\u8d1f\u8d23\u628a\u4f60\u5e26\u5230","I'm only responsible for bringing you there"],
	["\u53ef\u7528\u8bf7\u6c42\u6570\u7edf\u8ba1","Available request statistics"],
	["\u540e\u66f4\u65b0\u8ba2\u9605\u5373\u53ef","Just update your subscription later"],
	["\u5927\u91cf\u6d88\u8017\u8bf7\u6c42\u6570","Consuming a large number of requests"],
	["\u5982\u679c\u4f60\u7684\u5ba2\u6237\u7aef","If your client"],
	["\u5c06\u65e0\u6cd5\u7ee7\u7eed\u63a5\u6536","will no longer be able to receive"],
	["\u5c06\u65e0\u6cd5\u7ee7\u7eed\u7edf\u8ba1","Statistics will no longer be possible"],
	["\u5c0f\u65f6\u5185\u4e0d\u518d\u63d0\u793a","Don\u2019t prompt again within hours"],
	["\u5c0f\u767d\u63a8\u8350\u9009\u8fd9\u4e2a","Xiaobai recommends choosing this"],
	["\u5f02\u5e38\u6d41\u91cf\u5e76\u62e6\u622a","Abnormal traffic and interception"],
	["\u603b\u4f53\u767e\u5206\u6bd4\u6587\u5b57","overall percentage text"],
	["\u652f\u6301\u591a\u8d26\u53f7\u6c47\u603b","Support multiple account summary"],
	["\u652f\u6301\u591a\u8d26\u53f7\u7edf\u8ba1","Support multiple account statistics"],
	["\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500","This action is irreversible"],
	["\u7528\u4e8e\u5ba2\u6237\u7aef\u53d1\u8d77","For client initiated"],
	["\u7528\u4e8e\u8282\u70b9\u9a8c\u8bc1\u7684","used for node verification"],
	["\u7684\u5ba2\u6237\u7aef\u5747\u652f\u6301","All clients support"],
	["\u7ad9\u70b9\u7684\u6d41\u91cf\u4e5f\u8d70","The traffic of the site also goes"],
	["\u81ea\u5b9a\u4e49\u4f18\u9009\u5730\u5740","Custom preferred address"],
	["\u81ea\u5b9a\u4e49\u540e\u7aef\u5730\u5740","Custom backend address"],
	["\u81ea\u5b9a\u4e49\u57df\u540d\u5217\u8868","Custom domain name list"],
	["\u8282\u70b9\u7684\u4f2a\u88c5\u8def\u5f84","The camouflage path of the node"],
	["\u8bf7\u52a1\u5fc5\u8bbe\u7f6e\u6b64\u9879","Be sure to set this"],
	["\u8bf7\u786e\u8ba4\u4ee5\u4e0b\u4e09\u70b9","Please confirm the following three points"],
	["\u8bf7\u9009\u62e9\u7edf\u8ba1\u65b9\u6848","Please select a statistical plan"],
	["\u91cc\u6dfb\u52a0\u60a8\u7684\u57df\u540d","Add your domain name here"],
	["\u94fe\u5f0f\u4ee3\u7406\u6a21\u6001\u6846","Chained proxy modal box"],
	["\u9879\u76ee\u5206\u914d\u7684\u57df\u540d","Domain name assigned to the project"],
	["\u9879\u76ee\u5fc5\u987b\u90e8\u7f72\u5728","The project must be deployed in"],
	["\u4e0d\u80fd\u76f4\u63a5\u8bbf\u95ee","No direct access"],
	["\u4e3b\u9898\u5207\u6362\u6309\u94ae","Theme switch button"],
	["\u4ee3\u7406\u8d44\u6e90\u6765\u81ea","Agent resources come from"],
	["\u4f18\u9009\u8ba2\u9605\u6a21\u5f0f","Preferred subscription model"],
	["\u4f18\u9009\u8ba2\u9605\u751f\u6210","Preferred subscription generation"],
	["\u4f2a\u88c5\u57df\u540d\u5747\u4e3a","Disguised domain names are"],
	["\u4f7f\u7528\u7edf\u8ba1\u5361\u7247","Use stat cards"],
	["\u4f7f\u7528\u7edf\u8ba1\u6a21\u5757","Use statistics module"],
	["\u5168\u90e8\u65e0\u6cd5\u4f7f\u7528","All unavailable"],
	["\u5173\u95ed\u786e\u8ba4\u5f39\u7a97","Close confirmation popup"],
	["\u5176\u4ed6\u8282\u70b9\u793a\u4f8b","Other node examples"],
	["\u5185\u6838\u4f7f\u7528\u9ed8\u8ba4","The kernel uses the default"],
	["\u5185\u6838\u8fd0\u884c\u5931\u8d25","Kernel operation failed"],
	["\u6700\u7ec8\u6d41\u91cf\u4f1a\u4ee5","The final traffic will be"],
	["\u5207\u6362\u65e5\u95f4\u6a21\u5f0f","Switch day mode"],
	["\u529f\u80fd\u63d0\u793a\u5f39\u7a97","Function prompt pop-up window"],
	["\u5305\u62ec\u8ba2\u9605\u751f\u6210","Includes subscription generation"],
	["\u53cd\u4ee3\u843d\u5730\u8bbe\u7f6e","Anti-generation landing settings"],
	["\u53cd\u4ee3\u8d44\u6e90\u6765\u81ea","Anti-generation resources come from"],
	["\u53d1\u73b0\u76ee\u6807\u4e5f\u5728","Found the target is also there"],
	["\u53ef\u4ee5\u76f4\u63a5\u8bbf\u95ee","Can be accessed directly"],
	["\u53ef\u4ee5\u901a\u8fc7\u4e00\u4e2a","can be passed through a"],
	["\u542f\u7528\u5168\u5c40\u4ee3\u7406","Enable global proxy"],
	["\u542f\u7528\u81ea\u52a8\u83b7\u53d6","Enable automatic retrieval"],
	["\u57df\u540d\u914d\u7f6e\u63d0\u793a","Domain name configuration tips"],
	["\u591c\u95f4\u6a21\u5f0f\u663e\u793a","Night mode display"],
	["\u5927\u82f1\u767e\u79d1\u5168\u4e66","Encyclopedia Britannica"],
	["\u5982\u4f55\u5224\u65ad\u7ed3\u679c","How to judge the result"],
	["\u5ba2\u6237\u7aef\u4e13\u7528\u7684","Client-specific"],
	["\u5bf9\u5916\u4ec5\u663e\u793a\u4e3a","Externally it is only displayed as"],
	["\u5e2e\u52a9\u79d1\u666e\u5f39\u7a97","Help pop-up window"],
	["\u5ef6\u8fdf\u6d4b\u8bd5\u5361\u7247","Delay test card"],
	["\u5f00\u6e90\u6e38\u620f\u5f15\u64ce","Open source game engine"],
	["\u5f53\u524d\u4f60\u9009\u62e9\u4e86","Currently you have chosen"],
	["\u5f53\u524d\u7f51\u7edc\u4fe1\u606f","Current network information"],
	["\u5f53\u524d\u7f51\u9875\u57df\u540d","Current web page domain name"],
	["\u6216\u5ba2\u6237\u7aef\u7248\u672c","or client version"],
	["\u6240\u4ee5\u9700\u8981\u8df3\u677f","So we need a springboard"],
	["\u6240\u6709\u64cd\u4f5c\u65e5\u5fd7","All operation logs"],
	["\u6240\u6709\u8282\u70b9\u77ac\u95f4","All nodes instantly"],
	["\u6307\u5b9a\u4f18\u9009\u7aef\u53e3","Specify preferred port"],
	["\u652f\u6301\u6c47\u805a\u8ba2\u9605","Support aggregation subscription"],
	["\u65e0\u9700\u6dfb\u52a0\u9017\u53f7","No need to add comma"],
	["\u65e5\u5fd7\u67e5\u770b\u5f39\u7a97","Log view pop-up window"],
	["\u65e5\u95f4\u6a21\u5f0f\u663e\u793a","Day mode display"],
	["\u660e\u6587\u5f62\u6001\u4f20\u8f93","Transmission in plain text"],
	["\u662f\u5426\u5df2\u7ecf\u751f\u6548","Has it taken effect?"],
	["\u662f\u5426\u6b63\u5e38\u5de5\u4f5c","Is it working properly?"],
	["\u662f\u7531\u60a8\u68af\u5b50\u7684","It's up to you to ladder"],
	["\u66f4\u591a\u6d4b\u8bd5\u9879\u76ee","More test items"],
	["\u66f4\u65b0\u65e5\u5fd7\u5f39\u7a97","Update log popup"],
	["\u67e5\u770b\u6240\u6709\u65e5\u5fd7","View all logs"],
	["\u67e5\u770b\u64cd\u4f5c\u65e5\u5fd7","View operation log"],
	["\u67e5\u770b\u66f4\u65b0\u65e5\u5fd7","View changelog"],
	["\u68c0\u67e5\u63d0\u793a\u5f39\u7a97","Check the prompt pop-up window"],
	["\u6a21\u5757\u5316\u533a\u5757\u94fe","Modular blockchain"],
	["\u6bcf\u884c\u4e00\u4e2a\u5730\u5740","One address per line"],
	["\u6d88\u606f\u901a\u77e5\u8bbe\u7f6e","Message notification settings"],
	["\u6d88\u8017\u5c11\u901f\u5ea6\u5feb","Less consumption and faster speed"],
	["\u7248\u672c\u4fe1\u606f\u6c14\u6ce1","Version information bubble"],
	["\u7528\u6237\u6ce8\u610f\u4e8b\u9879","User precautions"],
	["\u767b\u5f55\u8bbe\u7f6e\u9875\u9762","Login settings page"],
	["\u7684\u4e00\u9879\u65b0\u7279\u6027","a new feature of"],
	["\u7684\u53d6\u820d\u4e0e\u7b56\u7565","trade-offs and strategies"],
	["\u7684\u6838\u5fc3\u4f5c\u7528\u662f","The core function of"],
	["\u7684\u7f51\u7ad9\u548c\u670d\u52a1","website and services"],
	["\u786e\u5b9a\u662f\u5426\u6e05\u9664","Confirm whether to clear"],
	["\u7ba1\u7406\u540e\u53f0\u5bb9\u5668","Manage backend containers"],
	["\u7ed3\u679c\u663e\u793a\u533a\u57df","Result display area"],
	["\u7f16\u8f91\u8ba2\u9605\u751f\u6210","Edit subscription generation"],
	["\u7f51\u7edc\u4fe1\u606f\u6a21\u5757","Network information module"],
	["\u8282\u70b9\u94fe\u63a5\u683c\u5f0f","Node link format"],
	["\u83b7\u53d6\u8282\u70b9\u94fe\u63a5","Get node link"],
	["\u8ba2\u9605\u8f6c\u6362\u540e\u7aef","Subscription conversion backend"],
	["\u8ba2\u9605\u8f6c\u6362\u914d\u7f6e","Subscription conversion configuration"],
	["\u8bc1\u4e66\u9a8c\u8bc1\u529f\u80fd","Certificate verification function"],
	["\u8be6\u7ec6\u914d\u7f6e\u4fe1\u606f","Detailed configuration information"],
	["\u8bf7\u6c42\u4f7f\u7528\u60c5\u51b5","Request usage"],
	["\u8bf7\u6c42\u65b9\u6848\u9009\u62e9","Request plan selection"],
	["\u8bf7\u6c42\u7edf\u8ba1\u65b9\u6848","Request statistics plan"],
	["\u8ddd\u79bb\u91cd\u7f6e\u8fd8\u6709","Still far from reset"],
	["\u8def\u5f84\u6a21\u677f\u914d\u7f6e","Path template configuration"],
	["\u8df3\u8fc7\u8bc1\u4e66\u9a8c\u8bc1","Skip certificate verification"],
	["\u8fd4\u56de\u9876\u90e8\u6309\u94ae","Back to top button"],
	["\u9009\u62e9\u76ee\u6807\u4ee3\u7406","Select target proxy"],
	["\u9009\u62e9\u76ee\u6807\u5730\u533a","Select target area"],
	["\u901a\u77e5\u53c2\u6570\u914d\u7f6e","Notification parameter configuration"],
	["\u901a\u77e5\u8bbe\u7f6e\u5f39\u7a97","Notification settings pop-up window"],
	["\u914d\u7f6e\u5b58\u5728\u95ee\u9898","There is a problem with the configuration"],
	["\u914d\u7f6e\u786e\u8ba4\u5f39\u7a97","Configuration confirmation pop-up window"],
	["\u914d\u7f6e\u8def\u5f84\u6a21\u677f","Configure path template"],
	["\u91cd\u65b0\u66f4\u65b0\u8ba2\u9605","Renew subscription"],
	["\u94fe\u5f0f\u4ee3\u7406\u534f\u8bae","chain proxy protocol"],
	["\u94fe\u5f0f\u4ee3\u7406\u5730\u5740","chain proxy address"],
	["\u968f\u673a\u4f18\u9009\u6570\u91cf","Randomly selected quantity"],
	["\u968f\u673a\u4f2a\u88c5\u8def\u5f84","random camouflage path"],
	["\u9a8c\u8bc1\u72b6\u6001\u63d0\u793a","Verification status prompt"],
	["\u9ed8\u8ba4\u7aef\u53e3\u8f93\u5165","Default port input"],
	["\u4e0d\u652f\u6301\u8df3\u8fc7","Skip is not supported"],
	["\u4e0d\u9700\u8981\u5148\u627e","No need to look for it first"],
	["\u4e3a\u4ec0\u4e48\u9700\u8981","why needed"],
	["\u4e8c\u7ef4\u7801\u5f39\u7a97","QR code pop-up window"],
	["\u4f18\u9009\u6a21\u6001\u6846","Preferred modal box"],
	["\u4f1a\u4e0d\u4f1a\u88ab\u5c01","Will it be blocked?"],
	["\u4f20\u8f93\u5c42\u52a0\u5bc6","transport layer encryption"],
	["\u4f46\u77e5\u9053\u4f60\u5728","But know you are there"],
	["\u4f46\u8282\u70b9\u4ecd\u7531","But the node is still composed of"],
	["\u4f7f\u7528\u7684\u4f18\u9009","Preferred to use"],
	["\u4fdd\u5b58\u5e76\u5e94\u7528","Save and apply"],
	["\u4fdd\u5b58\u914d\u7f6e\u540e","After saving the configuration"],
	["\u5361\u7247\u5c06\u901a\u8fc7","card will go through"],
	["\u53cd\u4ee3\u914d\u7f6e\u7b49","Anti-generation configuration, etc."],
	["\u53ef\u7528\u6027\u9a8c\u8bc1","Availability verification"],
	["\u53ef\u901a\u8fc7\u90e8\u7f72","Can be deployed via"],
	["\u5bc6\u7801\u5b66\u670d\u52a1","cryptography services"],
	["\u5c06\u4f18\u9009\u4f5c\u4e3a","will be preferred as"],
	["\u5df2\u6210\u529f\u751f\u6548","Successfully taken effect"],
	["\u5df2\u66f4\u65b0\u8ba2\u9605","Subscription updated"],
	["\u5e2e\u52a9\u6a21\u6001\u6846","Help modal box"],
	["\u5f53\u6211\u4eec\u4f7f\u7528","when we use"],
	["\u6211\u51c6\u5907\u597d\u4e86","I'm ready"],
	["\u6211\u60f3\u7b80\u5355\u70b9","I want it to be simple"],
	["\u6240\u4ee5\u53ea\u4fdd\u7559","So just keep"],
	["\u6253\u5f00\u8282\u70b9\u7684","open node"],
	["\u660e\u6587\u7684\u65b9\u5f0f","clear text method"],
	["\u6d4f\u89c8\u5668\u6307\u7eb9","browser fingerprint"],
	["\u767b\u5f55\u6846\u5bb9\u5668","Login box container"],
	["\u7684\u52a0\u5bc6\u65b9\u5f0f","encryption method"],
	["\u7684\u64cd\u4f5c\u65e5\u5fd7","Operation log"],
	["\u7684\u73af\u5883\u53d8\u91cf","environment variables"],
	["\u7684\u76f8\u5173\u4fe1\u606f","related information"],
	["\u7ad9\u70b9\u4e5f\u4f1a\u8d70","The site will also go"],
	["\u7b49\u5f00\u6e90\u793e\u533a","Waiting for the open source community"],
	["\u7ba1\u7406\u5458\u5bc6\u7801","Administrator password"],
	["\u7f16\u8f91\u6a21\u6001\u6846","Edit modal box"],
	["\u7f3a\u5c11\u5360\u4f4d\u7b26","Missing placeholder"],
	["\u80fd\u6301\u7eed\u591a\u4e45","how long can it last"],
	["\u81ea\u5b9a\u4e49\u57df\u540d","Custom domain name"],
	["\u81ea\u5b9a\u4e49\u8ba2\u9605","Custom subscription"],
	["\u81ea\u9002\u5e94\u8ba2\u9605","adaptive subscription"],
	["\u82e5\u5ba2\u6237\u7aef\u4e3a","If the client is"],
	["\u8868\u73b0\u901a\u5e38\u4e3a","The performance is usually"],
	["\u8bf7\u8c28\u614e\u64cd\u4f5c","Please operate with caution"],
	["\u8fd9\u4ece\u6e90\u5934\u4e0a","This is from the source"],
	["\u9009\u9879\u5361\u5185\u5bb9","Tab content"],
	["\u901a\u77e5\u914d\u7f6e\u540e","After notification configuration"],
	["\u901f\u5ea6\u4e0d\u4f1a\u6bd4","No faster than"],
	["\u9700\u642d\u914d\u8bbe\u7f6e","Requires matching settings"],
	["\u4e0a\u4f20\u90e8\u7f72","Upload deployment"],
	["\u4e0b\u8f7d\u6700\u65b0","Download the latest"],
	["\u4e0d\u518d\u5177\u5907","no longer possess"],
	["\u4e0d\u662f\u4f18\u9009","Not preferred"],
	["\u4e5f\u5c31\u662f\u8bf4","That is to say"],
	["\u4ec5\u53ef\u901a\u8fc7","Only available via"],
	["\u4ee3\u7406\u534f\u8bae","agency agreement"],
	["\u4ee3\u7406\u5730\u5740","proxy address"],
	["\u4ee4\u724c\u6743\u9650","Token permissions"],
	["\u4f18\u9009\u57df\u540d","Preferred domain names"],
	["\u4f18\u9009\u7aef\u53e3","preferred port"],
	["\u4f18\u9009\u8ba2\u9605","Preferred subscription"],
	["\u4f20\u8f93\u534f\u8bae","transport protocol"],
	["\u4f2a\u88c5\u57df\u540d","Disguise domain name"],
	["\u4f46\u8fd9\u6837\u4f1a","But this will"],
	["\u4f7f\u7528\u7684\u662f","used is"],
	["\u4fe1\u606f\u63d0\u793a","Information prompt"],
	["\u5168\u5c40\u4ee3\u7406","global agent"],
	["\u5168\u5c40\u8def\u5f84","global path"],
	["\u5168\u90e8\u65e5\u5fd7","All logs"],
	["\u5176\u4ed6\u4ee3\u7406","Other agents"],
	["\u6700\u65b0\u7248\u672c","latest version"],
	["\u5206\u6d41\u89c4\u5219","Diversion rules"],
	["\u5206\u7247\u529f\u80fd","Sharding function"],
	["\u5230\u526a\u8d34\u677f","to clipboard"],
	["\u529f\u80fd\u63d0\u793a","Function tips"],
	["\u52a0\u5bc6\u6570\u636e","Encrypt data"],
	["\u52a0\u5bc6\u65b9\u5f0f","Encryption method"],
	["\u52a8\u6001\u751f\u6210","Dynamically generated"],
	["\u5317\u4eac\u65f6\u95f4","Beijing time"],
	["\u53c2\u6570\u914d\u7f6e","Parameter configuration"],
	["\u53c8\u662f\u4ec0\u4e48","What is it again"],
	["\u53cd\u4ee3\u6a21\u5f0f","anti-generation model"],
	["\u53cd\u590d\u5faa\u73af","Repeated cycle"],
	["\u53d6\u6d88\u91cd\u7f6e","Cancel reset"],
	["\u53d8\u91cf\u540d\u79f0","variable name"],
	["\u53ef\u4ee5\u53c2\u8003","Can refer to"],
	["\u542f\u7528\u5206\u7247","Enable sharding"],
	["\u547d\u540d\u7a7a\u95f4","namespace"],
	["\u56fd\u5185\u6d4b\u8bd5","Domestic testing"],
	["\u56fd\u5916\u6d4b\u8bd5","Overseas testing"],
	["\u5728\u7ebf\u4f18\u9009","Online selection"],
	["\u5899\u5916\u6d4b\u8bd5","outside wall testing"],
	["\u590d\u5236\u6700\u65b0","Copy latest"],
	["\u590d\u5236\u8282\u70b9","Copy node"],
	["\u590d\u5236\u8ba2\u9605","Copy subscription"],
	["\u5916\u90e8\u8df3\u677f","external springboard"],
	["\u592a\u9633\u56fe\u6807","sun icon"],
	["\u5982\u4f55\u4f7f\u7528","How to use"],
	["\u5982\u4f55\u4fee\u6539","How to modify"],
	["\u5982\u4f55\u786e\u8ba4","How to confirm"],
	["\u59cb\u7ec8\u4f7f\u7528","always use"],
	["\u5b98\u65b9\u535a\u5ba2","Official blog"],
	["\u5b98\u65b9\u6587\u6863","Official documentation"],
	["\u5b9e\u9645\u843d\u5730","Actual implementation"],
	["\u5b9e\u9a8c\u6027\u8d28","experimental nature"],
	["\u5bb9\u6613\u8bef\u5224","Easy to misjudge"],
	["\u5c01\u53f7\u8b66\u544a","Account ban warning"],
	["\u5c0f\u767d\u52ff\u7528","Not for beginners"],
	["\u5c0f\u767d\u8bf4\u660e","Novice explanation"],
	["\u5e76\u53d1\u6a21\u5f0f","Concurrent mode"],
	["\u5f3a\u529b\u9a71\u52a8","Powerful drive"],
	["\u5f53\u524d\u7248\u672c","Current version"],
	["\u5f71\u54cd\u8303\u56f4","Scope of influence"],
	["\u6211\u5df2\u5f00\u542f","I have turned on"],
	["\u6211\u662f\u5c0f\u767d","I'm a novice"],
	["\u6211\u77e5\u9053\u4e86","I know"],
	["\u6240\u6709\u4f7f\u7528","All uses"],
	["\u6307\u7eb9\u4f2a\u88c5","Fingerprint camouflage"],
	["\u63a5\u53e3\u7ed3\u679c","Interface results"],
	["\u63a8\u8350\u4f7f\u7528","Recommended"],
	["\u63e1\u624b\u9636\u6bb5","handshake phase"],
	["\u652f\u6301\u7248\u672c","Supported version"],
	["\u6570\u636e\u5c06\u4ee5","The data will be"],
	["\u662f\u7531\u60a8\u7684","is yours"],
	["\u666e\u901a\u6a21\u5f0f","Normal mode"],
	["\u66f4\u65b0\u65e5\u5fd7","Change log"],
	["\u6708\u4eae\u56fe\u6807","moon icon"],
	["\u673a\u623f\u51b3\u5b9a","Computer room decision"],
	["\u6743\u9650\u5373\u53ef","Permission is enough"],
	["\u6807\u51c6\u8def\u5f84","standard path"],
	["\u6b63\u5728\u52a0\u8f7d","Loading"],
	["\u6d41\u52a8\u8d28\u62bc","Liquid pledge"],
	["\u6d88\u606f\u901a\u77e5","Message notification"],
	["\u6e05\u9664\u914d\u7f6e","clear configuration"],
	["\u6f0f\u7f51\u4e4b\u9c7c","A fish that slipped through the net"],
	["\u73af\u5883\u53d8\u91cf","environment variables"],
	["\u751f\u6210\u4e13\u5c5e","Generate exclusive"],
	["\u751f\u6210\u5f39\u7a97","Generate pop-up window"],
	["\u7528\u4e8e\u83b7\u53d6","used to get"],
	["\u7528\u4e8e\u89e3\u6790","for parsing"],
	["\u7684\u5ba2\u6237\u7aef","client"],
	["\u7684\u8bf7\u6c42\u6570","number of requests"],
	["\u76d1\u63a7\u7cfb\u7edf","Monitoring system"],
	["\u76f4\u63a5\u4f7f\u7528","Use directly"],
	["\u76f4\u63a5\u963b\u65ad","block directly"],
	["\u786e\u5b9a\u6e05\u9664","Confirm clear"],
	["\u786e\u5b9a\u91cd\u7f6e","Confirm reset"],
	["\u786e\u8ba4\u5f00\u542f","Confirm to open"],
	["\u79d1\u6280\u5927\u5b66","University of Science and Technology"],
	["\u7a7a\u95f4\u6709\u9650","Space is limited"],
	["\u7acb\u5373\u767b\u5f55","Log in now"],
	["\u7aef\u53e3\u4e0d\u5199","Port is not written"],
	["\u7ba1\u7406\u540e\u53f0","Management background"],
	["\u7c7b\u578b\u7aef\u53e3","Type port"],
	["\u7ee7\u7eed\u8bbf\u95ee","Continue to visit"],
	["\u7f16\u8f91\u8282\u70b9","Edit node"],
	["\u80cc\u666f\u5185\u5bb9","Background content"],
	["\u80cc\u666f\u8bf4\u660e","Background information"],
	["\u817e\u8baf\u56fd\u5bc6","Tencent National Secret"],
	["\u81ea\u52a8\u83b7\u53d6","Get automatically"],
	["\u81ea\u6170\u529f\u80fd","Masturbation function"],
	["\u81ea\u884c\u6d4b\u8bd5","Test it yourself"],
	["\u8282\u70b9\u4fe1\u606f","Node information"],
	["\u8282\u70b9\u534f\u8bae","node protocol"],
	["\u8282\u70b9\u540d\u79f0","Node name"],
	["\u8282\u70b9\u57df\u540d","Node domain name"],
	["\u82b1\u91cc\u80e1\u7b11","Laughter in flowers"],
	["\u83b7\u53d6\u5f53\u524d","Get current"],
	["\u83b7\u53d6\u66f4\u591a","Get more"],
	["\u89e3\u6790\u57df\u540d","Resolve domain names"],
	["\u8ba2\u9605\u540d\u79f0","Subscription name"],
	["\u8ba2\u9605\u63a5\u53e3","Subscription interface"],
	["\u8ba2\u9605\u94fe\u63a5","Subscription link"],
	["\u8bbf\u95ee\u8bbe\u7f6e","Access settings"],
	["\u8bf7\u6c42\u5df2\u88ab","The request has been"],
	["\u8bf7\u6c42\u65f6\u7684","at the time of request"],
	["\u8d26\u6237\u90ae\u7bb1","Account email"],
	["\u8fb9\u7f18\u8bc1\u4e66","edge certificate"],
	["\u8fd4\u56de\u9876\u90e8","Back to top"],
	["\u8fdb\u884c\u4fee\u6539","Make changes"],
	["\u8ffd\u52a0\u7ed3\u679c","Append results"],
	["\u9000\u51fa\u767b\u5f55","Log out"],
	["\u901a\u77e5\u8bbe\u7f6e","Notification settings"],
	["\u901a\u77e5\u914d\u7f6e","Notification configuration"],
	["\u914d\u5408\u4f7f\u7528","used together"],
	["\u914d\u7f6e\u9519\u8bef","Configuration error"],
	["\u91cd\u7f6e\u914d\u7f6e","Reset configuration"],
	["\u91cd\u8981\u66f4\u65b0","Important updates"],
	["\u94fe\u5f0f\u4ee3\u7406","chain proxy"],
	["\u968f\u673a\u4f18\u9009","Random selection"],
	["\u968f\u673a\u7aef\u53e3","random port"],
	["\u96c6\u56e2\u5b98\u7f51","Group official website"],
	["\u9700\u8981\u66f4\u65b0","Need to update"],
	["\u975e\u5e38\u7b80\u5355","very simple"],
	["\u9879\u76ee\u83b7\u53d6","Project acquisition"],
	["\u9884\u8bbe\u6a21\u677f","Default template"],
	["\u9a8c\u8bc1\u6b65\u9aa4","Verification steps"],
	["\u9ed8\u8ba4\u7aef\u53e3","Default port"],
	["\u4e13\u7528\u7684","dedicated"],
	["\u4e14\u5f00\u542f","and turn on"],
	["\u4e2d\u5173\u95ed","Medium close"],
	["\u4e8c\u7ef4\u7801","QR code"],
	["\u4ec0\u4e48\u662f","what is"],
	["\u4f20\u8f93\u5c42","transport layer"],
	["\u4f60\u8fde\u5230","You are connected to"],
	["\u51b3\u5b9a\u7684","decided"],
	["\u52a0\u8f7d\u4e2d","Loading"],
	["\u52fe\u9009\u6846","tick box"],
	["\u53d6\u51b3\u4e8e","depends on"],
	["\u53ea\u9700\u8981","Just need"],
	["\u53ef\u524d\u5f80","Available to"],
	["\u53ef\u7559\u7a7a","Can be left blank"],
	["\u53ef\u80fd\u88ab","may be"],
	["\u573a\u666f\u4e00","Scene one"],
	["\u573a\u666f\u4e8c","Scene 2"],
	["\u57df\u540d\u7684","domain name"],
	["\u5c0f\u706b\u7bad","little rocket"],
	["\u5df2\u5f00\u542f","Already turned on"],
	["\u5fc5\u987b\u662f","must be"],
	["\u60a8\u8bbf\u95ee","you visit"],
	["\u611b\u6599\u7406","Love cooking"],
	["\u6240\u9700\u7684","required"],
	["\u6284\u4f5c\u4e1a","Copy homework"],
	["\u6307\u5411\u7684","pointed"],
	["\u6309\u94ae\u7ec4","button group"],
	["\u65e5\u914d\u989d","daily quota"],
	["\u672a\u751f\u6548","Not effective"],
	["\u672a\u7ed1\u5b9a","Not bound"],
	["\u672a\u8bbe\u7f6e","not set"],
	["\u6765\u9a8c\u8bc1","to verify"],
	["\u7406\u8bba\u4e0a","Theoretically"],
	["\u7531\u4f18\u9009","by preferred"],
	["\u7684\u4f5c\u7528","role"],
	["\u7684\u5165\u53e3","entrance"],
	["\u7684\u57df\u540d","domain name"],
	["\u7684\u8282\u70b9","node"],
	["\u81ea\u5b9a\u4e49","Customize"],
	["\u8bbf\u95ee\u975e","access non"],
	["\u8be5\u57df\u540d","the domain name"],
	["\u8bef\u5224\u4e3a","Misjudged as"],
	["\u8bf7\u524d\u5f80","Please go to"],
	["\u8bf7\u68c0\u67e5","please check"],
	["\u8bf7\u7a0d\u5019","please wait"],
	["\u8bf7\u7ed1\u5b9a","Please bind"],
	["\u8bf7\u8bbe\u7f6e","Please set"],
	["\u8bf7\u8f93\u5165","Please enter"],
	["\u8fd0\u8425\u5546","Operator"],
	["\u8fdb\u5ea6\u6761","progress bar"],
	["\u9009\u9879\u5361","tab"],
	["\u914d\u7f6e\u540e","After configuration"],
	["\u9ed8\u8ba4\u4e3a","Default is"],
	["\u4e0d\u662f","No"],
	["\u4e2d\u592e","central"],
	["\u4e86\u89e3","Understand"],
	["\u4ee3\u7406"," proxy"],
	["\u4f18\u9009","preferred"],
	["\u4f20\u8f93","transmission"],
	["\u4f46\u5728","But in"],
	["\u4f5c\u4e3a","as"],
	["\u4f7f\u7528","Use"],
	["\u4f8b\u5982","For example"],
	["\u4fdd\u5b58","save"],
	["\u5173\u4e8e","About"],
	["\u5173\u95ed","close"],
	["\u5185\u6838","Kernel"],
	["\u5185\u7f6e","Built-in"],
	["\u6700\u591a","most"],
	["\u51b3\u5b9a","decide"],
	["\u51fa\u53e3","export"],
	["\u5217\u8868","list"],
	["\u529f\u80fd","Function"],
	["\u52a0\u5bc6","Encryption"],
	["\u5373\u53ef","That\u2019s it"],
	["\u53d6\u6d88","Cancel"],
	["\u53ea\u9700","Just"],
	["\u53ef\u9009","Optional"],
	["\u542f\u7528","enable"],
	["\u56e0\u4e3a","because"],
	["\u56e0\u6b64","Therefore"],
	["\u56fd\u5185","Domestic"],
	["\u5730\u5740","address"],
	["\u57df\u540d","domain name"],
	["\u5907\u6ce8","Remarks"],
	["\u5927\u4f6c","Boss"],
	["\u5c06\u975e","will not"],
	["\u5c0f\u65f6","hours"],
	["\u5df2\u9009","Selected"],
	["\u5e76\u975e","Not"],
	["\u5efa\u8bae","Suggestions"],
	["\u5f00\u542f","turn on"],
	["\u5f39\u7a97","Pop-up window"],
	["\u603b\u7ed3","Summary"],
	["\u6276\u5899","Support the wall"],
	["\u63a2\u7d22","Explore"],
	["\u63a8\u7279","Twitter"],
	["\u652f\u6301","support"],
	["\u65b9\u6848","Plan"],
	["\u66f4\u5feb","faster"],
	["\u670d\u52a1","service"],
	["\u6839\u636e","According to"],
	["\u6a21\u5757","module"],
	["\u6a21\u5f0f","mode"],
	["\u6cb9\u7ba1","oil pipe"],
	["\u6ce8\u610f","Note"],
	["\u6dfb\u52a0","add"],
	["\u6e05\u9664","Clear"],
	["\u6e90\u7801","Source code"],
	["\u7248\u672c","Version"],
	["\u73b0\u8c61","phenomenon"],
	["\u7528\u6765","used for"],
	["\u786e\u5b9a","OK"],
	["\u793a\u4f8b","Example"],
	["\u7ad9\u70b9","site"],
	["\u7aef\u53e3","port"],
	["\u7eff\u8272","green"],
	["\u7f51\u7edc","network"],
	["\u800c\u662f","Rather"],
	["\u81ea\u5df1","myself"],
	["\u81ea\u5e26","Bring your own"],
	["\u843d\u5730","landing"],
	["\u84dd\u8272","blue"],
	["\u8ba2\u9605","Subscribe"],
	["\u8bbe\u7f6e","settings"],
	["\u8bbf\u95ee","visit"],
	["\u8bc6\u522b","identify"],
	["\u8be6\u60c5","Details"],
	["\u8bf4\u660e","Description"],
	["\u8bf7\u6c42","Request"],
	["\u8c37\u6b4c","Google"],
	["\u8def\u5f84","path"],
	["\u8f93\u5165","input"],
	["\u8fd9\u662f","This is"],
	["\u8ffd\u52a0","Append"],
	["\u901a\u77e5","Notification"],
	["\u914d\u7f6e","Configuration"],
	["\u91cd\u7f6e","reset"],
	["\u94fe\u63a5","link"],
	["\u963f\u91cc","Ali"],
	["\u9700\u8981","need"],
	["\u9762\u677f","panel"],
	["\u9891\u9053","channel"],
	["\u4e2a","a"],
	["\u4e3a","for"],
	["\u4ece","from"],
	["\u5206","points"],
	["\u524d","before"],
	["\u540e","after"],
	["\u548c","and"],
	["\u5728","in"],
	["\u5982","Such as"],
	["\u5c06","will"],
	["\u5e2e","help"],
	["\u6216","or"],
	["\u65f6","time"],
	["\u662f","Yes"],
	["\u7531","by"],
	["\u7684","of"],
	["\u79d2","seconds"],
	["\u7a33","stable"],
	["\u7b49","Wait"],
	["\u800c","And"],
	["\u975e","Not"],
];
const ENGLISH_UI_TRANSLATION_MAP = new Map(ENGLISH_UI_TRANSLATIONS);
const ENGLISH_UI_TRANSLATION_PATTERN = ENGLISH_UI_TRANSLATIONS.length
	? new RegExp(ENGLISH_UI_TRANSLATIONS.map(([from]) => escapeRegExp(from)).sort((a, b) => b.length - a.length).join('|'), 'g')
	: null;

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translateUIText(value) {
	if (!value || !/[\u3400-\u9fff\uf900-\ufaff]/.test(value)) return value;
	let output = value;
	if (ENGLISH_UI_TRANSLATION_PATTERN) {
		output = output.replace(ENGLISH_UI_TRANSLATION_PATTERN, match => ENGLISH_UI_TRANSLATION_MAP.get(match) || match);
	}
	return output.replace(/[\u3400-\u9fff\uf900-\ufaff]+/g, '').replace(/[ \t]{2,}/g, ' ').trim();
}

function translateSafeTagAttributes(tag) {
	return tag.replace(/\s(placeholder|title|aria-label|aria-description|alt|data-title|data-label|data-tip|data-tooltip|data-bs-title|data-original-title)=(["'])([\s\S]*?)\2/gi, (match, name, quote, value) => {
		return ` ${name}=${quote}${translateUIText(value)}${quote}`;
	});
}

function translateHTMLChunk(chunk) {
	return chunk.split(/(<[^>]+>)/g).map(part => {
		if (!part) return part;
		if (/^<!--/.test(part)) return '';
		if (part[0] === '<') return translateSafeTagAttributes(part);
		return translateUIText(part);
	}).join('');
}

function translateHTMLVisibleText(html) {
	return html
		.replace(/<html\b([^>]*)lang=(["'])zh-CN\2/gi, '<html$1lang="en"')
		.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/gi)
		.map(part => /^<(script|style)\b/i.test(part) ? part : translateHTMLChunk(part))
		.join('');
}

function unicodeEscapeScriptText(value) {
	return value.replace(/[<>&\u007f-\uffff]/g, char => {
		const code = char.charCodeAt(0).toString(16).padStart(4, '0');
		return '\\u' + code;
	});
}

function stringifyJSONASCII(value, space) {
	return JSON.stringify(value, null, space).replace(/[\u007f-\uffff]/g, char => {
		return '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
	});
}

function buildEnglishRuntimeTranslatorScript() {
	const serializedTranslations = unicodeEscapeScriptText(JSON.stringify(ENGLISH_UI_TRANSLATIONS));
	return [
		'<script data-english-runtime-translator>',
		'(function(){',
		'"use strict";',
		`var entries=${serializedTranslations};`,
		'var translationMap=new Map(entries);',
		'function escapeRegExp(value){return value.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&");}',
		'var pattern=entries.length?new RegExp(entries.map(function(pair){return escapeRegExp(pair[0]);}).sort(function(a,b){return b.length-a.length;}).join("|"),"g"):null;',
		'var textAttrs=["placeholder","title","aria-label","aria-description","alt","data-title","data-label","data-tip","data-tooltip","data-bs-title","data-original-title"];',
		'var skipped={SCRIPT:1,STYLE:1,TEMPLATE:1,TEXTAREA:1,CODE:1,PRE:1};',
		'function hasHan(value){return /[\\u3400-\\u9fff\\uf900-\\ufaff]/.test(value);}',
		'function translate(value){if(!value||!hasHan(value))return value;var output=pattern?value.replace(pattern,function(match){return translationMap.get(match)||match;}):value;return output.replace(/[\\u3400-\\u9fff\\uf900-\\ufaff]+/g,"").replace(/[ \\t]{2,}/g," ").trim();}',
		'function isSkipped(node){for(var el=node&&node.nodeType===1?node:node&&node.parentElement;el;el=el.parentElement){if(skipped[el.tagName])return true;}return false;}',
		'function translateTextNode(node){var next=translate(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;}',
		'function translateAttributes(el){if(!el||isSkipped(el))return;textAttrs.forEach(function(attr){if(el.hasAttribute&&el.hasAttribute(attr)){var current=el.getAttribute(attr);var next=translate(current);if(next!==current)el.setAttribute(attr,next);}});}',
		'function translateTree(root){if(!root)return;if(root.nodeType===3){if(!isSkipped(root))translateTextNode(root);return;}if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11)return;if(root.nodeType===1){if(isSkipped(root))return;translateAttributes(root);}if(root.querySelectorAll){root.querySelectorAll("*").forEach(translateAttributes);}var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(node){return isSkipped(node)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});var node;while((node=walker.nextNode()))translateTextNode(node);}',
		'function run(){translateTree(document.documentElement);}',
		'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();',
		'if(window.MutationObserver&&document.documentElement){new MutationObserver(function(mutations){mutations.forEach(function(mutation){if(mutation.type==="childList"){mutation.addedNodes.forEach(translateTree);}else if(mutation.type==="characterData"){translateTextNode(mutation.target);}else if(mutation.type==="attributes"){translateAttributes(mutation.target);}});}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:textAttrs});}',
		'})();',
		'<\/script>',
	].join('\n');
}

function injectEnglishRuntimeTranslator(html) {
	if (html.includes('data-english-runtime-translator')) return html;
	const script = buildEnglishRuntimeTranslatorScript();
	return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, script + '\n</body>') : html + script;
}

function normalizeEnglishLoginPage(html) {
	let output = html
		.replace(/(<input\b[^>]*\bid=(["'])password\2[^>]*)\s+disabled\b/gi, '$1')
		.replace(/(<button\b[^>]*\bid=(["'])loginBtn\2[^>]*)\s+disabled\b/gi, '$1')
		.replace(/\s*<div\b[^>]*\bid=(["'])ir-modal\1[\s\S]*?<div\b[^>]*\bid=(["'])ir-modal-content\2[^>]*><\/div>\s*<\/div>\s*<\/div>/i, '')
		.replace('Powered by <a href="https://github.com/cmliu/edgetunnel">edge' + 'tunnel</a>Powered', 'Powered by <a href="https://github.com/cmliu/edgetunnel">edge' + 'tunnel</a>');

	const gateStart = output.indexOf("document.addEventListener('DOMContentLoaded'");
	const submitStart = output.indexOf("document.getElementById('loginForm').addEventListener");
	if (gateStart !== -1 && submitStart !== -1 && submitStart > gateStart) {
		const enableLoginScript = [
			"document.addEventListener('DOMContentLoaded', () => {",
			"    const passwordInput = document.getElementById('password');",
			"    const loginBtn = document.getElementById('loginBtn');",
			"    if (passwordInput) {",
			"        passwordInput.removeAttribute('disabled');",
			"        passwordInput.focus();",
			"    }",
			"    if (loginBtn) loginBtn.removeAttribute('disabled');",
			"});",
			"",
			"        "
		].join('\n');
		output = output.slice(0, gateStart) + enableLoginScript + output.slice(submitStart);
	}

	return output
		.replace(/密码错误，请重试/g, 'Wrong password. Please try again.')
		.replace(/登录失败，请重试/g, 'Sign-in failed. Please try again.')
		.replace(/网络错误，请检查连接/g, 'Network error. Please check the connection.')
		.replace(/登录错误/g, 'Sign-in error');
}

async function fetchEnglishStaticPage(path, statusOverride) {
	const cacheKey = `${normalizeEnglishStaticPageCachePath(path)}|${statusOverride ?? ''}`;
	const cached = ENGLISH_STATIC_PAGE_CACHE.get(cacheKey);
	const now = Date.now();
	if (cached && now - cached.createdAt < ENGLISH_STATIC_PAGE_CACHE_TTL_MS) {
		return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: new Headers(cached.headers) });
	}
	const inFlight = ENGLISH_STATIC_PAGE_IN_FLIGHT.get(cacheKey);
	if (inFlight) {
		const entry = await inFlight;
		return new Response(entry.body, { status: entry.status, statusText: entry.statusText, headers: new Headers(entry.headers) });
	}

	const loadPromise = (async () => {
		let upstream;
		try {
			upstream = await fetchWithTimeout(Pages静态页面 + path, {}, 5000);
		} catch (error) {
			return {
				body: await nginx(),
				status: statusOverride ?? 502,
				statusText: 'Bad Gateway',
				headers: [['Content-Type', 'text/html; charset=UTF-8'], ['Cache-Control', 'no-store']],
				createdAt: Date.now(),
			};
		}
		const headers = new Headers(upstream.headers);
		headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
		headers.set('Pragma', 'no-cache');
		headers.set('Expires', '0');
		// Drop any upstream Content-Security-Policy so the injected runtime translator and
		// ProxyIP scanner widget (inline scripts) are allowed to execute in the browser.
		headers.delete('Content-Security-Policy');
		headers.delete('Content-Security-Policy-Report-Only');
		headers.delete('X-Content-Security-Policy');

		const status = statusOverride ?? upstream.status;
		const statusText = upstream.statusText;
		const contentType = headers.get('Content-Type') || '';
		const isHTML = /text\/html|application\/xhtml\+xml/i.test(contentType);
		let body = await upstream.text();
		if (isHTML) {
			// Also strip any inline CSP meta tag for the same reason.
			body = body.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');
			body = translateHTMLVisibleText(body);
			if (path.startsWith('/login')) body = normalizeEnglishLoginPage(body);
			body = injectEnglishRuntimeTranslator(body);
		}

		const cacheEntry = {
			body,
			status,
			statusText,
			headers: Array.from(headers.entries()),
			createdAt: Date.now(),
		};
		ENGLISH_STATIC_PAGE_CACHE.set(cacheKey, cacheEntry);
		if (ENGLISH_STATIC_PAGE_CACHE.size > ENGLISH_STATIC_PAGE_CACHE_MAX_ENTRIES) {
			const oldestKey = ENGLISH_STATIC_PAGE_CACHE.keys().next().value;
			ENGLISH_STATIC_PAGE_CACHE.delete(oldestKey);
		}
		return cacheEntry;
	})();
	ENGLISH_STATIC_PAGE_IN_FLIGHT.set(cacheKey, loadPromise);
	try {
		const entry = await loadPromise;
		return new Response(entry.body, { status: entry.status, statusText: entry.statusText, headers: new Headers(entry.headers) });
	} finally {
		ENGLISH_STATIC_PAGE_IN_FLIGHT.delete(cacheKey);
	}
}

function applyTopConfigAliases(config_JSON, env = {}) {
	const read = (...keys) => {
		for (const key of keys) {
			const value = env?.[key];
			if (value !== undefined && value !== null && value !== '') return value;
		}
		return undefined;
	};
	const subscriptionConfigKey = '\u4f18\u9009\u8ba2\u9605\u751f\u6210';
	const grpcModeKey = 'gRPC\u6a21\u5f0f';
	const transportKey = '\u4f20\u8f93\u534f\u8bae';

	const transport = read('TRANSPORT', 'TRANSPORT_PROTOCOL');
	if (transport !== undefined) config_JSON[transportKey] = String(transport).trim().toLowerCase();

	const grpcMode = read('GRPC_MODE', 'gRPC_MODE');
	if (grpcMode !== undefined) config_JSON[grpcModeKey] = String(grpcMode).trim().toLowerCase();

	const grpcUserAgent = read('GRPC_USER_AGENT', 'gRPC_USER_AGENT');
	if (grpcUserAgent !== undefined) config_JSON.gRPCUserAgent = String(grpcUserAgent).trim();

	const fingerprint = read('FP', 'FINGERPRINT');
	if (fingerprint !== undefined) config_JSON.Fingerprint = String(fingerprint).trim();

	const subName = read('SUBNAME', 'SUB_NAME');
	if (subName !== undefined && config_JSON[subscriptionConfigKey]) config_JSON[subscriptionConfigKey].SUBNAME = String(subName).trim();

	const subUpdateTime = read('SUB_UPDATE_TIME', 'SUBUpdateTime');
	if (subUpdateTime !== undefined && config_JSON[subscriptionConfigKey]) {
		const parsed = Number(subUpdateTime);
		if (Number.isFinite(parsed) && parsed > 0) config_JSON[subscriptionConfigKey].SUBUpdateTime = parsed;
	}
}

function normalizeEnglishStaticPageCachePath(path) {
	const value = String(path || '/');
	const queryIndex = value.indexOf('?');
	const pathname = queryIndex === -1 ? value : value.slice(0, queryIndex);
	const search = queryIndex === -1 ? '' : value.slice(queryIndex);
	const normalizedPathname = pathname || '/';
	if (/^\/(?:admin|login|noADMIN|noKV)(?:\/)?$/i.test(normalizedPathname)) return normalizedPathname.replace(/\/$/, '') || '/';
	return normalizedPathname + search
}

async function 读取config_JSON(env, hostname, userID, UA = "Mozilla/5.0", 重置配置 = false) {
	const _p = atob("UFJPWFlJUA==");
	const host = hostname, Ali_DoH = "https://dns.alidns.com/dns-query", ECH_SNI = "cloudflare-ech.com", 占位符 = '{{IP:PORT}}', 初始化开始时间 = performance.now(), 默认配置JSON = {
		TIME: new Date().toISOString(),
		HOST: host,
		HOSTS: [hostname],
		UUID: userID,
		PATH: "/",
		协议类型: "v" + "le" + "ss",
		传输协议: "ws",
		gRPC模式: "gun",
		gRPCUserAgent: UA,
		跳过证书验证: false,
		启用0RTT: false,
		TLS分片: null,
		随机路径: false,
		ECH: false,
		ECHConfig: {
			DNS: Ali_DoH,
			SNI: ECH_SNI,
		},
		SS: {
			加密方式: "aes-128-gcm",
			TLS: true,
		},
		Fingerprint: "chrome",
		优选订阅生成: {
			local: true,
			本地IP库: {
				随机IP: true,
				随机数量: 16,
				指定端口: -1,
			},
			SUB: null,
			SUBNAME: "edge" + "tunnel",
			SUBUpdateTime: 3,
			TOKEN: await MD5MD5(hostname + userID),
		},
		订阅转换配置: {
			SUBAPI: "https://SUBAPI.cmliussss.net",
			SUBCONFIG: "https://raw.githubusercontent.com/cmliu/ACL4SSR/refs/heads/main/Clash/config/ACL4SSR_Online_Mini_MultiMode_CF.ini",
			SUBEMOJI: false,
		},
		反代: {
			[_p]: "auto",
			SOCKS5: {
				启用: null,
				全局: false,
				账号: null,
				白名单: DEFAULT_SOCKS5_WHITELIST,
			},
			路径模板: {
				[_p]: "proxyip=" + 占位符,
				SOCKS5: {
					全局: "socks5://" + 占位符,
					标准: "socks5=" + 占位符
				},
				HTTP: {
					全局: "http://" + 占位符,
					标准: "http=" + 占位符
				},
				HTTPS: {
					全局: "https://" + 占位符,
					标准: "https=" + 占位符
				},
				TURN: {
					全局: "turn://" + 占位符,
					标准: "turn=" + 占位符
				},
				SSTP: {
					全局: "sstp://" + 占位符,
					标准: "sstp=" + 占位符
				},
			},
		},
		TG: {
			启用: false,
			BotToken: null,
			ChatID: null,
		},
		CF: {
			Email: null,
			GlobalAPIKey: null,
			AccountID: null,
			APIToken: null,
			UsageAPI: null,
			Usage: {
				success: false,
				pages: 0,
				workers: 0,
				total: 0,
				max: 100000,
			},
		}
	};

	let config_JSON;
	try {
		let configJSON = await env.KV.get('config.json');
		if (!configJSON || 重置配置 == true) {
			await env.KV.put('config.json', JSON.stringify(默认配置JSON, null, 2));
			config_JSON = 默认配置JSON;
		} else {
			config_JSON = JSON.parse(configJSON);
		}
	} catch (error) {
		debugError(`Failed to read config_JSON: ${error.message}`);
		config_JSON = 默认配置JSON;
	}

	const 合并对象默认值 = (默认值, 当前值) => ({
		...默认值,
		...((当前值 && typeof 当前值 === 'object' && !Array.isArray(当前值)) ? 当前值 : {})
	});
	config_JSON = 合并对象默认值(默认配置JSON, config_JSON);
	config_JSON.优选订阅生成 = 合并对象默认值(默认配置JSON.优选订阅生成, config_JSON.优选订阅生成);
	config_JSON.优选订阅生成.本地IP库 = 合并对象默认值(默认配置JSON.优选订阅生成.本地IP库, config_JSON.优选订阅生成.本地IP库);
	config_JSON.订阅转换配置 = 合并对象默认值(默认配置JSON.订阅转换配置, config_JSON.订阅转换配置);
	config_JSON.ECHConfig = 合并对象默认值(默认配置JSON.ECHConfig, config_JSON.ECHConfig);
	config_JSON.SS = 合并对象默认值(默认配置JSON.SS, config_JSON.SS);
	config_JSON.反代 = 合并对象默认值(默认配置JSON.反代, config_JSON.反代);
	config_JSON.反代.SOCKS5 = 合并对象默认值(默认配置JSON.反代.SOCKS5, config_JSON.反代.SOCKS5);
	config_JSON.反代.路径模板 = 合并对象默认值(默认配置JSON.反代.路径模板, config_JSON.反代.路径模板);
	for (const 模板名称 of ['SOCKS5', 'HTTP', 'HTTPS', 'TURN', 'SSTP']) {
		config_JSON.反代.路径模板[模板名称] = 合并对象默认值(默认配置JSON.反代.路径模板[模板名称], config_JSON.反代.路径模板[模板名称]);
	}
	config_JSON.TG = 合并对象默认值(默认配置JSON.TG, config_JSON.TG);
	config_JSON.CF = 合并对象默认值(默认配置JSON.CF, config_JSON.CF);
	config_JSON.CF.Usage = 合并对象默认值(默认配置JSON.CF.Usage, config_JSON.CF.Usage);

	applyTopConfigAliases(config_JSON, env);
	if (!config_JSON.gRPCUserAgent) config_JSON.gRPCUserAgent = UA;
	const currentHostname = normalizeConfigHost(hostname);
	config_JSON.HOST = currentHostname || host;
	if (env.HOST) {
		config_JSON.HOSTS = (await 整理成数组(env.HOST)).map(normalizeConfigHost).filter(Boolean);
	} else {
		const storedHosts = Array.isArray(config_JSON.HOSTS)
			? config_JSON.HOSTS.map(normalizeConfigHost).filter(Boolean)
			: [normalizeConfigHost(config_JSON.HOSTS)].filter(Boolean);
		const storedHostsAreWorkerDomains = storedHosts.length > 0 && storedHosts.every(h => h.endsWith('.workers.dev'));
		const shouldRefreshWorkerDomain = storedHostsAreWorkerDomains && currentHostname && (storedHosts.length !== 1 || storedHosts[0] !== currentHostname);
		config_JSON.HOSTS = (!storedHosts.length || shouldRefreshWorkerDomain) ? [currentHostname || hostname] : storedHosts;
	}
	if (!config_JSON.HOSTS.length) config_JSON.HOSTS = [currentHostname || hostname];
	config_JSON.UUID = userID;
	if (!config_JSON.随机路径) config_JSON.随机路径 = false;
	if (!config_JSON.启用0RTT) config_JSON.启用0RTT = false;

	if (env.PATH) config_JSON.PATH = env.PATH.startsWith('/') ? env.PATH : '/' + env.PATH;
	else if (!config_JSON.PATH) config_JSON.PATH = '/';

	if (!config_JSON.gRPC模式) config_JSON.gRPC模式 = 'gun';
	if (!config_JSON.SS) config_JSON.SS = { 加密方式: "aes-128-gcm", TLS: false };

	if (!config_JSON.反代.路径模板?.[_p]) {
		config_JSON.反代.路径模板 = {
			[_p]: "proxyip=" + 占位符,
			SOCKS5: {
				全局: "socks5://" + 占位符,
				标准: "socks5=" + 占位符
			},
			HTTP: {
				全局: "http://" + 占位符,
				标准: "http=" + 占位符
			},
			HTTPS: {
				全局: "https://" + 占位符,
				标准: "https=" + 占位符
			},
			TURN: {
				全局: "turn://" + 占位符,
				标准: "turn=" + 占位符
			},
			SSTP: {
				全局: "sstp://" + 占位符,
				标准: "sstp=" + 占位符
			},
		};
	}
	if (!config_JSON.反代.路径模板.HTTPS) config_JSON.反代.路径模板.HTTPS = { 全局: "https://" + 占位符, 标准: "https=" + 占位符 };
	if (!config_JSON.反代.路径模板.TURN) config_JSON.反代.路径模板.TURN = { 全局: "turn://" + 占位符, 标准: "turn=" + 占位符 };
	if (!config_JSON.反代.路径模板.SSTP) config_JSON.反代.路径模板.SSTP = { 全局: "sstp://" + 占位符, 标准: "sstp=" + 占位符 };

	const 代理配置 = config_JSON.反代.路径模板[config_JSON.反代.SOCKS5.启用?.toUpperCase()];

	let 路径反代参数 = '';
	if (代理配置 && config_JSON.反代.SOCKS5.账号) 路径反代参数 = (config_JSON.反代.SOCKS5.全局 ? 代理配置.全局 : 代理配置.标准).replace(占位符, config_JSON.反代.SOCKS5.账号);
	else if (config_JSON.反代[_p] !== 'auto') 路径反代参数 = config_JSON.反代.路径模板[_p].replace(占位符, config_JSON.反代[_p]);

	let 反代查询参数 = '';
	if (路径反代参数.includes('?')) {
		const [反代路径部分, 反代查询部分] = 路径反代参数.split('?');
		路径反代参数 = 反代路径部分;
		反代查询参数 = 反代查询部分;
	}

	config_JSON.PATH = config_JSON.PATH.replace(路径反代参数, '').replace('//', '/');
	const normalizedPath = config_JSON.PATH === '/' ? '' : config_JSON.PATH.replace(/\/+(?=\?|$)/, '').replace(/\/+$/, '');
	const [路径部分, ...查询数组] = normalizedPath.split('?');
	const 查询部分 = 查询数组.length ? '?' + 查询数组.join('?') : '';
	const 最终查询部分 = 反代查询参数 ? (查询部分 ? 查询部分 + '&' + 反代查询参数 : '?' + 反代查询参数) : 查询部分;
	config_JSON.完整节点路径 = (路径部分 || '/') + (路径部分 && 路径反代参数 ? '/' : '') + 路径反代参数 + 最终查询部分 + (config_JSON.启用0RTT ? (最终查询部分 ? '&' : '?') + 'ed=2560' : '');

	if (!config_JSON.TLS分片 && config_JSON.TLS分片 !== null) config_JSON.TLS分片 = null;
	const TLS分片参数 = config_JSON.TLS分片 == 'Shadowrocket' ? `&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}` : config_JSON.TLS分片 == 'Happ' ? `&fragment=${encodeURIComponent('3,1,tlshello')}` : '';
	if (!config_JSON.Fingerprint) config_JSON.Fingerprint = "chrome";
	if (!config_JSON.ECH) config_JSON.ECH = false;
	if (!config_JSON.ECHConfig) config_JSON.ECHConfig = { DNS: Ali_DoH, SNI: ECH_SNI };
	const ECHLINK参数 = config_JSON.ECH ? `&ech=${encodeURIComponent((config_JSON.ECHConfig.SNI ? config_JSON.ECHConfig.SNI + '+' : '') + config_JSON.ECHConfig.DNS)}` : '';
	const { type: 传输协议, 路径字段名, 域名字段名 } = 获取传输协议配置(config_JSON);
	const 传输路径参数值 = 获取传输路径参数值(config_JSON, config_JSON.完整节点路径);
	const ssPathWithEncryption = (config_JSON.完整节点路径.includes('?') ? config_JSON.完整节点路径.replace('?', '?enc=' + config_JSON.SS.加密方式 + '&') : (config_JSON.完整节点路径 + '?enc=' + config_JSON.SS.加密方式)) + (config_JSON.SS.TLS ? ';tls' : '');
	const ssPluginOption = 'ray-plugin;mode=websocket;host=' + host + ';path=' + ssPathWithEncryption + ';mux=0';
	config_JSON.LINK = config_JSON.协议类型 === 'ss'
		? `${config_JSON.协议类型}://${btoa(config_JSON.SS.加密方式 + ':' + userID)}@${host}:${config_JSON.SS.TLS ? '443' : '80'}?plugin=v2${encodeURIComponent(ssPluginOption) + ECHLINK参数}#${encodeURIComponent(config_JSON.优选订阅生成.SUBNAME)}`
		: `${config_JSON.协议类型}://${userID}@${host}:443?security=tls&type=${传输协议 + ECHLINK参数}&${域名字段名}=${host}&fp=${config_JSON.Fingerprint}&sni=${host}&${路径字段名}=${encodeURIComponent(传输路径参数值) + TLS分片参数}&encryption=none#${encodeURIComponent(config_JSON.优选订阅生成.SUBNAME)}`;
	config_JSON.优选订阅生成.TOKEN = await MD5MD5(hostname + userID);

	const 初始化TG_JSON = { BotToken: null, ChatID: null };
	config_JSON.TG = { 启用: config_JSON.TG.启用 ? config_JSON.TG.启用 : false, ...初始化TG_JSON };
	try {
		const TG_TXT = await env.KV.get('tg.json');
		if (!TG_TXT) {
			await env.KV.put('tg.json', JSON.stringify(初始化TG_JSON, null, 2));
		} else {
			const TG_JSON = JSON.parse(TG_TXT);
			config_JSON.TG.ChatID = TG_JSON.ChatID ? TG_JSON.ChatID : null;
			config_JSON.TG.BotToken = TG_JSON.BotToken ? 掩码敏感信息(TG_JSON.BotToken) : null;
		}
	} catch (error) {
		debugError(`Failed to read tg.json: ${error.message}`);
	}

	const 初始化CF_JSON = { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null };
	config_JSON.CF = { ...初始化CF_JSON, Usage: { success: false, pages: 0, workers: 0, total: 0, max: 100000 } };
	try {
		const CF_TXT = await env.KV.get('cf.json');
		if (!CF_TXT) {
			await env.KV.put('cf.json', JSON.stringify(初始化CF_JSON, null, 2));
		} else {
			const CF_JSON = JSON.parse(CF_TXT);
			if (CF_JSON.UsageAPI) {
				try {
					const response = await fetch(CF_JSON.UsageAPI);
					const Usage = await response.json();
					config_JSON.CF.Usage = Usage;
				} catch (err) {
					debugError(`CF_JSON.UsageAPI request failed: ${err.message}`);
				}
			} else {
				config_JSON.CF.Email = CF_JSON.Email ? CF_JSON.Email : null;
				config_JSON.CF.GlobalAPIKey = CF_JSON.GlobalAPIKey ? 掩码敏感信息(CF_JSON.GlobalAPIKey) : null;
				config_JSON.CF.AccountID = CF_JSON.AccountID ? 掩码敏感信息(CF_JSON.AccountID) : null;
				config_JSON.CF.APIToken = CF_JSON.APIToken ? 掩码敏感信息(CF_JSON.APIToken) : null;
				config_JSON.CF.UsageAPI = null;
				const Usage = await getCloudflareUsage(CF_JSON.Email, CF_JSON.GlobalAPIKey, CF_JSON.AccountID, CF_JSON.APIToken);
				config_JSON.CF.Usage = Usage;
			}
		}
	} catch (error) {
		debugError(`Failed to read cf.json: ${error.message}`);
	}

	config_JSON.加载时间 = (performance.now() - 初始化开始时间).toFixed(2) + 'ms';
	return config_JSON;
}

function 识别运营商(request) {
	const cf = request?.cf;
	const ASN运营商映射 = {
		'4134': 'ct',
		'4809': 'ct',
		'4811': 'ct',
		'4812': 'ct',
		'4815': 'ct',
		'4837': 'cu',
		'4814': 'cu',
		'9929': 'cu',
		'17623': 'cu',
		'17816': 'cu',
		'9808': 'cmcc',
		'24400': 'cmcc',
		'56040': 'cmcc',
		'56041': 'cmcc',
		'56044': 'cmcc',
	};
	const 运营商关键词映射 = [
		{ code: 'ct', pattern: /chinanet|chinatelecom|china telecom|cn2|shtel/ },
		{ code: 'cmcc', pattern: /cmi|cmnet|chinamobile|china mobile|cmcc|mobile communications/ },
		{ code: 'cu', pattern: /china169|china unicom|chinaunicom|cucc|cncgroup|cuii|netcom/ },
	];
	if (String(cf?.country || '').toLowerCase() !== 'cn') return 'cf';
	const 组织名称 = String(cf?.asOrganization || '').toLowerCase();
	const 命中运营商 = 运营商关键词映射.find(({ pattern }) => pattern.test(组织名称))?.code;
	return 命中运营商 || ASN运营商映射[String(cf?.asn || '')] || 'cf';
}

async function 生成随机IP(request, count = 16, 指定端口 = -1) {
	const url = new URL(request.url);
	const 查询参数运营商 = String(url.searchParams.get('asOrg') || '').toLowerCase();
	const 运营商文件标识 = ['ct', 'cu', 'cmcc', 'cf'].includes(查询参数运营商) ? 查询参数运营商 : 识别运营商(request);
	const 运营商名称映射 = {
		cmcc: 'CF Mobile Preferred',
		cu: 'CF Unicom Preferred',
		ct: 'CF Telecom Preferred',
		cf: 'CF Official Preferred',
	};
	const cidr_url = 运营商文件标识 === 'cf' ? 'https://raw.githubusercontent.com/cmliu/cmliu/main/CF-CIDR.txt' : `https://raw.githubusercontent.com/cmliu/cmliu/main/CF-CIDR/${运营商文件标识}.txt`;
	const cfname = 运营商名称映射[运营商文件标识] || 'CF Official Preferred';
	const cfport = [443, 2053, 2083, 2087, 2096, 8443];
	let cidrList = [];
	try { const res = await fetchWithTimeout(cidr_url, {}, 5000); cidrList = res.ok ? await 整理成数组(await res.text()) : ['104.16.0.0/13'] } catch { cidrList = ['104.16.0.0/13'] }

	const generateRandomIPFromCIDR = (cidr) => {
		const [baseIP, prefixLength] = cidr.split('/'), prefix = parseInt(prefixLength, 10);
		// Clamp prefix to 0–32 (treat a malformed prefix as /32 = a single host). hostBits === 32 (a /0)
		// must give mask 0, but JS `<<` is mod-32 so `0xFFFFFFFF << 32` is a no-op — special-case it.
		const hostBits = Number.isInteger(prefix) ? Math.max(0, Math.min(32, 32 - prefix)) : 0;
		const ipInt = baseIP.split('.').reduce((a, p, i) => a | ((parseInt(p, 10) || 0) << (24 - i * 8)), 0);
		const randomOffset = Math.floor(Math.random() * Math.pow(2, hostBits));
		const mask = hostBits >= 32 ? 0 : (0xFFFFFFFF << hostBits) >>> 0, randomIP = (((ipInt & mask) >>> 0) + randomOffset) >>> 0;
		return [(randomIP >>> 24) & 0xFF, (randomIP >>> 16) & 0xFF, (randomIP >>> 8) & 0xFF, randomIP & 0xFF].join('.');
	};
	const randomIPs = Array.from({ length: count }, (_, index) => {
		const ip = generateRandomIPFromCIDR(cidrList[Math.floor(Math.random() * cidrList.length)]);
		const 目标端口 = 指定端口 === -1
			? cfport[Math.floor(Math.random() * cfport.length)]
			: 指定端口;
		return `${ip}:${目标端口}#${cfname} ${index + 1}`;
	});
	return [randomIPs, randomIPs.join('\n')];
}

async function 整理成数组(内容) {
	if (内容 == null) return [];
	if (Array.isArray(内容)) {
		const nested = await Promise.all(内容.map(item => 整理成数组(item)));
		return nested.flat();
	}
	var 替换后的内容 = String(内容).replace(/[	"'\r\n]+/g, ',').replace(/,+/g, ',');
	if (替换后的内容.charAt(0) == ',') 替换后的内容 = 替换后的内容.slice(1);
	if (替换后的内容.charAt(替换后的内容.length - 1) == ',') 替换后的内容 = 替换后的内容.slice(0, 替换后的内容.length - 1);
	const 地址数组 = 替换后的内容.split(',');
	return 地址数组.map(item => item.trim()).filter(Boolean);
}

async function 获取优选订阅生成器数据(优选订阅生成器HOST) {
	let 优选IP = [], 其他节点LINK = '', 格式化HOST = 优选订阅生成器HOST.replace(/^sub:\/\//i, 'https://').split('#')[0].split('?')[0];
	if (!/^https?:\/\//i.test(格式化HOST)) 格式化HOST = `https://${格式化HOST}`;

	try {
		const url = new URL(格式化HOST);
		格式化HOST = url.origin;
	} catch (error) {
		优选IP.push(`127.0.0.1:1234#${优选订阅生成器HOST} preferred-sub generator format error: ${error.message}`);
		return [优选IP, 其他节点LINK];
	}

	const 优选订阅生成器URL = `${格式化HOST}/sub?host=example.com&uuid=00000000-0000-4000-8000-000000000000`;

	try {
		const response = await fetchWithTimeout(优选订阅生成器URL, {
			headers: { 'User-Agent': 'v2rayN/edge' + 'tunnel (https://github.com/cmliu/edge' + 'tunnel)' }
		}, 3000);

		if (!response.ok) {
			优选IP.push(`127.0.0.1:1234#${优选订阅生成器HOST} preferred-sub generator error: ${response.statusText}`);
			return [优选IP, 其他节点LINK];
		}

		// This body is untrusted (an arbitrary host the caller passed via ?sub=). Cap it so a hostile/huge
		// response can't spike isolate memory; the timeout above bounds a slow/hung upstream.
		const 声明长度 = Number(response.headers.get('content-length') || 0);
		if (Number.isFinite(声明长度) && 声明长度 > 512 * 1024) {
			try { response.body?.cancel() } catch (e) { }
			优选IP.push(`127.0.0.1:1234#${优选订阅生成器HOST} preferred-sub generator error: response too large`);
			return [优选IP, 其他节点LINK];
		}
		const 优选订阅生成器原始文本 = await response.text();
		if (优选订阅生成器原始文本.length > 512 * 1024) {
			优选IP.push(`127.0.0.1:1234#${优选订阅生成器HOST} preferred-sub generator error: response too large`);
			return [优选IP, 其他节点LINK];
		}
		const 优选订阅生成器返回订阅内容 = atob(优选订阅生成器原始文本);
		const 订阅行列表 = 优选订阅生成器返回订阅内容.includes('\r\n')
			? 优选订阅生成器返回订阅内容.split('\r\n')
			: 优选订阅生成器返回订阅内容.split('\n');

		for (const 行内容 of 订阅行列表) {
			if (!行内容.trim()) continue;
			if (行内容.includes('00000000-0000-4000-8000-000000000000') && 行内容.includes('example.com')) {
				const 地址匹配 = 行内容.match(/:\/\/[^@]+@([^?]+)/);
				if (地址匹配) {
					let 地址端口 = 地址匹配[1], 备注 = '';
					const 备注匹配 = 行内容.match(/#(.+)$/);
					if (备注匹配) 备注 = '#' + decodeURIComponent(备注匹配[1]);
					优选IP.push(地址端口 + 备注);
				}
			} else {
				其他节点LINK += 行内容 + '\n';
			}
		}
	} catch (error) {
		优选IP.push(`127.0.0.1:1234#${优选订阅生成器HOST} preferred-sub generator error: ${error.message}`);
	}

	return [优选IP, 其他节点LINK];
}

async function 请求优选API(urls, 默认端口 = '443', 超时时间 = 3000) {
	if (!urls?.length) return [[], [], [], []];
	const results = new Set(), 反代IP池 = new Set();
	let 订阅链接响应的明文LINK内容 = '', 需要订阅转换订阅URLs = [];
	await Promise.allSettled(urls.map(async (url) => {
		const hashIndex = url.indexOf('#');
		const urlWithoutHash = hashIndex > -1 ? url.substring(0, hashIndex) : url;
		const API备注名 = hashIndex > -1 ? decodeURIComponent(url.substring(hashIndex + 1)) : null;
		const 优选IP作为反代IP = url.toLowerCase().includes('proxyip=true');
		if (urlWithoutHash.toLowerCase().startsWith('sub://')) {
			try {
				const [优选IP, 其他节点LINK] = await 获取优选订阅生成器数据(urlWithoutHash);
				if (API备注名) {
					for (const ip of 优选IP) {
						const 处理后IP = ip.includes('#')
							? `${ip} [${API备注名}]`
							: `${ip}#[${API备注名}]`;
						results.add(处理后IP);
						if (优选IP作为反代IP) 反代IP池.add(ip.split('#')[0]);
					}
				} else {
					for (const ip of 优选IP) {
						results.add(ip);
						if (优选IP作为反代IP) 反代IP池.add(ip.split('#')[0]);
					}
				}
				if (其他节点LINK && typeof 其他节点LINK === 'string' && API备注名) {
					const 处理后LINK内容 = 其他节点LINK.replace(/([a-z][a-z0-9+\-.]*:\/\/[^\r\n]*?)(\r?\n|$)/gi, (match, link, lineEnd) => {
						const 完整链接 = link.includes('#')
							? `${link}${encodeURIComponent(` [${API备注名}]`)}`
							: `${link}${encodeURIComponent(`#[${API备注名}]`)}`;
						return `${完整链接}${lineEnd}`;
					});
					订阅链接响应的明文LINK内容 += 处理后LINK内容;
				} else if (其他节点LINK && typeof 其他节点LINK === 'string') {
					订阅链接响应的明文LINK内容 += 其他节点LINK;
				}
			} catch (e) { }
			return;
		}

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 超时时间);
			const response = await fetch(urlWithoutHash, { signal: controller.signal });
			clearTimeout(timeoutId);
			let text = '';
			try {
				const buffer = await response.arrayBuffer();
				const contentType = (response.headers.get('content-type') || '').toLowerCase();
				const charset = contentType.match(/charset=([^\s;]+)/i)?.[1]?.toLowerCase() || '';

				let decoders = ['utf-8', 'gb2312'];
				if (charset.includes('gb') || charset.includes('gbk') || charset.includes('gb2312')) {
					decoders = ['gb2312', 'utf-8'];
				}

				let decodeSuccess = false;
				for (const decoder of decoders) {
					try {
						const decoded = new TextDecoder(decoder).decode(buffer);
						if (decoded && decoded.length > 0 && !decoded.includes('\ufffd')) {
							text = decoded;
							decodeSuccess = true;
							break;
						} else if (decoded && decoded.length > 0) {
							continue;
						}
					} catch (e) {
						continue;
					}
				}

				if (!decodeSuccess) {
					// The body was already consumed by arrayBuffer() above, so re-reading via
					// response.text() would throw. Best-effort decode from the buffer we already have.
					text = new TextDecoder('utf-8').decode(buffer);
				}

				if (!text || text.trim().length === 0) {
					return;
				}
			} catch (e) {
				debugError('Failed to decode response:', e);
				return;
			}

			let 预处理订阅明文内容 = text;
			const cleanText = typeof text === 'string' ? text.replace(/\s/g, '') : '';
			if (cleanText.length > 0 && cleanText.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(cleanText)) {
				try {
					const bytes = new Uint8Array(atob(cleanText).split('').map(c => c.charCodeAt(0)));
					预处理订阅明文内容 = new TextDecoder('utf-8').decode(bytes);
				} catch { }
			}
			if (预处理订阅明文内容.split('#')[0].includes('://')) {
				if (API备注名) {
					const 处理后LINK内容 = 预处理订阅明文内容.replace(/([a-z][a-z0-9+\-.]*:\/\/[^\r\n]*?)(\r?\n|$)/gi, (match, link, lineEnd) => {
						const 完整链接 = link.includes('#')
							? `${link}${encodeURIComponent(` [${API备注名}]`)}`
							: `${link}${encodeURIComponent(`#[${API备注名}]`)}`;
						return `${完整链接}${lineEnd}`;
					});
					订阅链接响应的明文LINK内容 += 处理后LINK内容 + '\n';
				} else {
					订阅链接响应的明文LINK内容 += 预处理订阅明文内容 + '\n';
				}
				return;
			}

			const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
			const isCSV = lines.length > 1 && lines[0].includes(',');
			const IPV6_PATTERN = /^[^\[\]]*:[^\[\]]*:[^\[\]]/;
			const parsedUrl = new URL(urlWithoutHash);
			if (!isCSV) {
				lines.forEach(line => {
					const lineHashIndex = line.indexOf('#');
					const [hostPart, remark] = lineHashIndex > -1 ? [line.substring(0, lineHashIndex), line.substring(lineHashIndex)] : [line, ''];
					let hasPort = false;
					if (hostPart.startsWith('[')) {
						hasPort = /\]:(\d+)$/.test(hostPart);
					} else {
						const colonIndex = hostPart.lastIndexOf(':');
						hasPort = colonIndex > -1 && /^\d+$/.test(hostPart.substring(colonIndex + 1));
					}
					const port = parsedUrl.searchParams.get('port') || 默认端口;
					const ipItem = hasPort ? line : `${hostPart}:${port}${remark}`;
					if (API备注名) {
						const 处理后IP = ipItem.includes('#')
							? `${ipItem} [${API备注名}]`
							: `${ipItem}#[${API备注名}]`;
						results.add(处理后IP);
					} else {
						results.add(ipItem);
					}
					if (优选IP作为反代IP) 反代IP池.add(ipItem.split('#')[0]);
				});
			} else {
				const headers = lines[0].split(',').map(h => h.trim());
				const dataLines = lines.slice(1);
				if (headers.includes('IP\u5730\u5740') && headers.includes('\u7aef\u53e3') && headers.includes('\u6570\u636e\u4e2d\u5fc3')) {
					const ipIdx = headers.indexOf('IP\u5730\u5740'), portIdx = headers.indexOf('\u7aef\u53e3');
					const remarkIdx = headers.indexOf('\u56fd\u5bb6') > -1 ? headers.indexOf('\u56fd\u5bb6') :
						headers.indexOf('\u57ce\u5e02') > -1 ? headers.indexOf('\u57ce\u5e02') : headers.indexOf('\u6570\u636e\u4e2d\u5fc3');
					const tlsIdx = headers.indexOf('TLS');
					dataLines.forEach(line => {
						const cols = line.split(',').map(c => c.trim());
						if (tlsIdx !== -1 && cols[tlsIdx]?.toLowerCase() !== 'true') return;
						const wrappedIP = IPV6_PATTERN.test(cols[ipIdx]) ? `[${cols[ipIdx]}]` : cols[ipIdx];
						const ipItem = `${wrappedIP}:${cols[portIdx]}#${cols[remarkIdx]}`;
						if (API备注名) {
							const 处理后IP = `${ipItem} [${API备注名}]`;
							results.add(处理后IP);
						} else {
							results.add(ipItem);
						}
						if (优选IP作为反代IP) 反代IP池.add(`${wrappedIP}:${cols[portIdx]}`);
					});
				} else if (headers.some(h => h.includes('IP')) && headers.some(h => h.includes('\u5ef6\u8fdf')) && headers.some(h => h.includes('\u4e0b\u8f7d\u901f\u5ea6'))) {
					const ipIdx = headers.findIndex(h => h.includes('IP'));
					const delayIdx = headers.findIndex(h => h.includes('\u5ef6\u8fdf'));
					const speedIdx = headers.findIndex(h => h.includes('\u4e0b\u8f7d\u901f\u5ea6'));
					const port = parsedUrl.searchParams.get('port') || 默认端口;
					dataLines.forEach(line => {
						const cols = line.split(',').map(c => c.trim());
						const wrappedIP = IPV6_PATTERN.test(cols[ipIdx]) ? `[${cols[ipIdx]}]` : cols[ipIdx];
						const ipItem = `${wrappedIP}:${port}#CF Preferred ${cols[delayIdx]}ms ${cols[speedIdx]}MB/s`;
						if (API备注名) {
							const 处理后IP = `${ipItem} [${API备注名}]`;
							results.add(处理后IP);
						} else {
							results.add(ipItem);
						}
						if (优选IP作为反代IP) 反代IP池.add(`${wrappedIP}:${port}`);
					});
				}
			}
		} catch (e) { }
	}));
	const LINK数组 = 订阅链接响应的明文LINK内容.trim() ? [...new Set(订阅链接响应的明文LINK内容.split(/\r?\n/).filter(line => line.trim() !== ''))] : [];
	return [Array.from(results), LINK数组, 需要订阅转换订阅URLs, Array.from(反代IP池)];
}

async function 反代参数获取(url, uuid, tunnelContext = emptyTunnelContext()) {
	return applyProxyParamsToTunnelContext(url, uuid, tunnelContext);
}

const 反代协议默认端口 = { socks5: 1080, http: 80, https: 443, turn: 3478, sstp: 443 };
function 获取代理默认端口(类型) {
	return 反代协议默认端口[String(类型 || '').toLowerCase()] || 80;
}

const SOCKS5账号Base64正则 = /^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i, IPv6方括号正则 = /^\[.*\]$/;
function 获取SOCKS5账号(address, 默认端口 = 80) {
	address = String(address || '').trim().replace(/^(socks5|http|https|turn|sstp):\/\//i, '').split('#')[0].trim();
	const firstAt = address.lastIndexOf("@");
	if (firstAt !== -1) {
		let auth = address.slice(0, firstAt).replaceAll("%3D", "=");
		if (!auth.includes(":") && SOCKS5账号Base64正则.test(auth)) auth = atob(auth);
		address = `${auth}@${address.slice(firstAt + 1)}`;
	}

	const atIndex = address.lastIndexOf("@");
	const hostPart = (atIndex === -1 ? address : address.slice(atIndex + 1)).split('/')[0];
	const authPart = atIndex === -1 ? "" : address.slice(0, atIndex);
	const [username, password] = authPart ? authPart.split(":") : [];
	if (authPart && !password) throw new Error('Invalid proxy address format: the authentication part must be "username:password"');

	let hostname = hostPart, port = 默认端口;
	if (hostPart.includes("]:")) {
		const [ipv6Host, ipv6Port = ""] = hostPart.split("]:");
		hostname = ipv6Host + "]";
		port = Number(ipv6Port.replace(/[^\d]/g, ""));
	} else if (!hostPart.startsWith("[")) {
		const parts = hostPart.split(":");
		if (parts.length === 2) {
			hostname = parts[0];
			port = Number(parts[1].replace(/[^\d]/g, ""));
		}
	}

	if (isNaN(port)) throw new Error('Invalid proxy address format: the port must be a number');
	if (hostname.includes(":") && !IPv6方括号正则.test(hostname)) throw new Error('Invalid proxy address format: IPv6 addresses must be wrapped in brackets, for example [2001:db8::1]');
	return { username, password, hostname, port };
}

async function getCloudflareUsage(Email, GlobalAPIKey, AccountID, APIToken) {
	const API = "https://api.cloudflare.com/client/v4";
	const sum = (a) => a?.reduce((t, i) => t + (i?.sum?.requests || 0), 0) || 0;
	const cfg = { "Content-Type": "application/json" };

	try {
		if (!AccountID && (!Email || !GlobalAPIKey)) return { success: false, pages: 0, workers: 0, total: 0, max: 100000 };

		if (!AccountID) {
			const r = await fetch(`${API}/accounts`, {
				method: "GET",
				headers: { ...cfg, "X-AUTH-EMAIL": Email, "X-AUTH-KEY": GlobalAPIKey }
			});
			if (!r.ok) throw new Error(`Failed to fetch account: ${r.status}`);
			const d = await r.json();
			if (!d?.result?.length) throw new Error("Account not found");
			const idx = d.result.findIndex(a => a.name?.toLowerCase().startsWith(Email.toLowerCase()));
			AccountID = d.result[idx >= 0 ? idx : 0]?.id;
		}

		const now = new Date();
		now.setUTCHours(0, 0, 0, 0);
		const hdr = APIToken ? { ...cfg, "Authorization": `Bearer ${APIToken}` } : { ...cfg, "X-AUTH-EMAIL": Email, "X-AUTH-KEY": GlobalAPIKey };

		const res = await fetch(`${API}/graphql`, {
			method: "POST",
			headers: hdr,
			body: JSON.stringify({
				query: `query getBillingMetrics($AccountID: String!, $filter: AccountWorkersInvocationsAdaptiveFilter_InputObject) {
					viewer { accounts(filter: {accountTag: $AccountID}) {
						pagesFunctionsInvocationsAdaptiveGroups(limit: 1000, filter: $filter) { sum { requests } }
						workersInvocationsAdaptive(limit: 10000, filter: $filter) { sum { requests } }
					} }
				}`,
				variables: { AccountID, filter: { datetime_geq: now.toISOString(), datetime_leq: new Date().toISOString() } }
			})
		});

		if (!res.ok) throw new Error(`Query failed: ${res.status}`);
		const result = await res.json();
		if (result.errors?.length) throw new Error(result.errors[0].message);

		const acc = result?.data?.viewer?.accounts?.[0];
		if (!acc) throw new Error("Account usage data not found");

		const pages = sum(acc.pagesFunctionsInvocationsAdaptiveGroups);
		const workers = sum(acc.workersInvocationsAdaptive);
		const total = pages + workers;
		const max = 100000;
		log(`Usage summary - Pages: ${pages}, Workers: ${workers}, Total: ${total}, Limit: 100000`);
		return { success: true, pages, workers, total, max };

	} catch (error) {
		debugError('Failed to fetch usage:', error.message);
		return { success: false, pages: 0, workers: 0, total: 0, max: 100000 };
	}
}

function sha224(s) {
	const cacheKey = String(s);
	const cached = getLruCacheValue(SHA224_RESULT_CACHE, cacheKey);
	if (cached !== undefined) return cached;
	const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
	const r = (n, b) => ((n >>> b) | (n << (32 - b))) >>> 0;
	s = unescape(encodeURIComponent(cacheKey));
	const l = s.length * 8; s += String.fromCharCode(0x80);
	while ((s.length * 8) % 512 !== 448) s += String.fromCharCode(0);
	const h = [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4];
	const hi = Math.floor(l / 0x100000000), lo = l & 0xFFFFFFFF;
	s += String.fromCharCode((hi >>> 24) & 0xFF, (hi >>> 16) & 0xFF, (hi >>> 8) & 0xFF, hi & 0xFF, (lo >>> 24) & 0xFF, (lo >>> 16) & 0xFF, (lo >>> 8) & 0xFF, lo & 0xFF);
	const w = []; for (let i = 0; i < s.length; i += 4)w.push((s.charCodeAt(i) << 24) | (s.charCodeAt(i + 1) << 16) | (s.charCodeAt(i + 2) << 8) | s.charCodeAt(i + 3));
	for (let i = 0; i < w.length; i += 16) {
		const x = new Array(64).fill(0);
		for (let j = 0; j < 16; j++)x[j] = w[i + j];
		for (let j = 16; j < 64; j++) {
			const s0 = r(x[j - 15], 7) ^ r(x[j - 15], 18) ^ (x[j - 15] >>> 3);
			const s1 = r(x[j - 2], 17) ^ r(x[j - 2], 19) ^ (x[j - 2] >>> 10);
			x[j] = (x[j - 16] + s0 + x[j - 7] + s1) >>> 0;
		}
		let [a, b, c, d, e, f, g, h0] = h;
		for (let j = 0; j < 64; j++) {
			const S1 = r(e, 6) ^ r(e, 11) ^ r(e, 25), ch = (e & f) ^ (~e & g), t1 = (h0 + S1 + ch + K[j] + x[j]) >>> 0;
			const S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22), maj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + maj) >>> 0;
			h0 = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
		}
		for (let j = 0; j < 8; j++)h[j] = (h[j] + (j === 0 ? a : j === 1 ? b : j === 2 ? c : j === 3 ? d : j === 4 ? e : j === 5 ? f : j === 6 ? g : h0)) >>> 0;
	}
	let hex = '';
	for (let i = 0; i < 7; i++) {
		for (let j = 24; j >= 0; j -= 8)hex += ((h[i] >>> j) & 0xFF).toString(16).padStart(2, '0');
	}
	return setLruCacheValue(SHA224_RESULT_CACHE, cacheKey, hex, HASH_CACHE_MAX_ENTRIES);
}

function getWorkerRequestContext(request) {
	if (!request || typeof request !== 'object') return {};
	return WORKER_REQUEST_CONTEXT.get(request) || (request.env ? { env: request.env, ctx: request.ctx || null, tunnel: request.tunnel || null } : {});
}

function emptyTunnelContext() {
	return {
		proxyIP: '',
		proxyFallbackEnabled: true,
		proxyType: null,
		globalProxyEnabled: false,
		proxyAccount: null,
		parsedProxyAddress: {},
		socksWhitelist: DEFAULT_SOCKS5_WHITELIST,
		forceProxyHosts: [],
		tcpDialConcurrency: 2,
		preloadRaceDial: false,
	};
}

async function getSocksWhitelist(env) {
	const key = String(env?.GO2SOCKS5 || '');
	if (缓存SOCKS5白名单 && 缓存SOCKS5白名单键 === key) return 缓存SOCKS5白名单;
	const extra = key.trim() ? await 整理成数组(key) : [];
	缓存SOCKS5白名单 = [...new Set(DEFAULT_SOCKS5_WHITELIST.concat(extra).filter(Boolean))];
	缓存SOCKS5白名单键 = key;
	return 缓存SOCKS5白名单;
}

async function getForceProxyHosts(env) {
	const key = String(env?.FORCE_PROXY_HOSTS || env?.PROXYIP_HOSTS || '');
	if (缓存强制反代主机 && 缓存强制反代主机键 === key) return 缓存强制反代主机;
	缓存强制反代主机 = key.trim() ? [...new Set((await 整理成数组(key)).map(value => String(value || '').trim()).filter(Boolean))] : [];
	缓存强制反代主机键 = key;
	return 缓存强制反代主机;
}

async function getProxyIPList(env) {
	const raw = String(env?.PROXYIP || '');
	if (cachedProxyIPList && cachedProxyIPRaw === raw) return cachedProxyIPList;
	if (raw.trim().toLowerCase() === 'auto') {
		cachedProxyIPRaw = raw;
		cachedProxyIPList = [];
		return cachedProxyIPList;
	}
	cachedProxyIPList = raw.trim()
		? (await 整理成数组(raw)).map(value => String(value || '').trim()).filter(Boolean)
		: [];
	cachedProxyIPRaw = raw;
	return cachedProxyIPList;
}

async function createTunnelContext(request, env = {}) {
	const tunnelContext = emptyTunnelContext();
	const proxyIPList = await getProxyIPList(env);
	if (proxyIPList.length) {
		tunnelContext.proxyIP = proxyIPList[Math.floor(Math.random() * proxyIPList.length)];
		// A custom PROXYIP normally disables auto-fallback (deliberate). PROXYIP_FALLBACK=1 keeps it on
		// so a dead custom ProxyIP can still fall back to the per-colo community relay.
		tunnelContext.proxyFallbackEnabled = isEnabledEnvFlag(env?.PROXYIP_FALLBACK);
	} else {
		const colo = String(request?.cf?.colo || 'www').toLowerCase();
		tunnelContext.proxyIP = `${colo}.PrOxYIp.CmLiUsSsS.nEt`.toLowerCase();
		tunnelContext.proxyFallbackEnabled = true;
	}
	tunnelContext.socksWhitelist = await getSocksWhitelist(env);
	tunnelContext.forceProxyHosts = await getForceProxyHosts(env);
	tunnelContext.tcpDialConcurrency = 识别运营商(request) === 'cmcc' ? 1 : 2;
	tunnelContext.preloadRaceDial = ['1', 'true'].includes(String(env?.PRELOAD_RACE_DIAL || '').toLowerCase());
	// NOTE: no automatic ProxyIP scan here. Auto-scanning rapidly TCP-probes many Cloudflare IPs,
	// which is flagged as network abuse. The ProxyIP scan is manual-only (admin "Scan now" button).
	return tunnelContext;
}

function getRequestTunnelContext(request) {
	return getWorkerRequestContext(request).tunnel || emptyTunnelContext();
}

async function applyProxyParamsToTunnelContext(url, uuid, tunnelContext = emptyTunnelContext()) {
	const { searchParams } = url;
	const pathname = decodeURIComponent(url.pathname);
	const pathLower = pathname.toLowerCase();

	tunnelContext.proxyAccount = null;
	tunnelContext.proxyType = null;
	tunnelContext.globalProxyEnabled = false;
	tunnelContext.parsedProxyAddress = {};

	const 链式代理路径匹配 = pathname.match(/\/video\/(.+)$/i);
	if (链式代理路径匹配) {
		try {
			const 链式代理明文 = base64SecretDecode(链式代理路径匹配[1], uuid);
			const { type, ...链式代理地址 } = JSON.parse(链式代理明文);
			if (!type || !反代协议默认端口[String(type).toLowerCase()]) throw new Error('Invalid chain proxy type');
			if (!链式代理地址.hostname || !链式代理地址.port) throw new Error('Chain proxy address is missing hostname or port');
			tunnelContext.proxyAccount = '';
			tunnelContext.proxyIP = 'chain-proxy';
			tunnelContext.proxyFallbackEnabled = false;
			tunnelContext.globalProxyEnabled = true;
			tunnelContext.proxyType = String(type).toLowerCase();
			tunnelContext.parsedProxyAddress = {
				username: 链式代理地址.username,
				password: 链式代理地址.password,
				hostname: 链式代理地址.hostname,
				port: Number(链式代理地址.port)
			};
			if (isNaN(tunnelContext.parsedProxyAddress.port)) throw new Error('Invalid chain proxy port');
			return tunnelContext;
		} catch (err) {
			debugError('Failed to parse chain proxy parameters:', err.message);
		}
	}

	tunnelContext.proxyAccount = searchParams.get('socks5') || searchParams.get('http') || searchParams.get('https') || searchParams.get('turn') || searchParams.get('sstp') || null;
	tunnelContext.globalProxyEnabled = searchParams.has('globalproxy');
	if (searchParams.get('socks5')) tunnelContext.proxyType = 'socks5';
	else if (searchParams.get('http')) tunnelContext.proxyType = 'http';
	else if (searchParams.get('https')) tunnelContext.proxyType = 'https';
	else if (searchParams.get('turn')) tunnelContext.proxyType = 'turn';
	else if (searchParams.get('sstp')) tunnelContext.proxyType = 'sstp';

	const 解析代理URL = (值, 强制全局 = true) => {
		const 匹配 = /^(socks5|http|https|turn|sstp):\/\/(.+)$/i.exec(值 || '');
		if (!匹配) return false;
		tunnelContext.proxyType = 匹配[1].toLowerCase();
		tunnelContext.proxyAccount = 匹配[2].split('/')[0];
		if (强制全局) tunnelContext.globalProxyEnabled = true;
		return true;
	};

	const 设置反代IP = (值) => {
		tunnelContext.proxyIP = 值;
		tunnelContext.proxyType = null;
		tunnelContext.proxyAccount = null;
		tunnelContext.parsedProxyAddress = {};
		tunnelContext.proxyFallbackEnabled = false;
		return tunnelContext;
	};

	const 提取路径值 = (值) => {
		if (!值.includes('://')) {
			const 斜杠索引 = 值.indexOf('/');
			return 斜杠索引 > 0 ? 值.slice(0, 斜杠索引) : 值;
		}
		const 协议拆分 = 值.split('://');
		if (协议拆分.length !== 2) return 值;
		const 斜杠索引 = 协议拆分[1].indexOf('/');
		return 斜杠索引 > 0 ? `${协议拆分[0]}://${协议拆分[1].slice(0, 斜杠索引)}` : 值;
	};

	const 查询反代IP = searchParams.get('proxyip');
	if (查询反代IP !== null) {
		if (!解析代理URL(查询反代IP)) return 设置反代IP(查询反代IP);
	} else {
		let 匹配 = /\/(socks5?|http|https|turn|sstp):\/?\/?([^/?#\s]+)/i.exec(pathname);
		if (匹配) {
			const 类型 = 匹配[1].toLowerCase();
			tunnelContext.proxyType = 类型 === 'sock' || 类型 === 'socks' ? 'socks5' : 类型;
			tunnelContext.proxyAccount = 匹配[2].split('/')[0];
			tunnelContext.globalProxyEnabled = true;
		} else if ((匹配 = /\/(g?s5|socks5|g?http|g?https|g?turn|g?sstp)=([^/?#\s]+)/i.exec(pathname))) {
			const 类型 = 匹配[1].toLowerCase();
			tunnelContext.proxyAccount = 匹配[2].split('/')[0];
			tunnelContext.proxyType = 类型.includes('sstp') ? 'sstp' : (类型.includes('turn') ? 'turn' : (类型.includes('https') ? 'https' : (类型.includes('http') ? 'http' : 'socks5')));
			if (类型.startsWith('g')) tunnelContext.globalProxyEnabled = true;
		} else if ((匹配 = /\/(proxyip[.=]|pyip=|ip=)([^?#\s]+)/.exec(pathLower))) {
			const 路径反代值 = 提取路径值(匹配[2]);
			if (!解析代理URL(路径反代值)) return 设置反代IP(路径反代值);
		}
	}

	if (!tunnelContext.proxyAccount) {
		tunnelContext.proxyType = null;
		tunnelContext.parsedProxyAddress = {};
		return tunnelContext;
	}

	try {
		tunnelContext.parsedProxyAddress = await 获取SOCKS5账号(tunnelContext.proxyAccount, 获取代理默认端口(tunnelContext.proxyType));
		if (searchParams.get('socks5')) tunnelContext.proxyType = 'socks5';
		else if (searchParams.get('http')) tunnelContext.proxyType = 'http';
		else if (searchParams.get('https')) tunnelContext.proxyType = 'https';
		else if (searchParams.get('turn')) tunnelContext.proxyType = 'turn';
		else if (searchParams.get('sstp')) tunnelContext.proxyType = 'sstp';
		else tunnelContext.proxyType = tunnelContext.proxyType || 'socks5';
	} catch (err) {
		debugError('Failed to parse SOCKS5 address:', err.message);
		tunnelContext.proxyType = null;
		tunnelContext.parsedProxyAddress = {};
	}
	return tunnelContext;
}

function getProxyConnectTimeoutMs(env) {
	const configured = Number(env?.CONNECT_TIMEOUT_MS);
	if (!Number.isFinite(configured) || configured <= 0) return PROXY_CONNECT_TIMEOUT_DEFAULT_MS;
	return Math.max(PROXY_CONNECT_TIMEOUT_MIN_MS, Math.min(PROXY_CONNECT_TIMEOUT_MAX_MS, Math.round(configured)));
}

function getProxyHandshakeTimeoutMs(proxyAddress = {}) {
	const configured = Number(proxyAddress?.timeoutMs);
	if (!Number.isFinite(configured) || configured <= 0) return PROXY_CONNECT_TIMEOUT_DEFAULT_MS;
	return Math.max(PROXY_CONNECT_TIMEOUT_MIN_MS, Math.min(PROXY_CONNECT_TIMEOUT_MAX_MS, Math.round(configured)));
}

function getDnsTcpResponseTimeoutMs(env) {
	const configured = Number(env?.DNS_TIMEOUT_MS || env?.CONNECT_TIMEOUT_MS);
	if (!Number.isFinite(configured) || configured <= 0) return DNS_TCP_RESPONSE_TIMEOUT_MS;
	return Math.max(PROXY_CONNECT_TIMEOUT_MIN_MS, Math.min(PROXY_CONNECT_TIMEOUT_MAX_MS, Math.round(configured)));
}

// Downstream backpressure high-water mark, env-overridable for per-network benchmarking.
// Default (ENGINE_DEFAULTS.DOWNLINK_BACKPRESSURE_HWM_BYTES) is unchanged when the env var is unset.
// Clamped to [64KB, 8MB] so a bad value can't break the stream or exhaust isolate memory.
function getDownlinkBackpressureHwm(env) {
	const configured = Number(env?.DOWNLINK_BACKPRESSURE_HWM_BYTES);
	if (!Number.isFinite(configured) || configured <= 0) return 下行背压高水位字节;
	return Math.max(64 * 1024, Math.min(8 * 1024 * 1024, Math.round(configured)));
}

// Downstream "grain" flush size, env-overridable for per-network benchmarking. Bigger = fewer, larger
// downstream flushes (better sustained download throughput); smaller = lower latency for tiny responses.
// Default (ENGINE_DEFAULTS.DOWNLINK_GRAIN_PACKET_BYTES) unchanged when unset; clamped [4KB, 1MB].
function getDownlinkGrainBytes(env) {
	const configured = Number(env?.DOWNLINK_GRAIN_PACKET_BYTES);
	if (!Number.isFinite(configured) || configured <= 0) return 下行Grain包字节;
	return Math.max(4 * 1024, Math.min(1024 * 1024, Math.round(configured)));
}

// Optional post-first-byte idle watchdog timeout (ms). 0 = disabled (default). Clamped to [1s, 10min].
function getIdleTimeoutMs(env) {
	const configured = Number(env?.IDLE_TIMEOUT_MS);
	if (!Number.isFinite(configured) || configured <= 0) return 0;
	return Math.max(1000, Math.min(600000, Math.round(configured)));
}

// First-byte (blackhole-detection) timeouts, split per route. Both default OFF (0). The DIRECT path is normally
// very fast (capture: direct TTFB p95 ~60ms, max ~1.2s) so it can use an aggressive deadline (~3s); the ProxyIP
// path is more variable (capture: a successful relay took ~3.9s) so it warrants a longer one (~5s). A single
// FIRST_BYTE_TIMEOUT_MS still sets both unless a specific override is given. Safe to enable ONLY because the
// watchdog now (a) never fires until the client actually sent a request and (b) never fires during an active
// upload write — so a preconnect / slow upload is never mistaken for a blackhole. Clamped [1s, 15s].
function 首字节超时取值(raw) {
	const v = Number(raw);
	if (!Number.isFinite(v) || v <= 0) return 0;
	return Math.max(1000, Math.min(15000, Math.round(v)));
}
function getDirectFirstByteTimeoutMs(env) {
	return 首字节超时取值(env?.DIRECT_FIRST_BYTE_TIMEOUT_MS ?? env?.FIRST_BYTE_TIMEOUT_MS);
}
function getProxyFirstByteTimeoutMs(env) {
	return 首字节超时取值(env?.PROXY_FIRST_BYTE_TIMEOUT_MS ?? env?.FIRST_BYTE_TIMEOUT_MS);
}

// Optional stuck-writer watchdog for the uplink queue (ms). 0 = disabled (default). A remote writer.write()
// that never settles (a wedged outbound socket) would otherwise block the upload path forever; when enabled,
// a write exceeding this bound rejects and the connection is torn down so the client re-dials. Off by default
// because writer.write() also blocks under legitimate backpressure (a slow-but-alive upload), which this
// timeout cannot distinguish — enable it only if you actually observe wedged-upload freezes. Clamped [1s,2min].
function getUplinkWriteTimeoutMs(env) {
	const configured = Number(env?.UPLINK_WRITE_TIMEOUT_MS);
	if (!Number.isFinite(configured) || configured <= 0) return 0;
	return Math.max(1000, Math.min(120000, Math.round(configured)));
}

// Opt-in gRPC duplex half-close (default OFF). When enabled, a NORMAL request-body EOF half-closes only the
// UPSTREAM writable (sends FIN so the origin knows the upload finished) and keeps reading the downstream
// response to completion, instead of closing the whole remote socket. This is the correct bidirectional gRPC
// lifecycle, but it is off by default because xray "gun" keeps the stream open until teardown (so the current
// full-close never truncates it), and this changes teardown on the primary transport. Enable it only if a
// client half-closes its request stream mid-response (a response cut off right after an upload finishes).
function isGrpcHalfCloseOnEof(env) {
	return ['1', 'true', 'yes', 'on'].includes(String(env?.GRPC_HALF_CLOSE_ON_EOF || '').trim().toLowerCase());
}

function getDialStaggerMs(env) {
	const configured = Number(env?.DIAL_STAGGER_MS);
	if (!Number.isFinite(configured) || configured < 0) return DIAL_STAGGER_MS;
	return Math.max(0, Math.min(500, Math.round(configured)));
}

async function withOperationTimeout(operation, timeoutMs, message, onTimeout = null) {
	let timedOut = false;
	let timer = null;
	try {
		return await Promise.race([
			Promise.resolve(operation),
			new Promise((_, reject) => {
				timer = setTimeout(() => {
					timedOut = true;
					reject(new Error(message));
					queueMicrotask(() => {
						try { onTimeout?.() } catch (e) { }
					});
				}, Math.max(1, Number(timeoutMs) || PROXY_CONNECT_TIMEOUT_DEFAULT_MS));
			}),
		]);
	} finally {
		clearTimeout(timer);
		if (timedOut && operation && typeof operation.catch === 'function') operation.catch(() => { });
	}
}

function cancelReaderQuietly(reader, reason = 'operation timed out') {
	try {
		const result = reader?.cancel?.(reason);
		if (result && typeof result.catch === 'function') result.catch(() => { });
	} catch (e) { }
}

async function readWithOperationTimeout(reader, timeoutMs, message) {
	return withOperationTimeout(reader.read(), timeoutMs, message, () => cancelReaderQuietly(reader, message));
}

async function writeWithOperationTimeout(writer, chunk, timeoutMs, message) {
	return withOperationTimeout(writer.write(chunk), timeoutMs, message);
}

async function socketOpenedWithTimeout(socket, timeoutMs, message) {
	if (!socket?.opened) return;
	return withOperationTimeout(socket.opened, timeoutMs, message, () => {
		try { socket?.close?.() } catch (e) { }
	});
}

async function fetchWithTimeout(resource, init = {}, timeoutMs = DOH_LOOKUP_TIMEOUT_MS, fetchImpl = fetch) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || DOH_LOOKUP_TIMEOUT_MS));
	try {
		return await fetchImpl(resource, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

function stableHashText(value) {
	let hash = 2166136261;
	for (const char of String(value || '')) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

function proxyCacheKey(proxyIP, targetHost = '', UUID = '') {
	const baseKey = `proxy-resolution:${PROXY_RESOLUTION_CACHE_VERSION}:${stableHashText(String(proxyIP || '').toLowerCase())}`;
	const targetKey = String(targetHost || '').toLowerCase();
	const uuidKey = String(UUID || '').toLowerCase();
	if (!targetKey && !uuidKey) return baseKey;
	return `${baseKey}:${stableHashText(targetKey)}:${stableHashText(uuidKey)}`;
}

function proxyEndpointKey(endpoint) {
	return `${endpoint[0]}:${endpoint[1]}`;
}

function isValidProxyEndpointHost(host) {
	if (typeof host !== 'string' || !host || host.length > 255 || /[\s/\\?#]/.test(host)) return false;
	if (/^\[[\da-f:]+\]$/i.test(host)) return true;
	if (/^(?:[a-f0-9]{0,4}:){1,7}[a-f0-9]{0,4}$/i.test(host)) return true;
	if (/^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(host)) return true;
	return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i.test(host);
}

function getProxyEndpointCursorKey(proxyIP, targetHost) {
	return `${String(proxyIP || '').toLowerCase()}|${String(targetHost || '').toLowerCase()}`;
}

function getProxyEndpointCursor(proxyIP, targetHost, length) {
	if (!length) return 0;
	const key = getProxyEndpointCursorKey(proxyIP, targetHost);
	return (PROXY_ENDPOINT_CURSOR.get(key) || 0) % length;
}

function setProxyEndpointCursor(proxyIP, targetHost, index, length) {
	if (!length) return;
	const key = getProxyEndpointCursorKey(proxyIP, targetHost);
	PROXY_ENDPOINT_CURSOR.set(key, index % length);
	while (PROXY_ENDPOINT_CURSOR.size > 256) PROXY_ENDPOINT_CURSOR.delete(PROXY_ENDPOINT_CURSOR.keys().next().value);
}

function normalizeProxyEndpoint(endpoint) {
	if (!Array.isArray(endpoint) || endpoint.length < 2) return null;
	const host = String(endpoint[0] || '').trim().toLowerCase();
	const port = Number(endpoint[1]);
	if (!isValidProxyEndpointHost(host) || !Number.isInteger(port) || port < 1 || port > 65535) return null;
	return [host, port];
}

function normalizeProxyHealthEntry(entry, now) {
	if (!entry || typeof entry !== 'object') return null;
	const lastSeenAt = Number(entry.lastSeenAt || entry.lastSuccessAt || entry.lastFailureAt || entry.updatedAt || 0);
	if (lastSeenAt && now - lastSeenAt > PROXY_ENDPOINT_HEALTH_MAX_AGE_MS) return null;
	const rawLatency = entry.latencyMs;
	return {
		successes: Math.max(0, Math.min(1000, Number(entry.successes) || 0)),
		failures: Math.max(0, Math.min(1000, Number(entry.failures) || 0)),
		latencyMs: rawLatency === null || rawLatency === undefined || rawLatency === '' ? null : (Number.isFinite(Number(rawLatency)) ? Math.max(1, Math.min(60000, Math.round(Number(rawLatency)))) : null),
		cooldownUntil: Number.isFinite(Number(entry.cooldownUntil)) ? Math.max(0, Math.round(Number(entry.cooldownUntil))) : 0,
		lastSeenAt: lastSeenAt || 0,
		lastSuccessAt: Number.isFinite(Number(entry.lastSuccessAt)) ? Math.max(0, Math.round(Number(entry.lastSuccessAt))) : 0,
		lastFailureAt: Number.isFinite(Number(entry.lastFailureAt)) ? Math.max(0, Math.round(Number(entry.lastFailureAt))) : 0,
	};
}

function normalizeProxyCacheRecord(raw, now = Date.now()) {
	let data = raw;
	if (typeof raw === 'string') {
		try { data = JSON.parse(raw) }
		catch (_) { return null }
	}
	if (!data || typeof data !== 'object' || data.version !== PROXY_RESOLUTION_CACHE_VERSION) return null;
	const updatedAt = Number(data.updatedAt || data.createdAt || 0);
	if (!Number.isFinite(updatedAt) || updatedAt <= 0 || now - updatedAt > PROXY_RESOLUTION_CACHE_STALE_TTL_MS) return null;
	const endpoints = [];
	const seen = new Set();
	for (const rawEndpoint of Array.isArray(data.endpoints) ? data.endpoints : []) {
		const endpoint = normalizeProxyEndpoint(rawEndpoint);
		if (!endpoint) continue;
		const key = proxyEndpointKey(endpoint);
		if (seen.has(key)) continue;
		seen.add(key);
		endpoints.push(endpoint);
		if (endpoints.length >= PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS) break;
	}
	if (!endpoints.length) return null;
	const health = {};
	const inputHealth = data.health && typeof data.health === 'object' ? data.health : {};
	for (const endpoint of endpoints) {
		const key = proxyEndpointKey(endpoint);
		const entry = normalizeProxyHealthEntry(inputHealth[key], now);
		if (entry) health[key] = entry;
	}
	return {
		version: PROXY_RESOLUTION_CACHE_VERSION,
		createdAt: Number(data.createdAt) || updatedAt,
		updatedAt,
		isFresh: now - updatedAt <= PROXY_RESOLUTION_CACHE_FRESH_TTL_MS,
		endpoints,
		health,
		lastKvWriteAt: Number(data.lastKvWriteAt) || 0,
	};
}

function touchProxyL1Cache(key, record) {
	if (!key || !record) return;
	if (PROXY_RESOLUTION_L1_CACHE.has(key)) PROXY_RESOLUTION_L1_CACHE.delete(key);
	PROXY_RESOLUTION_L1_CACHE.set(key, record);
	while (PROXY_RESOLUTION_L1_CACHE.size > PROXY_RESOLUTION_CACHE_MAX_L1_ENTRIES) {
		PROXY_RESOLUTION_L1_CACHE.delete(PROXY_RESOLUTION_L1_CACHE.keys().next().value);
	}
}

async function readProxyResolutionCache(env, proxyIP, now = Date.now(), targetHost = '', UUID = '') {
	const key = proxyCacheKey(proxyIP, targetHost, UUID);
	const memoryRecord = normalizeProxyCacheRecord(PROXY_RESOLUTION_L1_CACHE.get(key), now);
	if (memoryRecord) {
		touchProxyL1Cache(key, memoryRecord);
		return { key, record: memoryRecord, source: 'memory' };
	}
	if (!isProxyResolutionKvCacheEnabled(env)) return { key, record: null, source: 'none' };
	if (!env?.KV || typeof env.KV.get !== 'function') return { key, record: null, source: 'none' };
	try {
		const raw = await env.KV.get(key);
		const record = normalizeProxyCacheRecord(raw, now);
		if (record) {
			touchProxyL1Cache(key, record);
			return { key, record, source: 'kv' };
		}
	} catch (error) {
		log(`[ProxyIP cache] KV read failed: ${error?.message || error}`);
	}
	return { key, record: null, source: 'none' };
}

function serializeProxyCacheRecord(record, now = Date.now()) {
	const health = {};
	for (const endpoint of record.endpoints || []) {
		const key = proxyEndpointKey(endpoint);
		if (record.health?.[key]) health[key] = record.health[key];
	}
	return JSON.stringify({
		version: PROXY_RESOLUTION_CACHE_VERSION,
		createdAt: record.createdAt || now,
		updatedAt: record.updatedAt || now,
		endpoints: (record.endpoints || []).slice(0, PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS),
		health,
		lastKvWriteAt: Number(record.lastKvWriteAt) || 0,
	});
}

function resetProxyCacheKvThrottle() { 上次代理缓存KV写入 = 0; }

function scheduleProxyCacheWrite(env, ctx, cacheKey, record, now = Date.now(), force = false) {
	if (!isProxyResolutionKvCacheEnabled(env)) return;
	if (!env?.KV || typeof env.KV.put !== 'function' || !cacheKey || !record) return;
	if (!force && record.lastKvWriteAt && now - record.lastKvWriteAt < PROXY_RESOLUTION_CACHE_KV_WRITE_COOLDOWN_MS) return;
	// Global throttle across all target-aware keys so active browsing cannot exhaust the
	// free-plan daily KV write quota. Applies even to forced writes (they retry on the next pass).
	if (now - 上次代理缓存KV写入 < PROXY_RESOLUTION_CACHE_KV_MIN_GLOBAL_INTERVAL_MS) return;
	上次代理缓存KV写入 = now;
	record.lastKvWriteAt = now;
	let writePromise;
	try {
		writePromise = Promise.resolve(env.KV.put(cacheKey, serializeProxyCacheRecord(record, now), { expirationTtl: PROXY_RESOLUTION_CACHE_KV_TTL_SECONDS }))
			.catch(error => log(`[ProxyIP cache] KV write failed: ${error?.message || error}`));
		if (ctx?.waitUntil) {
			try { ctx?.waitUntil?.(writePromise) }
			catch (error) {
				log(`[ProxyIP cache] waitUntil failed: ${error?.message || error}`);
				writePromise.catch(() => { });
			}
		} else writePromise.catch(() => { });
	} catch (error) {
		log(`[ProxyIP cache] KV write failed: ${error?.message || error}`);
	}
}

function endpointJitter(endpoint, seed) {
	return parseInt(stableHashText(`${seed}|${proxyEndpointKey(endpoint)}`).slice(0, 8), 16) / 0xffffffff;
}

function orderProxyEndpoints(endpoints, health = {}, now = Date.now(), seed = '') {
	const normalized = [];
	const seen = new Set();
	for (const rawEndpoint of endpoints || []) {
		const endpoint = normalizeProxyEndpoint(rawEndpoint);
		if (!endpoint) continue;
		const key = proxyEndpointKey(endpoint);
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push(endpoint);
	}
	const score = endpoint => {
		const h = health[proxyEndpointKey(endpoint)] || {};
		const latency = Number.isFinite(Number(h.latencyMs)) ? Number(h.latencyMs) : 700;
		const failures = Number(h.failures) || 0;
		const successes = Number(h.successes) || 0;
		const successBonus = successes > 0 ? Math.min(250, successes * 12) : 0;
		return latency + failures * 450 - successBonus + endpointJitter(endpoint, seed) * 20;
	};
	const active = normalized.filter(endpoint => {
		const h = health[proxyEndpointKey(endpoint)] || {};
		return !(Number(h.cooldownUntil) > now);
	});
	const candidates = active.length ? active : normalized;
	return candidates.sort((a, b) => score(a) - score(b)).slice(0, PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS);
}

function recordProxyEndpointResult(record, endpoint, success, latencyMs, now = Date.now()) {
	if (!record || !endpoint) return null;
	const normalizedEndpoint = normalizeProxyEndpoint(endpoint);
	if (!normalizedEndpoint) return null;
	const key = proxyEndpointKey(normalizedEndpoint);
	const current = normalizeProxyHealthEntry(record.health?.[key], now) || {
		successes: 0,
		failures: 0,
		latencyMs: null,
		cooldownUntil: 0,
		lastSeenAt: 0,
		lastSuccessAt: 0,
		lastFailureAt: 0,
	};
	if (!record.health) record.health = {};
	current.lastSeenAt = now;
	if (success) {
		current.successes = Math.min(1000, current.successes + 1);
		current.failures = 0;
		current.cooldownUntil = 0;
		current.lastSuccessAt = now;
		if (Number.isFinite(Number(latencyMs)) && Number(latencyMs) > 0) {
			const measured = Math.round(Number(latencyMs));
			current.latencyMs = current.latencyMs ? Math.round(current.latencyMs * 0.7 + measured * 0.3) : measured;
		}
	} else {
		current.failures = Math.min(1000, current.failures + 1);
		current.lastFailureAt = now;
		if (current.failures >= PROXY_ENDPOINT_FAILURE_COOLDOWN_THRESHOLD) current.cooldownUntil = now + PROXY_ENDPOINT_FAILURE_COOLDOWN_MS;
	}
	record.health[key] = current;
	return current;
}

function parsePreferredEndpointText(value) {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	const regex = /^(\[[\da-fA-F:]+\]|[\d.]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*)(?::(\d+))?(?:#(.+))?$/;
	const match = text.match(regex);
	if (!match) return null;
	const port = match[2] || '443';
	const portNumber = Number(port);
	if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) return null;
	return {
		address: match[1],
		port,
		remark: match[3] || '',
		hasExplicitPort: Boolean(match[2]),
	};
}

function parsePreferredEndpoint(value) {
	const parsed = parsePreferredEndpointText(value);
	if (!parsed) return null;
	return {
		address: parsed.address,
		port: parsed.port,
		remark: parsed.remark || parsed.address,
	};
}

function formatPreferredEndpointVariant(parsed, address) {
	return `${address}${parsed.hasExplicitPort ? ':' + parsed.port : ''}${parsed.remark ? '#' + parsed.remark : ''}`;
}

function expandPreferredEndpointVariants(value) {
	const parsed = parsePreferredEndpointText(value);
	if (!parsed) return [value];
	const address = parsed.address;
	if (address.includes('*') || address.startsWith('[') || isIPHostname(address) || !address.includes('.')) return [value];
	const lowerAddress = address.toLowerCase();
	const labelCount = lowerAddress.split('.').filter(Boolean).length;
	const isWwwApexPair = lowerAddress.startsWith('www.') && labelCount === 3;
	const isBareApexPair = !lowerAddress.startsWith('www.') && labelCount === 2;
	if (!isWwwApexPair && !isBareApexPair) return [formatPreferredEndpointVariant(parsed, lowerAddress)];
	const pairedAddress = isWwwApexPair ? lowerAddress.slice(4) : `www.${lowerAddress}`;
	if (!pairedAddress || pairedAddress === lowerAddress || !isValidProxyEndpointHost(pairedAddress) || isIPHostname(pairedAddress)) return [formatPreferredEndpointVariant(parsed, lowerAddress)];
	return [...new Set([
		formatPreferredEndpointVariant(parsed, lowerAddress),
		formatPreferredEndpointVariant(parsed, pairedAddress),
	])];
}

function expandPreferredEndpointList(values) {
	const expanded = [];
	for (const value of values || []) {
		for (const variant of expandPreferredEndpointVariants(value)) expanded.push(variant);
	}
	return [...new Set(expanded)];
}

function rememberProxyEndpointResult(env, ctx, proxyIP, endpoint, success, latencyMs, now = Date.now(), targetHost = '', UUID = '') {
	const normalizedEndpoint = normalizeProxyEndpoint(endpoint);
	if (!normalizedEndpoint) return;
	const cacheKey = proxyCacheKey(proxyIP, targetHost, UUID);
	const record = normalizeProxyCacheRecord(PROXY_RESOLUTION_L1_CACHE.get(cacheKey), now);
	if (!record) return;
	recordProxyEndpointResult(record, normalizedEndpoint, success, latencyMs, now);
	touchProxyL1Cache(cacheKey, record);
	scheduleProxyCacheWrite(env, ctx, cacheKey, record, now, false);
}

async function refreshProxyResolutionCache(env, ctx, cacheKey, proxyIP, 目标域名, UUID, priorRecord = null, liveResolver = resolveProxyEndpointsLive) {
	const now = Date.now();
	const endpoints = await liveResolver(proxyIP, 目标域名, UUID);
	const record = normalizeProxyCacheRecord({
		version: PROXY_RESOLUTION_CACHE_VERSION,
		createdAt: priorRecord?.createdAt || now,
		updatedAt: now,
		endpoints,
		health: priorRecord?.health || {},
	}, now);
	if (!record) return null;
	touchProxyL1Cache(cacheKey, record);
	scheduleProxyCacheWrite(env, ctx, cacheKey, record, now, true);
	return record;
}

function proxyResolutionInFlightKey(cacheKey, 目标域名, UUID) {
	return `${cacheKey}:${stableHashText(目标域名)}:${stableHashText(UUID)}`;
}

function startProxyResolutionRefresh(env, ctx, cacheKey, proxyIP, 目标域名, UUID, priorRecord = null, liveResolver = resolveProxyEndpointsLive) {
	const inFlightKey = proxyResolutionInFlightKey(cacheKey, 目标域名, UUID);
	const existing = PROXY_RESOLUTION_IN_FLIGHT.get(inFlightKey);
	if (existing) return existing;
	const refreshPromise = refreshProxyResolutionCache(env, ctx, cacheKey, proxyIP, 目标域名, UUID, priorRecord, liveResolver)
		.finally(() => PROXY_RESOLUTION_IN_FLIGHT.delete(inFlightKey));
	PROXY_RESOLUTION_IN_FLIGHT.set(inFlightKey, refreshPromise);
	return refreshPromise;
}

async function getProxyResolutionRecord(env, ctx, proxyIP, 目标域名 = 'dash.cloudflare.com', UUID = '00000000-0000-4000-8000-000000000000', liveResolver = resolveProxyEndpointsLive) {
	proxyIP = String(proxyIP || '').toLowerCase();
	const now = Date.now();
	const cache = await readProxyResolutionCache(env, proxyIP, now, 目标域名, UUID);
	if (cache.record) {
		if (!cache.record.isFresh) {
			const refreshPromise = startProxyResolutionRefresh(env, ctx, cache.key, proxyIP, 目标域名, UUID, cache.record, liveResolver)
				.catch(error => log(`[ProxyIP cache] Background refresh failed: ${error?.message || error}`));
			ctx?.waitUntil?.(refreshPromise);
		}
		return { key: cache.key, record: cache.record, source: cache.source };
	}
	const record = await startProxyResolutionRefresh(env, ctx, cache.key, proxyIP, 目标域名, UUID, null, liveResolver);
	return { key: cache.key, record, source: record ? 'live' : 'none' };
}

async function resolveProxyEndpointsLive(proxyIP, 目标域名 = 'dash.cloudflare.com', UUID = '00000000-0000-4000-8000-000000000000') {
	return 解析地址端口Legacy(proxyIP, 目标域名, UUID);
}

async function resolveProxyEndpointsLiveWithEnv(env, proxyIP, 目标域名 = 'dash.cloudflare.com', UUID = '00000000-0000-4000-8000-000000000000') {
	return 解析地址端口Legacy(proxyIP, 目标域名, UUID, env);
}

export const __testPerformanceHelpers = {
	validateTunnelTarget,
	PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS,
	PROXY_RESOLUTION_CACHE_KV_TTL_SECONDS,
	PROXY_RESOLUTION_CACHE_KV_MIN_GLOBAL_INTERVAL_MS,
	PROXY_RESOLUTION_L1_CACHE,
	DNS_RESULT_CACHE,
	MD5MD5_RESULT_CACHE,
	SHA224_RESULT_CACHE,
	getProxyConnectTimeoutMs,
	getDialStaggerMs,
	getDohLookupUrl,
	getDnsTcpEndpoint,
	createTunnelContext,
	applyProxyParamsToTunnelContext,
	getProxyResolutionRecord,
	fetchWithTimeout,
	normalizeProxyCacheRecord,
	openStaggeredCandidates,
	orderProxyEndpoints,
	proxyCacheKey,
	readProxyResolutionCache,
	recordProxyEndpointResult,
	DoH查询,
	MD5MD5,
	md5Bytes,
	deriveShadowsocksMasterKey: SS派生主密钥,
	sha224,
	parsePreferredEndpoint,
	expandPreferredEndpointVariants,
	scheduleProxyCacheWrite,
	resetProxyCacheKvThrottle,
	isProxyResolutionKvCacheEnabled,
	connectStreams,
	forwardataudp,
	socks5Connect,
	httpConnect,
	httpsConnect,
	handleGrpcRequest: 处理gRPC请求,
	encodeGrpcDataFrame,
	encodeGrpcFramePrefix,
	parseGrpcFrameChunk,
	unwrapGrpcMessagePayloads,
	getSubscriptionRequestOptions,
	finalizeSubscriptionContent,
	getTransportConfig: 获取传输协议配置,
	getTransportPathParamValue: 获取传输路径参数值,
	readConfigJson: 读取config_JSON,
	translateHTMLVisibleText,
	injectEnglishRuntimeTranslator,
	normalizeEnglishStaticPageCachePath,
	buildRequestLogEntryKey,
	readRequestLogs,
	recordRequestLog: 请求日志记录,
	writeRequestLogEntry,
	isSpeedTestSite,
	matchesHostPattern,
	patchClashSubscription: Clash订阅配置文件热补丁,
	patchSingboxSubscription: Singbox订阅配置文件热补丁,
	patchSurgeSubscription: Surge订阅配置文件热补丁,
	readGrpcFrameLength,
	parseDnsTcpFrames: 解析DNS_TCP帧,
	dnsAnswerMinTtlMs: 解析DNS应答最小TTL毫秒,
	readXhttpFirstPacket: 读取XHTTP首包,
	createUploadQueue: 创建上行写入队列,
	createConnectionTracer: 创建连接追踪器,
	traceUplink: 追踪上行,
	traceDownlink: 追踪下行,
	traceFirstByte: 追踪首字节,
	traceRoute: 追踪记录路由,
	traceClose: 追踪关闭,
	traceFallback: 追踪回退,
	traceDns: 追踪DNS,
	classifyClose: 分类关闭原因,
	isStreamCancellation: 是流取消错误,
	updateTraceRatePeaks: 更新追踪速率峰值,
	formatByteCount: 格式化字节数,
	getUplinkWriteTimeoutMs,
	getDirectFirstByteTimeoutMs,
	getProxyFirstByteTimeoutMs,
	isReplayableTlsFirstPacket: 是可重放的TLS首包,
	normalizeConfigHost,
	splitConfigArray: 整理成数组,
	base64SecretEncode,
	base64SecretDecode,
};

async function 解析地址端口(proxyIP, 目标域名 = 'dash.cloudflare.com', UUID = '00000000-0000-4000-8000-000000000000', env = null, ctx = null) {
	proxyIP = String(proxyIP || '').toLowerCase();
	const now = Date.now();
	const liveResolver = (proxyValue, targetValue, uuidValue) => resolveProxyEndpointsLiveWithEnv(env, proxyValue, targetValue, uuidValue);
	const resolution = await getProxyResolutionRecord(env, ctx, proxyIP, 目标域名, UUID, liveResolver);
	if (resolution.record) {
		const ordered = orderProxyEndpoints(resolution.record.endpoints, resolution.record.health, now, `${目标域名}|${UUID}`);
		log(`[ProxyIP resolver] Loaded ${resolution.source} resolver (${resolution.record.isFresh ? 'fresh' : 'stale'}). Total: ${ordered.length}\n${ordered.map(([ip, port], index) => `${index + 1}. ${ip}:${port}`).join('\n')}`);
		return ordered;
	}

	const ordered = [];
	log(`[ProxyIP resolver] Loaded live resolver. Total: ${ordered.length}\n${ordered.map(([ip, port], index) => `${index + 1}. ${ip}:${port}`).join('\n')}`);
	return ordered;
}

async function 解析地址端口Legacy(proxyIP, 目标域名 = 'dash.cloudflare.com', UUID = '00000000-0000-4000-8000-000000000000', env = null) {
	proxyIP = String(proxyIP || '').toLowerCase();
	const dohLookupUrl = getDohLookupUrl(env);

		function 解析地址端口字符串(str) {
			let 地址 = str, 端口 = 443;
			if (str.includes(']:')) {
				const parts = str.split(']:');
				地址 = parts[0] + ']';
				端口 = parseInt(parts[1], 10) || 端口;
			} else if ((str.match(/:/g) || []).length === 1 && !str.startsWith('[')) {
				const colonIndex = str.lastIndexOf(':');
				地址 = str.slice(0, colonIndex);
				端口 = parseInt(str.slice(colonIndex + 1), 10) || 端口;
			}
			return [地址, 端口];
		}

		function 解析TXT反代记录(txtData) {
			return txtData.flatMap(data => {
				if (data.startsWith('"') && data.endsWith('"')) data = data.slice(1, -1);
				return data.replace(/\\010/g, ',').replace(/\n/g, ',').split(',').map(s => s.trim()).filter(Boolean);
			}).map(prefix => 解析地址端口字符串(prefix));
		}

		const 反代IP数组 = await 整理成数组(proxyIP);
		let 所有反代数组 = [];
		const ipv4Regex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
		const ipv6Regex = /^\[?(?:[a-fA-F0-9]{0,4}:){1,7}[a-fA-F0-9]{0,4}\]?$/;


		for (const singleProxyIP of 反代IP数组) {
			let [地址, 端口] = 解析地址端口字符串(singleProxyIP);

			if (singleProxyIP.includes('.tp')) {
				const tpMatch = singleProxyIP.match(/\.tp(\d+)/);
				if (tpMatch) 端口 = parseInt(tpMatch[1], 10);
			}


			if (ipv4Regex.test(地址) || ipv6Regex.test(地址)) {
				log(`[ProxyIP resolver] ${地址} is an IP address; using it directly`);
				所有反代数组.push([地址, 端口]);
				continue;
			}

			const [txtRecords, aRecords] = await Promise.all([
				DoH查询(地址, 'TXT', dohLookupUrl),
				DoH查询(地址, 'A', dohLookupUrl)
			]);

			const txtData = txtRecords.filter(r => r.type === 16).map(r => (r.data));
			const txtAddresses = 解析TXT反代记录(txtData);
			if (txtAddresses.length > 0) {
				log(`[ProxyIP resolver] ${地址} used TXT records with ${txtAddresses.length} results`);
				所有反代数组.push(...txtAddresses);
				continue;
			}

			const ipv4List = aRecords.filter(r => r.type === 1).map(r => r.data);
			if (ipv4List.length > 0) {
				log(`[ProxyIP resolver] ${地址} had no TXT records; using A records with ${ipv4List.length} results`);
				所有反代数组.push(...ipv4List.map(ip => [ip, 端口]));
				continue;
			}

			const aaaaRecords = await DoH查询(地址, 'AAAA', dohLookupUrl);
			const ipv6List = aaaaRecords.filter(r => r.type === 28).map(r => `[${r.data}]`);
			if (ipv6List.length > 0) {
				log(`[ProxyIP resolver] ${地址} had no TXT or A records; using AAAA records with ${ipv6List.length} results`);
				所有反代数组.push(...ipv6List.map(ip => [ip, 端口]));
			} else {
				log(`[ProxyIP resolver] ${地址} had no TXT, A, or AAAA records; keeping the original hostname`);
				所有反代数组.push([地址, 端口]);
			}
		}
		const 排序后数组 = 所有反代数组.sort((a, b) => a[0].localeCompare(b[0]));
		const 目标根域名 = 目标域名.includes('.') ? 目标域名.split('.').slice(-2).join('.') : 目标域名;
		let 随机种子 = [...(目标根域名 + UUID)].reduce((a, c) => a + c.charCodeAt(0), 0);
		log(`[ProxyIP resolver] Random seed: ${随机种子}\nTarget site: ${目标根域名}`)
		// Deterministic, uniform Fisher-Yates shuffle seeded per (target, UUID). Using
		// Array.sort with a mutating-seed comparator produces a non-uniform, engine-dependent order.
		// Exact 32-bit LCG (Math.imul avoids float-precision loss) mapped to [0, 1).
		const 下一个随机 = () => (随机种子 = (Math.imul(随机种子, 1103515245) + 12345) & 0x7fffffff) / 0x80000000;
		const 洗牌后 = 排序后数组.slice();
		for (let i = 洗牌后.length - 1; i > 0; i--) {
			const j = Math.min(i, Math.floor(下一个随机() * (i + 1)));
			const tmp = 洗牌后[i]; 洗牌后[i] = 洗牌后[j]; 洗牌后[j] = tmp;
		}
		const liveEndpoints = 洗牌后.slice(0, PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS);
		log(`[ProxyIP resolver] Resolution complete. Total: ${liveEndpoints.length}\n${liveEndpoints.map(([ip, port], index) => `${index + 1}. ${ip}:${port}`).join('\n')}`);
	return liveEndpoints;
}


// Setup-reminder page for /login and /admin when ADMIN and/or KV are not configured. Deliberately generic
// (looks like any unconfigured web app) so it reveals nothing about what this Worker actually is. Only ever
// reachable on the admin paths while misconfigured; disappears once ADMIN + KV are set.
function 管理面板设置提示(缺少配置) {
	const 列表项 = 缺少配置.map(项 => `<li>${项}</li>`).join('');
	return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Setup required</title>
<style>html{color-scheme:light dark;font-family:system-ui,Segoe UI,Arial,sans-serif}
body{max-width:38em;margin:3rem auto;padding:0 1.25rem;line-height:1.55}
h1{font-size:1.4rem}code{background:rgba(128,128,128,.18);padding:.1em .35em;border-radius:4px}
li{margin:.4rem 0}.hint{opacity:.75;font-size:.9rem;margin-top:1.5rem}</style></head>
<body><h1>Setup required</h1>
<p>The admin panel is not usable yet because the following ${缺少配置.length > 1 ? 'items are' : 'item is'} not configured:</p>
<ul>${列表项}</ul>
<p>Add ${缺少配置.length > 1 ? 'them' : 'it'} in the Cloudflare dashboard (Workers &amp; Pages &rarr; your Worker &rarr; Settings), then redeploy.</p>
<p class="hint">The connection itself does not require the admin panel — this message only appears on the admin routes while setup is incomplete.</p>
</body></html>`;
}

async function nginx() {
	return `
	<!DOCTYPE html>
	<html>
	<head>
	<title>Welcome to nginx!</title>
	<style>
		body {
			width: 35em;
			margin: 0 auto;
			font-family: Tahoma, Verdana, Arial, sans-serif;
		}
	</style>
	</head>
	<body>
	<h1>Welcome to nginx!</h1>
	<p>If you see this page, the nginx web server is successfully installed and
	working. Further configuration is required.</p>

	<p>For online documentation and support please refer to
	<a href="http://nginx.org/">nginx.org</a>.<br/>
	Commercial support is available at
	<a href="http://nginx.com/">nginx.com</a>.</p>

	<p><em>Thank you for using nginx.</em></p>
	</body>
	</html>
	`
}

async function html1101(host, 访问IP) {
	const now = new Date();
	const 格式化时间戳 = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
	const 随机字符串 = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');

	return `<!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>
<title>Worker threw exception | ${host} | Cloudflare</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/cf.errors.css" />
<!--[if lt IE 9]><link rel="stylesheet" id='cf_styles-ie-css' href="/cdn-cgi/styles/cf.errors.ie.css" /><![endif]-->
<style>body{margin:0;padding:0}</style>


<!--[if gte IE 10]><!-->
<script>
  if (!navigator.cookieEnabled) {
    window.addEventListener('DOMContentLoaded', function () {
      var cookieEl = document.getElementById('cookie-alert');
      cookieEl.style.display = 'block';
    })
  }
</script>
<!--<![endif]-->

</head>
<body>
    <div id="cf-wrapper">
        <div class="cf-alert cf-alert-error cf-cookie-error" id="cookie-alert" data-translate="enable_cookies">Please enable cookies.</div>
        <div id="cf-error-details" class="cf-error-details-wrapper">
            <div class="cf-wrapper cf-header cf-error-overview">
                <h1>
                    <span class="cf-error-type" data-translate="error">Error</span>
                    <span class="cf-error-code">1101</span>
                    <small class="heading-ray-id">Ray ID: ${随机字符串} &bull; ${格式化时间戳} UTC</small>
                </h1>
                <h2 class="cf-subheadline" data-translate="error_desc">Worker threw exception</h2>
            </div><!-- /.header -->

            <section></section><!-- spacer -->

            <div class="cf-section cf-wrapper">
                <div class="cf-columns two">
                    <div class="cf-column">
                        <h2 data-translate="what_happened">What happened?</h2>
                            <p>You've requested a page on a website (${host}) that is on the <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=error_100x" target="_blank">Cloudflare</a> network. An unknown error occurred while rendering the page.</p>
                    </div>

                    <div class="cf-column">
                        <h2 data-translate="what_can_i_do">What can I do?</h2>
                            <p><strong>If you are the owner of this website:</strong><br />refer to <a href="https://developers.cloudflare.com/workers/observability/errors/" target="_blank">Workers - Errors and Exceptions</a> and check Workers Logs for ${host}.</p>
                    </div>

                </div>
            </div><!-- /.section -->

            <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
    <p class="text-13">
      <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold"> ${随机字符串}</strong></span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
      <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
        Your IP:
        <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
        <span class="hidden" id="cf-footer-ip">${访问IP}</span>
        <span class="cf-footer-separator sm:hidden">&bull;</span>
      </span>
      <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing" id="brand_link" target="_blank">Cloudflare</a></span>

    </p>
    <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
  </div><!-- /.error-footer -->

        </div><!-- /#cf-error-details -->
    </div><!-- /#cf-wrapper -->

     <script>
    window._cf_translation = {};


  </script>
</body>
</html>`;
}
