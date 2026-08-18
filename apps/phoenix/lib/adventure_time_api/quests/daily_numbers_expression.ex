defmodule AdventureTimeApi.Quests.DailyNumbersExpression do
  @moduledoc """
  Daily Numbers arithmetic expressions, exact operation rules, and structural
  canonicalization.

  Addition and multiplication are flattened and sorted. Subtraction and
  division retain their left/right ordering. No algebraic simplification is
  performed.
  """

  @commutative_operators ["+", "*"]
  @operators @commutative_operators ++ ["-", "/"]

  def number(value) when is_integer(value) and value > 0 do
    %{type: :number, value: value}
  end

  def operation(operator, left, right) when operator in @operators do
    %{type: :operation, operator: operator, children: [left, right]}
  end

  def apply_operator(left, "+", right), do: {:ok, left + right}
  def apply_operator(left, "*", right), do: {:ok, left * right}

  def apply_operator(left, "-", right) do
    result = left - right

    if result > 0, do: {:ok, result}, else: {:error, :result_must_be_positive}
  end

  def apply_operator(left, "/", right) do
    cond do
      right == 0 -> {:error, :division_must_be_exact}
      rem(left, right) != 0 -> {:error, :division_must_be_exact}
      div(left, right) <= 0 -> {:error, :result_must_be_positive}
      true -> {:ok, div(left, right)}
    end
  end

  def apply_operator(_left, _operator, _right), do: {:error, :invalid_operator}

  def evaluate(%{type: :number, value: value}), do: value

  def evaluate(%{type: :operation, operator: operator, children: children}) do
    case children do
      [first | rest] ->
        Enum.reduce(rest, evaluate(first), fn child, value ->
          {:ok, result} = apply_operator(value, operator, evaluate(child))
          result
        end)

      [] ->
        raise ArgumentError, "operation expressions require children"
    end
  end

  def canonicalize(%{type: :number, value: value}), do: number(value)

  def canonicalize(%{type: :operation, operator: operator, children: children})
      when operator in @commutative_operators do
    canonical_children =
      children
      |> Enum.map(&canonicalize/1)
      |> Enum.flat_map(&flatten_child(&1, operator))
      |> Enum.sort_by(&canonical_sort_key/1)

    %{type: :operation, operator: operator, children: canonical_children}
  end

  def canonicalize(%{type: :operation, operator: operator, children: [left, right]})
      when operator in ["-", "/"] do
    operation(operator, canonicalize(left), canonicalize(right))
  end

  def canonical_key(expression) do
    expression
    |> canonicalize()
    |> serialize_canonical()
  end

  def to_storage(expression) do
    case canonicalize(expression) do
      %{type: :number, value: value} ->
        %{"type" => "number", "value" => value}

      %{type: :operation, operator: operator, children: children} ->
        %{
          "type" => "operation",
          "operator" => operator,
          "children" => Enum.map(children, &to_storage/1)
        }
    end
  end

  defp flatten_child(%{type: :operation, operator: operator, children: children}, operator),
    do: children

  defp flatten_child(child, _operator), do: [child]

  defp canonical_sort_key(%{type: :number, value: value}), do: {0, value}
  defp canonical_sort_key(expression), do: {1, serialize_canonical(expression)}

  defp serialize_canonical(%{type: :number, value: value}), do: "n:#{value}"

  defp serialize_canonical(%{type: :operation, operator: operator, children: children}) do
    serialized_children = Enum.map_join(children, ",", &serialize_canonical/1)
    "#{operator}(#{serialized_children})"
  end
end
