declare module 'vx-discord-giveaways' {
    import { EventEmitter } from 'events';
    import {
        Client,
        PermissionResolvable,
        ColorResolvable,
        EmojiIdentifierResolvable,
        User,
        Snowflake,
        GuildMember,
        TextChannel,
        MessageReaction,
        Message,
        MessageEmbed,
        EmbedBuilder
    } from 'discord.js';

    export const version: string;
    export const discordjsVersion: 11 | 12 | 13 | 14;

    export const DiscordUtil: {
        Discord: typeof Client;
        version: string;
        major: 11 | 12 | 13 | 14;
        createEmbed(): MessageEmbed | EmbedBuilder;
        setEmbedFooter(embed: MessageEmbed | EmbedBuilder, text: string): MessageEmbed | EmbedBuilder;
        setEmbedAuthor(embed: MessageEmbed | EmbedBuilder, name: string, iconURL?: string, url?: string): MessageEmbed | EmbedBuilder;
        sendMessage(channel: TextChannel, content: string, embeds: Array<MessageEmbed | EmbedBuilder>): Promise<Message>;
        editMessage(message: Message, content: string, embeds: Array<MessageEmbed | EmbedBuilder>): Promise<Message>;
        fetchReactionUsers(reaction: MessageReaction, options?: { limit?: number; after?: string }): Promise<Map<string, User>>;
        fetchAllReactionUsers(reaction: MessageReaction): Promise<Map<string, User>>;
        getMessageReactions(message: Message): Map<string, MessageReaction>;
        parseEmoji(emoji: EmojiIdentifierResolvable | string): { name: string | null; id: string | null };
        reactionMatches(reaction: MessageReaction, emoji: string): boolean;
        findReaction(message: Message, emoji: string): MessageReaction | null;
        getClientGuild(client: Client, guildID: string): any | null;
        getClientChannel(client: Client, channelID: string): any | null;
        getGuildChannel(guild: any, channelID: string): any | null;
        getCachedMessage(channel: TextChannel, messageID: string): Message | null;
        fetchMessage(channel: TextChannel, messageID: string): Promise<Message | null>;
        getCachedMember(guild: any, memberID: string): GuildMember | null;
        fetchMember(guild: any, memberID: string): Promise<GuildMember | null>;
        fetchAllMembers(guild: any): Promise<any>;
        memberHasPermission(member: GuildMember, permission: PermissionResolvable): boolean;
        getMemberRoles(member: GuildMember): any;
        getReactionUsers(reaction: MessageReaction): Map<string, User>;
    };

    export class GiveawaysManager extends EventEmitter {
        constructor(client: Client, options?: GiveawaysManagerOptions);

        public client: Client;
        public giveaways: Giveaway[];
        public options: GiveawaysManagerOptions;
        public ready: boolean;

        public get(messageID: Snowflake): Giveaway | null;
        public delete(messageID: Snowflake, doNotDeleteMessage?: boolean): Promise<void>;
        // @ts-ignore-next-line
        public async deleteGiveaway(messageID: Snowflake): Promise<boolean>;
        public edit(messageID: Snowflake, options: GiveawayEditOptions): Promise<Giveaway>;
        public end(messageID: Snowflake): Promise<GuildMember[]>;
        public reroll(messageID: Snowflake, options?: GiveawayRerollOptions): Promise<GuildMember[]>;
        public start(channel: TextChannel, options: GiveawayStartOptions): Promise<Giveaway>;

        public on<K extends keyof GiveawaysManagerEvents>(
            event: K,
            listener: (...args: GiveawaysManagerEvents[K]) => void
        ): this;

        public once<K extends keyof GiveawaysManagerEvents>(
            event: K,
            listener: (...args: GiveawaysManagerEvents[K]) => void
        ): this;

