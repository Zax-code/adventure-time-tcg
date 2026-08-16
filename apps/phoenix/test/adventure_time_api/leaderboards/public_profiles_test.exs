defmodule AdventureTimeApi.Leaderboards.PublicProfilesTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Leaderboards.PublicProfiles

  test "assigns a stable canonical fallback avatar from the approved set" do
    public_profile_id = "6cf8ffcf-bf71-4ba2-a795-5759780e574d"

    key = PublicProfiles.fallback_avatar_key(public_profile_id)

    assert key in PublicProfiles.fallback_avatar_keys()
    assert PublicProfiles.fallback_avatar_key(public_profile_id) == key
    assert length(PublicProfiles.fallback_avatar_keys()) == 12
  end

  test "does not derive an avatar from invalid or missing identities" do
    assert PublicProfiles.fallback_avatar_key(nil) == nil
    assert PublicProfiles.fallback_avatar_key("not-a-uuid") == nil
  end
end
