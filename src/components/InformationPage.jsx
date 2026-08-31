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
            <strong>Pre-SU</strong> means the June 1st to June 30th baseline.
            July 1-July 14 is not included in the baseline, because a lot of the smaller
            streamers gained a lot of  viewers after getting accepted in SU.
          </li>
          <li>
            <strong>Post-SU</strong> defaults to August 1 through August 30.
            July is excluded from the default because event hype and botting
            inflated audience numbers, making August a more representative
            comparison period. You can change this period using the
            <strong> Post-SU metrics</strong> date selector in Streamer Breakdown.
          </li>
          <li>
            <strong>Outcome</strong> compares the average viewers from the
            selected Post-SU metrics period with the streamer's June average:
            more than 10% above is <strong>Grew</strong>, within +/-10% is
            <strong> Stagnant</strong>, and more than 10% below is
            <strong> Declined</strong>.
          </li>
          <li>
            <strong>Barely streamed</strong> means fewer than 2 broadcasts or
            fewer than 20 total streaming hours during the selected Post-SU
            metrics period.
          </li>
        </ul>
      </article>

      <article className="info-card info-note">
        <h3>Project Note 🐔</h3>
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
