// Fires the deployed workflow at a real n8n webhook. If VoxOps isn't wired to
// an n8n instance yet (no N8N_WEBHOOK_URL), the workflow still gets recorded
// locally so the rest of the product works — it's just marked undelivered.
async function triggerN8nWebhook(payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return { delivered: false, reason: 'N8N_WEBHOOK_URL not configured' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { delivered: res.ok, status: res.status };
  } catch (err) {
    return { delivered: false, reason: err.message };
  }
}

module.exports = { triggerN8nWebhook };
