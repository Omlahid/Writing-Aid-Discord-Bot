require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { DateTime } = require('luxon');
const fs = require('fs');
const path = require('path');
const prompts = require('./prompts.json');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PREFIX = '!';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Determine language
const lang = process.env.LANGUAGE || 'en';
let strings;

try {
  const langPath = path.join(__dirname, `${lang}.json`);
  strings = JSON.parse(fs.readFileSync(langPath, 'utf8'));
  console.log(`Loaded language file: ${lang}.json`);
} catch (err) {
  console.warn(`Could not load ${lang}.json, falling back to en.json`);
  strings = JSON.parse(fs.readFileSync(path.join(__dirname, 'en.json'), 'utf8'));
}

const dataPath = path.join(__dirname, 'userData.json');

let userData = {};
if (fs.existsSync(dataPath)) {
  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    userData = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse userData.json, starting with empty object:', err);
    userData = {};
  }
} else {
  // File doesn't exist, initialize with {}
  fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
  userData = {};
}

function format(str, data = {}) {
  return str.replace(/{(.*?)}/g, (_, key) => data[key] ?? `{${key}}`);
}

function getDisplayMonth(dt, cap) {
  const currentYear = DateTime.now().year;
  const raw = dt.year === currentYear
    ? dt.setLocale(lang).toFormat('LLLL')       // Month name only
    : dt.setLocale(lang).toFormat('LLLL yyyy'); // Month name + year

  // Capitalize first letter only if locale supports casing
  if (raw && raw.length > 0 && cap) {
    const first = raw.charAt(0);
    const upper = first.toUpperCase();
    if (first !== upper) {
      return upper + raw.slice(1);
    }
  }
  return raw;
}


