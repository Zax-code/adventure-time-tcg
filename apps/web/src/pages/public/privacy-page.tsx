import { Link } from "react-router-dom";

const privacySections = [
  {
    kicker: "Account",
    title: "Account and authentication data",
    body: "We store your email address, display name, password authentication state, preferred language, timezone, profile image, and session records so you can sign in and keep your account secure.",
  },
  {
    kicker: "Gameplay",
    title: "Game progress data",
    body: "We store coins, dust, cards, packs, gifts, quests, PvP loadouts, matches, battle events, and related timestamps so the game can preserve your progress.",
  },
  {
    kicker: "Activity",
    title: "Optional step-sync data",
    body: "If you enable step quests, the mobile app reads step counts from Apple Health, Health Connect, the device pedometer, or Fitbit. We store daily step totals, source, date, and sync timestamps for quest progress. We do not sell this data.",
  },
  {
    kicker: "Notifications",
    title: "Notification data",
    body: "If you enable notifications, we store installation identifiers and push tokens so the mobile app can send requested quest, gift, and PvP alerts. You can disable preferences in settings or revoke OS permission at any time.",
  },
  {
    kicker: "Sharing",
    title: "Sharing and third parties",
    body: "Data is sent securely when you use the game. Third-party services are used only as needed for platform login, email, push notifications, app distribution, storage, and an optional Fitbit connection.",
  },
  {
    kicker: "Security",
    title: "Access-request fraud prevention",
    body: "When you request access, we may assess your IP network, request and app metadata, and Android app/device integrity to help a super administrator review abuse risk. IPQualityScore processes the IP and limited technical metadata for this purpose. The result is advisory only: a person approves or rejects every request. Exact IPs are removed 30 days after review, detailed evidence after 90 days, and the review record after one year.",
  },
  {
    kicker: "Control",
    title: "Access and deletion",
    body: "You can update preferences, disconnect optional services, or delete your account. Deletion removes credentials, collection, gifts, quest progress, PvP data, step snapshots, notification devices, and your profile image.",
  },
] as const;

export function PrivacyPage() {
  return (
    <>
      <header className="page-header public-page-header">
        <div className="page-heading">
          <span className="eyebrow">Privacy policy · updated August 2026</span>
          <h1>Privacy without the maze.</h1>
          <p>
            A readable account of the data that makes collections, quests,
            gifts, and battles work.
          </p>
        </div>
        <div className="page-actions">
          <Link className="button button-secondary" to="/account-deletion">
            Deletion details
          </Link>
        </div>
      </header>

      <div className="policy-layout">
        <aside className="policy-index" aria-label="On this page">
          <strong>On this page</strong>
          {privacySections.map((section, index) => (
            <a href={`#privacy-${index + 1}`} key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {section.title}
            </a>
          ))}
        </aside>
        <section className="policy-content" aria-label="Privacy details">
          {privacySections.map((section, index) => (
            <article id={`privacy-${index + 1}`} key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small className="eyebrow">{section.kicker}</small>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {section.kicker === "Control" ? (
                  <Link className="text-link" to="/account-deletion">
                    Open deletion instructions →
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          <div className="policy-callout">
            <strong>Plain-language promise</strong>
            <p>
              Adventure Time TCG does not sell personal information or use step
              data for advertising.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
