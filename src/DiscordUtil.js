'use strict';

const path = require('path');

/**
 * Loads the `discord.js` module from the consuming project (peer dependency),
 * with fallbacks so it works on npm, yarn and pnpm installs.
 * @returns {typeof import('discord.js')}
 */
function loadDiscord() {
    try {
        return require('discord.js');
    } catch (err) {
        try {
            return require(require.resolve('discord.js', { paths: [process.cwd()] }));
        } catch (err2) {
            throw new Error(
                'vx-discord-giveaways requires "discord.js" (v11 to v14) as a peer dependency. ' +
                    'Please run `npm install discord.js` in your project.'
            );
        }
    }
}

const Discord = loadDiscord();

/**
 * Resolves the installed discord.js major version.
 * @returns {number} The discord.js major version (11, 12, 13 or 14)
 */
function resolveMajor() {
    if (typeof Discord.version === 'string') {
        const major = parseInt(Discord.version.split('.')[0], 10);
        if (!isNaN(major) && major >= 11 && major <= 14) return major;
    }
    if (Discord.EmbedBuilder) return 14;
    if (Discord.RichEmbed) return 11;
    if (Discord.MessageEmbed) return 13;
    if (Discord.Intents && Discord.MessageManager) return 12;
    return 13;
}

const major = resolveMajor();

/**
 * Discord.js compatibility helpers.
 * All the API calls of the package go through this module so the whole
 * package works on discord.js v11, v12, v13 and v14.
 */
