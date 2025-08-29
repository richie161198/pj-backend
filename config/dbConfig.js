
// const mongoose = require('mongoose');


// const connectDB = async () => {
//     console.log("DB init");
//     try {
//          console.log("DB init 23");
//         const connectDb = await mongoose.connect("mongodb+srv://preciousconsole:C4GZZEmm7mSbOHO4@clusterpg.rtxn0iy.mongodb.net/?retryWrites=true&w=majority&appName=ClusterPG"
//         //     , {
//         //     useNewUrlParser: true,
//         //     useUnifiedTopology: true
//         // }
//     );
//         console.log(`${connectDb.connection.name} DB connected  `)
//         console.log("DB init2");
//     } catch (error) {
//         console.log("DB init 3");
//         console.log(error);
//         process.exit(1);

//     }

// }

// module.exports = connectDB;


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
