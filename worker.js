// ============================================================
// Cloudflare Worker — 数据收集后端
// 路由:
//   GET  /          → 访客前端 (index.html)
//   POST /api/collect → 接收数据，存入 KV
//   GET  /api/records → 后台读取所有记录（需要密码）
//   DELETE /api/records → 清空数据（需要密码）
//   GET  /admin     → 后台管理页 (admin.html)
// ============================================================

// ⚠️ 修改这里的密码！访问 /admin 和 /api/records 时需要这个密码
const ADMIN_PASSWORD = 'your_password_here';

// KV 命名空间绑定名称（在 wrangler.toml 里配置）
// KV_RECORDS 会自动注入

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ── POST /api/collect ── 接收访客数据
    if (path === '/api/collect' && method === 'POST') {
      try {
        const data = await request.json();
        data.ip = request.headers.get('CF-Connecting-IP') || 
                  request.headers.get('X-Forwarded-For') || 
                  'unknown';
        data.country = request.cf?.country || null;
        data.city = request.cf?.city || null;
        data.timezone = request.cf?.timezone || null;
        data.serverTime = new Date().toISOString();

        const key = `record_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
        await env.KV_RECORDS.put(key, JSON.stringify(data), {
          expirationTtl: 60 * 60 * 24 * 30 // 30天过期
        });

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch(e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ── GET /api/records ── 读取所有记录（需认证）
    if (path === '/api/records' && method === 'GET') {
      if (!checkAuth(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const list = await env.KV_RECORDS.list({ prefix: 'record_' });
      const records = [];
      
      for (const key of list.keys) {
        const val = await env.KV_RECORDS.get(key.name);
        if (val) {
          try { records.push(JSON.parse(val)); } catch(e) {}
        }
      }
      
      records.sort((a, b) => new Date(a.time) - new Date(b.time));
      
      return new Response(JSON.stringify({ records, total: records.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── DELETE /api/records ── 清空所有数据（需认证）
    if (path === '/api/records' && method === 'DELETE') {
      if (!checkAuth(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const list = await env.KV_RECORDS.list({ prefix: 'record_' });
      for (const key of list.keys) {
        await env.KV_RECORDS.delete(key.name);
      }
      
      return new Response(JSON.stringify({ ok: true, deleted: list.keys.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── GET /admin ── 返回后台管理页（Basic Auth）
    if (path === '/admin' || path === '/admin/') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !verifyBasicAuth(authHeader)) {
        return new Response('请输入管理员密码', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Admin"',
            'Content-Type': 'text/plain'
          }
        });
      }
      return new Response(ADMIN_HTML, {
        headers: { 'Content-Type': 'text/html;charset=utf-8' }
      });
    }

    // ── GET / ── 返回访客前端页
    if (path === '/' || path === '/index.html') {
      return new Response(INDEX_HTML, {
        headers: { 'Content-Type': 'text/html;charset=utf-8' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

function checkAuth(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  return verifyBasicAuth(authHeader);
}

function verifyBasicAuth(authHeader) {
  if (!authHeader.startsWith('Basic ')) return false;
  const b64 = authHeader.slice(6);
  const decoded = atob(b64);
  const [, pass] = decoded.split(':');
  return pass === ADMIN_PASSWORD;
}

// ============================================================
// 内嵌 HTML（deploy 时 wrangler build 会替换这两个占位符）
// 也可以用 Workers Sites / __STATIC_CONTENT 方式
// 这里直接硬编码方便单文件部署
// ============================================================

const INDEX_HTML = `__INDEX_HTML__`;
const ADMIN_HTML = `__ADMIN_HTML__`;
