const mongoose = require("mongoose");

async function connectToDatabase() {
    mongoose.set("strictQuery", true);
    await mongoose
        .connect(process.env.MONGODB_URI, { family: 4 })
        .then(() => {
            console.log("Connected to the database.");
        })
        .catch((err) => {
            console.log("Failed to connect to the database:", err);
            throw err;
        });
}

module.exports = { connectToDatabase };
