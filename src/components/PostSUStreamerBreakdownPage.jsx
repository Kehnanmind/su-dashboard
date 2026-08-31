import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./PostSUStreamerBreakdownPage.css";

function valueOf(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function numberOf(row, ...keys) {
  const value = valueOf(row, ...keys);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

const SU_START_TIME = new Date("2026-07-15T14:00:00").getTime();
const SU_END_TIME = new Date("2026-07-20T06:00:00").getTime();
const PRE_SU_COLOR = "#efb6bd";
const DURING_SU_COLOR = "#b8cee0";
const POST_SU_COLOR = "#d6a85f";
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

function viewerScale(value) {
  return Number(value);
}

function formatViewerScaleTick(value) {
  return formatCompact(value);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRangeDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

function formatTimelineDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function changeFor(value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) {
    return { tone: "neutral", icon: "→", label: "No baseline" };
  }

  const percent = ((value - baseline) / Math.abs(baseline)) * 100;
  if (percent === 0) return { tone: "neutral", icon: "→", label: "No change" };

  return {
    tone: percent > 0 ? "positive" : "negative",
    icon: percent > 0 ? "↑" : "↓",
    label: `${Math.abs(percent).toFixed(1)}%`,
  };
}

function changeClass(value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return "neutral";
  if (value > baseline) return "positive";
  if (value < baseline) return "negative";
  return "neutral";
}

function changePercent(value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return "—";
  const percent = ((value - baseline) / Math.abs(baseline)) * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

function formatOutcome(result) {
  const [audience, activity] = String(result || "No post-SU data")
    .split("/")
    .map((part) => part.trim());

  return activity && activity !== "Active" ? `${audience} / ${activity}` : audience;
}

function outcomeCategory(result) {
  const [audience, activity] = String(result || "Undetermined")
    .split("/")
    .map((part) => part.trim());

  return activity === "Barely streamed" ? activity : audience;
}

function outcomeForRange(row) {
  if (!row?.has_post_su_data) return "Undetermined";

  const baseline = Number(valueOf(row, "pre_june_average_viewers", "pre_average_viewers"));
  const average = Number(valueOf(row, "post_su_average_viewers_weighted", "post_su_average_viewers_simple"));
  const broadcasts = Number(row.post_su_broadcasts);
  const hours = Number(row.post_su_total_hours_streamed);
  const activity = broadcasts < 2 || hours < 20 ? "Barely streamed" : "Active";

  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(average)) {
    return `Undetermined / ${activity}`;
  }

  const growthPct = ((average - baseline) / baseline) * 100;
  const audience = growthPct > 10 ? "Grew" : growthPct < -10 ? "Declined" : "Stagnant";
  return `${audience} / ${activity}`;
}

function tableSortValue(row, key) {
  const fields = {
    pre_average: ["pre_june_average_viewers", "pre_30d_average_viewers", "pre_average_viewers"],
    pre_followers: ["pre_june_followers_gained", "pre_30d_followers_gained", "pre_followers_gained"],
    pre_hours: ["pre_june_hours_streamed", "pre_30d_total_hours_streamed", "pre_total_hours_streamed"],
    during_average: ["during_average_viewers"],
    during_followers: ["during_followers_gained"],
    during_hours: ["during_total_hours_streamed"],
    post_average: ["post_su_average_viewers_weighted", "post_su_average_viewers_simple"],
    post_followers: ["post_su_followers_gained"],
    post_hours: ["post_su_total_hours_streamed"],
  };

  if (key.startsWith("change_")) {
    const metric = key.replace("change_", "post_");
    const value = tableSortValue(row, metric);
    const baseline = tableSortValue(row, `pre_${metric.replace("post_", "")}`);
    if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return Number.NaN;
    return ((value - baseline) / Math.abs(baseline)) * 100;
  }

  return numberOf(row, ...(fields[key] || [key]));
}

function StreamTrendTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  if (!item) return null;

  return (
    <div className="post-su-stream-tooltip">
      <strong>{item.label}</strong>
      <span>Hours: {formatNumber(item.hours, 1)}</span>
      <span>Avg viewers: {formatNumber(item.average_viewers)}</span>
      <span>Peak viewers: {formatNumber(item.peak_viewers)}</span>
      <span>Followers: {formatNumber(item.followers)}</span>
      {item.stream_url && <small>Click point to open stream</small>}
    </div>
  );
}

function StreamTrendDot({ cx, cy, payload }) {
  if (payload.average_viewers === null) return null;

  const color = payload.isPreSU ? PRE_SU_COLOR : payload.isDuringSU ? DURING_SU_COLOR : POST_SU_COLOR;

  function openStream(event) {
    event.stopPropagation();
    if (payload.stream_url) window.open(payload.stream_url, "_blank", "noopener,noreferrer");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") openStream(event);
  }

  return <g className={payload.stream_url ? "post-su-clickable-dot" : ""} role={payload.stream_url ? "link" : undefined} tabIndex={payload.stream_url ? 0 : undefined} aria-label={payload.stream_url ? `Open stream from ${payload.label}` : undefined} onClick={payload.stream_url ? openStream : undefined} onKeyDown={payload.stream_url ? handleKeyDown : undefined} pointerEvents="all"><circle cx={cx} cy={cy} r={8} fill="transparent" onClick={payload.stream_url ? openStream : undefined} /><circle cx={cx} cy={cy} r={4.5} fill={color} onClick={payload.stream_url ? openStream : undefined} /></g>;
}

const CARTEREFE_ATTENDANCE_NOTE = "Was invited to SU, but wasn't able to attend.";

function StreamerAttendanceDisclaimer() {
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    function updatePosition() {
      if (!triggerRef.current || !tooltipRef.current) return;

      const triggerBounds = triggerRef.current.getBoundingClientRect();
      const tooltipBounds = tooltipRef.current.getBoundingClientRect();
      const viewportPadding = 8;
      const gap = 8;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipBounds.width - viewportPadding);
      const left = Math.min(Math.max(viewportPadding, triggerBounds.left - viewportPadding), maxLeft);
      const below = triggerBounds.bottom + gap;
      const above = triggerBounds.top - tooltipBounds.height - gap;
      const top = below + tooltipBounds.height <= window.innerHeight - viewportPadding
        ? below
        : Math.max(viewportPadding, above);

      setPosition({ left, top });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <>
      <span
        ref={triggerRef}
        className="post-su-streamer-disclaimer"
        tabIndex="0"
        aria-label={CARTEREFE_ATTENDANCE_NOTE}
        aria-describedby="carterefe-attendance-note"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      >
        <span aria-hidden="true">i</span>
      </span>
      {isOpen && createPortal(
        <span
          ref={tooltipRef}
          id="carterefe-attendance-note"
          className="post-su-streamer-disclaimer-tooltip"
          role="tooltip"
          style={{
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            visibility: position ? "visible" : "hidden",
          }}
        >
          {CARTEREFE_ATTENDANCE_NOTE}
        </span>,
        document.body
      )}
    </>
  );
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  allLabel = "All",
  colorMap = null,
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
              {colorMap ? (
                <span
                  className="option-dot"
                  style={{
                    background: colorMap[option] || "#8b98a8",
                  }}
                />
              ) : null}
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomRangePicker({ label, start, end, minDate, maxDate, onChange, onClear, showPeriodMarkers = false }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(`${minDate}T00:00:00`));
  const [pendingStart, setPendingStart] = useState(start);
  const pickerRef = useRef(null);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function chooseDate(selectedDate) {
    if (!pendingStart || (pendingStart && end)) {
      setPendingStart(selectedDate);
      onChange(selectedDate, "");
      return;
    }

    if (selectedDate < pendingStart) onChange(selectedDate, pendingStart);
    else onChange(pendingStart, selectedDate);
    setPendingStart("");
    setOpen(false);
  }

  function selectFullRange() {
    onChange(minDate, maxDate);
    setPendingStart("");
    setOpen(false);
  }

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const firstCalendarDay = new Date(monthStart);
  firstCalendarDay.setDate(1 - monthStart.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCalendarDay);
    day.setDate(firstCalendarDay.getDate() + index);
    return day;
  });
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const canGoPrevious = viewDate > new Date(2026, 5, 1);
  const canGoNext = viewDate < new Date(2026, 7, 1);

  return (
    <div className="post-su-custom-range" ref={pickerRef}>
      <button type="button" className={`post-su-range-trigger${start || end ? " active" : ""}`} onClick={() => setOpen((current) => !current)}>
        <span className="post-su-range-label">{label}</span>
        <strong>{formatRangeDate(start || minDate)} <em>to</em> {formatRangeDate(end || maxDate)}</strong>
        <span className="post-su-range-chevron">⌄</span>
      </button>
      {open && (
        <div className="post-su-calendar-popover">
          <div className="post-su-calendar-header">
            <button type="button" disabled={!canGoPrevious} onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>‹</button>
            <strong>{monthLabel}</strong>
            <button type="button" disabled={!canGoNext} onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="post-su-calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="post-su-calendar-grid">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const disabled = key < minDate || key > maxDate;
              const preSU = showPeriodMarkers && key < "2026-07-15" && key >= minDate;
              const duringSU = showPeriodMarkers && key >= "2026-07-15" && key <= "2026-07-20";
              const selected = key === start || key === end;
              const inRange = start && end && key > start && key < end;
              return <button type="button" key={key} disabled={disabled} className={`${day.getMonth() !== viewDate.getMonth() ? "outside-month " : ""}${disabled ? "disabled-day " : ""}${preSU ? "pre-su-day " : ""}${duringSU ? "during-su-day " : ""}${selected ? "selected-day " : ""}${inRange ? "in-range " : ""}`} onClick={() => chooseDate(key)}>{day.getDate()}</button>;
            })}
          </div>
          <div className="post-su-calendar-footer">
            <span>{pendingStart ? "Choose an end date" : "Choose a start date"}</span>
            <div className="post-su-calendar-actions">
              {(start || end) && <button type="button" onClick={() => { onClear(); setPendingStart(""); }}>Clear</button>}
              <button type="button" onClick={selectFullRange}>Select full range</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostSUStreamerBreakdownPage({ summary = [], duringSummary = [], streams = [], groups = [] }) {
  const [search, setSearch] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedSizeTiers, setSelectedSizeTiers] = useState([]);
  const [sortKey, setSortKey] = useState("post_su_followers_gained");
  const [sortDescending, setSortDescending] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [selectedStreamer, setSelectedStreamer] = useState(null);
  const [metricRangeStart, setMetricRangeStart] = useState("2026-08-01");
  const [metricRangeEnd, setMetricRangeEnd] = useState("2026-08-30");
  const [timelineRangeStart, setTimelineRangeStart] = useState("");
  const [timelineRangeEnd, setTimelineRangeEnd] = useState("");
  const rangeStart = timelineRangeStart;
  const rangeEnd = timelineRangeEnd;
  const setRangeStart = setTimelineRangeStart;
  const setRangeEnd = setTimelineRangeEnd;
  const earliestTimelineDate = "2026-06-01";
  const earliestPostSUDate = "2026-07-21";
  const latestPostSUDate = "2026-08-30";
  const defaultPostSUMetricStart = "2026-08-01";
  const defaultPostSUMetricEnd = "2026-08-30";
  const postSUMetricStart = metricRangeStart || earliestPostSUDate;
  const postSUMetricEnd = metricRangeEnd || latestPostSUDate;
  const postSUMetricRangeLabel = `${formatRangeDate(postSUMetricStart)} - ${formatRangeDate(postSUMetricEnd)}`;

  const sizeTierOptions = useMemo(() => {
    const found = [
      ...new Set(duringSummary.map((row) => valueOf(row, "size_tier")).filter(Boolean)),
    ];

    return [
      ...SIZE_TIER_ORDER.filter((tier) => found.includes(tier)),
      ...found.filter((tier) => !SIZE_TIER_ORDER.includes(tier)),
    ];
  }, [duringSummary]);

  useEffect(() => {
    setSelectedGroups((current) => {
      if (!groups.length) return [];
      if (!current.length) return groups;
      const next = current.filter((groupValue) => groups.includes(groupValue));
      return next.length ? next : groups;
    });
  }, [groups]);

  useEffect(() => {
    setSelectedSizeTiers((current) => {
      if (!sizeTierOptions.length) return [];
      if (!current.length) return sizeTierOptions;
      const next = current.filter((tier) => sizeTierOptions.includes(tier));
      return next.length ? next : sizeTierOptions;
    });
  }, [sizeTierOptions]);

  const metricStreams = useMemo(() => {
    const startTime = new Date(`${postSUMetricStart}T00:00:00`).getTime();
    const endTime = new Date(`${postSUMetricEnd}T23:59:59`).getTime();
    return streams.filter((row) => {
      const time = new Date(row.stream_start || row.post_su_start).getTime();
      return time >= startTime && time <= endTime;
    });
  }, [postSUMetricEnd, postSUMetricStart, streams]);

  const timelineStreams = useMemo(() => {
    const startTime = timelineRangeStart ? new Date(`${timelineRangeStart}T00:00:00`).getTime() : -Infinity;
    const endTime = timelineRangeEnd ? new Date(`${timelineRangeEnd}T23:59:59`).getTime() : Infinity;
    return streams.filter((row) => {
      const time = new Date(row.stream_start || row.post_su_start).getTime();
      return time >= startTime && time <= endTime;
    });
  }, [streams, timelineRangeEnd, timelineRangeStart]);

  const filteredSummary = useMemo(() => {
    const byStreamer = new Map();
    for (const stream of metricStreams) {
      const key = String(stream?.streamer || stream?.display_name || "");
      if (!key) continue;
      const current = byStreamer.get(key) || [];
      current.push(stream);
      byStreamer.set(key, current);
    }

    return summary.map((row) => {
      const streamRows = byStreamer.get(String(row?.streamer || row?.display_name || "")) || [];
      const broadcasts = streamRows.length;
      const hours = streamRows.reduce((total, stream) => total + numberOf(stream, "post_su_hours_streamed", "stream_hours"), 0);
      const followers = streamRows.reduce((total, stream) => total + numberOf(stream, "post_su_followers_gained", "followers_gained"), 0);
      const weightedViewers = streamRows.reduce((total, stream) => total + numberOf(stream, "post_su_average_viewers", "average_viewers") * numberOf(stream, "post_su_hours_streamed", "stream_hours"), 0);
      const average = hours > 0 ? weightedViewers / hours : 0;
      const peak = streamRows.reduce((highest, stream) => Math.max(highest, numberOf(stream, "post_su_peak_viewers", "peak_viewers")), 0);

      return { ...row, has_post_su_data: streamRows.length > 0, post_su_broadcasts: broadcasts, post_su_total_hours_streamed: hours, post_su_hours_streamed: hours, post_su_followers_gained: followers, post_su_average_viewers_weighted: average, post_su_average_viewers_simple: average, post_su_peak_viewers: peak };
    });
  }, [metricStreams, summary]);

  const combinedRows = useMemo(() => {
    const byStreamer = new Map();

    for (const row of duringSummary) {
      const key = String(row?.streamer || row?.display_name || "");
      if (!key) continue;
      byStreamer.set(key, { ...row });
    }

    for (const row of filteredSummary) {
      const key = String(row?.streamer || row?.display_name || "");
      if (!key) continue;
      const current = byStreamer.get(key) || {};
      byStreamer.set(key, { ...current, ...row });
    }

    return [...byStreamer.values()];
  }, [duringSummary, filteredSummary]);

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return combinedRows
      .filter((row) => {
        const name = String(row.display_name || row.streamer || "").toLowerCase();
        return selectedGroups.includes(row.group)
          && selectedSizeTiers.includes(valueOf(row, "size_tier"))
          && (outcomeFilter === "All" || outcomeCategory(outcomeForRange(row)) === outcomeFilter)
          && (!normalizedSearch || name.includes(normalizedSearch));
      })
      .sort((left, right) => {
        const leftValue = sortKey === "display_name" ? String(left.display_name || left.streamer) : tableSortValue(left, sortKey);
        const rightValue = sortKey === "display_name" ? String(right.display_name || right.streamer) : tableSortValue(right, sortKey);
        if (typeof leftValue !== "string" && !Number.isFinite(leftValue)) return 1;
        if (typeof rightValue !== "string" && !Number.isFinite(rightValue)) return -1;
        const comparison = typeof leftValue === "string" ? leftValue.localeCompare(rightValue) : leftValue - rightValue;
        return sortDescending ? -comparison : comparison;
      });
  }, [combinedRows, search, selectedGroups, selectedSizeTiers, outcomeFilter, sortKey, sortDescending]);

  useEffect(() => {
    setSelectedStreamer((current) => {
      if (!rows.length) return null;
      if (!current) return rows[0];
      return rows.find((row) => row.streamer === current.streamer) || rows[0];
    });
  }, [rows]);

  const selectedStreams = useMemo(() => {
    if (!selectedStreamer) return [];
    return timelineStreams
      .filter((row) => row.streamer === selectedStreamer.streamer)
      .sort((left, right) => String(right.stream_start).localeCompare(String(left.stream_start)));
  }, [selectedStreamer, timelineStreams]);

  const trendData = useMemo(() => {
    if (!selectedStreams.length) return [];

    const sorted = [...selectedStreams].sort((left, right) => {
      const leftTime = new Date(left.stream_start || left.post_su_start).getTime();
      const rightTime = new Date(right.stream_start || right.post_su_start).getTime();
      return leftTime - rightTime;
    });

    const first = new Date(sorted[0].stream_start || sorted[0].post_su_start);
    const last = new Date(sorted[sorted.length - 1].stream_start || sorted[sorted.length - 1].post_su_start);
    const timeline = [];
    const streamDays = new Set(sorted.map((row) => new Date(row.stream_start || row.post_su_start).toISOString().slice(0, 10)));
    const cursor = new Date(first);
    cursor.setHours(0, 0, 0, 0);

    for (let day = new Date(cursor); day <= last; day.setDate(day.getDate() + 1)) {
      const dayKey = day.toISOString().slice(0, 10);
      if (!streamDays.has(dayKey)) {
        timeline.push({
          dateKey: dayKey,
          time: new Date(day).getTime(),
          label: formatTimelineDate(day),
          hours: null,
          average_viewers: null,
          peak_viewers: null,
          followers: null,
        });
      }
    }

    sorted.forEach((row) => {
      const rawDate = new Date(row.stream_start || row.post_su_start);
      const averageViewers = numberOf(row, "post_su_average_viewers", "average_viewers");
      const chartAverageViewers = averageViewers > 0 ? viewerScale(averageViewers) : null;
      const isPreSU = rawDate.getTime() < SU_START_TIME;
      const isDuringSU = !isPreSU && rawDate.getTime() < SU_END_TIME;
      timeline.push({
        dateKey: rawDate.toISOString().slice(0, 10),
        time: rawDate.getTime(),
        label: formatTimeLabel(rawDate),
        hours: numberOf(row, "post_su_hours_streamed", "stream_hours"),
        average_viewers: averageViewers > 0 ? averageViewers : null,
        chart_average_viewers: chartAverageViewers,
        isPreSU,
        isDuringSU,
        peak_viewers: numberOf(row, "post_su_peak_viewers", "peak_viewers"),
        followers: numberOf(row, "post_su_followers_gained", "followers_gained"),
        stream_url: row.stream_url,
      });
    });

    const orderedTimeline = timeline.sort((left, right) => left.time - right.time);
    const firstDuringSUStream = orderedTimeline.find(
      (row) => row.average_viewers !== null && row.isDuringSU
    );
    const lastDuringSUStream = [...orderedTimeline]
      .reverse()
      .find((row) => row.average_viewers !== null && row.isDuringSU);

    return orderedTimeline.map((row) => ({
      ...row,
      pre_su_average_viewers:
        row.isPreSU || row === firstDuringSUStream
          ? row.chart_average_viewers
          : null,
      during_su_average_viewers: row.isDuringSU ? row.chart_average_viewers : null,
      post_su_average_viewers:
        (!row.isPreSU && !row.isDuringSU) || row === lastDuringSUStream
          ? row.chart_average_viewers
          : null,
    }));
  }, [selectedStreams]);

  const visibleTrendData = useMemo(() => {
    return trendData;
  }, [trendData]);

  function toggleSort(nextKey) {
    if (nextKey === sortKey) setSortDescending((current) => !current);
    else {
      setSortKey(nextKey);
      setSortDescending(nextKey !== "display_name");
    }
  }

  const sortMark = (key) => sortKey === key ? (sortDescending ? " ↓" : " ↑") : "";

  const preAvg = numberOf(selectedStreamer, "pre_june_average_viewers", "pre_30d_average_viewers", "pre_average_viewers");
  const duringAvg = numberOf(selectedStreamer, "during_average_viewers");
  const postAvg = numberOf(selectedStreamer, "post_su_average_viewers_weighted", "post_su_average_viewers_simple");
  const preFollowers = numberOf(selectedStreamer, "pre_june_followers_gained", "pre_30d_followers_gained", "pre_followers_gained");
  const duringFollowers = numberOf(selectedStreamer, "during_followers_gained");
  const postFollowers = numberOf(selectedStreamer, "post_su_followers_gained");
  const preHours = numberOf(selectedStreamer, "pre_june_hours_streamed", "pre_30d_total_hours_streamed", "pre_total_hours_streamed");
  const duringHours = numberOf(selectedStreamer, "during_total_hours_streamed");
  const postHours = numberOf(selectedStreamer, "post_su_total_hours_streamed");
  const viewerAxisDomain = useMemo(() => {
    const values = trendData
      .map((row) => Number(row.average_viewers))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (preAvg > 0) values.push(preAvg);
    if (!values.length) return [10, 100];

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return [Math.max(1, minimum / 1.8), maximum * 1.8];
  }, [preAvg, trendData]);
  const viewerAxisTicks = useMemo(() => {
    const [minimum, maximum] = viewerAxisDomain;
    const standardTicks = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
    return standardTicks.filter((tick) => tick >= minimum && tick <= maximum);
  }, [viewerAxisDomain]);

  const comparisonCards = [
    { label: "Average viewers", values: [preAvg, duringAvg, postAvg], suffix: "" },
    { label: "Followers gained", values: [preFollowers, duringFollowers, postFollowers], suffix: "" },
    { label: "Peak viewers", values: [numberOf(selectedStreamer, "pre_june_peak_viewers", "pre_30d_peak_viewers", "pre_peak_viewers"), numberOf(selectedStreamer, "during_peak_viewers"), numberOf(selectedStreamer, "post_su_peak_viewers")], suffix: "" },
    { label: "Hours streamed", values: [preHours, duringHours, postHours], suffix: " hrs", compareToPre: false, showBaseline: false },
  ];

  return (
    <section className="post-su-breakdown-page">
      <header className="post-su-breakdown-heading">
        <div><span>Post-SU Analysis</span><h2>Streamer Breakdown</h2><p>Individual performance and post-SU broadcast activity.</p></div>
        <div className="post-su-breakdown-heading-actions">
          <CustomRangePicker label="Post-SU metrics" start={metricRangeStart} end={metricRangeEnd} minDate={earliestPostSUDate} maxDate={latestPostSUDate} onChange={(nextStart, nextEnd) => { setMetricRangeStart(nextStart); setMetricRangeEnd(nextEnd); }} onClear={() => { setMetricRangeStart(defaultPostSUMetricStart); setMetricRangeEnd(defaultPostSUMetricEnd); }} />
          <div className="post-su-breakdown-count">{formatNumber(rows.length)} streamers</div>
        </div>
      </header>

      <main className="post-su-breakdown-main">
        <section className="post-su-breakdown-toolbar">
          <label className="post-su-search-control"><span>Search streamer</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search streamer..." /></label>
          <MultiSelectDropdown
            label="Group"
            options={groups}
            selected={selectedGroups}
            onChange={setSelectedGroups}
            colorMap={GROUP_COLORS}
          />
          <MultiSelectDropdown
            label="Pre-SU streamer size"
            options={sizeTierOptions}
            selected={selectedSizeTiers}
            onChange={setSelectedSizeTiers}
          />
        </section>
          {selectedStreamer ? (
            <>
              <header className="post-su-profile-header">
                <div className="post-su-profile-identity"><div><span>Selected streamer</span><h3>{selectedStreamer.display_name || selectedStreamer.streamer}</h3><small>{selectedStreamer.group || "Streamer"}</small></div></div>
              </header>

              <div className="post-su-breakdown-metrics">
                {comparisonCards.map((card) => {
                  const duringChange = changeFor(card.values[1], card.values[0]);
                  const postChange = changeFor(card.values[2], card.values[0]);
                  return <article key={card.label} className={`post-su-metric-card${card.featured ? " featured" : ""}`}><div className="post-su-metric-heading"><small>{card.label}</small></div><div className="post-su-metric-columns"><div><span>Pre-SU</span><strong>{formatCompact(card.values[0])}{card.suffix}</strong>{card.showBaseline !== false && <em className="post-su-baseline-label">June baseline</em>}</div><div><span>During-SU</span><strong>{formatCompact(card.values[1])}{card.suffix}</strong>{card.compareToPre !== false && <em className={`post-su-change-indicator ${duringChange.tone}`}><b>{duringChange.icon}</b>{duringChange.label}</em>}</div><div><span>Post-SU</span><strong>{formatCompact(card.values[2])}{card.suffix}</strong>{card.compareToPre !== false && <em className={`post-su-change-indicator ${postChange.tone}`}><b>{postChange.icon}</b>{postChange.label}</em>}</div></div></article>;
                })}
                <div className="post-su-timeline-picker"><CustomRangePicker label="Timeline view" start={timelineRangeStart} end={timelineRangeEnd} minDate={earliestTimelineDate} maxDate={latestPostSUDate} showPeriodMarkers onChange={(nextStart, nextEnd) => { setTimelineRangeStart(nextStart); setTimelineRangeEnd(nextEnd); }} onClear={() => { setTimelineRangeStart(""); setTimelineRangeEnd(""); }} /></div>
              </div>

              <article className="post-su-chart-panel post-su-viewer-chart"><div className="post-su-chart-title"><div><h4>Average viewers over time</h4><small>Focused log scale · One point per broadcast · <span style={{ color: PRE_SU_COLOR }}>Pre-SU</span> · <span style={{ color: DURING_SU_COLOR }}>During SU</span> · <span style={{ color: POST_SU_COLOR }}>Post-SU</span></small></div><div className="post-su-chart-actions"><span>{formatNumber(selectedStreams.length)} broadcasts</span></div></div><div className="post-su-breakdown-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={visibleTrendData} margin={{ top: 12, right: 14, bottom: 10, left: 0 }} isAnimationActive={false}><CartesianGrid stroke="rgba(163, 173, 184, 0.13)" vertical={false} /><XAxis type="number" dataKey="time" domain={['dataMin', 'dataMax']} tick={{ fill: "#A3ADB8", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={18} tickFormatter={formatTimelineDate} /><YAxis type="number" scale="log" domain={viewerAxisDomain} ticks={viewerAxisTicks} allowDataOverflow={false} tick={{ fill: "#A3ADB8", fontSize: 10 }} axisLine={false} tickLine={false} width={42} tickFormatter={formatViewerScaleTick} /><Tooltip isAnimationActive={false} animationDuration={0} content={<StreamTrendTooltip />} /><ReferenceLine x={SU_START_TIME} stroke="#A3ADB8" strokeDasharray="4 4" label={{ value: "SU starts", position: "insideBottomLeft", fill: "#A3ADB8", fontSize: 10 }} /><ReferenceLine x={SU_END_TIME} stroke="#A3ADB8" strokeDasharray="4 4" label={{ value: "SU ends", position: "insideTopRight", fill: "#A3ADB8", fontSize: 10 }} /><ReferenceLine y={preAvg > 0 ? preAvg : undefined} stroke={PRE_SU_COLOR} strokeDasharray="3 3" label={{ value: "Pre-SU Average", position: "insideBottomLeft", fill: PRE_SU_COLOR, fontSize: 10 }} /><Line type="monotone" dataKey="pre_su_average_viewers" stroke={PRE_SU_COLOR} strokeWidth={2.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} /><Line type="monotone" dataKey="during_su_average_viewers" stroke={DURING_SU_COLOR} strokeWidth={2.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} /><Line type="monotone" dataKey="post_su_average_viewers" stroke={POST_SU_COLOR} strokeWidth={2.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} /><Line type="monotone" dataKey="chart_average_viewers" stroke="transparent" strokeWidth={0} dot={<StreamTrendDot />} activeDot={false} connectNulls isAnimationActive={false} /></LineChart></ResponsiveContainer></div></article>
            </>
          ) : <div className="post-su-breakdown-empty-state"><h3>Select a streamer</h3><p>Choose a name from the list to view their detailed breakdown.</p></div>}
      </main>

      <section className="post-su-breakdown-table-panel">
        <div className="post-su-table-heading"><div><span>Performance summary</span><h3>All streamers</h3></div><div className="post-su-table-actions"><small>Click a row to inspect the streamer</small></div></div>
        <div className="post-su-breakdown-table-wrap">
          <table>
            <thead>
              <tr className="post-su-table-groups">
                <th rowSpan="2" onClick={() => toggleSort("display_name")}>Streamer{sortMark("display_name")}</th>
                <th rowSpan="2">Group</th>
                <th colSpan="3">Pre-SU <small>June baseline</small></th>
                <th colSpan="3">During-SU <small>Event period</small></th>
                <th colSpan="3">Post-SU <small>{postSUMetricRangeLabel}</small></th>
                <th colSpan="3">Change % <small>Post-SU vs Pre-SU</small></th>
                <th rowSpan="2" className="post-su-outcome-header">
                  <span>Outcome</span>
                  <select
                    aria-label="Filter by outcome"
                    value={outcomeFilter}
                    onChange={(event) => setOutcomeFilter(event.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Grew">Grew</option>
                    <option value="Stagnant">Stagnant</option>
                    <option value="Declined">Declined</option>
                    <option value="Barely streamed">Barely streamed</option>
                    <option value="Undetermined">Undetermined</option>
                  </select>
                </th>
              </tr>
              <tr className="post-su-table-subgroups">
                <th onClick={() => toggleSort("pre_average")}>Avg viewers{sortMark("pre_average")}</th><th onClick={() => toggleSort("pre_followers")}>Followers{sortMark("pre_followers")}</th><th onClick={() => toggleSort("pre_hours")}>Hours{sortMark("pre_hours")}</th>
                <th onClick={() => toggleSort("during_average")}>Avg viewers{sortMark("during_average")}</th><th onClick={() => toggleSort("during_followers")}>Followers{sortMark("during_followers")}</th><th onClick={() => toggleSort("during_hours")}>Hours{sortMark("during_hours")}</th>
                <th onClick={() => toggleSort("post_average")}>Avg viewers{sortMark("post_average")}</th><th onClick={() => toggleSort("post_followers")}>Followers{sortMark("post_followers")}</th><th onClick={() => toggleSort("post_hours")}>Hours{sortMark("post_hours")}</th>
                <th onClick={() => toggleSort("change_average")}>Avg viewers{sortMark("change_average")}</th><th onClick={() => toggleSort("change_followers")}>Followers{sortMark("change_followers")}</th><th onClick={() => toggleSort("change_hours")}>Hours{sortMark("change_hours")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className={selectedStreamer?.streamer === row.streamer ? "selected" : ""} onClick={() => setSelectedStreamer(row)} key={row.streamer}>
                  <td>
                    <span className="post-su-streamer-name">
                      <strong>{row.display_name || row.streamer}</strong>
                      {[row.streamer, row.display_name].some((name) => String(name || "").toLowerCase() === "carterefe") && (
                        <StreamerAttendanceDisclaimer />
                      )}
                    </span>
                  </td>
                  <td>{row.group || "-"}</td>
                  <td>{formatCompact(valueOf(row, "pre_june_average_viewers", "pre_30d_average_viewers", "pre_average_viewers"))}</td>
                  <td>{formatCompact(valueOf(row, "pre_june_followers_gained", "pre_30d_followers_gained", "pre_followers_gained"))}</td>
                  <td>{formatCompact(valueOf(row, "pre_june_hours_streamed", "pre_30d_total_hours_streamed", "pre_total_hours_streamed"))}</td>
                  <td>{formatCompact(valueOf(row, "during_average_viewers"))}</td>
                  <td>{formatCompact(valueOf(row, "during_followers_gained"))}</td>
                  <td>{formatCompact(valueOf(row, "during_total_hours_streamed"))}</td>
                  <td>{formatCompact(valueOf(row, "post_su_average_viewers_weighted", "post_su_average_viewers_simple"))}</td>
                  <td>{formatCompact(valueOf(row, "post_su_followers_gained"))}</td>
                  <td>{formatCompact(valueOf(row, "post_su_total_hours_streamed"))}</td>
                  {[
                    ["post_average", "pre_average"],
                    ["post_followers", "pre_followers"],
                    ["post_hours", "pre_hours"],
                  ].map(([valueKey, baselineKey]) => {
                    const value = tableSortValue(row, valueKey);
                    const baseline = tableSortValue(row, baselineKey);
                    return <td className={`post-su-table-change ${changeClass(value, baseline)}`} key={valueKey}>{changePercent(value, baseline)}</td>;
                  })}
                  <td>{formatOutcome(outcomeForRange(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export default PostSUStreamerBreakdownPage;