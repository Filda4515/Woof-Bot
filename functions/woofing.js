const UserProfile = require("../schemas/UserProfile.js");
const config = require("../config.json");

function getGaussianTarget(mean = 50) {
    let target;

    // stdDev = 20 at mean 50, stdDev = 10 at mean 25/75 with gaussian curve
    const spreadFactor = -Math.pow(25 - 50, 2) / Math.log(0.5);
    const stdDev = 20 * Math.exp(-Math.pow(mean - 50, 2) / spreadFactor);

    do {
        let u1 = 0;
        let u2 = 0;
        while (u1 === 0) u1 = Math.random();
        while (u2 === 0) u2 = Math.random();

        let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        target = z0 * stdDev + mean;
    } while (target < 1 || target > 100);

    return Math.round(target * 100) / 100;
}

async function woofReply(message, userProfile) {
    const reply = message.content.toLowerCase();
    let replied = false;

    try {
        switch (userProfile.latestWoofType) {
            case "secret":
                if (reply.includes("secret woof")) {
                    message.reply("double secret woof!");
                    replied = true;
                } else if (reply.includes("woof")) {
                    message.reply("No more secret woof?");
                    replied = true;
                }
                break;
            case "meow":
                if (reply.includes("meow")) {
                    message.reply("meow... :(");
                    replied = true;
                } else if (reply.includes("woof")) {
                    message.reply("woof!!! :)");
                    replied = true;
                }
                break;
            case "normal":
                if (reply.includes("woof")) {
                    message.reply("double woof!");
                    replied = true;
                }
                break;
            case "rare":
                if (reply.includes("rare woof")) {
                    message.reply("double rare woof!");
                    replied = true;
                } else if (reply.includes("woof")) {
                    message.reply("woof woof!");
                    replied = true;
                }
                break;
            case "legendary":
                if (reply.includes("legendary woof")) {
                    message.reply("!! Double Legendary Woof !!");
                    replied = true;
                } else if (reply.includes("woof")) {
                    message.reply("woof woof!");
                    replied = true;
                }
                break;
            case "mythic":
                if (reply.includes("mythical woof")) {
                    message.reply("!!!!! DOUBLE MYTHICAL WOOF !!!!!");
                    replied = true;
                } else if (reply.includes("woof")) {
                    message.reply("woof woof!");
                    replied = true;
                }
                break;
            default:
                break;
        }
    } catch (error) {
        console.error(`Network error: Could not send woof message to ${message.author.username}:`, error.message);
        return;
    }

    if (replied) {
        userProfile.latestWoofId = "";
        userProfile.latestWoofType = "";
        await userProfile.save();
    }

    return replied;
}

async function woofMessage(message, userProfile) {
    let sentMessage;
    let woofType;
    let roll;

    try {
        if (userProfile.secret === true) {
            userProfile.secret = false;
            sentMessage = await message.reply("secret woof!");
            woofType = "secret";
        } else if (userProfile.meow === true) {
            userProfile.meow = false;
            sentMessage = await message.reply("M... meow?");
            woofType = "meow";
        } else {
            const rates = config.woofSettings.dropRates;
            const normalChance = 100 - (rates.mythic + rates.legendary + rates.rare);
            const woofTable = [
                { chance: rates.mythic, type: "mythic", text: "!! MYTHICAL WOOF !!" },
                { chance: rates.legendary, type: "legendary", text: "! Legendary Woof !" },
                { chance: rates.rare, type: "rare", text: "rare woof" },
                { chance: normalChance, type: "normal", text: "woof" },
            ];

            roll = Math.random() * 100;
            let cumulativeWeight = 0;
            let selectedWoof = woofTable[woofTable.length - 1];

            for (const woofDict of woofTable) {
                cumulativeWeight += woofDict.chance;
                if (roll < cumulativeWeight) {
                    selectedWoof = woofDict;
                    break;
                }
            }

            sentMessage = await message.reply(selectedWoof.text);
            woofType = selectedWoof.type;
        }
    } catch (error) {
        console.error(`Network error: Could not send woof message to ${message.author.username}:`, error.message);
        return;
    }

    const userMean = userProfile.woofTargetMean;
    const newTarget = getGaussianTarget(userMean);
    console.log(
        `Woofed at ${message.author.username} with woof rarity ${woofType} (${roll !== undefined ? roll.toFixed(2) : "N/A"})! New goal: ${newTarget} (Mean: ${userMean}).`,
    );

    userProfile.latestWoofId = sentMessage.id;
    userProfile.latestWoofType = woofType;
    userProfile.chance = 0;
    userProfile.woofTarget = newTarget;
    userProfile.woofStats.total += 1;
    userProfile.woofStats[woofType] += 1;
    await userProfile.save();
}

async function gainWoofPoints(message, userProfile) {
    const now = Date.now();
    const timePassed = Math.min(now - userProfile.lastMessageTime, config.woofSettings.maxTimePauseMs);
    const timeRatio = timePassed / config.woofSettings.maxTimePauseMs;
    const timeMultiplier = timeRatio * config.woofSettings.timeMultiplier;

    const characterRatio = Math.min(message.content.length, config.woofSettings.maxCharCount) / config.woofSettings.maxCharCount;
    const characterPoints = characterRatio * config.woofSettings.maxCharacterPoints;

    const customEmojiRegex = /<a?:[a-zA-Z0-9_]+:\d+>/g;
    const unicodeEmojiRegex = /\p{Extended_Pictographic}/gu;
    const hasEmoji = customEmojiRegex.test(message.content) || unicodeEmojiRegex.test(message.content);
    const emojiPoints = hasEmoji ? config.woofSettings.emojiPoints : 0;

    const attachmentPoints = message.attachments.size > 0 ? config.woofSettings.attachmentPoints : 0;

    let totalPoints = Math.min((characterPoints + emojiPoints + attachmentPoints) * timeMultiplier, config.woofSettings.maxPointsGain);
    totalPoints = Math.round(totalPoints * 100) / 100;
    let currentChance = userProfile.chance + totalPoints;
    if (currentChance > 100) currentChance = 100;

    console.log(
        `No woof for ${message.author.username}. ((${characterPoints.toFixed(2)} + ${emojiPoints.toFixed(2)} + ${attachmentPoints.toFixed(2)}) * ${timeMultiplier.toFixed(2)} => +${totalPoints.toFixed(2)} points) Points increased to ${currentChance.toFixed(2)}, waiting for ${userProfile.woofTarget.toFixed(2)}.`,
    );
    userProfile.chance = currentChance;
    userProfile.lastMessageTime = now;
    await userProfile.save();
}

async function handleWoofing(message) {
    let userProfile = await UserProfile.findOne({ discordId: message.author.id });
    if (!userProfile) {
        userProfile = new UserProfile({ discordId: message.author.id });
    }

    if (!userProfile.woofToggle) return;

    if (message.reference && message.reference.messageId === userProfile.latestWoofId) {
        const replied = await woofReply(message, userProfile);
        if (replied) return;
    }

    if (userProfile.chance >= userProfile.woofTarget) {
        await woofMessage(message, userProfile);
    } else {
        await gainWoofPoints(message, userProfile);
    }
}

module.exports = { handleWoofing };
