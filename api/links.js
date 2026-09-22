// api/links.js — hands the shell any dashboard URL that carries a key,
// so the key lives in Vercel rather than in the GitHub repo.
//
// Env vars (all optional):
//   CONTENTOS_URL       default https://contentos-dusky.vercel.app
//   CONTENTOS_TEAM_KEY  the TEAM_KEY set on the Content OS project

module.exports = (req, res) => {
  const base = (process.env.CONTENTOS_URL || 'https://contentos-dusky.vercel.app').replace(/\/+$/, '');
  const teamKey = process.env.CONTENTOS_TEAM_KEY || '';

  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).json({
    contentos: teamKey ? base + '/?team=' + encodeURIComponent(teamKey) : base
  });
};
