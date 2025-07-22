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

const strings = JSON.parse(fs.readFileSync(path.join(__dirname, 'en.json'), 'utf8'));
const dataPath = path.join(__dirname, 'userData.json');

function format(str, data = {}) {
  return str.replace(/{(.*?)}/g, (_, key) => data[key] ?? `{${key}}`);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'help') {
    return message.reply(strings.help);
  }

  if (command === 'words') {
    const userId = message.author.id;
    const input = args[0];
    const now = DateTime.now().setZone('America/Toronto');
    const monthKey = now.toFormat('yyyy-MM');

    if (!userData[userId]) {
      userData[userId] = { total: 0, monthly: {} };
    }

    const userEntry = userData[userId];
    const currentMonthly = userEntry.monthly[monthKey] || 0;
    const currentTotal = userEntry.total || 0;

    if (!input) {
      return message.reply(format(strings.words_show_monthly, {
        month: monthKey,
        monthly: currentMonthly
      }));
    }

    if (input.toLowerCase() === 'all') {
      return message.reply(format(strings.words_show_all, {
        month: monthKey,
        monthly: currentMonthly,
        total: currentTotal
      }));
    }

    if (input.toLowerCase() === 'leaderboard') {
      const leaderboard = Object.entries(userData)
        .map(([id, data]) => ({
          userId: id,
          count: data.monthly?.[monthKey] || 0
        }))
        .filter(entry => entry.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      if (leaderboard.length === 0) {
        return message.reply(format(strings.leaderboard_empty, { month: monthKey }));
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
        month: monthKey,
        entries: lines.join('\n')
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
        month: monthKey,
        monthly: newMonthly
      }));
    } catch (err) {
      console.error('Failed to write userData.json:', err);
      return message.reply(strings.error_saving);
    }
  }
});

client.login(TOKEN);
