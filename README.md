# 🎉 vx-discord-giveaways

A powerful, lightweight and **discord.js-version-agnostic** giveaway framework for Discord bots.

`vx-discord-giveaways` lets you create, manage, roll, edit and delete giveaways with just a few lines of code —
and it works out of the box with **every discord.js version from v11 to v14**, automatically detecting the installed version.

---

## 📦 Compatible with ALL discord.js versions

This package is compatible with **every discord.js major version still in use**:

| discord.js | Supported | Notes |
| ---------- | :-------: | ----- |
| **v11**    | ✅ | Automatic version detection |
| **v12**    | ✅ | Automatic version detection |
| **v13**    | ✅ | Automatic version detection |
| **v14**    | ✅ | Automatic version detection |

No configuration, no feature flags, no forks — the library inspects the installed `discord.js` at runtime and adapts
every Discord API interaction (embeds, messages, reactions, members, permissions, caches) to the correct API shape
for your version.

You can always check which version was detected:

```js
const { discordjsVersion } = require('vx-discord-giveaways');
console.log(discordjsVersion); // 11 | 12 | 13 | 14
```

---

## ✨ Features

- ⏱️ **Easy to use** — start a giveaway in a single `start()` call
- 🔄 **Crash-safe** — giveaways are restored and resume automatically when the bot restarts
- 📦 **Cross-version** — works with discord.js **v11, v12, v13 and v14**, auto-detected
- 🇫🇷 **Fully translatable** — every message can be customized per-giveaway
- 📁 **Any database** — JSON file by default, but pluggable (MySQL, MongoDB, Enmap, Quick.db, etc.)
- ⚙️ **Highly customizable** — prize, duration, winners, permissions, reactions, bonus entries, last-chance mode...
- 🚀 **Super powerful** — start, edit, reroll, end and delete giveaways
- 💥 **Rich event system** — `giveawayEnded`, `giveawayRerolled`, `giveawayDeleted`, reaction events...
- 🕸️ **Multi-shard support** — via the `refreshStorage()` hook
- 📄 **TypeScript definitions** included
- 🧪 **Tested against all four versions** — `npm test` runs the full suite on real v11/v12/v13/v14 copies

---

## 🚀 Installation

```bash
npm i vx-discord-giveaways
```

The `discord.js` library is declared as a **peer dependency** (you already have it in your project).

---

## 🧑‍💻 Quick Start

```js
const Discord = require('discord.js');
const client = new Discord.Client({ intents: [...] });

const { GiveawaysManager } = require('vx-discord-giveaways');

// Create the manager, bound to your client
const manager = new GiveawaysManager(client, {
    storage: './giveaways.json',       // where giveaways are saved (default)
    updateCountdownEvery: 10000,      // how often the embed countdown updates (ms)
    hasGuildMembersIntent: false,     // set to true if you enabled the GUILD_MEMBERS intent
    default: {
        botsCanWin: false,                            // can bots win giveaways?
        exemptPermissions: ['MANAGE_MESSAGES', 'ADMINISTRATOR'], // members with these perms can't win
        embedColor: '#FF0000',            // embed color while the giveaway is running
        embedColorEnd: '#000000',         // embed color after the giveaway ends
        reaction: '🎉'                     // reaction users must add to participate
    }
});

// Expose the manager on the client, so you can use it anywhere
client.giveawaysManager = manager;

client.on('ready', () => console.log('Ready!'));

// IMPORTANT: messages are listened with the "message" event on v11/v12,
// and the "messageCreate" event on v13+.
client.on('message' /* or 'messageCreate' on v13+ */, (message) => {
    if (message.author.bot) return;

    if (message.content === '!start') {
        // Starts a giveaway: 1 week, 1 winner, prize "Discord Nitro"
        client.giveawaysManager.start(message.channel, {
            time: 604800000,
            winnerCount: 1,
            prize: 'Discord Nitro'
        }).then((giveaway) => {
            message.channel.send(`Giveaway started! ${giveaway.messageURL}`);
        }).catch(console.error);
    }
});

client.login('TOKEN');
```

After that, giveaways that were not finished are automatically restored and updated on restart, and new giveaways can be created at any time.

---

## ⚙️ Manager Options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `storage` | `string` | `'./giveaways.json'` | Path of the JSON file used to persist giveaways |
| `updateCountdownEvery` | `number` | `5000` | Update interval of the countdown on the embeds (ms) |
| `endedGiveawaysLifetime` | `number` | `null` | How long (ms) ended giveaways stay in the database before being cleaned up automatically |
| `hasGuildMembersIntent` | `boolean` | `false` | Set `true` if your client has the `GUILD_MEMBERS` intent — makes winner validation faster |
| `default` | `GiveawayStartOptions` | — | Defaults applied to every new giveaway (see below) |

