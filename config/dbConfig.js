const mongoose = require('mongoose');

const connectDB = async () => {
    console.log("DB init");

    try {
        console.log("Connecting to MongoDB...");
        const connectDb = await mongoose.connect(process.env.DB_CONNECTION,
            {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });

        console.log(`✅ MongoDB Connected: ${connectDb.connection.host}/${connectDb.connection.name}`);
    } catch (error) {
        console.error("MongoDB Connection Error:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
