/* ── AAR insights — What-If explorer and the commander's cognitive profile ── */
import React, { useState } from 'react';
import { pct } from '../../utils/format';

const KEYS = { OBSERVE: 1, MOVE: 2, INTERCEPT: 3, HOLD: 4, WITHDRAW: 5, REQUEST_RECON: 6 };
const BIAS_CODES = {
  anchoring: 'ANC', stale_source: 'STL', recency: 'REC', overconfidence: 'OVC',
  hesitation: 'HES', rash_commitment: 'RSH', paralysis: 'PAR', escalation: 'ESC',
};
const scoreColor = (v) => (v >= 75 ? '#4caf50' : v >= 55 ? '#ff9800' : '#f44336');
const label = (t) => t.replace('_', ' ');

export function WhatIfTab({ comparison, cognitive }) {
  const points = comparison?.decision_points || [];
  const [sel, setSel] = useState(0);
  if (!points.length) return <div className="feed-empty">No decisions were made — nothing to replay.</div>;

  const p = points[sel];
  const regret = cognitive?.regret?.find((r) => r.decision === p.index);
  const alts = [...(p.alternatives || [])].sort((a, b) => b.score - a.score);
  const best = alts[0];

  return (
    <div className="whatif">
      <div className="insight-banner">
        <div>
          <div className="insight-big">{cognitive?.optimal_choices ?? 0}/{cognitive?.decisions ?? points.length}</div>
          <div className="insight-label">best-available calls</div>
        </div>
        <div>
          <div className="insight-big" style={{ color: (cognitive?.total_regret || 0) > 20 ? '#f44336' : '#4caf50' }}>
            {Math.round(cognitive?.total_regret || 0)}
          </div>
          <div className="insight-label">points of decision regret</div>
        </div>
        <div className="insight-explain">
          At each decision the engine replayed all six actions from the exact same moment.
          Scores use only what you knew then; outcomes show what each would really have caused.
        </div>
      </div>

      <div className="dp-tabs">
        {points.map((pt, i) => (
          <button key={i} className={`dp-tab ${sel === i ? 'active' : ''}`} onClick={() => setSel(i)}>
            Decision {pt.index}
          </button>
        ))}
      </div>

      {regret && (
        <div className="whatif-headline">
          {regret.regret < 1
            ? <><b>{label(regret.chosen)}</b> was the strongest option on the evidence you had.</>
            : <>You chose <b>{label(regret.chosen)}</b> ({Math.round(regret.chosen_score)}). The evidence best supported{' '}
              <b>{label(regret.best)}</b> ({Math.round(regret.best_score)}) — <b>{Math.round(regret.regret)} points</b> left on the table.</>}
        </div>
      )}

      <div className="whatif-list">
        {alts.map((a) => {
          const chosen = a.decision_type === p.decision_type;
          const isBest = a === best;
          return (
            <div key={a.decision_type} className={`whatif-row ${chosen ? 'chosen' : ''}`}>
              <div className="whatif-head">
                <span className="whatif-action"><span className="whatif-key">{KEYS[a.decision_type]}</span>{label(a.decision_type)}</span>
                {chosen && <span className="tag tag-you">YOUR CALL</span>}
                {isBest && <span className="tag tag-best">BEST ON EVIDENCE</span>}
                <span className="whatif-score" style={{ color: scoreColor(a.score) }}>{Math.round(a.score)}</span>
              </div>
              <div className="whatif-bar">
                <div style={{ width: `${a.score}%`, background: scoreColor(a.score) }} />
              </div>
              <div className="whatif-outcome">{a.outcome}</div>
              <div className="whatif-chips">
                <span className={`chip ${a.strength_change < 0 ? 'bad' : ''}`}>
                  Friendly strength {a.strength_change < 0 ? a.strength_change : '±0'}
                </span>
                <span className={`chip ${a.enemies_halted ? 'good' : ''}`}>
                  {a.enemies_halted ? `${a.enemies_halted} enemy halted` : 'Enemy still moving'}
                </span>
                {a.closest_threat != null && (
                  <span className={`chip ${a.closest_threat < 4 ? 'bad' : ''}`}>Nearest threat {a.closest_threat} grid</span>
                )}
                {a.threat_contact && <span className="chip bad">Units in contact</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CognitiveTab({ cognitive }) {
  if (!cognitive) return null;
  const { calibration, beliefs = [], biases = [], profile } = cognitive;

  return (
    <div className="cognitive">
      {profile && (
        <div className="profile-card">
          <div className="profile-kicker">COMMANDER PROFILE</div>
          <div className="profile-name">{profile.name}</div>
          <div className="profile-summary">{profile.summary}</div>
          {profile.mix && (
            <div className="profile-mix">
              {[['Action', profile.mix.action, '#f44336'], ['Information', profile.mix.information, '#00bcd4'],
                ['Defensive', profile.mix.defensive, '#ff9800']].map(([n, v, c]) => (
                <div key={n} className="mix-item">
                  <div className="mix-bar"><div style={{ width: pct(v), background: c }} /></div>
                  <span>{n} {pct(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="cog-section-title">BELIEF CALIBRATION</div>
      {calibration ? (
        <div className="calib-card">
          <div className="calib-score" style={{ color: scoreColor(calibration.score) }}>
            {calibration.score}<span>/100</span>
          </div>
          <div>
            <div className={`calib-label ${calibration.label.toLowerCase().replace(' ', '-')}`}>{calibration.label}</div>
            <div className="calib-summary">{calibration.summary}</div>
          </div>
        </div>
      ) : (
        <div className="feed-empty">No assessments were recorded.</div>
      )}

      {beliefs.length > 0 && (
        <table className="belief-table">
          <thead>
            <tr><th>#</th><th>Your estimate</th><th>Confidence</th><th>Your error</th><th>Evidence error</th><th>Read</th></tr>
          </thead>
          <tbody>
            {beliefs.map((b) => {
              const better = b.evidence_error != null && b.error + 1.5 < b.evidence_error;
              const worse = b.evidence_error != null && b.error > b.evidence_error + 1.5;
              return (
                <tr key={b.decision}>
                  <td>{b.decision}</td>
                  <td>grid {b.grid}</td>
                  <td>{pct(b.confidence)}</td>
                  <td style={{ color: b.hit ? '#4caf50' : '#f44336' }}>{b.error} {b.hit ? 'HIT' : 'MISS'}</td>
                  <td>{b.evidence_error ?? '—'}</td>
                  <td className="belief-read">
                    {better ? 'Read past the noise' : worse ? 'Misread the evidence' : 'Followed the evidence'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="score-footnote">
        "Evidence error" is where a confidence-weighted reading of your reports pointed. In the replay, the cyan pin
        is your estimate, purple is the evidence and red is the truth.
      </div>

      <div className="cog-section-title">COGNITIVE PATTERNS DETECTED</div>
      {biases.length === 0 ? (
        <div className="bias-none">No bias patterns detected — disciplined reasoning under uncertainty.</div>
      ) : (
        biases.map((b, i) => (
          <div key={i} className="bias-card">
            <div className="bias-head">
              <span className="bias-icon">{BIAS_CODES[b.key] || 'BIA'}</span>
              <span className="bias-name">{b.name}</span>
              <span className="bias-dec">Decision {b.decision}</span>
            </div>
            <div className="bias-detail">{b.detail}</div>
            <div className="bias-tip"><span>COACHING</span>{b.tip}</div>
          </div>
        ))
      )}
    </div>
  );
}
