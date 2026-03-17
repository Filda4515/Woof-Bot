const { Schema, model } = require("mongoose");

const userProfileSchema = new Schema({
    discordId: { type: String, required: true, unique: true },
    woofToggle: { type: Boolean, default: false },
    chance: { type: Number, default: 0.03 },
    woofTarget: { type: Number, default: 50 },
    lastMessageTime: { type: Number, default: Date.now },
    latestWoofId: { type: String, default: "" },
    latestWoofType: { type: String, default: "" },
    secret: { type: Boolean, default: false },
    meow: { type: Boolean, default: false },
    woofStats: {
        total: { type: Number, default: 0 },
        normal: { type: Number, default: 0 },
        rare: { type: Number, default: 0 },
        legendary: { type: Number, default: 0 },
        mythic: { type: Number, default: 0 },
        secret: { type: Number, default: 0 },
        meow: { type: Number, default: 0 },
    },
});

module.exports = model("UserProfile", userProfileSchema);
