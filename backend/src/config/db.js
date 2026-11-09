import mongoose from "mongoose";

let connectionPromise = null;

// Reuse the connection pool while a Vercel Function instance stays warm.
// Reset the cached promise if MongoDB disconnects.
mongoose.connection.on("disconnected", () => {
  connectionPromise = null;
});

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from the environment.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 5,
        minPoolSize: 0,
      })
      .then(() => {
        console.log(
          `MongoDB connected: ${mongoose.connection.host}`
        );

        console.log(
          `MongoDB database: ${mongoose.connection.name}`
        );

        return mongoose.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        console.error("MongoDB connection failed:", error.message);
        throw error;
      });
  }

  return connectionPromise;
};

export default connectDB;