client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'help' || command === strings.commands.help) {
    return message.reply(strings.help);
  }

  if (command === strings.commands.leaderboard) {
    const now = DateTime.now().setZone(process.env.TIMEZONE || 'America/Toronto');
    const monthKey = now.toFormat('yyyy-MM');
    const displayMonth = getDisplayMonth(now, false);

    const leaderboard = Object.entries(userData)
      .map(([id, data]) => ({
        userId: id,
        count: data.monthly?.[monthKey] || 0
      }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    if (leaderboard.length === 0) {
      return message.reply(format(strings.leaderboard_empty, { month: displayMonth }));
    }

    const lines = await Promise.all(
      leaderboard.map(async (entry, index) => {
        try {
          const user = await client.users.fetch(entry.userId);
          return format(strings.leaderboard_entry, {
            rank: index + 1,
            username: user.username,
            count: entry.count
          });
        } catch {
          return format(strings.leaderboard_entry, {
            rank: index + 1,
            username: `Unknown (${entry.userId})`,
            count: entry.count
          });
        }
      })
    );

    return message.reply(format(strings.leaderboard_title, {
      month: displayMonth,
      entries: lines.join('\n')
    }));
  }

if (command === strings.commands.wordcount) {
  const userId = message.author.id;
  const now = DateTime.now().setZone('America/Toronto');
  const monthKey = now.toFormat('yyyy-MM');
  const displayMonth = getDisplayMonth(now, true);
  const daysInMonth = now.daysInMonth;
  const day = now.day;

  if (!userData[userId]) {
    userData[userId] = { total: 0, daily: {}, monthly: {}, goal: {} };
  }
  const userEntry = userData[userId];
  if (!userEntry.goal) {
    userEntry.goal = {};
  }

  const monthlyGoal = userEntry.goal[monthKey] || null;
  const currentWordCount = userEntry.monthly[monthKey] || 0;

  // --- Case 1: November with NO goal set → fallback to NaNoWriMo default ---
  if (now.month === 11 && !monthlyGoal) {
    const countPerDay = [
      1667, 3333, 5000, 6667, 8333, 10000, 11667, 13333, 15000,
      16667, 18333, 20000, 21667, 23333, 25000, 26667, 28333,
      30000, 31667, 33333, 35000, 36667, 38333, 40000, 41667,
      43333, 45000, 46667, 48333, 50000
    ];

    const target = countPerDay[day - 1];
    return message.reply(format(strings.wordcount_today, {
      day,
      target,
      currentWordCount
    }));
  }

  // --- Case 2: Has a monthly goal set (any month, incl. November) ---
  if (monthlyGoal) {
    const perDay = Math.ceil(monthlyGoal / daysInMonth);
    const target = perDay * day;

    return message.reply(format(strings.wordcount_today, {
      day,
      target,
      currentWordCount
    }));
  }

  // --- Case 3: No goal set & not November fallback ---
  return message.reply(strings.goal_none.replace('{month}', displayMonth));
}


  if (command === strings.commands.cheer) {
    return message.reply(strings.cheer[Math.floor(Math.random() * strings.cheer.length)]);
  }

  if (command === strings.commands.congrats) {
    return message.reply(strings.congrats[Math.floor(Math.random() * strings.congrats.length)]);
  }

  if (command === strings.commands.hydrate) {
    return message.channel.send(strings.hydrate);
  }

  if (command === strings.commands.prompt) {
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    return message.reply(prompt);
  }

if (command === strings.commands.words) {
  const userId = message.author.id;
  let input = args[0];
  const modifier =
    args[1] && args[1].toLowerCase() === strings.commands.yesterday
      ? 'yesterday'
      : 'today';

  const baseDate = DateTime.now().setZone('America/Toronto');
  const now = modifier === 'yesterday' ? baseDate.minus({ days: 1 }) : baseDate;

  const monthKey = now.toFormat('yyyy-MM');
  const dayKey = now.toFormat('yyyy-MM-dd');
  const displayMonth = getDisplayMonth(now, true);

  // Ensure user entry exists
  if (!userData[userId]) {
    userData[userId] = { total: 0, daily: {}, monthly: {} };
  }
  const userEntry = userData[userId];

  // Current totals
  const currentDaily = userEntry.daily[dayKey] || 0;
  const currentMonthly = userEntry.monthly[monthKey] || 0;
  const currentTotal = userEntry.total || 0;

  // === SHOW MONTHLY TOTAL ===
  if (!input) {
    return message.reply(
      format(strings.words_show_monthly, {
        month: displayMonth,
        monthly: currentMonthly,
      })
    );
  }

  // === SHOW ALL-TIME TOTAL ===
  if (input.toLowerCase() === strings.commands.all) {
    return message.reply(
      format(strings.words_show_all, {
        month: getDisplayMonth(now, false),
        monthly: currentMonthly,
        total: currentTotal,
      })
    );
  }

  // === VALIDATION ===
  if (!/^[-+]?\d+$/.test(input)) {
    return message.reply(strings.invalid_number);
  }

  const parsed = parseInt(input, 10);
  let delta;

  // === CALCULATE DELTA ===
  if (input.startsWith('+') || input.startsWith('-')) {
    // relative change, applied directly
    delta = parsed;
  } else {
    // absolute: only apply the difference between new desired and old monthly
    delta = parsed - currentMonthly;
  }

  // === APPLY TO DAILY ===
  const newDaily = Math.max(0, currentDaily + delta);
  userEntry.daily[dayKey] = newDaily;

  // === RECALCULATE MONTHLY & TOTAL ===
  const newMonthly = Object.entries(userEntry.daily)
    .filter(([date]) => date.startsWith(monthKey))
    .reduce((sum, [, val]) => sum + val, 0);

  const newTotal = Object.values(userEntry.daily).reduce(
    (sum, val) => sum + val,
    0
  );

  userEntry.monthly[monthKey] = newMonthly;
  userEntry.total = newTotal;

  // === SAVE & REPLY ===
  try {
    fs.writeFileSync(dataPath, JSON.stringify(userData, null, 2));
    return message.reply(
      format(strings.words_set, {
        month: displayMonth,
        monthly: newMonthly,
      })
    );
  } catch (err) {
    console.error('Failed to write userData.json:', err);
    return message.reply(strings.error_saving);
  }
}

if (command === strings.commands.goal) {
  const userId = message.author.id;
  const baseDate = DateTime.now().setZone('America/Toronto');
  const monthKey = baseDate.toFormat('yyyy-MM');
  const displayMonth = getDisplayMonth(baseDate, true);
  const daysInMonth = baseDate.daysInMonth;
  if (!userData[userId]) {
    userData[userId] = { total: 0, daily: {}, monthly: {}, goal: {} };
  }

  const userEntry = userData[userId];

  if (!userEntry.goal) {
    userEntry.goal = {};
  }
  // Case: no arguments → show current goal or instructions
  if (!args.length) {
    if (userEntry.goal[monthKey]) {
      const goal = userEntry.goal[monthKey];
      const perDay = Math.ceil(goal / daysInMonth);
      return message.reply(format(strings.goal_show, {
        month: displayMonth,
        goal: goal,
        perDay: perDay
      }));
    } else {
      return message.reply(strings.goal_none);
    }
  }

  const input = args.join(''); // join all args in case user writes "50 000"

  if (!input) {
    return message.reply(strings.invalid_number);
  }

  // normalize: remove spaces, commas, dots (but not leading minus/plus)
  const normalized = input.replace(/[\s,\.]/g, '');

  if (!/^\d+$/.test(normalized)) {
    return message.reply(strings.invalid_number);
  }

  const parsed = parseInt(normalized, 10);

  userEntry.goal[monthKey] = parsed;

  try {
    fs.writeFileSync(dataPath, JSON.stringify(userData, null, 2));
    return message.reply(format(strings.goal_set, {
      month: displayMonth,
      perDay: Math.ceil(parsed / daysInMonth),
      goal: parsed
    }));
  } catch (err) {
    console.error('Failed to write userData.json:', err);
    return message.reply(strings.error_saving);
  }
}


});

client.login(TOKEN);
