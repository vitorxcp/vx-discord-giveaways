const { EventEmitter } = require('events');
const merge = require('deepmerge');
const { writeFile, readFile, exists } = require('fs');
const { promisify } = require('util');
const writeFileAsync = promisify(writeFile);
const existsAsync = promisify(exists);
const readFileAsync = promisify(readFile);
const DiscordUtil = require('./DiscordUtil.js');
const {
    defaultGiveawayMessages,
    defaultManagerOptions,
    defaultRerollOptions,
    GiveawayEditOptions,
    GiveawayData,
    GiveawayRerollOptions,
    GiveawaysManagerOptions,
    GiveawayStartOptions
} = require('./Constants.js');
const Giveaway = require('./Giveaway.js');

class GiveawaysManager extends EventEmitter {
    constructor(client, options, init = true) {
        super();
        if (!client) throw new Error('Discord.Client() não foi declarado no sistema de sorteios...');
        this.client = client;
        this.ready = false;
        this.giveaways = [];
        this.options = merge(defaultManagerOptions, options);
        this._endTimers = new Map();
        this._lastChanceTimers = new Map();
        if (init) this._init();
    }

    /**
     * Generates the embed that is displayed while a giveaway is running.
     * @param {Giveaway} giveaway The giveaway
     * @param {boolean} lastChanceEnabled Whether the last chance system is enabled
     * @returns {import('discord.js').MessageEmbed | import('discord.js').EmbedBuilder} The generated embed
     */
    generateMainEmbed(giveaway, lastChanceEnabled) {
        const embed = DiscordUtil.createEmbed();
        embed
            .setTitle(giveaway.prize)
            .setColor(lastChanceEnabled ? giveaway.lastChance.embedColor : giveaway.embedColor)
            .setDescription(
                (lastChanceEnabled ? giveaway.lastChance.content + '\n\n' : '') +
                    giveaway.messages.inviteToParticipate +
                    '\n' +
                    giveaway.remainingTimeText +
                    '\n' +
                    (giveaway.hostedBy ? giveaway.messages.hostedBy.replace('{user}', giveaway.hostedBy) : '')
            )
            .setTimestamp(new Date(giveaway.endAt));
        DiscordUtil.setEmbedFooter(embed, `${giveaway.winnerCount} ${giveaway.messages.winners} • ${giveaway.messages.embedFooter}`);
        return embed;
    }

    /**
     * Generates the embed that is displayed when a giveaway has ended.
     * @param {Giveaway} giveaway The giveaway
     * @param {import('discord.js').GuildMember[]} winners The winners of the giveaway
     * @returns {import('discord.js').MessageEmbed | import('discord.js').EmbedBuilder} The generated embed
     */
    generateEndEmbed(giveaway, winners) {
        let formattedWinners = winners.map((w) => `<@${w.id}>`).join(', ');

        const descriptionString = (winnersString) => {
            const winnersText =
                giveaway.messages.winners.substr(0, 1).toUpperCase() +
                giveaway.messages.winners.substr(1, giveaway.messages.winners.length) +
                ': ' +
                winnersString;

            return (
                winnersText +
                '\n' +
                (giveaway.hostedBy ? giveaway.messages.hostedBy.replace('{user}', giveaway.hostedBy) : '')
            );
        };

        for (
            let i = 1;
            descriptionString(formattedWinners).length > 2048 ||
            giveaway.prize.length + giveaway.messages.endedAt.length + descriptionString(formattedWinners).length > 6000;
            i++
        )
            formattedWinners = formattedWinners.substr(0, formattedWinners.lastIndexOf(', <@')) + `, ${i} mais`;

        const embed = DiscordUtil.createEmbed();
        DiscordUtil.setEmbedAuthor(embed, giveaway.prize);
        embed.setColor(giveaway.embedColorEnd);
        DiscordUtil.setEmbedFooter(embed, giveaway.messages.endedAt);
        embed.setDescription(descriptionString(formattedWinners)).setTimestamp(new Date(giveaway.endAt));
        return embed;
    }

