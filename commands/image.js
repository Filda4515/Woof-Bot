const { AttachmentBuilder, SlashCommandBuilder } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const IMAGE_CAPTION = {
    fetch: "\\*plays a fetch\\*",
    sit: "\\*sits down\\*",
    grrr: "\\*Grrr\\*",
    eep: "\\*goes eep\\*",
    rat: "\\*gets smol rat\\*",
    puppy: "\\*memories are flooding back\\*",
    bot_wake_up: "Good morning, woof!",
    bot_eep: "Good night, woof!",
};
const IMAGES_FOLDER = path.join(__dirname, "../images");

const CATEGORIES = Object.keys(IMAGE_CAPTION);
const RANDOM_CATEGORIES = CATEGORIES.filter((c) => c !== "bot_wake_up" && c !== "bot_eep");

function getRandomImage(category) {
    try {
        const allImages = fs.readdirSync(IMAGES_FOLDER);
        const categoryImages = allImages.filter((image) => image.startsWith(category) && image.endsWith(".avif"));
        if (categoryImages.length === 0) {
            console.error(`No pictures were found for ${category} category!`);
            return null;
        }
        const randomImage = categoryImages[Math.floor(Math.random() * categoryImages.length)];
        const imgPath = path.join(IMAGES_FOLDER, randomImage);
        return new AttachmentBuilder(imgPath);
    } catch (error) {
        console.error("Error reading images directory:", error);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("image")
        .setDescription("Get the best image of me!")
        .addStringOption((option) =>
            option
                .setName("category")
                .setDescription("Category of the image")
                .addChoices(
                    { name: "🎲 Random", value: "random" },
                    { name: "🥎 Fetch", value: "fetch" },
                    { name: "🪑 Sit", value: "sit" },
                    { name: "😠 Grrr", value: "grrr" },
                    { name: "💤 Sleep", value: "eep" },
                    { name: "🐀 Rat", value: "rat" },
                    { name: "🐶 Puppy", value: "puppy" },
                    { name: "🌞 Good morning!", value: "bot_wake_up" },
                    { name: "🌕 Good night!", value: "bot_eep" },
                ),
        ),
    async execute(interaction) {
        let selectedCategory = interaction.options.getString("category") ?? "random";
        if (selectedCategory === "random") {
            const randomIndex = Math.floor(Math.random() * RANDOM_CATEGORIES.length);
            selectedCategory = RANDOM_CATEGORIES[randomIndex];
        }

        const attachment = getRandomImage(selectedCategory);

        if (!attachment) {
            return await interaction.reply("There was an error trying to fetch the image. :(");
        }

        await interaction.reply({
            content: IMAGE_CAPTION[selectedCategory],
            files: [attachment],
        });
    },
};
