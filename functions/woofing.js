const UserProfile = require("../schemas/UserProfile.js");
const config = require("../config.json");

function getGaussianTarget() {
    let target;
    let mean = 50;

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

async function handleWoofing(message) {
    let userProfile = await UserProfile.findOne({ discordId: message.author.id });
    if (!userProfile) {
        userProfile = new UserProfile({ discordId: message.author.id });
    }

    if (!userProfile.woofToggle) return;

    if (message.reference && message.reference.messageId === userProfile.latestWoofId) {
        const latestWoofType = userProfile.latestWoofType;
        let replied = false;

        switch (latestWoofType) {
            case "secret":
                if (message.content.toLowerCase().includes("secret woof")) {
                    message.reply("double secret woof!");
                    replied = true;
                } else if (message.content.toLowerCase().includes("woof")) {
                    message.reply("No more secret woof?");
                    replied = true;
                }
                break;
            case "meow":
                if (message.content.toLowerCase().includes("meow")) {
                    message.reply("meow... :(");
                    replied = true;
                } else if (message.content.toLowerCase().includes("woof")) {
                    message.reply("woof!!! :)");
                    replied = true;
                }
                break;
            case "normal":
                if (message.content.toLowerCase().includes("woof")) {
                    message.reply("double woof!");
                    replied = true;
                }
                break;
            case "rare":
                if (message.content.toLowerCase().includes("rare woof")) {
                    message.reply("double rare woof!");
                    replied = true;
                } else if (message.content.toLowerCase().includes("woof")) {
                    message.reply("woof woof!");
                    replied = true;
                }
                break;
            case "legendary":
                if (message.content.toLowerCase().includes("legendary woof")) {
                    message.reply("!! Double Legendary Woof !!");
                    replied = true;
                } else if (message.content.toLowerCase().includes("woof")) {
                    message.reply("woof woof!");
                    replied = true;
                }
                break;
            case "mythic":
                if (message.content.toLowerCase().includes("mythical woof")) {
                    message.reply("!!!!! DOUBLE MYTHICAL WOOF !!!!!");
                    replied = true;
                } else if (message.content.toLowerCase().includes("woof")) {
                    message.reply("woof woof!");
                    replied = true;
                }
                break;
            default:
                break;
        }

        if (replied) {
            userProfile.latestWoofId = "";
            userProfile.latestWoofType = "";
            await userProfile.save();
        }
        return;
    }

    let currentChance = userProfile.chance;

    if (currentChance >= userProfile.woofTarget) {
        let sentMessage;

        if (userProfile.secret === true) {
            userProfile.secret = false;
            await userProfile.save();
            sentMessage = await message.reply("secret woof!");
            userProfile.latestWoofType = "secret";
        } else if (userProfile.meow === true) {
            userProfile.meow = false;
            await userProfile.save();
            sentMessage = await message.reply("M... meow?");
            userProfile.latestWoofType = "meow";
        } else {
            const woofTable = [
                { chance: 1, type: "mythic", text: "!! MYTHICAL WOOF !!" },
                { chance: 5, type: "legendary", text: "! Legendary Woof !" },
                { chance: 20, type: "rare", text: "rare woof" },
                { chance: 74, type: "normal", text: "woof" },
            ];
            let roll = Math.random() * 100;
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
            userProfile.latestWoofType = selectedWoof.type;
        }

        const newTarget = getGaussianTarget();
        console.log(`Woofed at ${message.author.username}! New goal: ${newTarget}.`);
        userProfile.latestWoofId = sentMessage.id;
        userProfile.chance = 0;
        userProfile.woofTarget = newTarget;

        userProfile.woofStats.total += 1;
        if (userProfile.latestWoofType) {
            userProfile.woofStats[userProfile.latestWoofType] += 1;
        }
        await userProfile.save();
    } else {
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
        currentChance += totalPoints;
        if (currentChance > 100) currentChance = 100;

        console.log(
            `No woof for ${message.author.username}. ((${characterPoints.toFixed(2)} + ${emojiPoints.toFixed(2)} + ${attachmentPoints.toFixed(2)}) * ${timeMultiplier.toFixed(2)} => +${totalPoints.toFixed(2)} points) Points increased to ${currentChance.toFixed(2)}, waiting for ${userProfile.woofTarget.toFixed(2)}.`,
        );
        userProfile.chance = currentChance;
        userProfile.lastMessageTime = Date.now();
        await userProfile.save();
    }
}

module.exports = { handleWoofing };
