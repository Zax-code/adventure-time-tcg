INSERT INTO rarities (id, name, drop_rate, color)
VALUES
  ('common', 'Common', 60, '#94a3b8'),
  ('rare', 'Rare', 25, '#38bdf8'),
  ('epic', 'Epic', 10, '#f97316'),
  ('legendary', 'Legendary', 5, '#eab308')
ON CONFLICT DO NOTHING;

INSERT INTO image_assets (id, kind, mime_type, placeholder_svg)
VALUES
  (
    'card-finn-placeholder',
    'card',
    'image/svg+xml',
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#1d4ed8"/><text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="40">Finn</text><text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="#dbeafe" font-size="18">Heroic Swordsman</text></svg>'
  ),
  (
    'profile-default',
    'profile',
    'image/svg+xml',
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" rx="128" fill="#0f766e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ecfeff" font-size="28">AT</text></svg>'
  )
ON CONFLICT DO NOTHING;

INSERT INTO cards (id, name, character, description, hp, attack, defense, speed, type, rarity_id, image_asset_id)
VALUES
  ('finn-hero', 'Finn the Human', 'Finn', 'A balanced hero card for the first native slice.', 80, 24, 18, 42, 'hero', 'rare', 'card-finn-placeholder')
ON CONFLICT DO NOTHING;
