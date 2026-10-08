defmodule AdventureTimeApiWeb.WebsiteDocumentCacheTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  @plug AdventureTimeApiWeb.Plugs.WebsiteDocumentPlug

  setup do
    original = Application.get_env(:adventure_time_api, @plug, [])

    path =
      Path.join(System.tmp_dir!(), "website-cache-#{System.unique_integer([:positive])}.html")

    File.write!(path, "<html data-cache-version=\"one\"></html>")
    Application.put_env(:adventure_time_api, @plug, index_path: path, cache_document: true)

    on_exit(fn ->
      Application.put_env(:adventure_time_api, @plug, original)
      :persistent_term.erase({@plug, path})
      File.rm(path)
    end)

    %{path: path}
  end

  test "production caching serves the first read of index.html", %{path: path} do
    fetch = fn ->
      build_conn()
      |> put_req_header("accept", "text/html")
      |> get("/")
      |> html_response(200)
    end

    assert fetch.() =~ "data-cache-version=\"one\""

    File.write!(path, "<html data-cache-version=\"two\"></html>")
    assert fetch.() =~ "data-cache-version=\"one\""
  end
end