    /**
     * Generates the embed that is displayed when a giveaway has ended without valid participants.
     * @param {Giveaway} giveaway The giveaway
     * @returns {import('discord.js').MessageEmbed | import('discord.js').EmbedBuilder} The generated embed
     */
    generateNoValidParticipantsEndEmbed(giveaway) {
        const embed = DiscordUtil.createEmbed();
        DiscordUtil.setEmbedAuthor(embed, giveaway.prize);
        embed.setColor(giveaway.embedColorEnd);
        DiscordUtil.setEmbedFooter(embed, giveaway.messages.endedAt);
        embed
            .setDescription(
                giveaway.messages.noWinner +
                    '\n' +
                    (giveaway.hostedBy ? giveaway.messages.hostedBy.replace('{user}', giveaway.hostedBy) : '')
            )
            .setTimestamp(new Date(giveaway.endAt));
        return embed;
    }

    /**
     * Gets a giveaway from its message ID.
     * @param {string} messageID The message ID of the giveaway
     * @returns {Giveaway | null} The giveaway
     */
    get(messageID) {
        return this.giveaways.find((g) => g.messageID === messageID) || null;
    }

    /**
     * Ends a giveaway.
     * @param {string} messageID The message ID of the giveaway
     * @returns {Promise<import('discord.js').GuildMember[]>} The winners of the giveaway
     */
    end(messageID) {
        return new Promise((resolve, reject) => {
            const giveaway = this.get(messageID);
            if (!giveaway) {
                return reject('Não achei o sorteio do ID `' + messageID + '`.');
            }
            this._clearScheduledEnd(giveaway.messageID);
            giveaway
                .end()
                .then((winners) => {
                    this.emit('giveawayEnded', giveaway, winners);
                    resolve(winners);
                })
                .catch(reject);
        });
    }

    /**
     * Starts a new giveaway.
     * @param {import('discord.js').TextChannel} channel The channel in which the giveaway will be created
     * @param {GiveawayStartOptions} options The start options
     * @returns {Promise<Giveaway>} The started giveaway
     */
    start(channel, options) {
        return new Promise(async (resolve, reject) => {
            if (!this.ready) {
                return reject('The manager is not ready yet.');
            }
            if (!channel || !channel.id) {
                return reject(`Canal inválido. (val=${channel})`);
            }
            if (!channel.guild || typeof channel.send !== 'function') {
                return reject(`O canal informado não é um canal de texto válido. (val=${channel})`);
            }
            if (!options.time || isNaN(options.time)) {
                return reject(`Tempo inválido. (val=${options.time})`);
            }
            if (typeof options.prize !== 'string') {
                return reject(`Prêmio inválido. (val=${options.prize})`);
            }
            if (!Number.isInteger(options.winnerCount) || options.winnerCount < 1) {
                return reject(`Total de ganhadores inválido. (val=${options.winnerCount})`);
            }
            options.messages =
                options.messages && typeof options.messages === 'object'
                    ? merge(defaultGiveawayMessages, options.messages)
                    : defaultGiveawayMessages;
            const giveaway = new Giveaway(this, {
                startAt: Date.now(),
                endAt: Date.now() + options.time,
                winnerCount: options.winnerCount,
                winnerIDs: [],
                channelID: channel.id,
                guildID: channel.guild.id,
                ended: false,
                prize: options.prize,
                hostedBy: options.hostedBy ? options.hostedBy.toString() : null,
                messages: options.messages,
                reaction: options.reaction,
                botsCanWin: options.botsCanWin,
                exemptPermissions: Array.isArray(options.exemptPermissions) ? options.exemptPermissions : [],
                exemptMembers: options.exemptMembers,
                bonusEntries:
                    Array.isArray(options.bonusEntries) && options.bonusEntries.every((elem) => typeof elem === 'object')
                        ? options.bonusEntries
                        : [],
                embedColor: options.embedColor,
                embedColorEnd: options.embedColorEnd,
                extraData: options.extraData,
                lastChance: options.lastChance,
                fetchAllParticipants:
                    typeof options.fetchAllParticipants === 'boolean'
                        ? options.fetchAllParticipants
                        : this.options.default.fetchAllParticipants
            });
            const embed = this.generateMainEmbed(giveaway);
            const message = await DiscordUtil.sendMessage(channel, giveaway.messages.giveaway, [embed]);
            await message.react(giveaway.reaction).catch(() => {});
            giveaway.messageID = message.id;
            this.giveaways.push(giveaway);
            await this.saveGiveaway(giveaway.messageID, giveaway.data);
            resolve(giveaway);
        });
    }