const DiscordUtil = {
    /**
     * The loaded discord.js module.
     * @type {typeof import('discord.js')}
     */
    Discord,

    /**
     * The discord.js version installed by the user.
     * @type {string}
     */
    version: Discord.version || `v${major}`,

    /**
     * The detected discord.js major version (11, 12, 13 or 14).
     * @type {number}
     */
    major,

    /**
     * Builds an embed using the embed class of the installed discord.js version.
     * @returns {import('discord.js').MessageEmbed | import('discord.js').EmbedBuilder} The embed builder
     */
    createEmbed() {
        if (major === 11) return new Discord.RichEmbed();
        if (major === 14) return new Discord.EmbedBuilder();
        return new Discord.MessageEmbed();
    },

    /**
     * Sets the footer of an embed, using the correct argument shape.
     * @param {import('discord.js').MessageEmbed | import('discord.js').EmbedBuilder} embed The embed
     * @param {string} text The footer text
     */
    setEmbedFooter(embed, text) {
        if (major >= 13) return embed.setFooter({ text });
        return embed.setFooter(text);
    },

    /**
     * Sets the author of an embed, using the correct argument shape.
     * @param {import('discord.js').MessageEmbed | import('discord.js').EmbedBuilder} embed The embed
     * @param {string} name The author name
     * @param {string} [iconURL] The author icon url
     * @param {string} [url] The author url
     */
    setEmbedAuthor(embed, name, iconURL, url) {
        if (major >= 13) return embed.setAuthor({ name, iconURL, url });
        return embed.setAuthor(name, iconURL, url);
    },

    /**
     * Sends a message with the correct payload shape for the discord.js version.
     * @param {import('discord.js').TextChannel} channel The channel
     * @param {string} content The message content
     * @param {import('discord.js').MessageEmbed[] | import('discord.js').EmbedBuilder[]} embeds The embeds
     * @returns {Promise<import('discord.js').Message>} The sent message
     */
    sendMessage(channel, content, embeds) {
        if (major >= 13) return channel.send({ content, embeds });
        return channel.send(content, { embed: embeds[0] });
    },

    /**
     * Edits a message with the correct payload shape for the discord.js version.
     * @param {import('discord.js').Message} message The message to edit
     * @param {string} content The new message content
     * @param {import('discord.js').MessageEmbed[] | import('discord.js').EmbedBuilder[]} embeds The embeds
     * @returns {Promise<import('discord.js').Message>} The edited message
     */
    editMessage(message, content, embeds) {
        if (major >= 13) return message.edit({ content, embeds });
        return message.edit(content, { embed: embeds[0] });
    },

    /**
     * Fetches the users who reacted to a reaction.
     * @param {import('discord.js').MessageReaction} reaction The reaction
     * @param {Object} [options] Fetch options
     * @param {number} [options.limit] The maximum amount of users to fetch (defaults to 100)
     * @param {string} [options.after] Fetch users with an id greater than the supplied id
     * @returns {Promise<import('discord.js').Collection<import('discord.js').Snowflake, import('discord.js').User>>} The users
     */
    fetchReactionUsers(reaction, options = {}) {
        if (major >= 12) return reaction.users.fetch(options);
        const { limit, after, before } = options;
        return reaction.fetchUsers(limit || 100, { after, before });
    },

    /**
     * Fetches ALL the users who reacted to a reaction (paginated, 100 per request).
     * @param {import('discord.js').MessageReaction} reaction The reaction
     * @returns {Promise<Map<string, import('discord.js').User>>} All the users mapped by id
     */
    async fetchAllReactionUsers(reaction) {
        const users = new Map();
        let batch = await this.fetchReactionUsers(reaction, { limit: 100, after: null });
        this.mergeCollection(users, batch);
        while (batch.size >= 100) {
            const after = this.lastItem(batch).id;
            batch = await this.fetchReactionUsers(reaction, { limit: 100, after });
            this.mergeCollection(users, batch);
        }
        return users;
    },

    /**
     * Merges a discord.js Collection into a Map.
     * @param {Map} map The destination map
     * @param {import('discord.js').Collection} collection The source collection
     */
    mergeCollection(map, collection) {
        for (const [id, value] of collection) map.set(id, value);
    },

    /**
     * The reactions of a message (Collection), for every discord.js version.
     * @param {import('discord.js').Message} message The message
     * @returns {import('discord.js').Collection} The reactions
     */
    getMessageReactions(message) {
        return major >= 12 ? message.reactions.cache : message.reactions;
    },

    /**
     * Parses an emoji string (or emoji object) into { name, id }.
     * @param {string | import('discord.js').Emoji | import('discord.js').ReactionEmoji} emoji The emoji
     * @returns {{ name: string, id: string | null }} The parsed emoji
     */
    parseEmoji(emoji) {
        if (!emoji) return { name: null, id: null };
        if (typeof emoji !== 'string') return { name: emoji.name, id: emoji.id || null };
        const match = /^<?(a)?:(\w+):(\d+)>?$/.exec(emoji);
        if (match) return { name: match[2], id: match[3] };
        return { name: emoji, id: null };
    },

    /**
     * Checks whether a reaction's emoji matches a resolvable emoji.
     * @param {import('discord.js').MessageReaction} reaction The reaction
     * @param {string | import('discord.js').Emoji | import('discord.js').ReactionEmoji} emoji The emoji
     * @returns {boolean} Whether the emojis match
     */
    reactionMatches(reaction, emoji) {
        const parsed = this.parseEmoji(emoji);
        if (!parsed.name || reaction.emoji.name !== parsed.name) return false;
        if (parsed.id && reaction.emoji.id !== parsed.id) return false;
        return true;
    },

    /**
     * Finds the reaction matching an emoji on a message.
     * @param {import('discord.js').Message} message The message
     * @param {string | import('discord.js').Emoji | import('discord.js').ReactionEmoji} emoji The emoji
     * @returns {import('discord.js').MessageReaction | null} The matching reaction
     */
    findReaction(message, emoji) {
        const reactions = this.getMessageReactions(message);
        return reactions.find((reaction) => this.reactionMatches(reaction, emoji)) || null;
    },

    /**
     * Gets a channel from the client, for every discord.js version.
     * @param {import('discord.js').Client} client The client
     * @param {string} channelID The channel id
     * @returns {import('discord.js').GuildChannel | null} The channel
     */
    getClientChannel(client, channelID) {
        const channels = major >= 12 ? client.channels.cache : client.channels;
        return channels.get(channelID) || null;
    },

    /**
     * The users who reacted (cached), for every discord.js version.
     * @param {import('discord.js').MessageReaction} reaction The reaction
     * @returns {import('discord.js').Collection} The cached users
     */
    getReactionUsers(reaction) {
        return major >= 12 ? reaction.users.cache : reaction.users;
    },

    /**
     * Gets a guild from the client, for every discord.js version.
     * @param {import('discord.js').Client} client The client
     * @param {string} guildID The guild id
     * @returns {import('discord.js').Guild | null} The guild
     */
    getClientGuild(client, guildID) {
        const guilds = major >= 12 ? client.guilds.cache : client.guilds;
        return guilds.get(guildID) || null;
    },

    /**
     * Gets a channel from a guild, for every discord.js version.
     * @param {import('discord.js').Guild} guild The guild
     * @param {string} channelID The channel id
     * @returns {import('discord.js').GuildChannel | null} The channel
     */
    getGuildChannel(guild, channelID) {
        const channels = major >= 12 ? guild.channels.cache : guild.channels;
        return channels.get(channelID) || null;
    },

    /**
     * Gets a message from the cache of a channel, for every discord.js version.
     * @param {import('discord.js').TextChannel} channel The channel
     * @param {string} messageID The message id
     * @returns {import('discord.js').Message | null} The cached message
     */
    getCachedMessage(channel, messageID) {
        if (major === 11) return channel.messages.get(messageID) || null;
        return channel.messages.cache.get(messageID) || null;
    },

    /**
     * Fetches a message in a channel, for every discord.js version.
     * Resolves with `null` if the message doesn't exist.
     * @param {import('discord.js').TextChannel} channel The channel
     * @param {string} messageID The message id
     * @returns {Promise<import('discord.js').Message | null>} The message
     */
    async fetchMessage(channel, messageID) {
        try {
            if (major === 11) return (await channel.fetchMessage(messageID)) || null;
            return (await channel.messages.fetch(messageID)) || null;
        } catch (err) {
            return null;
        }
    },

    /**
     * Gets a guild member from the cache, for every discord.js version.
     * @param {import('discord.js').Guild} guild The guild
     * @param {string} memberID The member id
     * @returns {import('discord.js').GuildMember | null} The cached member
     */
    getCachedMember(guild, memberID) {
        if (major === 11) return guild.members.get(memberID) || null;
        return guild.members.cache.get(memberID) || null;
    },

    /**
     * Fetches a guild member, for every discord.js version.
     * Resolves with `null` if the member doesn't exist.
     * @param {import('discord.js').Guild} guild The guild
     * @param {string} memberID The member id
     * @returns {Promise<import('discord.js').GuildMember | null>} The member
     */
    async fetchMember(guild, memberID) {
        try {
            if (major === 11) return (await guild.fetchMember(memberID)) || null;
            return (await guild.members.fetch(memberID)) || null;
        } catch (err) {
            return null;
        }
    },

    /**
     * Fetches all the members of a guild (requires the GUILD_MEMBERS intent).
     * @param {import('discord.js').Guild} guild The guild
     * @returns {Promise<import('discord.js').Collection>} The members
     */
    fetchAllMembers(guild) {
        if (major === 11) return guild.fetchMembers();
        return guild.members.fetch();
    },

    /**
     * Checks whether a member has a given permission, for every discord.js version.
     * @param {import('discord.js').GuildMember} member The member
     * @param {import('discord.js').PermissionResolvable} permission The permission
     * @returns {boolean} Whether the member has the permission
     */
    memberHasPermission(member, permission) {
        if (major >= 13) return member.permissions.has(permission);
        return member.hasPermission(permission);
    },

    /**
     * The roles of a member (Collection), for every discord.js version.
     * @param {import('discord.js').GuildMember} member The member
     * @returns {import('discord.js').Collection} The roles
     */
    getMemberRoles(member) {
        return major >= 12 ? member.roles.cache : member.roles;
    },

    /**
     * Converts a Collection or iterable to an array, for every discord.js version.
     * @template T
     * @param {import('discord.js').Collection | Iterable<T>} collection The collection
     * @returns {T[]} The array of values
     */
    collectionToArray(collection) {
        if (Array.isArray(collection)) return collection;
        if (typeof collection.array === 'function') return collection.array();
        return Array.from(collection.values());
    },

    /**
     * The last value of a Collection.
     * @template T
     * @param {import('discord.js').Collection | Map} collection The collection
     * @returns {T} The last value
     */
    lastItem(collection) {
        if (typeof collection.last === 'function') return collection.last();
        return Array.from(collection.values()).pop();
    },

    /**
     * Picks `amount` random values from an array, without repetition.
     * @template T
     * @param {T[]} array The source array
     * @param {number} amount The amount of values to pick
     * @returns {T[]} The random values
     */
    randomFrom(array, amount) {
        const copy = array.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy.slice(0, Math.max(0, Math.min(amount, copy.length)));
    },

    /**
     * Number of values contained in a Collection or array.
     * @param {import('discord.js').Collection | Map | Array} collection The collection
     * @returns {number} The size
     */
    size(collection) {
        return Array.isArray(collection) ? collection.length : collection.size;
    }
};

module.exports = DiscordUtil;