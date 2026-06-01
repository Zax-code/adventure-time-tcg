English Wordle dictionary sources

- `wordle_en_answers.txt`: based on the original 2,315-answer Wordle solution list published in the `cfreshman` gist collection.
- `wordle_en_allowed_guesses.txt`: based on the NYT-era allowed-guess list published in the `cfreshman` gist collection.
- The import task unions the answer list into the allowed-guess set to guarantee every answer is also an accepted guess.

Verified counts when these files were added:

- Allowed guesses: 14,855
- Solution candidates: 2,315