    /**
     * Rerolls a giveaway.
     * @param {string} messageID The message ID of the giveaway
     * @param {GiveawayRerollOptions} [options] The reroll options
     * @returns {Promise<import('discord.js').GuildMember[]>} The winners of the reroll
     */
    reroll(messageID, options = {}) {
        return new Promise((resolve, reject) => {
            options = merge(defaultRerollOptions, options);
            const giveaway = this.get(messageID);
            if (!giveaway) {
                return reject('Não achei o sorteio do ID `' + messageID + '`.');
            }
            giveaway
                .reroll(options)
                .then((winners) => {
                    this.emit('giveawayRerolled', giveaway, winners);
                    resolve(winners);
                })
                .catch(reject);
        });
    }

    /**
     * Edits a giveaway.
     * @param {string} messageID The message ID of the giveaway
     * @param {GiveawayEditOptions} [options] The edit options
     * @returns {Promise<Giveaway>} The edited giveaway
     */
    edit(messageID, options = {}) {
        return new Promise((resolve, reject) => {
            const giveaway = this.get(messageID);
            if (!giveaway) {
                return reject('Não achei o sorteio do ID `' + messageID + '`.');
            }
            giveaway.edit(options).then(resolve).catch(reject);
        });
    }

    /**
     * Deletes a giveaway.
     * @param {string} messageID The message ID of the giveaway
     * @param {boolean} [doNotDeleteMessage=false] Whether the giveaway message should not be deleted
     * @returns {Promise<void>}
     */
    delete(messageID, doNotDeleteMessage = false) {
        return new Promise(async (resolve, reject) => {
            const giveaway = this.get(messageID);
            if (!giveaway) {
                return reject('Não achei o sorteio do ID `' + messageID + '`.');
            }
            if (!doNotDeleteMessage && giveaway.channel) {
                const message = await DiscordUtil.fetchMessage(giveaway.channel, messageID);
                if (message) await message.delete().catch(() => {});
            }
            this._clearScheduledEnd(giveaway.messageID);
            this.giveaways = this.giveaways.filter((g) => g.messageID !== messageID);
            await this.deleteGiveaway(messageID);
            this.emit('giveawayDeleted', giveaway);
            resolve();
        });
    }

    /**
     * Deletes a giveaway from the database. Override this method to use your own database.
     * @param {string} messageID The message ID of the deleted giveaway
     * @returns {Promise<boolean>}
     */
    async deleteGiveaway(messageID) {
        await this._writeStorage();
        this.refreshStorage();
        return true;
    }

    /**
     * Refreshes the storage of the whole shard system. Override this method to support shards.
     * @returns {Promise<boolean>}
     */
    async refreshStorage() {
        return true;
    }

