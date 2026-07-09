import { Link } from "react-router-dom";

import {
  CardsIcon,
  PackIcon,
  QuestIcon,
  SwordsIcon,
} from "../../components/icons";
import { APP_ICON_SRC } from "../../lib/assets";

const dailyLoop = [
  {
    number: "01",
    title: "Quest",
    description:
      "Return for short challenges that reward curiosity, memory, movement, and quick thinking.",
    Icon: QuestIcon,
    href: "/quests",
    tone: "secondary",
  },
  {
    number: "02",
    title: "Collect",
    description:
      "Turn rewards into pack openings and a catalog that shows exactly what is still missing.",
    Icon: CardsIcon,
    href: "/collection",
    tone: "primary",
  },
  {
    number: "03",
    title: "Shape",
    description:
      "Recycle duplicates, craft meaningful gaps, and build six-card teams with deliberate tradeoffs.",
    Icon: PackIcon,
    href: "/packs",
    tone: "success",
  },
  {
    number: "04",
    title: "Battle",
    description:
      "Challenge a friend, take a turn when it suits you, and replay every pivotal moment.",
    Icon: SwordsIcon,
    href: "/pvp/mechanics",
    tone: "accent",
  },
] as const;

export function LandingPage() {
  return (
    <>
      <section className="marketing-hero">
        <div className="marketing-copy">
          <span className="eyebrow">A daily card adventure</span>
          <h1>
            Build a collection that <em>does something.</em>
          </h1>
          <p>
            Open packs, solve playful daily challenges, craft the cards your team
            needs, and meet friends across a tactical battle table.
          </p>
          <div className="button-row">
            <Link className="button button-primary" to="/register">
              Start your collection
            </Link>
            <Link className="button button-secondary" to="/home">
              See today&apos;s rhythm
            </Link>
          </div>
          <dl className="hero-proof" aria-label="Adventure Time TCG at a glance">
            <div>
              <dt>Daily quests</dt>
              <dd>7</dd>
            </div>
            <div>
              <dt>Card types</dt>
              <dd>10</dd>
            </div>
            <div>
              <dt>Languages</dt>
              <dd>2</dd>
            </div>
            <div>
              <dt>Friendly world</dt>
              <dd>1</dd>
            </div>
          </dl>
        </div>

        <div className="marketing-art">
          <div className="world-scene" aria-hidden="true">
            <span className="world-orb" />
            <span className="world-cloud world-cloud-one" />
            <span className="world-cloud world-cloud-two" />
            <span className="world-hill world-hill-back" />
            <span className="world-hill world-hill-front" />
            <img className="world-app-icon" src={APP_ICON_SRC} alt="" />
            <span className="world-path" />
          </div>
          <div className="art-caption">
            <span>Today in Ooo</span>
            <strong>Three rewards are ready</strong>
          </div>
        </div>
      </section>

      <section className="loop-section" aria-labelledby="daily-loop-title">
        <header className="section-header">
          <div>
            <span className="eyebrow">The daily rhythm</span>
            <h2 id="daily-loop-title">
              A satisfying loop, one small visit at a time
            </h2>
            <p>
              The whole game is organized around four clear player intentions.
            </p>
          </div>
        </header>
        <div className="loop-grid">
          {dailyLoop.map(({ Icon, description, href, number, title, tone }) => (
            <article className={`loop-card tone-${tone}`} key={title}>
              <div className="loop-card-top">
                <span>{number}</span>
                <Icon />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <Link to={href}>Explore {title.toLowerCase()} →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-story">
        <div className="feature-story-copy">
          <span className="eyebrow">Not another endless ladder</span>
          <h2>Designed for friendly, low-pressure play.</h2>
          <p>
            There is no ranking treadmill hiding behind the cards. The reward is
            a growing collection, a clever daily solve, and the story of a battle
            between people you know.
          </p>
          <Link className="button button-secondary" to="/pvp/mechanics">
            How battles work
          </Link>
        </div>
        <div className="feature-story-points" aria-label="Ways to play">
          <article className="tone-secondary">
            <QuestIcon />
            <h3>Think for a minute</h3>
            <p>Wordle, Daily Numbers, and Speed Calculus make every visit distinct.</p>
          </article>
          <article className="tone-primary">
            <CardsIcon />
            <h3>Grow with purpose</h3>
            <p>Every pack, duplicate, and crafted card moves a visible collection forward.</p>
          </article>
          <article className="tone-accent">
            <SwordsIcon />
            <h3>Play people you know</h3>
            <p>Friendly asynchronous battles remember every turn and pivotal choice.</p>
          </article>
        </div>
      </section>

      <section className="public-cta">
        <span className="eyebrow">Your first pack is waiting</span>
        <h2>Pick a favorite. Then build a story around them.</h2>
        <div className="button-row">
          <Link className="button button-primary" to="/register">
            Create an account
          </Link>
          <Link className="button button-ghost" to="/status">
            Check game status
          </Link>
        </div>
      </section>
    </>
  );
}