        public emit<K extends keyof GiveawaysManagerEvents>(event: K, ...args: GiveawaysManagerEvents[K]): boolean;
    }
    interface BonusEntry {
        bonus(member?: GuildMember): number | Promise<number>;
        cumulative: boolean;
    }
    interface LastChanceOptions {
        enabled: boolean;
        embedColor: string;
        content: string;
        threshold: number;
    }
    interface GiveawaysManagerOptions {
        storage?: string;
        updateCountdownEvery?: number;
        endedGiveawaysLifetime?: number;
        hasGuildMembersIntent?: boolean;
        default?: GiveawayStartOptions;
    }
    interface GiveawayStartOptions {
        time?: number;
        winnerCount?: number;
        prize?: string;
        hostedBy?: User;
        botsCanWin?: boolean;
        exemptPermissions?: PermissionResolvable[];
        exemptMembers?: (member?: GuildMember) => boolean | Promise<boolean>;
        bonusEntries?: BonusEntry[];
        embedColor?: ColorResolvable;
        embedColorEnd?: ColorResolvable;
        reaction?: EmojiIdentifierResolvable;
        messages?: Partial<GiveawaysMessages>;
        extraData?: any;
        lastChance?: LastChanceOptions;
        fetchAllParticipants?: boolean;
    }
    interface GiveawaysMessages {
        giveaway?: string;
        giveawayEnded?: string;
        inviteToParticipate?: string;
        timeRemaining?: string;
        winMessage?: string;
        embedFooter?: string;
        noWinner?: string;
        winners?: string;
        endedAt?: string;
        hostedBy?: string;
        units?: {
            seconds?: string;
            minutes?: string;
            hours?: string;
            days?: string;
            pluralS?: false;
        };
    }
    interface GiveawaysManagerEvents {
        giveawayEnded: [Giveaway, GuildMember[]];
        giveawayRerolled: [Giveaway, GuildMember[]];
        giveawayReactionAdded: [Giveaway, GuildMember, MessageReaction];
        giveawayReactionRemoved: [Giveaway, GuildMember, MessageReaction];
        endedGiveawayReactionAdded: [Giveaway, GuildMember, MessageReaction];
    }
    class Giveaway extends EventEmitter {
        constructor(manager: GiveawaysManager, options: GiveawayData);

        public channelID: Snowflake;
        public client: Client;
        public data: GiveawayData;
        public endAt: number;
        public ended: boolean;
        public guildID: Snowflake;
        public hostedBy: User | null;
        public manager: GiveawaysManager;
        public message: Message | null;
        public messageID: Snowflake | null;
        public messages: GiveawaysMessages;
        public options: GiveawayData;
        public prize: string;
        public startAt: number;
        public winnerCount: number;
        public winnerIDs: Snowflake[];

        // getters calculated using default manager options
        readonly exemptPermissions: PermissionResolvable[];
        readonly giveawayDuration: number;
        readonly embedColor: ColorResolvable;
        readonly embedColorEnd: ColorResolvable;
        readonly botsCanWin: boolean;
        readonly reaction: string;
        readonly fetchAllParticipants: boolean;

        // getters calculated using other values
        readonly remainingTime: number;
        readonly messageURL: string;
        readonly isActive: boolean;
        readonly content: string;
        readonly channel: TextChannel;
        readonly exemptMembersFunction: Function | null;
        readonly bonusEntries: BonusEntry[];

        public exemptMembers(member: GuildMember): Promise<boolean>;
        public edit(options: GiveawayEditOptions): Promise<Giveaway>;
        public end(): Promise<GuildMember[]>;
        // @ts-ignore-next-line
        public async fetchMessage(): Promise<Message | null>;
        public reroll(options: GiveawayRerollOptions): Promise<GuildMember[]>;
        // @ts-ignore-next-line
        public async roll(winnerCount?: number): Promise<GuildMember[]>;
    }
    interface GiveawayEditOptions {
        newWinnerCount?: number;
        newPrize?: string;
        addTime?: number;
        setEndTimestamp?: number;
        newMessages?: Partial<GiveawaysMessages>;
        newBonusEntries?: BonusEntry[];
        newExtraData?: any;
    }
    interface GiveawayRerollOptions {
        winnerCount?: number | null;
        messages?: {
            congrat?: string;
            error?: string;
        };
    }
    interface GiveawayData {
        startAt: number;
        endAt: number;
        winnerCount: number;
        winnerIDs: Snowflake[];
        messages: GiveawaysMessages;
        ended: boolean;
        prize: string;
        channelID: Snowflake;
        guildID: Snowflake;
        messageID?: Snowflake | null;
        reaction?: EmojiIdentifierResolvable;
        exemptPermissions?: PermissionResolvable[];
        exemptMembers?: string;
        bonusEntries?: string;
        embedColor?: ColorResolvable;
        embedColorEnd?: ColorResolvable;
        hostedBy?: string | null;
        extraData?: any;
        lastChance?: LastChanceOptions;
        fetchAllParticipants?: boolean;
    }
}