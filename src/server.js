import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getGuildSettings, updateGuildSettings } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, SESSION_SECRET, PUBLIC_URL } = process.env;

function sessionFrom(req) {
  const token = req.headers.cookie?.split(';').find(c => c.trim().startsWith('hub_session='))?.split('=')[1];
  if (!token) return null;
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(token);
}

function requireAuth(req, res, next) {
  if (!sessionFrom(req)) return res.status(401).json({ error: 'Authentication required' });
  next();
}

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/auth/login', (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) return res.status(500).send('Discord OAuth is not configured');
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie?.('oauth_state', state, { httpOnly: true, sameSite: 'lax' });
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  try {
    if (!req.query.code) return res.status(400).send('Missing OAuth code');
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(req.query.code),
        redirect_uri: DISCORD_REDIRECT_URI
      })
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(token.access_description || 'OAuth exchange failed');

    const [user, guildResponse] = await Promise.all([
      fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } }).then(r => r.json()),
      fetch('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${token.access_token}` } }).then(r => r.json())
    ]);

    const sessionId = crypto.randomBytes(32).toString('hex');
    db.prepare(`INSERT OR REPLACE INTO sessions (id, user_id, username, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?, ?)`) 
      .run(sessionId, user.id, user.username, token.access_token, token.refresh_token || null, Date.now() + token.expires_in * 1000);
    res.setHeader('Set-Cookie', `hub_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    res.redirect('/dashboard.html');
  } catch (error) {
    res.status(400).send(`Authentication failed: ${error.message}`);
  }
});

app.post('/auth/logout', (req, res) => {
  const token = req.headers.cookie?.split(';').find(c => c.trim().startsWith('hub_session='))?.split('=')[1];
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  res.setHeader('Set-Cookie', 'hub_session=; Path=/; HttpOnly; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, async (req, res) => {
  const session = sessionFrom(req);
  const guildResponse = await fetch('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${session.access_token}` } });
  const guilds = guildResponse.ok ? await guildResponse.json() : [];
  res.json({
    user: { id: session.user_id, username: session.username },
    guilds: guilds.filter(g => (g.permissions & 0x20) === 0x20).map(g => ({ id: g.id, name: g.name, icon: g.icon }))
  });
});

app.get('/api/guilds/:guildId/settings', requireAuth, (req, res) => res.json(getGuildSettings(req.params.guildId)));
app.put('/api/guilds/:guildId/settings', requireAuth, (req, res) => {
  res.json(updateGuildSettings(req.params.guildId, req.body));
});

app.get('/api/erlc/server', async (req, res) => {
  const base = process.env.ERLC_API_BASE_URL;
  if (!base) return res.status(503).json({ error: 'ERLC_API_BASE_URL is not configured' });
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'Server ID is required' });
  for (const suffix of [`/servers/${encodeURIComponent(id)}`, `/server/${encodeURIComponent(id)}`]) {
    try {
      const response = await fetch(`${base}${suffix}`, { headers: process.env.ERLC_API_KEY ? { Authorization: `Bearer ${process.env.ERLC_API_KEY}` } : {} });
      if (response.ok) {
        const json = await response.json();
        return res.json(json.data || json);
      }
    } catch {}
  }
  res.status(502).json({ error: 'ER:LC server could not be reached' });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Dashboard listening on http://localhost:${port}`));
