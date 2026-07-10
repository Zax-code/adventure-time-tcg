import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import type {
  DailyNumbersMode,
  DailyNumbersStateResponse,
  DailyNumbersStepInput,
  WordleLocale,
} from "@adventure-time/api-client";

import {
  CheckCircleIcon,
  CoinIcon,
  GiftHeartIcon,
  QuestIcon,
  SpeedCalculusQuestIcon,
  SparklesIcon,
} from "@/components/icons";
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormStatus,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  ProgressBar,
  QueryState,
  SectionHeader,
  SegmentedControl,
  StatCard,
} from "@/components/ui";
import { webApiClient } from "@/lib/api";
import { useAuth } from "@/auth";
import { readErrorMessage } from "@/lib/form-utils";
import { getQuestDescription, getQuestTitle } from "@/lib/quest-copy";

const dailyModes: Array<{ label: string; value: DailyNumbersMode; copy: string }> = [
  { label: "1–5", value: "1-5", copy: "One large, five small" },
  { label: "2–4", value: "2-4", copy: "Two large, four small" },
  { label: "3–3", value: "3-3", copy: "Three large, three small" },
];

export function QuestsPage() {
  const { restore } = useAuth();
  const queryClient = useQueryClient();
  const quests = useQuery({ queryKey: ["quests"], queryFn: () => webApiClient.quests() });
  const fitbit = useQuery({ queryKey: ["fitbit"], queryFn: () => webApiClient.fitbitStatus() });
  const claim = useMutation({
    mutationFn: (questId: string) => webApiClient.claimQuest({ questId }),
    onSuccess: async () => {
      await restore();
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
    },
  });
  const connectFitbit = useMutation({
    mutationFn: () => webApiClient.createFitbitAuthorizeUrl({ redirectUri: `${window.location.origin}/settings` }),
    onSuccess: ({ authorizeUrl }) => window.location.assign(authorizeUrl),
  });

  return (
    <div className="page-stack quests-page">
      <PageHeader
        eyebrow="Seven threads, one day"
        lede="Move, solve, collect, and return when you like. Every completed quest waits until you choose to claim it."
        title="Daily quests"
      />
      {!fitbit.isPending && !fitbit.data?.connected ? (
        <Notice title="Step quests need a web-friendly source" tone="info">
          <p>Browsers cannot read Apple Health or Health Connect directly. Connect Fitbit here, or use the mobile app to sync device-health steps.</p>
          <Button busy={connectFitbit.isPending} onClick={() => connectFitbit.mutate()} tone="secondary">Connect Fitbit</Button>
        </Notice>
      ) : null}
      <QueryState query={quests} empty={(data) => data.quests.length === 0}>
        {(data) => (
          <div className="quest-list">
            {data.quests.map((quest, index) => {
              const claimable = quest.completed && !quest.claimed;
              return (
                <article className={`quest-row ${quest.completed ? "complete" : ""} ${quest.failed ? "failed" : ""}`} key={quest.id}>
                  <div className="quest-number">{String(index + 1).padStart(2, "0")}</div>
                  <div className="quest-icon"><QuestIcon /></div>
                  <div className="quest-copy">
                    <span>{quest.type.replaceAll("_", " ")}</span>
                    <h2>{getQuestTitle(quest)}</h2>
                    <p>{getQuestDescription(quest)}</p>
                    <ProgressBar label={`${getQuestTitle(quest)}: ${quest.progress} of ${quest.target}`} max={quest.target} value={quest.progress} />
                    <small>{Math.min(quest.progress, quest.target).toLocaleString()} / {quest.target.toLocaleString()}</small>
                  </div>
                  <div className="quest-reward"><CoinIcon /><b>+{quest.reward}</b><small>{quest.claimed ? "claimed" : claimable ? "ready" : "reward"}</small></div>
                  <div className="quest-action">
                    {claimable ? <Button busy={claim.isPending && claim.variables === quest.id} onClick={() => claim.mutate(quest.id)}>Claim</Button> : quest.actionPath && !quest.claimed ? <ButtonLink to={quest.actionPath} tone="secondary">Open</ButtonLink> : quest.claimed ? <span className="claimed-label"><CheckCircleIcon /> Done</span> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}

export function DailyNumbersPage() {
  const states = useQueries({
    queries: dailyModes.map((mode) => ({
      queryKey: ["daily-numbers", mode.value],
      queryFn: () => webApiClient.dailyNumbersState(mode.value),
    })),
  });

  if (states.some((state) => state.isPending)) return <LoadingState label="Setting today's number tiles…" />;
  const error = states.find((state) => state.isError);
  if (error) return <ErrorState error={error.error} onRetry={() => states.forEach((state) => void state.refetch())} />;

  return (
    <div className="page-stack daily-numbers-page">
      <PageHeader
        actions={<ButtonLink to="/quests/daily-numbers/history" tone="secondary">Open 30-day archive</ButtonLink>}
        eyebrow="Daily Numbers"
        lede="Combine six numbers with +, −, ×, and ÷. Get as close to the target as you can; exact is wonderful, not required."
        title="Three puzzles. One shared idea."
      />
      <div className="number-mode-grid">
        {dailyModes.map((mode, index) => {
          const state = states[index].data;
          return (
            <article className={`number-mode-card ${state?.completed ? "complete" : ""}`} key={mode.value}>
              <div className="number-target"><small>Target</small><strong>{state?.target ?? "—"}</strong></div>
              <span className="eyebrow">Mode {mode.label}</span>
              <h2>{mode.copy}</h2>
              <div className="number-preview">{state?.numbers.map((tile) => <span key={tile.id}>{tile.value}</span>)}</div>
              <dl><div><dt>Best</dt><dd>{state?.bestValue ?? "—"}</dd></div><div><dt>Distance</dt><dd>{state?.bestDistance ?? "—"}</dd></div><div><dt>Reward</dt><dd>{state?.reward ?? 0} coins</dd></div></dl>
              <ButtonLink to={`/quests/daily-numbers/play?mode=${mode.value}`} tone={state?.submitted ? "secondary" : "primary"}>{state?.submitted ? "Review result" : "Play this mode"}</ButtonLink>
            </article>
          );
        })}
      </div>
      <Notice title="How scoring works">
        Use each tile at most once. Division must resolve to a positive whole number. Your final remaining value is scored by its distance from the target, and your steps are checked again on the server.
      </Notice>
    </div>
  );
}

type Operator = "+" | "-" | "*" | "/";

function operationResult(left: number, operator: Operator, right: number) {
  const result = operator === "+" ? left + right : operator === "-" ? left - right : operator === "*" ? left * right : left / right;
  return Number.isInteger(result) && result > 0 ? result : null;
}

function PuzzleWorkspace({ archive, state }: { archive: boolean; state: DailyNumbersStateResponse }) {
  const queryClient = useQueryClient();
  const [steps, setSteps] = useState<DailyNumbersStepInput[]>([]);
  const [leftId, setLeftId] = useState<string>();
  const [rightId, setRightId] = useState<string>();
  const [operator, setOperator] = useState<Operator>("+");
  const [message, setMessage] = useState<string>();
  const startedAt = useState(() => Date.now())[0];

  const tiles = useMemo(() => {
    const values = new Map(state.numbers.map((tile) => [tile.id, tile.value]));
    const available = new Set(state.numbers.map((tile) => tile.id));
    steps.forEach((step) => {
      const left = values.get(step.leftId);
      const right = values.get(step.rightId);
      if (left === undefined || right === undefined) return;
      const result = operationResult(left, step.operator, right);
      if (result === null) return;
      values.set(step.resultId, result);
      available.delete(step.leftId);
      available.delete(step.rightId);
      available.add(step.resultId);
    });
    return [...available].map((id) => ({ id, value: values.get(id) ?? 0 }));
  }, [state.numbers, steps]);

  const submit = useMutation({
    mutationFn: () => archive
      ? webApiClient.submitDailyNumbersArchive({ mode: state.mode, dateKey: state.date, elapsedMs: Date.now() - startedAt, steps })
      : webApiClient.submitDailyNumbers({ mode: state.mode, dateKey: state.date, questVersion: state.questVersion ?? undefined, elapsedMs: Date.now() - startedAt, steps }),
    onSuccess: async () => {
      setMessage("Result saved. Your daily quest progress has been updated.");
      await queryClient.invalidateQueries({ queryKey: ["daily-numbers"] });
      await queryClient.invalidateQueries({ queryKey: ["quests"] });
    },
  });

  function combine() {
    const left = tiles.find((tile) => tile.id === leftId);
    const right = tiles.find((tile) => tile.id === rightId);
    if (!left || !right || left.id === right.id) {
      setMessage("Choose two different available tiles.");
      return;
    }
    if (operationResult(left.value, operator, right.value) === null) {
      setMessage("That operation must create a positive whole number.");
      return;
    }
    setSteps((current) => [...current, { leftId: left.id, operator, rightId: right.id, resultId: `web-${current.length}-${crypto.randomUUID()}` }]);
    setLeftId(undefined);
    setRightId(undefined);
    setMessage(undefined);
  }

  if (state.submitted && state.submission) {
    return (
      <Panel className="number-result-panel">
        <div className="number-result-orb">
          <span>Final value</span>
          <strong>{state.submission.finalValue}</strong>
          <small>Distance {state.submission.distance}</small>
        </div>
        <div className="number-result-copy">
          <span className="eyebrow">Saved result · mode {state.mode}</span>
          <h2>{state.submission.exact ? "Exactly on target." : "Your closest trail is saved."}</h2>
          <p>Score {state.submission.score} · {Math.round(state.submission.elapsedMs / 1000)} seconds · {state.submission.steps.length} operations.</p>
          {state.submission.steps.length ? <ol>{state.submission.steps.map((step, index) => <li key={step.resultId}><span>{index + 1}</span><code>{step.leftValue} {step.operator === "*" ? "×" : step.operator === "/" ? "÷" : step.operator} {step.rightValue} = {step.resultValue}</code></li>)}</ol> : null}
          <div className="button-row"><ButtonLink to="/quests/daily-numbers" tone="secondary">Other modes</ButtonLink><ButtonLink to="/quests/daily-numbers/history" tone="ghost">Open archive</ButtonLink></div>
        </div>
      </Panel>
    );
  }

  return (
    <div className="number-workspace">
      <Panel className="target-panel"><span>Get close to</span><strong>{state.target}</strong><small>{state.date} · Mode {state.mode}</small></Panel>
      <Panel className="number-board">
        <SectionHeader lede="Select a left tile, an operator, and a right tile." title="Available tiles" />
        <div className="number-tiles">{tiles.map((tile) => <button aria-pressed={leftId === tile.id || rightId === tile.id} className={leftId === tile.id ? "left" : rightId === tile.id ? "right" : ""} key={tile.id} onClick={() => !leftId ? setLeftId(tile.id) : leftId === tile.id ? setLeftId(undefined) : setRightId(tile.id)} type="button">{tile.value}</button>)}</div>
        <div className="operator-row">{(["+", "-", "*", "/"] as Operator[]).map((value) => <button aria-pressed={operator === value} key={value} onClick={() => setOperator(value)} type="button">{value === "*" ? "×" : value === "/" ? "÷" : value}</button>)}</div>
        <div className="equation-preview"><span>{tiles.find((tile) => tile.id === leftId)?.value ?? "?"}</span><b>{operator === "*" ? "×" : operator === "/" ? "÷" : operator}</b><span>{tiles.find((tile) => tile.id === rightId)?.value ?? "?"}</span><b>=</b><strong>{leftId && rightId ? operationResult(tiles.find((tile) => tile.id === leftId)?.value ?? 0, operator, tiles.find((tile) => tile.id === rightId)?.value ?? 0) ?? "—" : "?"}</strong></div>
        <div className="button-row"><Button disabled={!leftId || !rightId} onClick={combine}>Combine tiles</Button><Button disabled={!steps.length} onClick={() => setSteps((current) => current.slice(0, -1))} tone="ghost">Undo</Button></div>
      </Panel>
      <Panel className="number-ledger">
        <SectionHeader title="Your working" />
        {steps.length ? <ol>{steps.map((step, index) => <li key={step.resultId}><span>{index + 1}</span><code>{step.leftId.slice(-5)} {step.operator} {step.rightId.slice(-5)}</code></li>)}</ol> : <p>No operations yet. Your steps will appear here.</p>}
        <FormStatus message={submit.isError ? readErrorMessage(submit.error) : message} success={submit.isSuccess} />
        <Button busy={submit.isPending} disabled={tiles.length !== 1 || steps.length === 0} onClick={() => submit.mutate()}>Submit final value {tiles.length === 1 ? tiles[0].value : ""}</Button>
      </Panel>
    </div>
  );
}

export function DailyNumbersPlayPage() {
  const [search, setSearch] = useSearchParams();
  const mode = dailyModes.some((item) => item.value === search.get("mode")) ? search.get("mode") as DailyNumbersMode : "1-5";
  const date = search.get("date");
  const state = useQuery({
    queryKey: ["daily-numbers", date || "today", mode],
    queryFn: () => date ? webApiClient.dailyNumbersArchiveState(date, mode) : webApiClient.dailyNumbersState(mode),
  });

  return (
    <div className="page-stack daily-play-page">
      <PageHeader
        actions={<ButtonLink to={date ? "/quests/daily-numbers/history" : "/quests/daily-numbers"} tone="ghost">Leave puzzle</ButtonLink>}
        eyebrow={date ? "Archive puzzle" : "Today's puzzle"}
        lede="Your work is submitted only when one value remains. You can leave safely before then."
        title="Daily Numbers"
      />
      <SegmentedControl label="Puzzle mode" onChange={(next) => setSearch((current) => { current.set("mode", next); return current; })} options={dailyModes.map(({ label, value }) => ({ label, value }))} value={mode} />
      <QueryState query={state}>{(data) => <PuzzleWorkspace archive={Boolean(date)} key={`${data.date}-${data.mode}`} state={data} />}</QueryState>
    </div>
  );
}

export function DailyNumbersHistoryPage() {
  const history = useQuery({ queryKey: ["daily-numbers-history"], queryFn: () => webApiClient.dailyNumbersArchiveHistory() });
  return (
    <div className="page-stack number-history-page">
      <PageHeader actions={<ButtonLink to="/quests/daily-numbers" tone="secondary">Today's puzzles</ButtonLink>} eyebrow="Thirty-day archive" lede="Past puzzles are practice: their status is saved, but they do not award today's quest coins." title="Revisit an older number trail" />
      <QueryState query={history} empty={(data) => data.days.length === 0}>
        {(data) => <div className="archive-list">{data.days.map((day) => <article key={day.date}><div><span>{day.date === data.today ? "Today" : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span><b>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</b></div><div className="archive-modes">{day.modes.map((mode) => <Link className={`archive-${mode.status}`} key={mode.mode} to={`/quests/daily-numbers/play?date=${day.date}&mode=${mode.mode}`}><b>{mode.mode}</b><span>{mode.status}</span><small>{mode.finalValue ? `${mode.finalValue} · Δ${mode.distance}` : "Unplayed"}</small></Link>)}</div></article>)}</div>}
      </QueryState>
    </div>
  );
}

export function SpeedCalculusPage() {
  const queryClient = useQueryClient();
  const answerInputRef = useRef<HTMLInputElement>(null);
  const pendingAnswerFocusRef = useRef(false);
  const [answerFocusRequest, setAnswerFocusRequest] = useState(0);
  const [displayRemainingSeconds, setDisplayRemainingSeconds] = useState(0);
  const state = useQuery({ queryKey: ["speed-calculus"], queryFn: () => webApiClient.speedCalculusState(), refetchInterval: (query) => query.state.data?.activeRun ? 5_000 : false });
  const command = useMutation({
    mutationFn: (kind: "start" | "pause" | "resume" | "cashout") => kind === "start" ? webApiClient.startSpeedCalculus() : kind === "pause" ? webApiClient.pauseSpeedCalculus() : kind === "resume" ? webApiClient.resumeSpeedCalculus() : webApiClient.cashoutSpeedCalculus(),
    onSuccess: (_response, kind) => {
      if (kind === "start" || kind === "resume") requestAnswerFocus();
      void queryClient.invalidateQueries({ queryKey: ["speed-calculus"] });
    },
  });
  const answer = useMutation({
    mutationFn: ({ runId, value, version }: { runId: string; value: number; version?: string }) => webApiClient.answerSpeedCalculus(runId, value, version),
    onSuccess: () => {
      requestAnswerFocus();
      void queryClient.invalidateQueries({ queryKey: ["speed-calculus"] });
    },
  });

  const finish = useMutation({
    mutationFn: ({ runId, questVersion }: { runId: string; questVersion?: string }) =>
      webApiClient.finishSpeedCalculus(runId, questVersion),
    onSuccess: async (_result) => {
      await queryClient.invalidateQueries({ queryKey: ["speed-calculus"] });
    },
  });

  const activeRun = state.data?.activeRun;

  useEffect(() => {
    setDisplayRemainingSeconds(activeRun?.remainingSeconds ?? 0);
  }, [activeRun?.isManuallyPaused, activeRun?.remainingSeconds, activeRun?.runId]);

  useEffect(() => {
    if (!activeRun || activeRun.isManuallyPaused || finish.isPending) {
      return;
    }

    if (displayRemainingSeconds <= 0 || activeRun.questionIndex >= activeRun.questions.length) {
      finish.mutate({ runId: activeRun.runId, questVersion: state.data?.questVersion ?? undefined });
      return;
    }

    const timer = window.setTimeout(() => {
      setDisplayRemainingSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1_000);

    return () => window.clearTimeout(timer);
  }, [activeRun, displayRemainingSeconds, finish, state.data?.questVersion]);

  useEffect(() => {
    if (
      pendingAnswerFocusRef.current
      && activeRun
      && !activeRun.isManuallyPaused
      && answerInputRef.current
    ) {
      answerInputRef.current.focus();
      pendingAnswerFocusRef.current = false;
    }
  }, [activeRun, answerFocusRequest]);

  function requestAnswerFocus() {
    pendingAnswerFocusRef.current = true;
    setAnswerFocusRequest((request) => request + 1);
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>, runId: string, version?: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    answer.mutate({ runId, value: Number(form.get("answer")), version });
    event.currentTarget.reset();
  }

  return (
    <div className="page-stack speed-page">
      <PageHeader actions={<ButtonLink to="/quests/speed-calculus/training" tone="secondary">Training room</ButtonLink>} eyebrow="Speed Calculus" lede="Solve as many additions and subtractions as you can. You control when a scored run begins and whether to cash out." title="Think clearly, then move quickly." />
      <QueryState query={state}>
        {(data) => (
          <>
            <div className="stat-grid compact-stats"><StatCard label="Runs used" value={`${data.runsUsed}/${data.maxRuns}`} /><StatCard label="Latest score" value={data.latestScore} tone="accent" /><StatCard label="Reward preview" value={`${data.rewardPreview} coins`} tone="secondary" /><StatCard label="Seconds per run" value={data.runDurationSeconds} tone="info" /></div>
            {data.activeRun ? (
              <Panel className="speed-run-panel">
                <div className="speed-run-head"><div><span>Run {data.activeRun.runNumber}</span><strong>{displayRemainingSeconds}s</strong></div><div><span>Correct</span><strong>{data.activeRun.correctAnswers}</strong></div></div>
                {data.activeRun.isManuallyPaused ? <Notice title="Run paused"><p>You have {data.activeRun.pauseRemainingSeconds} seconds left in the pause window.</p><Button busy={command.isPending} onClick={() => command.mutate("resume")}>Resume run</Button></Notice> : (
                  <form className="speed-question" onSubmit={(event) => submitAnswer(event, data.activeRun!.runId, data.questVersion ?? undefined)}>
                    <div>{data.activeRun.questions[data.activeRun.questionIndex]?.left ?? "?"} <b>{data.activeRun.questions[data.activeRun.questionIndex]?.operator}</b> {data.activeRun.questions[data.activeRun.questionIndex]?.right ?? "?"} <span>=</span></div>
                    <input aria-label="Answer" inputMode="numeric" name="answer" pattern="-?[0-9]+" ref={answerInputRef} required type="text" />
                    <Button busy={answer.isPending} type="submit">Answer</Button>
                  </form>
                )}
                <div className="button-row"><Button busy={command.isPending} disabled={data.activeRun.isManuallyPaused} onClick={() => command.mutate("pause")} tone="ghost">Pause</Button></div>
              </Panel>
            ) : (
              <Panel className="speed-start-panel"><SpeedCalculusQuestIcon /><div><h2>{data.locked ? "Today's scored runs are complete." : "Ready for the clock?"}</h2><p>{data.canStartRun ? `You have ${data.maxRuns - data.runsUsed} scored run${data.maxRuns - data.runsUsed === 1 ? "" : "s"} left.` : "Use training for unlimited reward-free practice."}</p></div><div className="button-row"><Button busy={command.isPending} disabled={!data.canStartRun} onClick={() => command.mutate("start")}>Start scored run</Button>{data.canCashOut ? <Button busy={command.isPending} onClick={() => command.mutate("cashout")} tone="secondary">Cash out {data.rewardPreview}</Button> : null}</div></Panel>
            )}
            {data.history.length ? <Panel><SectionHeader title="Today's run history" /><div className="run-history">{data.history.map((run) => <article key={run.runId}><span>Run {run.runNumber}</span><b>{run.correctAnswers} correct</b><small>{run.totalAnswered} answered · {run.reward} coins</small></article>)}</div></Panel> : null}
            <FormStatus message={finish.isError ? readErrorMessage(finish.error) : command.isError ? readErrorMessage(command.error) : answer.isError ? readErrorMessage(answer.error) : undefined} />
          </>
        )}
      </QueryState>
    </div>
  );
}

export function SpeedTrainingPage() {
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const pendingAnswerFocusRef = useRef(false);
  const [answerFocusRequest, setAnswerFocusRequest] = useState(0);
  const training = useMutation({
    mutationFn: () => webApiClient.startSpeedCalculusTraining(),
    onSuccess: () => {
      setIndex(0);
      setCorrect(0);
      requestAnswerFocus();
    },
  });
  const current = training.data?.questions[index];

  useEffect(() => {
    if (pendingAnswerFocusRef.current && current && answerInputRef.current) {
      answerInputRef.current.focus();
      pendingAnswerFocusRef.current = false;
    }
  }, [answerFocusRequest, current]);

  function requestAnswerFocus() {
    pendingAnswerFocusRef.current = true;
    setAnswerFocusRequest((request) => request + 1);
  }

  function answer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const value = Number(new FormData(event.currentTarget).get("answer"));
    const expected = current.operator === "+" ? current.left + current.right : current.left - current.right;
    if (value === expected) setCorrect((score) => score + 1);
    setIndex((value) => value + 1);
    requestAnswerFocus();
    event.currentTarget.reset();
  }

  return (
    <div className="page-stack speed-training-page">
      <PageHeader actions={<ButtonLink to="/quests/speed-calculus" tone="ghost">Back to scored runs</ButtonLink>} eyebrow="Training room" lede="Unlimited practice, no timer pressure, no rewards. The questions still come from the game server." title="Build the rhythm first." />
      {!training.data ? <Panel className="training-intro"><GiftHeartIcon /><h2>Practice is intentionally consequence-free.</h2><p>Start a fresh seeded set. Nothing here spends a run or changes today's score.</p><Button busy={training.isPending} onClick={() => training.mutate()}>Begin training</Button></Panel> : current ? <Panel className="training-board"><div className="training-score"><span>Question {index + 1}</span><b>{correct} correct</b></div><form className="speed-question" onSubmit={answer}><div>{current.left} <b>{current.operator}</b> {current.right} <span>=</span></div><input aria-label="Answer" inputMode="numeric" name="answer" ref={answerInputRef} required /><Button type="submit">Check</Button></form></Panel> : <EmptyState action={<Button onClick={() => training.mutate()}>New set</Button>} copy={`You answered ${correct} of ${training.data.questions.length} correctly.`} title="Training set complete" />}
      {training.isError ? <FormStatus message={readErrorMessage(training.error)} /> : null}
    </div>
  );
}

function emptyWordRow(length: number) {
  return Array.from({ length }, (_, index) => <span key={index} />);
}

export function WordlePage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialLocale = searchParams.get("language") ?? searchParams.get("locale");
  const [locale, setLocale] = useState<WordleLocale>(initialLocale === "fr" ? "fr" : "en");
  const [guess, setGuess] = useState("");
  const state = useQuery({ queryKey: ["wordle", locale], queryFn: () => webApiClient.wordleState(locale) });
  const definition = useQuery({ queryKey: ["wordle-definition", locale], queryFn: () => webApiClient.wordleDefinition(locale), enabled: Boolean(state.data?.solved || state.data?.targetWord) });
  const submit = useMutation({
    mutationFn: () => webApiClient.submitWordle({ locale, guess: guess.trim(), expectedDate: state.data?.date, questVersion: state.data?.questVersion ?? undefined }),
    onSuccess: async () => {
      setGuess("");
      await queryClient.invalidateQueries({ queryKey: ["wordle", locale] });
      await queryClient.invalidateQueries({ queryKey: ["quests"] });
    },
  });

  return (
    <div className="page-stack wordle-page">
      <PageHeader eyebrow="Daily Wordle" lede="One word in each supported language. Six tries, server-checked guesses, and a definition when the answer is revealed." title="A five-letter trail" />
      <SegmentedControl label="Word language" onChange={setLocale} options={[{ label: "English", value: "en" }, { label: "Français", value: "fr" }]} value={locale} />
      <QueryState query={state}>
        {(data) => (
          <div className="wordle-layout">
            <Panel className="wordle-board">
              <div className="word-grid">
                {data.guesses.map((row, rowIndex) => <div key={`${row.guess}-${rowIndex}`}>{row.guess.toUpperCase().split("").map((letter, index) => <span className={row.evaluation[index]} key={`${letter}-${index}`}>{letter}</span>)}</div>)}
                {Array.from({ length: Math.max(0, 6 - data.guesses.length) }, (_, row) => <div key={`empty-${row}`}>{emptyWordRow(5)}</div>)}
              </div>
              {!data.solved && data.guesses.length < 6 ? <form className="wordle-entry" onSubmit={(event) => { event.preventDefault(); submit.mutate(); }}><input aria-label="Five-letter guess" autoCapitalize="characters" autoComplete="off" maxLength={5} minLength={5} onChange={(event) => setGuess(event.target.value.replace(/[^A-Za-zÀ-ÿ]/g, ""))} placeholder="GUESS" required value={guess} /><Button busy={submit.isPending} disabled={guess.length !== 5} type="submit">Submit guess</Button></form> : null}
              <FormStatus message={submit.isError ? readErrorMessage(submit.error) : data.solved ? "You found today's word." : data.guesses.length >= 6 ? `The word was ${data.targetWord ?? "revealed"}.` : undefined} success={data.solved} />
            </Panel>
            <Panel className="wordle-guide"><SparklesIcon /><h2>{data.solved || data.targetWord ? definition.data?.displayWord || data.targetWord : "Read the trail"}</h2>{definition.data ? <><span>{definition.data.partOfSpeech}</span><p>{definition.data.definition}</p><a href={definition.data.sourceUrl} rel="noreferrer" target="_blank">Definition via {definition.data.sourceName} ↗</a></> : <><p>Green means the right place. Gold means the word contains that letter elsewhere. Muted letters are absent.</p><small>{6 - data.guesses.length} attempts remain</small></>}</Panel>
          </div>
        )}
      </QueryState>
    </div>
  );
}
