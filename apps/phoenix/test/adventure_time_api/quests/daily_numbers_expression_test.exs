defmodule AdventureTimeApi.Quests.DailyNumbersExpressionTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Quests.DailyNumbersExpression, as: Expression

  test "canonicalizes commutative and associative addition" do
    assert key(op("+", number(25), number(50))) ==
             key(op("+", number(50), number(25)))

    assert key(op("+", op("+", number(25), number(50)), number(3))) ==
             key(op("+", number(3), op("+", number(50), number(25))))

    assert key(op("+", op("+", number(25), number(50)), number(3))) ==
             "+(n:3,n:25,n:50)"
  end

  test "canonicalizes commutative and associative multiplication" do
    assert key(op("*", op("*", number(2), number(3)), number(5))) ==
             key(op("*", number(5), op("*", number(3), number(2))))

    assert key(op("*", op("*", number(2), number(3)), number(5))) ==
             "*(n:2,n:3,n:5)"
  end

  test "preserves subtraction and division operand ordering" do
    refute key(op("-", number(50), number(25))) ==
             key(op("-", number(25), number(50)))

    refute key(op("/", number(50), number(2))) ==
             key(op("/", number(2), number(50)))
  end

  test "does not collapse algebraically equivalent structures" do
    factored = op("*", op("+", number(10), number(5)), number(2))

    distributed =
      op(
        "+",
        op("*", number(10), number(2)),
        op("*", number(5), number(2))
      )

    refute key(factored) == key(distributed)
  end

  test "round-trips canonical n-ary expressions through storage" do
    expression = op("*", op("+", number(3), number(7)), number(25))

    assert expression
           |> Expression.to_storage()
           |> Expression.from_storage()
           |> key() == key(expression)
  end

  test "canonicalizes visible steps independently of evaluation and commutative operand order" do
    first = [
      step(100, "-", 5, 95),
      step(6, "-", 2, 4),
      step(95, "*", 4, 380),
      step(75, "-", 4, 71),
      step(380, "+", 71, 451)
    ]

    reordered = [
      step(100, "-", 5, 95),
      step(4, "*", 95, 380),
      step(6, "-", 2, 4),
      step(75, "-", 4, 71),
      step(71, "+", 380, 451)
    ]

    assert Expression.solution_key_from_steps(first) ==
             Expression.solution_key_from_steps(reordered)
  end

  test "visible step keys preserve subtraction order and different constructions" do
    refute Expression.solution_key_from_steps([step(50, "-", 25, 25)]) ==
             Expression.solution_key_from_steps([step(25, "-", 50, -25)])

    factored = [step(10, "+", 5, 15), step(15, "*", 2, 30)]

    distributed = [
      step(10, "*", 2, 20),
      step(5, "*", 2, 10),
      step(20, "+", 10, 30)
    ]

    refute Expression.solution_key_from_steps(factored) ==
             Expression.solution_key_from_steps(distributed)
  end

  defp number(value), do: Expression.number(value)
  defp op(operator, left, right), do: Expression.operation(operator, left, right)
  defp key(expression), do: Expression.canonical_key(expression)

  defp step(left, operator, right, result) do
    %{leftValue: left, operator: operator, rightValue: right, resultValue: result}
  end
end
