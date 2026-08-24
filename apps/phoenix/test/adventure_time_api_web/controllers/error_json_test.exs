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

  test "renders a structured application upload limit response" do
    assert AdventureTimeApiWeb.ErrorJSON.render("413.json", %{}) == %{
             error: "Upload exceeds the 12 MB application limit",
             code: "UPLOAD_TOO_LARGE"
           }
  end
end
