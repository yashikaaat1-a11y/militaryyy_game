/* ── AAR export — JSON download and printable (Save as PDF) report ── */
import { formatT, pct } from '../../utils/format';

const CATEGORY_LABELS = {
  decision_quality: ['Decision quality', 30],
  response_time: ['Response time', 20],
  uncertainty_handling: ['Uncertainty handling', 20],
  communication_handling: ['Communication handling', 15],
  resource_management: ['Resource management', 15],
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function downloadJSON(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tacticomm-aar-${report.scenario.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function printReport(report) {
  const { scenario, score, comparison, timeline } = report;
  const started = timeline.started_at;
  const cfg = scenario.config;

  const categoryRows = Object.entries(CATEGORY_LABELS).map(([k, [label, w]]) =>
    `<tr><td>${label}</td><td>${w}%</td><td><b>${score[k].toFixed(0)}</b></td></tr>`).join('');

  const decisionBlocks = score.decision_reviews.map((r) => {
    const dp = comparison.decision_points.find((p) => p.index === r.index);
    const k = dp?.knowledge;
    const truth = dp?.truth;
    return `
      <div class="block">
        <h3>Decision ${r.index}: ${esc(r.decision_type.replace('_', ' '))}
          <span class="score">${r.total.toFixed(0)}/100</span></h3>
        <div class="meta">Round ${r.round} · T+${formatT(r.t)}${k ? ` · decided in ${k.wait_s.toFixed(0)}s of ${k.window_s.toFixed(0)}s` : ''}</div>
        <p><b>${esc(r.explanation)}</b></p>
        <ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        ${r.reasoning ? `<p class="quote">Trainee reasoning: “${esc(r.reasoning)}”</p>` : ''}
        ${k ? `
        <table class="cmp"><tr><th>What the trainee knew</th><th>Ground truth at that moment</th></tr>
          <tr><td>
            Avg confidence ${pct(k.avg_confidence)} · conflicting: ${k.conflict ? 'yes' : 'no'}<br/>
            Comms: ${Object.entries(k.comm_status).filter(([u]) => u !== 'OVERLORD').map(([u, s]) => `${u} ${s}`).join(', ')}<br/>
            ${k.reports.map((rep) => `<div class="rep">${esc(rep.source)} (${pct(rep.confidence)}): ${esc(rep.content)}</div>`).join('')}
          </td><td>
            ${truth.hostiles.map((h) => `<div class="rep">${esc(h.name)} — ${esc(h.strength)} ${esc(h.type)} at grid ${esc(h.grid)}${h.engaged ? ' (engaged)' : ''}</div>`).join('')}
            ${truth.best_report_error != null ? `Best report error: ${truth.best_report_error} grid<br/>` : ''}
            Reports lost in transit: ${truth.dropped_reports}
          </td></tr></table>` : ''}
        ${r.truth_note ? `<p class="note">${esc(r.truth_note)}</p>` : ''}
      </div>`;
  }).join('');

  const events = timeline.events.map((e) =>
    `<tr><td>T+${formatT(e.timestamp - started)}</td><td>${esc(e.event_type)}</td><td>${esc(e.description)}</td></tr>`).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>TactiComm AAR — ${esc(scenario.name)}</title>
<style>
  body { font: 12px/1.45 -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 28px; }
  h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: 1px; }
  h2 { font-size: 14px; margin: 22px 0 8px; border-bottom: 2px solid #111; padding-bottom: 3px; text-transform: uppercase; letter-spacing: 1px; }
  h3 { font-size: 13px; margin: 0 0 2px; display: flex; justify-content: space-between; }
  .meta { color: #555; font-size: 11px; margin-bottom: 6px; }
  .total { font-size: 34px; font-weight: 800; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  .block { border: 1px solid #ccc; padding: 10px 12px; margin-bottom: 12px; page-break-inside: avoid; }
  .score { font-weight: 800; }
  .rep { margin: 2px 0; }
  .quote { font-style: italic; color: #333; }
  .note { background: #f6f6f6; padding: 6px 8px; border-left: 3px solid #888; }
  .cmp td { width: 50%; font-size: 11px; }
  ul { margin: 4px 0 6px 18px; padding: 0; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <h1>TACTICOMM — AFTER ACTION REVIEW</h1>
  <div class="meta">${esc(scenario.name)} · scenario ${esc(scenario.id)} · ${new Date(started * 1000).toLocaleString()} ·
    difficulty ${esc(cfg.threat_difficulty)} · comm reliability ${pct(cfg.comm_reliability)} · dropout ${pct(cfg.dropout_probability)} ·
    conflicting reports ${pct(cfg.conflicting_report_probability)}</div>

  <h2>Overall score</h2>
  <div class="total">${score.total.toFixed(0)} / 100</div>
  <table>${'<tr><th>Category</th><th>Weight</th><th>Score</th></tr>'}${categoryRows}</table>

  <h2>Key findings</h2>
  <ul>${score.explanations.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>

  <h2>Decisions — knowledge vs ground truth</h2>
  ${decisionBlocks || '<p>No decisions were made.</p>'}

  <h2>Event timeline</h2>
  <table><tr><th>Time</th><th>Event</th><th>Description</th></tr>${events}</table>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Allow pop-ups to export the PDF report.');
    return;
  }
  w.document.write(html);
  w.document.close();
}