---

## 🎁 `start()` — Creating a giveaway

```js
client.giveawaysManager.start(channel, {
    time: 60000,          // duration in milliseconds
    winnerCount: 1,       // number of winners
    prize: 'Free Steam Key',
    hostedBy: message.author,   // who hosts the giveaway
    botsCanWin: false,          // whether bots can win
    exemptPermissions: ['MANAGE_MESSAGES'],
    exemptMembers: (member) => !member.roles.cache.some((r) => r.name === 'Nitro Boost'),
    bonusEntries: [
        // Users with the "Nitro Boost" role get 2 entries
        { bonus: (member) => (member.roles.cache.some((r) => r.name === 'Nitro Boost') ? 2 : null), cumulative: false }
    ],
    embedColor: '#FF0000',
    embedColorEnd: '#000000',
    reaction: '🎉',
    messages: { /* see "Translations" below */ },
    extraData: { key: 'value' },  // anything you want to attach to the giveaway
    lastChance: {                 // last-chance highlight before the end
        enabled: true,
        content: '⚠️ **LAST CHANCE TO ENTER!** ⚠️',
        threshold: 5000,          // ms before the end that the "last chance" state starts
        embedColor: '#FF0000'
    },
    fetchAllParticipants: false   // fetch ALL reactions (paginated) instead of only cached ones
});
```

### Full start options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `time` | `number` | — | Duration of the giveaway in milliseconds **(required)** |
| `winnerCount` | `number` | — | Number of winners to pick **(required)** |
| `prize` | `string` | — | The prize of the giveaway **(required)** |
| `hostedBy` | `User` | — | User who hosts the giveaway |
| `botsCanWin` | `boolean` | `false` | Whether bots can win |
| `exemptPermissions` | `PermissionResolvable[]` | `[]` | Members with any of these permissions cannot win |
| `exemptMembers` | `Function` | — | A function returning `true` for members that cannot win |
| `bonusEntries` | `BonusEntry[]` | `[]` | Custom entry counts (see below) |
| `embedColor` | `ColorResolvable` | `'#FF0000'` | Embed color while running |
| `embedColorEnd` | `ColorResolvable` | `'#000000'` | Embed color when ended |
| `reaction` | `EmojiIdentifierResolvable` | `'🎉'` | Reaction users must add to participate |
| `messages` | `GiveawayMessages` | — | Custom messages (see "Translations") |
| `extraData` | `any` | — | Any data you want to store with the giveaway (`giveaway.extraData`) |
| `lastChance` | `LastChanceOptions` | — | Last-chance highlight system |
| `fetchAllParticipants` | `boolean` | `false` | Fetch every reaction (paginated), not just cached ones |

---

## 🎯 `end()`, `reroll()`, `edit()` and `delete()`

### End a giveaway

```js
client.giveawaysManager.end(messageID).then((winners) => {
    console.log('Winners:', winners.map((w) => `@${w.user.tag}`).join(', '));
}).catch(console.error);
```

### Reroll a giveaway

```js
client.giveawaysManager.reroll(messageID, {
    winnerCount: 1,   // optional: number of winners to pick on reroll
    messages: {
        congrat: ':tada: New winner(s): {winners}! Congratulations, you won **{prize}**!\n{messageURL}',
        error: 'No valid participations, no new winner(s) can be chosen!'
    }
}).then(console.log).catch(console.error);
```

### Edit a giveaway

```js
client.giveawaysManager.edit(messageID, {
    // all fields are optional
    newWinnerCount: 3,                  // change the number of winners
    newPrize: 'New Prize!',              // change the prize
    addTime: 5000,                       // add (or subtract, with negative numbers) time
    setEndTimestamp: Date.now() + 60000, // set an exact new end timestamp
    newMessages: { /* new giveaway messages */ },
    newBonusEntries: [ /* new bonus entries */ ],
    newExtraData: { level: 2 }
}).then((giveaway) => {
    console.log(`The giveaway will be updated in less than ${client.giveawaysManager.options.updateCountdownEvery / 1000} seconds.`);
}).catch(console.error);
```

> **Note:** `addTime` accepts negative numbers to *reduce* the duration, e.g. `addTime: -5000`.

### Delete a giveaway

