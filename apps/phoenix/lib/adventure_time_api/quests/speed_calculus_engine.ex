defmodule AdventureTimeApi.Quests.SpeedCalculusEngine do
  @moduledoc """
  Pure Speed Calculus logic: seeded PRNG, question generation, scoring.

  The PRNG is a direct port of the JavaScript implementation in the backup
  (apps/api/src/lib/speed-calculus.ts) using FNV-1a hash + LCG, producing
  identical questions for the same seed — critical for mobile client sync.
  """

  import Bitwise

  @mask32 0xFFFFFFFF
  @question_count 120

  @run_duration_seconds 30
  @max_runs 3
  @reward_per_answer 4
  @finish_grace_seconds 5
  @resume_pause_seconds 5

  def run_duration_seconds, do: @run_duration_seconds
  def max_runs, do: @max_runs
  def reward_per_answer, do: @reward_per_answer
  def finish_grace_seconds, do: @finish_grace_seconds
  def resume_pause_seconds, do: @resume_pause_seconds

  def calculate_reward(correct_answers), do: max(0, correct_answers) * @reward_per_answer

  @doc """
  Build #{@question_count} deterministic arithmetic questions for a given seed UUID.
  Each question: %{index, left, right, operator ("+"|"-"), answer}.
  """
  def build_questions(seed, count \\ @question_count) do
    state = hash_seed(seed)

    {questions, _} =
      Enum.reduce(0..(count - 1), {[], state}, fn idx, {acc, s} ->
        {r1, s} = lcg_next(s)
        {r2, s} = lcg_next(s)
        {r3, s} = lcg_next(s)

        op = if r1 >= 0.5, do: :add, else: :sub
        left_raw = trunc(r2 * 21)
        right_raw = trunc(r3 * 21)

        {left, right, answer} =
          case op do
            :add ->
              {left_raw, right_raw, left_raw + right_raw}

            :sub ->
              hi = max(left_raw, right_raw)
              lo = min(left_raw, right_raw)
              {hi, lo, hi - lo}
          end

        q = %{
          index: idx,
          left: left,
          right: right,
          operator: if(op == :add, do: "+", else: "-"),
          answer: answer
        }

        {[q | acc], s}
      end)

    Enum.reverse(questions)
  end

  @doc "Strip answer keys for client-facing question payload."
  def to_public_questions(questions), do: Enum.map(questions, &Map.delete(&1, :answer))

  @doc "Evaluate a list of integer answers against the generated questions."
  def evaluate_answers(seed, answers) when is_list(answers) do
    questions = build_questions(seed)
    evaluate_answers_for_questions(questions, answers)
  end

  @doc "Evaluate answers against a precomputed question list."
  def evaluate_answers_for_questions(questions, answers)
      when is_list(questions) and is_list(answers) do
    limited = Enum.take(answers, length(questions))

    correct =
      limited
      |> Enum.zip(questions)
      |> Enum.count(fn {answer, question} -> question.answer == answer end)

    %{correct_answers: correct, total_answered: length(limited)}
  end

  @doc "Reconstruct per-question history for settled runs (answered questions only)."
  def build_run_history(seed, answers) when is_list(answers) do
    questions = build_questions(seed)
    build_run_history_for_questions(questions, answers)
  end

  @doc "Reconstruct per-question history using a precomputed question list."
  def build_run_history_for_questions(questions, answers)
      when is_list(questions) and is_list(answers) do
    count = min(length(answers), length(questions))

    if count == 0 do
      []
    else
      Enum.map(0..(count - 1), fn idx ->
        q = Enum.at(questions, idx)
        user_ans = Enum.at(answers, idx)
        is_correct = user_ans == q.answer

        %{
          index: q.index,
          left: q.left,
          right: q.right,
          operator: q.operator,
          userAnswer: user_ans,
          wasAnswered: true,
          isCorrect: is_correct,
          correctAnswer: if(is_correct, do: nil, else: q.answer)
        }
      end)
    end
  end

  # FNV-1a hash of seed string, masked to 32 bits.
  # Direct port of hashSeed() in speed-calculus.ts.
  defp hash_seed(seed) do
    result =
      seed
      |> to_charlist()
      |> Enum.reduce(2_166_136_261, fn char, hash ->
        band(bxor(hash, char) * 16_777_619, @mask32)
      end)

    if result == 0, do: 1, else: result
  end

  # LCG step: returns {float in [0,1), new_state}.
  # Direct port of createSeededRandom() next() in speed-calculus.ts.
  defp lcg_next(state) do
    new_state = band(state * 1_664_525 + 1_013_904_223, @mask32)
    {new_state / 4_294_967_296.0, new_state}
  end
end