    /**
     * Gets all the giveaways stored in the database. Override this method to use your own database.
     * @returns {Promise<GiveawayData[]>} All the stored giveaways
     */
    async getAllGiveaways() {
        const storageExists = await existsAsync(this.options.storage);
        if (!storageExists) {
            await writeFileAsync(this.options.storage, '[]', 'utf-8');
            return [];
        }
        const storageContent = await readFileAsync(this.options.storage);
        try {
            const giveaways = await JSON.parse(storageContent.toString());
            if (Array.isArray(giveaways)) {
                return giveaways;
            }
            throw new SyntaxError('O arquivo de armazenamento não está formatado corretamente (brindes não é um array).');
        } catch (e) {
            if (e.message === 'Unexpected end of JSON input') {
                throw new SyntaxError('O arquivo de armazenamento não está formatado corretamente (fim inesperado da entrada JSON).');
            }
            throw e;
        }
    }

    /**
     * Edits a giveaway in the database. Override this method to use your own database.
     * @param {string} messageID The message ID of the edited giveaway
     * @param {GiveawayData} giveawayData The new giveaway data
     * @returns {Promise<boolean>}
     */
    async editGiveaway(messageID, giveawayData) {
        await this._writeStorage();
        this.refreshStorage();
        return true;
    }

    /**
     * Saves a new giveaway in the database. Override this method to use your own database.
     * @param {string} messageID The message ID of the new giveaway
     * @param {GiveawayData} giveawayData The new giveaway data
     * @returns {Promise<boolean>}
     */
    async saveGiveaway(messageID, giveawayData) {
        await this._writeStorage();
        this.refreshStorage();
        return true;
    }

    /**
     * Writes the current giveaways in the JSON storage file.
     * Writes are debounced so that multiple saves in the same tick only write once.
     * @returns {Promise<void>}
     */
    _writeStorage() {
        if (this._storageWritePromise) return this._storageWritePromise;
        const content = () => JSON.stringify(this.giveaways.map((giveaway) => giveaway.data));
        this._storageWritePromise = new Promise((resolve, reject) => {
            setImmediate(async () => {
                try {
                    await writeFileAsync(this.options.storage, content(), 'utf-8');
                    resolve();
                } catch (err) {
                    reject(err);
                } finally {
                    this._storageWritePromise = null;
                }
            });
        });
        return this._storageWritePromise;
    }

    /**
     * Schedules the end of a giveaway once, when there is less than one
     * update interval remaining, so the giveaway ends at the right time.
     * @param {Giveaway} giveaway The giveaway
     */
    _scheduleEnd(giveaway) {
        const id = giveaway.messageID;
        if (this._endTimers.has(id)) return;
        if (giveaway.remainingTime >= this.options.updateCountdownEvery) return;
        const timer = setTimeout(() => {
            this._endTimers.delete(id);
            this.end(giveaway.messageID).catch(() => {});
        }, Math.max(giveaway.remainingTime, 0));
        this._endTimers.set(id, timer);
    }

    /**
     * Schedules the "last chance" embed update of a giveaway once.
     * @param {Giveaway} giveaway The giveaway
     */
    _scheduleLastChance(giveaway) {
        const id = giveaway.messageID;
        if (!giveaway.lastChance.enabled || this._lastChanceTimers.has(id)) return;
        const delay = giveaway.remainingTime - giveaway.lastChance.threshold;
        if (delay >= this.options.updateCountdownEvery || delay < 0) return;
        const timer = setTimeout(async () => {
            this._lastChanceTimers.delete(id);
            if (giveaway.ended || !giveaway.message) return;
            const embed = this.generateMainEmbed(giveaway, true);
            await DiscordUtil.editMessage(giveaway.message, giveaway.messages.giveaway, [embed]).catch(() => {});
        }, delay);
        this._lastChanceTimers.set(id, timer);
    }

    /**
     * Clears the scheduled end and last chance timers of a giveaway.
     * @param {string} messageID The message ID of the giveaway
     */
    _clearScheduledEnd(messageID) {
        if (this._endTimers.has(messageID)) {
            clearTimeout(this._endTimers.get(messageID));
            this._endTimers.delete(messageID);
        }
        if (this._lastChanceTimers.has(messageID)) {
            clearTimeout(this._lastChanceTimers.get(messageID));
            this._lastChanceTimers.delete(messageID);
        }
    }