```js
client.giveawaysManager.delete(messageID).then(() => {
    console.log('Giveaway deleted!');
}).catch(console.error);
```

Pass `true` as second argument to keep the giveaway message on the channel:

```js
client.giveawaysManager.delete(messageID, true);
```

> **⚠️ Security tip:** every method below accepts a `messageID`. Before acting on it, always check the giveaway
> actually belongs to the guild the command was used in, otherwise anyone could end/reroll/delete giveaways on other servers:

```js
const giveaway =
    client.giveawaysManager.giveaways.find((g) => g.guildID === message.guild.id && g.prize === args.join(' ')) ||
    client.giveawaysManager.giveaways.find((g) => g.guildID === message.guild.id && g.messageID === args[0]);

if (!giveaway) return message.channel.send('Unable to find a giveaway for `' + args.join(' ') + '`.');
```

---

## 🕵️ Fetching giveaways

```js
// All giveaways
const allGiveaways = client.giveawaysManager.giveaways;

// All giveaways on a specific server
const onServer = client.giveawaysManager.giveaways.filter((g) => g.guildID === '1909282092');

// All running giveaways
const running = client.giveawaysManager.giveaways.filter((g) => !g.ended);

// Get one giveaway by message ID
const giveaway = client.giveawaysManager.get(messageID);
```

### The `Giveaway` object

Each giveaway exposes useful properties and methods:

| Property / Method | Description |
| ----------------- | ----------- |
| `giveaway.prize` | The current prize |
| `giveaway.messageID` | The message ID of the giveaway embed |
| `giveaway.channelID` / `giveaway.guildID` | Where the giveaway lives |
| `giveaway.winnerCount` | Number of winners |
| `giveaway.winnerIDs` | IDs of the current winners (filled after end/reroll) |
| `giveaway.endAt` / `giveaway.startAt` | Timestamps |
| `giveaway.ended` | Whether the giveaway is finished |
| `giveaway.isActive` | `!ended` |
| `giveaway.remainingTime` / `giveaway.giveawayDuration` | Time in ms |
| `giveaway.message` | The cached giveaway message |
| `giveaway.channel` | The channel the giveaway is in |
| `giveaway.messageURL` | Direct clickable link to the giveaway |
| `giveaway.extraData` | The custom data you passed to `start()` |
| `giveaway.fetchMessage()` | Fetches (and updates the cache of) the giveaway message |
| `giveaway.roll(winnerCount?)` | Rolls winners manually |
| `giveaway.end()` / `giveaway.reroll()` / `giveaway.edit()` | Same as the manager methods |

---

## 📡 Events

The manager is an `EventEmitter`. Listen to them to hook into the giveaway lifecycle:

```js
client.giveawaysManager.on('giveawayEnded', (giveaway, winners) => {
    console.log(`Giveaway for "${giveaway.prize}" ended, winners: ${winners.map((w) => w.user.tag).join(', ')}`);
});

client.giveawaysManager.on('giveawayRerolled', (giveaway, winners) => {
    console.log(`Giveaway rerolled, new winners: ${winners.map((w) => w.user.tag).join(', ')}`);
});

client.giveawaysManager.on('giveawayDeleted', (giveaway) => {
    console.log(`Giveaway for "${giveaway.prize}" was deleted.`);
});

client.giveawaysManager.on('giveawayReactionAdded', (giveaway, member, reaction) => {
    console.log(`${member.user.tag} entered the giveaway!`);
});

client.giveawaysManager.on('giveawayReactionRemoved', (giveaway, member, reaction) => {
    console.log(`${member.user.tag} left the giveaway.`);
});

// Fired when someone reacts to an *ended* giveaway message
client.giveawaysManager.on('endedGiveawayReactionAdded', (giveaway, member, reaction) => {
    member.send('Sorry, this giveaway already ended!');
});
```

| Event | Arguments |
| ----- | --------- |
| `giveawayEnded` | `(giveaway, winners: GuildMember[])` |
| `giveawayRerolled` | `(giveaway, winners: GuildMember[])` |
| `giveawayDeleted` | `(giveaway)` |
| `giveawayReactionAdded` | `(giveaway, member, reaction)` |
| `giveawayReactionRemoved` | `(giveaway, member, reaction)` |
| `endedGiveawayReactionAdded` | `(giveaway, member, reaction)` |

---

## ⏰ Last Chance

Highlight the last seconds of a giveaway with a dedicated color and message:

