import { useMemo, useState } from "react";
import {
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./PostSUOverviewPage.css";

const OUTCOME_CONFIG = {
  Grew: { color: "#36d17a", label: "Grew" },
  Stagnant: { color: "#C9A44D", label: "Stagnant" },
  Declined: { color: "#ec6a6a", label: "Declined" },
  "Barely streamed": { color: "#657285", label: "Barely streamed" },
  Undetermined: { color: "#8b98a8", label: "Undetermined" },
};

function numberOf(row, key) {
  const value = Number(row?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value, decimals = 0) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCompact(value) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "Unknown");

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function outcomeOf(row) {
  const totalHours = numberOf(row, "post_su_total_hours_streamed");
  const audienceResult = row?.post_su_audience_result;
  const preJuneAverageViewers = Number(row?.pre_june_average_viewers);

  if (!row?.has_post_su_data) {
    return "Undetermined";
  }

  if (!Number.isFinite(preJuneAverageViewers) || preJuneAverageViewers <= 0) {
    return "Undetermined";
  }

  if (row?.barely_streamed_post_su || totalHours < 10) {
    return "Barely streamed";
  }

  if (audienceResult === "Grew") return "Grew";
  if (audienceResult === "Declined" || audienceResult === "Fell off") return "Declined";
  return "Stagnant";
}

function PostSUOverviewPage({ summary = [], daily = [], metadata = null }) {
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const activeSummary = useMemo(
    () => summary.filter((row) => row.has_post_su_data),
    [summary]
  );

  const totals = useMemo(
    () => activeSummary.reduce(
      (result, row) => ({
        followers: result.followers + numberOf(row, "post_su_followers_gained"),
        hours: result.hours + numberOf(row, "post_su_total_hours_streamed"),
        watched: result.watched + numberOf(row, "post_su_total_hours_watched"),
        peak: Math.max(result.peak, numberOf(row, "post_su_peak_viewers")),
      }),
      { followers: 0, hours: 0, watched: 0, peak: 0 }
    ), [activeSummary]);

  const trend = useMemo(() => {
    const dates = new Map();

    for (const row of daily) {
      const key = String(row.calendar_date || row.date || "");
      if (!key) continue;

      const current = dates.get(key) || {
        date: key,
        label: formatDate(key),
        followers: 0,
        hours: 0,
        watched: 0,
      };
      current.followers += numberOf(row, "followers_gained");
      current.hours += numberOf(row, "hours_streamed");
      current.watched += numberOf(row, "hours_watched");
      dates.set(key, current);
    }

    return [...dates.values()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((row) => ({
        ...row,
        average_viewers: row.hours > 0 ? row.watched / row.hours : 0,
      }));
  }, [daily]);

  const momentumCards = useMemo(() => {
    const preferredWindowSize = 14;
    const windowsAvailable = Math.floor(trend.length / 2);
    const windowSize = Math.max(3, Math.min(preferredWindowSize, windowsAvailable));
    const hasWindows = windowSize >= 3 && trend.length >= windowSize * 2;

    function average(values) {
      if (!values.length) return 0;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function momentumFor(metricKey) {
      const series = trend.map((row) => numberOf(row, metricKey));
      if (!hasWindows) {
        return {
          tone: "neutral",
          label: "Not enough data",
          deltaPct: Number.NaN,
          previousAvg: Number.NaN,
          recentAvg: Number.NaN,
          windowSize,
        };
      }

      const recent = series.slice(-windowSize);
      const previous = series.slice(-windowSize * 2, -windowSize);
      const recentAvg = average(recent);
      const previousAvg = average(previous);

      if (previousAvg <= 0 && recentAvg > 0) {
        return {
          tone: "positive",
          label: "Emerging",
          deltaPct: Number.NaN,
          previousAvg,
          recentAvg,
          windowSize,
        };
      }

      if (previousAvg <= 0) {
        return {
          tone: "neutral",
          label: "Flat",
          deltaPct: 0,
          previousAvg,
          recentAvg,
          windowSize,
        };
      }

      const deltaPct = ((recentAvg - previousAvg) / previousAvg) * 100;
      if (deltaPct >= 8) {
        return {
          tone: "positive",
          label: "Accelerating",
          deltaPct,
          previousAvg,
          recentAvg,
          windowSize,
        };
      }

      if (deltaPct <= -8) {
        return {
          tone: "negative",
          label: "Fading",
          deltaPct,
          previousAvg,
          recentAvg,
          windowSize,
        };
      }

      return {
        tone: "neutral",
        label: "Steady",
        deltaPct,
        previousAvg,
        recentAvg,
        windowSize,
      };
    }

    return [
      {
        key: "average_viewers",
        title: "Average viewers",
        metricKey: "average_viewers",
        color: "#b17eff",
        formatValue: (value) => formatNumber(value, 0),
      },
      {
        key: "followers",
        title: "Followers gained",
        metricKey: "followers",
        color: "#C9A44D",
        formatValue: (value) => formatNumber(value, 0),
      },
      {
        key: "watched",
        title: "Hours watched",
        metricKey: "watched",
        color: "#4f9eff",
        formatValue: (value) => formatCompact(value),
      },
    ].map((card) => {
      const momentum = momentumFor(card.metricKey);
      return {
        ...card,
        ...momentum,
        sparkline: trend.map((row) => ({ label: row.label, value: numberOf(row, card.metricKey) })),
      };
    });
  }, [trend]);

  const outcomes = useMemo(() => Object.keys(OUTCOME_CONFIG).map((outcome) => ({
    outcome,
    value: summary.filter((row) => outcomeOf(row) === outcome).length,
    ...OUTCOME_CONFIG[outcome],
  })), [summary]);

  const outcomeStreamers = useMemo(() => {
    if (!selectedOutcome) return [];
    return summary
      .filter((row) => outcomeOf(row) === selectedOutcome)
      .sort((left, right) => numberOf(right, "post_su_viewer_growth_pct") - numberOf(left, "post_su_viewer_growth_pct"));
  }, [selectedOutcome, summary]);

  const window = metadata?.post_su_window;
  const windowLabel = window
    ? `${formatDate(window.start)} - ${formatDate(window.end_exclusive)} (${formatNumber(window.days_available, 1)} days available)`
    : "Post-SU reporting window";

  return (
    <section className="post-su-page">
      <header className="post-su-heading">
        <div>
          <span className="post-su-kicker">Post-SU Analysis</span>
          <h2>Overview</h2>
          <p>{windowLabel}</p>
        </div>
        <span className={`post-su-window-status ${window?.complete_30_day_window ? "complete" : ""}`}>
          {window?.complete_30_day_window ? "30-day window complete" : "Window in progress"}
        </span>
      </header>

      <section className="post-su-kpis">
        <article><span>Active streamers</span><strong>{formatNumber(activeSummary.length)}</strong></article>
        <article><span>Followers gained</span><strong>{formatCompact(totals.followers)}</strong></article>
        <article><span>Hours streamed</span><strong>{formatNumber(totals.hours, 1)}</strong></article>
        <article><span>Hours watched</span><strong>{formatCompact(totals.watched)}</strong></article>
        <article><span>Peak viewers</span><strong>{formatCompact(totals.peak)}</strong></article>
      </section>

      <section className="post-su-panel post-su-momentum-panel">
        <div className="post-su-panel-heading">
          <div>
            <h3>Trajectory & momentum</h3>
            <span>Recent window vs prior window to show acceleration or fade</span>
          </div>
        </div>
        <div className="post-su-momentum-grid">
          {momentumCards.map((card) => (
            <article className="post-su-momentum-card" key={card.key}>
              <div className="post-su-momentum-top">
                <small>{card.title}</small>
                <span className={`post-su-momentum-badge ${card.tone}`}>{card.label}</span>
              </div>
              <div className="post-su-momentum-values">
                <strong>{formatSignedPercent(card.deltaPct)}</strong>
                <span>
                  {Number.isFinite(card.recentAvg) && Number.isFinite(card.previousAvg)
                    ? `Recent ${card.windowSize}d avg ${card.formatValue(card.recentAvg)} vs prior ${card.formatValue(card.previousAvg)}`
                    : "Need at least 6 daily points for comparison"}
                </span>
              </div>
              <div className="post-su-momentum-sparkline">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={card.sparkline} margin={{ top: 4, right: 0, bottom: 2, left: 0 }}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={card.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="post-su-panel post-su-spacer-ribbon" aria-hidden="true" />

      <section className="post-su-grid">
        <article className="post-su-panel post-su-outcomes-panel">
          <div className="post-su-panel-heading"><div><h3>Audience outcome</h3><span>Compared with June average viewers</span></div></div>
          <div className="post-su-outcomes">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{ background: "#171B22", border: "1px solid #232A33", borderRadius: 6 }}
                  formatter={(value, name) => [`${formatNumber(value)} streamers`, name]}
                />
                <Pie
                  data={outcomes}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="44%"
                  innerRadius={49}
                  outerRadius={78}
                  paddingAngle={3}
                  onClick={(entry) => setSelectedOutcome(entry.outcome)}
                >
                  {outcomes.map((entry) => <Cell cursor="pointer" fill={entry.color} key={entry.outcome} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="post-su-outcome-legend">
              {outcomes.map((entry) => <button type="button" className={selectedOutcome === entry.outcome ? "selected" : ""} onClick={() => setSelectedOutcome(entry.outcome)} key={entry.outcome}><i style={{ background: entry.color }} /><span>{entry.label}</span><strong>{formatNumber(entry.value)}</strong></button>)}
            </div>
          </div>
        </article>

        <article className="post-su-panel post-su-trend-panel">
          <div className="post-su-panel-heading">
            <div><h3>Daily post-SU performance</h3><span>Followers gained, hours watched, and average viewers</span></div>
          </div>
          <div className="post-su-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(163, 173, 184, 0.13)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#A3ADB8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="followers" tick={{ fill: "#A3ADB8", fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
                <YAxis yAxisId="watched" orientation="right" tickFormatter={formatCompact} tick={{ fill: "#A3ADB8", fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                <YAxis yAxisId="average" hide domain={[0, "auto"]} />
                <Tooltip contentStyle={{ background: "#171B22", border: "1px solid #232A33", borderRadius: 6 }} labelStyle={{ color: "#F2F4F6" }} formatter={(value) => formatNumber(value, 0)} />
                <Line yAxisId="followers" type="monotone" dataKey="followers" name="Followers gained" stroke="#C9A44D" strokeWidth={2} dot={false} />
                <Line yAxisId="watched" type="monotone" dataKey="watched" name="Hours watched" stroke="#4f9eff" strokeWidth={2} dot={false} />
                <Line yAxisId="average" type="monotone" dataKey="average_viewers" name="Average viewers" stroke="#b17eff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      {selectedOutcome && (
        <>
          <button type="button" className="post-su-drawer-backdrop" aria-label="Close outcome details" onClick={() => setSelectedOutcome(null)} />
          <aside className="post-su-outcome-drawer" role="dialog" aria-modal="true" aria-label={`${OUTCOME_CONFIG[selectedOutcome].label} streamers`}>
            <div className="post-su-drawer-heading">
              <div><span>{OUTCOME_CONFIG[selectedOutcome].label}{selectedOutcome === "Undetermined" && <span className="post-su-undetermined-help" aria-label="What does undetermined mean?" role="img" tabIndex="0">?<span className="post-su-undetermined-tooltip" role="tooltip">Undetermined means there is not enough pre-SU or post-SU stream data to calculate audience growth.</span></span>}</span><h3>{formatNumber(outcomeStreamers.length)} streamers</h3></div>
              <button type="button" onClick={() => setSelectedOutcome(null)}>Close</button>
            </div>
            <div className="post-su-drawer-list">
              {outcomeStreamers.map((row) => {
                const growth = Number(row.post_su_viewer_growth_pct);
                const hasGrowthResult =
                  outcomeOf(row) !== "Undetermined" && Number.isFinite(growth);
                return <div key={row.streamer}>
                  <div><strong>{row.display_name || row.streamer}</strong><span>{row.group || "Unassigned"}</span></div>
                  <b className={hasGrowthResult && growth > 10 ? "positive" : hasGrowthResult && growth < -10 ? "negative" : "neutral"}>{hasGrowthResult ? `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%` : "N/A"}</b>
                </div>;
              })}
            </div>
          </aside>
        </>
      )}
    </section>
  );
}

export default PostSUOverviewPage;