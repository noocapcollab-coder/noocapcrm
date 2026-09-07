const PIPELINE = process.env.PIPELINE_URL || 'https://noocap-v2.vercel.app';
const TZ = 'Asia/Kolkata';

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function flatten(node, out, depth) {
  if (!node || depth > 6) return out;
  if (Array.isArray(node)) {
    for (const item of node) flatten(item, out, depth + 1);
    return out;
  }
  if (typeof node === 'object') {
    const keys = Object.keys(node);
    const looksLikeVideo = keys.some(k => /^(status|stage|state)$/i.test(k));
    if (looksLikeVideo) out.push(node);
    for (const k of keys) flatten(node[k], out, depth + 1);
  }
  return out;
}

function statusOf(v) {
  const raw = v.status || v.stage || v.state || '';
  return typeof raw === 'string' ? raw.toLowerCase() : '';
}

function dateOf(v) {
  const raw = v.postDate || v.post_date || v.date || v.due || v.publishDate || '';
  if (typeof raw !== 'string' || raw.length < 10) return '';
  return raw.slice(0, 10);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  try {
    const r = await fetch(PIPELINE.replace(/\/+$/, '') + '/api/data', {
      headers: { accept: 'application/json' }
    });
    if (!r.ok) throw new Error('pipeline ' + r.status);
    const data = await r.json();

    const videos = flatten(data, [], 0);
    const day = today();

    let changes = 0;
    let dueToday = 0;
    for (const v of videos) {
      const s = statusOf(v);
      if (s.includes('changes') || /^8\b/.test(s) || s.startsWith('8-')) changes += 1;
      if (dateOf(v) === day) dueToday += 1;
    }

    return res.status(200).json({ changes, dueToday, seen: videos.length });
  } catch (err) {
    return res.status(200).json({ changes: null, dueToday: null, error: String(err.message || err) });
  }
};