    /**
     * Checks the active giveaways and updates/ends them when needed.
     */
    async _checkGiveaway() {
        for (const giveaway of this.giveaways) {
            try {
                if (giveaway.ended || !giveaway.channel) continue;
                if (giveaway.remainingTime <= 0) {
                    await this.end(giveaway.messageID);
                    continue;
                }
                await giveaway.fetchMessage();
                if (!giveaway.message) continue;
                const lastChanceEnabled =
                    giveaway.lastChance.enabled && giveaway.remainingTime < giveaway.lastChance.threshold;
                const embed = this.generateMainEmbed(giveaway, lastChanceEnabled);
                await DiscordUtil.editMessage(giveaway.message, giveaway.messages.giveaway, [embed]).catch(() => {});
                this._scheduleEnd(giveaway);
                this._scheduleLastChance(giveaway);
            } catch (err) {
                // A giveaway error must never make the bot crash
            }
        }
    }

    /**
     * Handles the raw MESSAGE_REACTION_ADD and MESSAGE_REACTION_REMOVE packets,
     * so reactions are tracked even when messages/users aren't cached.
     * @param {Object} packet The raw gateway packet
     */
    async _handleRawPacket(packet) {
        if (!packet || !packet.t || !packet.d) return;
        if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
        const giveaway = this.get(packet.d.message_id);
        if (!giveaway) return;
        if (giveaway.ended && packet.t === 'MESSAGE_REACTION_REMOVE') return;
        if (!this.client.user) return;
        if (packet.d.user_id === this.client.user.id) return;
        const guild = DiscordUtil.getClientGuild(this.client, packet.d.guild_id);
        if (!guild) return;
        const member =
            DiscordUtil.getCachedMember(guild, packet.d.user_id) ||
            (await DiscordUtil.fetchMember(guild, packet.d.user_id));
        if (!member) return;
        const channel = DiscordUtil.getGuildChannel(guild, packet.d.channel_id);
        if (!channel) return;
        const message =
            DiscordUtil.getCachedMessage(channel, packet.d.message_id) ||
            (await DiscordUtil.fetchMessage(channel, packet.d.message_id));
        if (!message) return;
        const reaction = DiscordUtil.findReaction(message, packet.d.emoji || giveaway.reaction);
        if (!reaction) return;
        if (packet.t === 'MESSAGE_REACTION_ADD') {
            if (giveaway.ended) return this.emit('endedGiveawayReactionAdded', giveaway, member, reaction);
            this.emit('giveawayReactionAdded', giveaway, member, reaction);
        } else {
            this.emit('giveawayReactionRemoved', giveaway, member, reaction);
        }
    }

    async _init() {
        const rawGiveaways = await this.getAllGiveaways();
        rawGiveaways.forEach((giveaway) => {
            this.giveaways.push(new Giveaway(this, giveaway));
        });
        setInterval(() => {
            if (this.client.readyAt) this._checkGiveaway().catch(() => {});
        }, this.options.updateCountdownEvery);
        this.ready = true;
        if (!isNaN(this.options.endedGiveawaysLifetime) && typeof this.options.endedGiveawaysLifetime === 'number') {
            const endedGiveaways = this.giveaways.filter(
                (g) => g.ended && g.endAt + this.options.endedGiveawaysLifetime <= Date.now()
            );
            this.giveaways = this.giveaways.filter(
                (g) => !endedGiveaways.map((giveaway) => giveaway.messageID).includes(g.messageID)
            );
            for (const giveaway of endedGiveaways) {
                await this.deleteGiveaway(giveaway.messageID);
            }
        }

        this.client.on('raw', (packet) => this._handleRawPacket(packet));
    }
}

module.exports = GiveawaysManager;