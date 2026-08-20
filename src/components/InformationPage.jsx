import "./InformationPage.css";

function InformationPage() {
  return (
    <section className="info-page">
      <header className="info-page-heading">
        <h2>Information</h2>
        <p>
          Methodology notes, caveats, and scope for this dashboard.
        </p>
      </header>

      <article className="info-card">
        <h3>Data Source And Scope</h3>
        <ul>
          <li>All data in this dashboard is sourced from <strong>SullyGnome</strong>.</li>
          <li>
            This includes <strong>Twitch</strong> streamers only. YouTube, Kick, and other
            platforms are not included.
          </li>
          <li>
            <strong>SullyGnome</strong> and <strong>TwitchTracker</strong> can differ slightly, so you may see
            discrepancies when comparing numbers. <strong>SullyGnome</strong> tends to have numbers that are slightly lower than whats reported on <strong>TwitchTracker</strong>.
          </li>
        </ul>
      </article>

      <article className="info-card">
        <h3>Long Stream Day Splitting</h3>
        <p>
          Some streams run across multiple days (for example, a 50-hour stream).
          Sullygnome reports that as a single stream, so I don't have the exact followers gained per day. To account for this, daily followers gained in the app are <strong>calculated</strong> per day rather than reused from the
          full stream.
        </p>
        <p>
          <strong>Formula:</strong> Daily followers gained = Total followers
          gained x (Daily hours streamed / Total stream hours)
        </p>
      </article>

      <article className="info-card">
        <h3>Definitions</h3>
        <ul>
          <li>
            A marathon streamer is someone who streamed at least 80% of all
            possible hours during Streamer University.
          </li>
          <li>
            Followers gained counts only followers gained while a streamer was
            live. Followers gained while they were offline are not included.
          </li>
          <li>
            SU starts at <strong>2:00 PM on July 15</strong> and event-day
            boundaries reset at <strong>6:00 AM</strong> (not midnight).
          </li>
          <li>
            The current event window ends at <strong>6:00 AM on July 20</strong>.
            "During SU" means stats that fall inside that timestamp range. So, if a streamer gained followers while being live past <strong>6:00 AM on July 20</strong>, those followers are not counted.
          </li>
        </ul>
      </article>

      <article className="info-card">
        <h3>Post-SU Analysis</h3>
        <ul>
          <li>
            <strong>Pre-SU</strong> means the June 1 through June 30 baseline.
            July 1 through July 14 is not used as the baseline because some
            smaller streamers had already been accepted into SU, which could
            inflate their viewer numbers before the event began.
          </li>
          <li>
            <strong>Post-SU</strong> begins July 21 and currently covers the
            full available reporting period through August 19. The Post-SU
            metrics date range can be changed in Streamer Breakdown, and the
            table values and outcomes update to match the selected range.
          </li>
          <li>
            <strong>Outcome</strong> compares the selected Post-SU average
            viewers with the streamer's June average: more than 10% above is
            <strong> Grew</strong>, within +/-10% is <strong>Stagnant</strong>,
            and more than 10% below is <strong>Declined</strong>.
          </li>
          <li>
            <strong>Barely streamed</strong> means fewer than 2 broadcasts or
            fewer than 20 total Post-SU streaming hours in the selected range.
            This activity label takes priority over the audience outcome.
          </li>
          <li>
            A streamer with no valid June baseline is shown as
            <strong> Undetermined</strong> rather than being treated as zero.
            No baseline does not mean no viewers.
          </li>
        </ul>
      </article>

      <article className="info-card info-note">
        <h3>Project Note</h3>
        <p>
          This is a small personal project and may contain errors. Treat it as
          experimental and avoid sharing it publicly as a formal analysis :)
        </p>
        <img
          className="info-note-image"
          src="/1x.avif"
          alt="1X graphic"
          loading="lazy"
        />
      </article>
    </section>
  );
}

export default InformationPage;
