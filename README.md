# Discord Writing Tracker Bot

A Discord bot for tracking writing progress, with monthly totals, all-time totals, and NaNoWriMo-style daily word targets.

---

## Features

- **!help** — Show all commands and usage.
- **!words** — Show your current monthly word count.
- **!words all** — Show both your monthly and all-time totals.
- **!words <number>** — Set your word count for this month.
- **!words +<number> / -<number>** — Increment or decrement your counts.
- **!leaderboard** — View the top word counts for the current month.
- **!wordcount** — During November, shows today’s NaNoWriMo target.
- Support for French and English

Note: All dates are currently only tracked in Eastern Time (ET) and respects daylight saving.

---

## Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/discord-writing-bot.git
cd discord-writing-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a .env file using the .env.example as a starter.

4. Run the bot.

```bash
node bot.js
```
