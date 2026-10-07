const { version } = require('./package.json');
const DiscordUtil = require('./src/DiscordUtil.js');

module.exports = {
    version,
    discordjsVersion: DiscordUtil.major,
    GiveawaysManager: require('./src/Manager'),
    DiscordUtil
};