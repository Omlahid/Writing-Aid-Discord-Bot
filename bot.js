require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { DateTime } = require('luxon');
const fs = require('fs');
const path = require('path');
const userData = require('./userData.json');

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
const countPerDay = [
  1667, 3333, 5000, 6667, 8333, 10000, 11667, 13333, 15000,
  16667, 18333, 20000, 21667, 23333, 25000, 26667, 28333,
  30000, 31667, 33333, 35000, 36667, 38333, 40000, 41667,
  43333, 45000, 46667, 48333, 50000
];

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
    const now = DateTime.now().setZone('America/Toronto');

    if (now.month !== 11) {
      return message.reply(strings.wordcount_not_november);
    }

    const day = now.day;
    if (day > countPerDay.length) {
      return message.reply(strings.wordcount_invalid_day);
    }

    const target = countPerDay[day - 1];
    return message.reply(format(strings.wordcount_today, {
      day,
      target
    }));
  }

    if (command === strings.commands.cheer) {
      return message.reply(strings.cheer[Math.floor(Math.random() * strings.cheer.length)]);
    }

    if (command === strings.commands.congrats) {
      return message.reply(strings.congrats[Math.floor(Math.random() * strings.congrats.length)]);
    }

    if (command === strings.commands.hydrate) {
      return message.reply(strings.hydrate);
    }

    if (command === strings.commands.words) {
    const userId = message.author.id;
    let input = args[0];
    const modifier = args[1] && args[1].toLowerCase() === strings.commands.yesterday ? 'yesterday' : 'today';

    const baseDate = DateTime.now().setZone('America/Toronto');
    const now = modifier === 'yesterday' ? baseDate.minus({ days: 1 }) : baseDate;

    const monthKey = now.toFormat('yyyy-MM');
    const displayMonth = getDisplayMonth(now, true);

    if (!userData[userId]) {
      userData[userId] = { total: 0, monthly: {} };
    }

    const userEntry = userData[userId];
    const currentMonthly = userEntry.monthly[monthKey] || 0;
    const currentTotal = userEntry.total || 0;

    if (!input) {
      return message.reply(format(strings.words_show_monthly, {
        month: displayMonth,
        monthly: currentMonthly
      }));
    }

    if (input.toLowerCase() === strings.commands.all) {
      return message.reply(format(strings.words_show_all, {
        month: getDisplayMonth(now, false),
        monthly: currentMonthly,
        total: currentTotal
      }));
    }

    if (!/^[-+]?\d+$/.test(input)) {
      return message.reply(strings.invalid_number);
    }

    const parsed = parseInt(input, 10);
    let newMonthly, newTotal;

    if (input.startsWith('+') || input.startsWith('-')) {
      newMonthly = currentMonthly + parsed;
      newTotal = currentTotal + parsed;
    } else {
      newMonthly = parsed;
      newTotal = currentTotal - currentMonthly + parsed;
    }

    newMonthly = Math.max(0, newMonthly);
    newTotal = Math.max(0, newTotal);

    userEntry.monthly[monthKey] = newMonthly;
    userEntry.total = newTotal;

    try {
      fs.writeFileSync(dataPath, JSON.stringify(userData, null, 2));
      return message.reply(format(strings.words_set, {
        month: displayMonth,
        monthly: newMonthly
      }));
    } catch (err) {
      console.error('Failed to write userData.json:', err);
      return message.reply(strings.error_saving);
    }
  }
});

client.login(TOKEN);