```js
client.giveawaysManager.start(message.channel, {
    time: 60000,
    winnerCount: 1,
    prize: 'Discord Nitro!',
    lastChance: {
        enabled: true,
        content: '⚠️ **LAST CHANCE TO ENTER!** ⚠️',
        threshold: 5000,      // starts 5 seconds before the end
        embedColor: '#FF0000'
    }
});
```

---

## 🔢 Bonus Entries

Give selected members more chances to win by assigning them extra "entries":

```js
client.giveawaysManager.start(message.channel, {
    time: 60000,
    winnerCount: 1,
    prize: 'Free Steam Key',
    bonusEntries: [
        // Members with the "Nitro Boost" role get 2 entries
        { bonus: (member) => (member.roles.cache.some((r) => r.name === 'Nitro Boost') ? 2 : null), cumulative: false }
    ]
});
```

- `bonus` — a function receiving a `GuildMember` and returning the number of extra entries (or `null` for none).
- `cumulative` — whether the extra entries can stack with other cumulative bonus entries.

Because `bonus` functions are serialized to the storage file, they must be **self-contained** (no closures). To use
dynamic values, wrap them with `new Function`:

```js
const roleName = 'Nitro Boost';
const roleBonusEntries = 2;

client.giveawaysManager.start(message.channel, {
    time: 60000,
    winnerCount: 1,
    prize: 'Free Steam Key',
    bonusEntries: [
        {
            bonus: new Function('member', `return member.roles.cache.some((r) => r.name === \'${roleName}\') ? ${roleBonusEntries} : null`),
            cumulative: false
        }
    ]
});
```

---

## 🚫 Exempt Members

Prevent specific members from winning, through a filter function:

```js
client.giveawaysManager.start(message.channel, {
    time: 60000,
    winnerCount: 1,
    prize: 'Free Steam Key',
    // Only members who have the "Nitro Boost" role are able to win
    exemptMembers: (member) => !member.roles.cache.some((r) => r.name === 'Nitro Boost')
});
```

Same self-containment rule applies here too — use `new Function` for dynamic filters:

```js
const roleName = 'Nitro Boost';

client.giveawaysManager.start(message.channel, {
    time: 60000,
    winnerCount: 1,
    prize: 'Free Steam Key',
    exemptMembers: new Function('member', `return !member.roles.cache.some((r) => r.name === \'${roleName}\')`)
});
```

---

## 🐎 `fetchAllParticipants`

By default, only **cached** reactions are considered when rolling winners. On large giveaways that can miss entries.

Set `fetchAllParticipants` to `true` (per-giveaway or in the manager `default` options) to automatically fetch
**all** the reactions using the Discord pagination API, so every participant has a chance to win:

```js
client.giveawaysManager.start(message.channel, {
    time: 604800000,
    winnerCount: 5,
    prize: 'Discord Nitro',
    fetchAllParticipants: true
});
```

---

## 🌍 Translations

Every text shown by the library can be customized with the `messages` option. The default messages are in
Portuguese (pt-BR); override them per-giveaway or through the manager `default` options.

```js
client.giveawaysManager.start(message.channel, {
    time: 60000,
    winnerCount: 1,
    prize: 'Free Steam Key',
    messages: {
        giveaway: '@everyone\n\n🎉🎉 **GIVEAWAY** 🎉🎉',
        giveawayEnded: '@everyone\n\n🎉🎉 **GIVEAWAY ENDED** 🎉🎉',
        inviteToParticipate: 'React with 🎉 to participate!',
        timeRemaining: 'Time remaining: **{duration}**',
        winMessage: 'Congratulations, {winners}! You won **{prize}**!\n{messageURL}',
        embedFooter: 'Powered by vx-discord-giveaways',
        noWinner: 'Giveaway cancelled, no valid participations.',
        hostedBy: 'Hosted by: {user}',
        winners: 'winner(s)',
        endedAt: 'Ended at',
        units: {
            seconds: 'seconds',
            minutes: 'minutes',
            hours: 'hours',
            days: 'days',
            pluralS: false // automatically strips trailing "S" from units when the value is lower than 2
        }
    }
});
```

| Key | Used for |
| --- | -------- |
| `giveaway` | Content above the embed while running |
| `giveawayEnded` | Content above the embed when ended |
| `inviteToParticipate` | Invitation text inside the embed (`{duration}` is replaced automatically) |
| `timeRemaining` | The countdown template (`{duration}` placeholder) |
| `winMessage` | Message sent to the channel with the winners (`{winners}`, `{prize}`, `{messageURL}`) |
| `embedFooter` | Footer of the embeds |
| `noWinner` | Shown when no valid participant was found |
| `hostedBy` | Host line inside the embed (`{user}` placeholder) |
| `winners` | Word used next to the footer winner counter |
| `endedAt` | Label of the end date in the footer |
| `units` | Names of the time units (must be plural) |

And for `reroll()`:

```js
client.giveawaysManager.reroll(messageID, {
    messages: {
        congrat: ':tada: New winner(s): {winners}! Congratulations, you won **{prize}**!\n{messageURL}',
        error: 'No valid participations, no new winner(s) can be chosen!'
    }
}).catch((err) => message.channel.send('No giveaway found for ' + messageID + ', please check and try again.'));
```

---

## 🗄️ Custom Databases

By default, giveaways are stored in a JSON file. You can easily plug any database by extending `GiveawaysManager`
and overriding **4 methods** — they must all be **async**:

| Method | Purpose |
| ------ | ------- |
| `getAllGiveaways()` | Return an array of the stored giveaways |
| `saveGiveaway(messageID, giveawayData)` | Save a new giveaway |
| `editGiveaway(messageID, giveawayData)` | Update an existing giveaway |
| `deleteGiveaway(messageID)` | Permanently delete a giveaway |

Example with `quick.db` (SQLite):

```js
const Discord = require('discord.js');
const client = new Discord.Client();

