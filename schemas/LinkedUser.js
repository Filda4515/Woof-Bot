const { Schema, model } = require("mongoose");

const linkedUserSchema = new Schema({
    discordId: { type: String, required: true, unique: true },
    ign: { type: String, required: true },
    uuid: { type: String, required: true },
});

module.exports = model("LinkedUser", linkedUserSchema);
