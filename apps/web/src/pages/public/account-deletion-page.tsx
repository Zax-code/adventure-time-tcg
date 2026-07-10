import { Link } from "react-router-dom";

const deletionSteps = [
  {
    title: "Open account settings",
    body: "Sign in, open Settings, and find Privacy & data near the end of the page.",
  },
  {
    title: "Choose Delete my account",
    body: "Review the permanent removal summary and confirm deliberately. The game will ask for a final confirmation.",
  },
  {
    title: "Your game data is removed",
    body: "Credentials, profile, collection, gifts, quests, step snapshots, notification devices, loadouts, matches, and profile imagery are deleted.",
  },
  {
    title: "Need help?",
    body: "If you cannot sign in, contact support from the email address attached to the account. We may ask you to verify ownership before acting.",
  },
] as const;

export function AccountDeletionPage() {
  return (
    <>
      <header className="page-header public-page-header">
        <div className="page-heading">
          <span className="eyebrow">Account deletion</span>
          <h1>Your account, your exit.</h1>
          <p>
            Delete your account from settings at any time, with a clear view of
            what disappears.
          </p>
        </div>
        <div className="page-actions">
          <Link className="button button-primary" to="/settings">
            Open settings
          </Link>
        </div>
      </header>

      <div className="policy-layout deletion-policy">
        <aside className="policy-index" aria-label="Deletion steps">
          <strong>Deletion steps</strong>
          {deletionSteps.map((step, index) => (
            <a href={`#deletion-${index + 1}`} key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {step.title}
            </a>
          ))}
        </aside>
        <section className="policy-content" aria-label="Account deletion instructions">
          {deletionSteps.map((step, index) => (
            <article id={`deletion-${index + 1}`} key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
                {index === deletionSteps.length - 1 ? (
                  <a className="text-link" href="mailto:support@leaetzak.love">
                    support@leaetzak.love
                  </a>
                ) : null}
              </div>
            </article>
          ))}
          <div className="policy-callout policy-callout-danger">
            <strong>Deletion is permanent.</strong>
            <p>
              There is no undo after the account and its dependent game records
              are removed.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
