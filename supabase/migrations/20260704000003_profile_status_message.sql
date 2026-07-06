-- profiles.status_message: editable tagline shown under the display name on MyPage.
-- NULL/empty falls back to the default slogan "Alone, but not lonely".
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status_message TEXT;

-- Length cap to keep the header tidy (UI also caps input at 80).
ALTER TABLE profiles
  ADD CONSTRAINT profiles_status_message_length
  CHECK (status_message IS NULL OR char_length(status_message) <= 80);
