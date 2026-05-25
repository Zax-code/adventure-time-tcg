defmodule AdventureTimeApiWeb.ErrorJSONTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  test "renders 404" do
    assert AdventureTimeApiWeb.ErrorJSON.render("404.json", %{}) == %{error: "Not Found"}
  end

  test "renders 500" do
    assert AdventureTimeApiWeb.ErrorJSON.render("500.json", %{}) == %{
             error: "Internal Server Error"
           }
  end
end