const db = require('quick.db');
if (!Array.isArray(db.get('giveaways'))) db.set('giveaways', []);

const { GiveawaysManager } = require('vx-discord-giveaways');

const CustomDatabase = class extends GiveawaysManager {
    async getAllGiveaways() {
        return db.get('giveaways');
    }
    async saveGiveaway(messageID, giveawayData) {
        db.push('giveaways', giveawayData);
        return true;
    }
    async editGiveaway(messageID, giveawayData) {
        const giveaways = db.get('giveaways');
        db.set('giveaways', giveaways.filter((g) => g.messageID !== messageID).concat(giveawayData));
        return true;
    }
    async deleteGiveaway(messageID) {
        const giveaways = db.get('giveaways');
        db.set('giveaways', giveaways.filter((g) => g.messageID !== messageID));
        return true;
    }
};

client.giveawaysManager = new CustomDatabase(client, {
    updateCountdownEvery: 10000,
    default: {
        botsCanWin: false,
        exemptPermissions: ['MANAGE_MESSAGES', 'ADMINISTRATOR'],
        embedColor: '#FF0000',
        embedColorEnd: '#000000',
        reaction: '🎉'
    }
});

client.login('TOKEN');
```

Need an example for your favorite database? The patterns are exactly the same for
[MySQL](https://github.com/Androz2091/discord-giveaways/blob/master/examples/custom-databases/mysql.js),
[MongoDB (Mongoose)](https://github.com/Androz2091/discord-giveaways/blob/master/examples/custom-databases/mongoose.js),
[QuickMongo](https://github.com/Androz2091/discord-giveaways/blob/master/examples/custom-databases/quickmongo.js),
[Enmap](https://github.com/Androz2091/discord-giveaways/blob/master/examples/custom-databases/enmap.js) or
[Replit DB](https://github.com/Androz2091/discord-giveaways/blob/master/examples/custom-databases/replit.js) — just swap the 4 methods.

---

## 🕸️ Multi-Shard Support

Extend the manager and override `refreshStorage()` so every shard resynchronizes its cache with the database:

```js
const { GiveawaysManager } = require('vx-discord-giveaways');

const ShardedManager = class extends GiveawaysManager {
    async refreshStorage() {
        return client.shard.broadcastEval(() => this.giveawaysManager.getAllGiveaways());
    }
};
```

---

## 🔌 What's exported

```js
const {
    version,            // package version (string)
    discordjsVersion,   // detected discord.js major: 11 | 12 | 13 | 14
    GiveawaysManager,   // the manager class
    DiscordUtil         // the internal cross-version compatibility layer
} = require('vx-discord-giveaways');
```

`DiscordUtil` centralizes every discord.js version branch (embeds, sending/editing messages, fetching reactions and
members, permission checks, caches). You won't need it for day-to-day use, but it's useful when you need to do the
same "version-aware" operations in your own code.

---

## 🧪 Testing

The test suite runs the full scenario (start → edit → end → reroll → delete, plus embeds, storage and events)
against **real copies of discord.js v11, v12, v13 and v14**:

```bash
npm test
```

The first run downloads each discord.js version into `tests/platform/` (gitignored). On subsequent runs they are
reused and the suite finishes quickly.

---

## 📄 License

MIT