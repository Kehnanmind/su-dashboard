import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
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

const GROUP_COLORS = {
  Student: "#36d17a",
  "Club Director": "#f59e0b",
  Professor: "#9b5cff",
  "Campus Police": "#4f9eff",
  "Guidance Counselor": "#ec4899",
  Janitor: "#a3e635",
  Librarian: "#22d3ee",
};

const SIZE_TIER_ORDER = [
  "Micro (<50)",
  "Small (50-199)",
  "Medium (200-999)",
  "Large (1,000-4,999)",
  "Very Large (5,000+)",
  "No pre-SU baseline",
];

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

function formatMonthDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

function buildSparklineSeries(rows, metricKey, priorAverage) {
  const rawValues = rows.map((row) => Math.max(0, numberOf(row, metricKey)));
  const baseline = Number(priorAverage);
  const safeBaseline = Number.isFinite(baseline) && baseline > 0 ? baseline : 1;

  return rows.map((row, index) => {
    const rawValue = rawValues[index];
    const percentFromBaseline = ((rawValue - safeBaseline) / safeBaseline) * 100;

    return {
      label: row.label,
      date: row.date,
      rawValue,
      displayValue: percentFromBaseline,
      index,
    };
  });
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

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  allLabel = "All",
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedLabel =
    selected.length === options.length
      ? `${allLabel} (${options.length})`
      : selected.length === 0
        ? "None"
        : selected.length === 1
          ? selected[0]
          : `${selected.length} selected`;

  function toggleOption(option) {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div className="dropdown" ref={wrapperRef}>
      <button
        className="dropdown-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <small>{label}</small>
          <strong>{selectedLabel}</strong>
        </span>
        <span className="chevron">⌄</span>
      </button>

      {open && (
        <div className="dropdown-menu">
          <div className="dropdown-actions">
            <button type="button" onClick={() => onChange(options)}>
              Select all
            </button>
            <button type="button" onClick={() => onChange([])}>
              Clear
            </button>
          </div>

          {options.map((option) => (
            <label className="dropdown-option" key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
              />
              <span
                className="option-dot"
                style={{
                  background: GROUP_COLORS[option] || "#8b98a8",
                }}
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function PostSUOverviewPage({ summary = [], duringSummary = [], daily = [], metadata = null }) {
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedSizeTiers, setSelectedSizeTiers] = useState([]);

  const groupOptions = useMemo(() => {
    const groups = [...new Set(summary.map((row) => row.group).filter(Boolean))];
    return groups.sort((left, right) => String(left).localeCompare(String(right)));
  }, [summary]);

  const sizeTierOptions = useMemo(() => {
    const tiers = [
      ...new Set(
        duringSummary
          .map((row) => row.size_tier)
          .filter(Boolean)
      ),
    ];

    return [
      ...SIZE_TIER_ORDER.filter((tier) => tiers.includes(tier)),
      ...tiers.filter((tier) => !SIZE_TIER_ORDER.includes(tier)),
    ];
  }, [duringSummary]);

  const summaryWithSizeTier = useMemo(() => {
    const tierByStreamer = new Map();

    for (const row of duringSummary) {
      const key = String(row?.streamer || row?.display_name || "").toLowerCase();
      if (!key) continue;
      if (row?.size_tier) tierByStreamer.set(key, row.size_tier);
    }

    return summary.map((row) => {
      const key = String(row?.streamer || row?.display_name || "").toLowerCase();
      return {
        ...row,
        size_tier: row?.size_tier || tierByStreamer.get(key) || null,
      };
    });
  }, [duringSummary, summary]);

  useEffect(() => {
    setSelectedGroups((current) => {
      if (!groupOptions.length) return [];
      if (!current.length) return groupOptions;

      const next = current.filter((group) => groupOptions.includes(group));
      return next.length ? next : groupOptions;
    });
  }, [groupOptions]);

  useEffect(() => {
    setSelectedSizeTiers((current) => {
      if (!sizeTierOptions.length) return [];
      if (!current.length) return sizeTierOptions;

      const next = current.filter((tier) => sizeTierOptions.includes(tier));
      return next.length ? next : sizeTierOptions;
    });
  }, [sizeTierOptions]);

  const filteredSummary = useMemo(() => {
    return summaryWithSizeTier.filter(
      (row) => selectedGroups.includes(row.group) && selectedSizeTiers.includes(row.size_tier)
    );
  }, [summaryWithSizeTier, selectedGroups, selectedSizeTiers]);

  const activeSummary = useMemo(
    () => filteredSummary.filter((row) => row.has_post_su_data),
    [filteredSummary]
  );

  const allowedStreamers = useMemo(() => {
    return new Set(
      filteredSummary
        .map((row) => String(row.streamer || row.display_name || "").toLowerCase())
        .filter(Boolean)
    );
  }, [filteredSummary]);

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
      if (allowedStreamers) {
        const streamerKey = String(row.streamer || row.display_name || "").toLowerCase();
        if (!allowedStreamers.has(streamerKey)) continue;
      }

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
  }, [daily, allowedStreamers]);

  const momentumCards = useMemo(() => {
    const preferredWindowSize = 10;
    const windowsAvailable = Math.floor(trend.length / 2);
    const windowSize = Math.max(3, Math.min(preferredWindowSize, windowsAvailable));
    const hasWindows = windowSize >= 3 && trend.length >= windowSize * 2;
    const comparisonTrend = hasWindows ? trend.slice(-windowSize * 2) : trend;
    const previousDates = new Set(
      comparisonTrend.slice(0, windowSize).map((row) => row.date)
    );
    const recentDates = new Set(
      comparisonTrend.slice(-windowSize).map((row) => row.date)
    );
    const streamerWindows = new Map();

    for (const row of daily) {
      const streamerKey = String(row.streamer || row.display_name || "").toLowerCase();
      const date = String(row.calendar_date || row.date || "");
      if (!streamerKey || !date || !allowedStreamers.has(streamerKey)) continue;

      const window = streamerWindows.get(streamerKey) || {
        previous: { hours: 0, watched: 0, followers: 0, days: 0 },
        recent: { hours: 0, watched: 0, followers: 0, days: 0 },
      };
      const period = previousDates.has(date)
        ? window.previous
        : recentDates.has(date)
          ? window.recent
          : null;
      if (!period) continue;

      period.hours += numberOf(row, "hours_streamed");
      period.watched += numberOf(row, "hours_watched");
      period.followers += numberOf(row, "followers_gained");
      period.days += 1;
      streamerWindows.set(streamerKey, window);
    }

    const comparableStreamers = [...streamerWindows.values()].filter(
      (window) => window.previous.days > 0 && window.recent.days > 0
    );
    const comparableStreamerKeys = new Set(
      [...streamerWindows.entries()]
        .filter(([, window]) => window.previous.days > 0 && window.recent.days > 0)
        .map(([streamerKey]) => streamerKey)
    );

    function average(values) {
      if (!values.length) return 0;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    const streamerTrend = comparisonTrend.map((row) => {
      const values = daily
        .filter((dailyRow) => {
          const streamerKey = String(
            dailyRow.streamer || dailyRow.display_name || ""
          ).toLowerCase();
          const date = String(dailyRow.calendar_date || dailyRow.date || "");
          return comparableStreamerKeys.has(streamerKey) && date === row.date;
        })
        .map((dailyRow) =>
          numberOf(dailyRow, "average_viewers_weighted", "average_viewers")
        );

      return {
        ...row,
        average_viewers: average(values),
      };
    });

    function momentumFor(metricKey) {
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

      const valuesFor = (period) => {
        if (metricKey === "average_viewers") {
          return period.hours > 0 ? period.watched / period.hours : 0;
        }

        return period[metricKey] / windowSize;
      };
      const recentAvg = average(
        comparableStreamers.map((window) => valuesFor(window.recent))
      );
      const previousAvg = average(
        comparableStreamers.map((window) => valuesFor(window.previous))
      );

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
        sparkline: buildSparklineSeries(
          card.metricKey === "average_viewers" ? streamerTrend : comparisonTrend,
          card.metricKey,
          momentum.previousAvg
        ),
      };
    });
  }, [allowedStreamers, daily, trend]);

  const outcomes = useMemo(() => Object.keys(OUTCOME_CONFIG).map((outcome) => ({
    outcome,
    value: filteredSummary.filter((row) => outcomeOf(row) === outcome).length,
    ...OUTCOME_CONFIG[outcome],
  })), [filteredSummary]);

  const outcomeStreamers = useMemo(() => {
    if (!selectedOutcome) return [];
    return filteredSummary
      .filter((row) => outcomeOf(row) === selectedOutcome)
      .sort((left, right) => numberOf(right, "post_su_viewer_growth_pct") - numberOf(left, "post_su_viewer_growth_pct"));
  }, [selectedOutcome, filteredSummary]);

  const window = metadata?.post_su_window;
  const windowLabel = window
    ? `${formatDate(window.start)} - ${formatDate(window.end_exclusive)} (${formatNumber(window.days_available, 1)} days available)`
    : "Post-SU reporting window";
  const postSUOutcomePeriod = window
    ? (() => {
        const lastDate = new Date(`${String(window.end_exclusive).slice(0, 10)}T00:00:00`);
        lastDate.setDate(lastDate.getDate() - 1);
        return `${formatDate(window.start)} - ${formatDate(lastDate)}`;
      })()
    : "the full available Post-SU period";

  return (
    <section className="post-su-page">
      <header className="post-su-heading">
        <div>
          <span className="post-su-kicker">Post-SU Analysis</span>
          <h2>Overview</h2>
          <p>{windowLabel}</p>
        </div>
        <div className="post-su-heading-filters">
          <MultiSelectDropdown
            label="Group"
            options={groupOptions}
            selected={selectedGroups}
            onChange={(next) => {
              setSelectedGroups(next);
              setSelectedOutcome(null);
            }}
          />
          <MultiSelectDropdown
            label="Pre-SU streamer size"
            options={sizeTierOptions}
            selected={selectedSizeTiers}
            onChange={(next) => {
              setSelectedSizeTiers(next);
              setSelectedOutcome(null);
            }}
            allLabel="All"
          />
        </div>
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
                <span className="post-su-momentum-context">
                  {Number.isFinite(card.recentAvg) && Number.isFinite(card.previousAvg)
                    ? <><b>Recent {card.windowSize}d average:</b> {card.formatValue(card.recentAvg)} <em>vs</em> <b>Prior {card.windowSize}d average:</b> {card.formatValue(card.previousAvg)}</>
                    : "Need at least 6 daily points for comparison"}
                </span>
              </div>
              <div className="post-su-momentum-sparkline">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={card.sparkline} margin={{ top: 4, right: 0, bottom: 2, left: 0 }}>
                    <YAxis hide domain={[(dataMin) => Math.min(-35, dataMin - 3), (dataMax) => Math.max(35, dataMax + 3)]} />
                    <ReferenceLine y={0} stroke="rgba(163, 173, 184, 0.45)" strokeDasharray="3 3" />
                    <Tooltip
                      cursor={{ stroke: "rgba(163, 173, 184, 0.35)", strokeWidth: 1 }}
                      contentStyle={{ background: "#171B22", border: "1px solid #232A33", borderRadius: 6, padding: "6px 8px" }}
                      labelStyle={{ color: "#F2F4F6", fontSize: 11, margin: 0 }}
                      itemStyle={{ fontSize: 11, margin: 0 }}
                      wrapperStyle={{ fontSize: 11 }}
                      labelFormatter={(_, payload) => formatMonthDay(payload?.[0]?.payload?.date)}
                      formatter={(_, __, item) => [card.formatValue(item?.payload?.rawValue), card.title]}
                    />
                    <Line
                      type="linear"
                      dataKey="displayValue"
                      stroke={card.color}
                      strokeWidth={2.3}
                      dot={false}
                      activeDot={{ r: 3 }}
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
          <div className="post-su-panel-heading"><div><h3>Audience outcome</h3><span>Full <strong>Post-SU</strong> period: {postSUOutcomePeriod} · Compared with June average viewers <span className="post-su-outcome-help" aria-label="How the audience outcome is calculated?" role="img" tabIndex="0">?<span className="post-su-outcome-tooltip" role="tooltip">This outcome uses the full available <strong>Post-SU</strong> period. Viewers can be unusually high during the first week after SU, including from possible <strong>bots</strong>, so growth may be inflated by that early activity. For more in-depth and precise analysis, see <strong>Streamer Breakdown</strong>.</span></span></span></div></div>
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