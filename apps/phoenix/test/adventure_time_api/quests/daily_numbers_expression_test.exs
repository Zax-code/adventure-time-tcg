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

  defp number(value), do: Expression.number(value)
  defp op(operator, left, right), do: Expression.operation(operator, left, right)
  defp key(expression), do: Expression.canonical_key(expression)
end
