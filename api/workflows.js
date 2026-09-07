const TZ = 'Asia/Kolkata';

function dayKey(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(iso));
  } catch (e) {
    return null;
  }
}

async function n8n(base, path, key) {
  const r = await fetch(base + path, {
    headers: { 'X-N8N-API-KEY': key, accept: 'application/json' }
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error('n8n ' + r.status + ' on ' + path + ' — ' + body.slice(0, 200));
  }
  return r.json();
}

module.exports = async (req, res) => {
  const base = (process.env.N8N_BASE_URL || '').replace(/\/+$/, '');
  const key = process.env.N8N_API_KEY;

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (!base || !key) {
    return res.status(500).json({
      error: 'Set N8N_BASE_URL and N8N_API_KEY in Vercel, then redeploy.'
    });
  }

  try {
    const wf = await n8n(base, '/api/v1/workflows?active=true&limit=250', key);
    const ex = await n8n(base, '/api/v1/executions?limit=250&includeData=false', key);

    const workflows = wf.data || [];
    const runs = ex.data || [];
    const today = dayKey(new Date().toISOString());

    const byWorkflow = new Map();
    for (const run of runs) {
      const id = String(run.workflowId);
      if (!byWorkflow.has(id)) byWorkflow.set(id, []);
      byWorkflow.get(id).push(run);
    }

    const out = workflows.map((w) => {
      const mine = (byWorkflow.get(String(w.id)) || []).sort(
        (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
      );
      const last = mine[0] || null;
      const runsToday = mine.filter((r) => dayKey(r.startedAt) === today).length;

      let state = 'idle';
      if (last) {
        if (last.status === 'error' || last.status === 'crashed') state = 'error';
        else if (last.status === 'running' || last.status === 'waiting') state = 'running';
        else state = 'ok';
      }

      return {
        id: w.id,
        name: w.name,
        state,
        runsToday,
        lastRunAt: last ? last.startedAt : null,
        lastStatus: last ? last.status : null
      };
    });

    out.sort((a, b) => {
      const rank = { error: 0, running: 1, ok: 2, idle: 3 };
      if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
      return new Date(b.lastRunAt || 0) - new Date(a.lastRunAt || 0);
    });

    return res.status(200).json({ checkedAt: new Date().toISOString(), workflows: out });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
};
