import "dotenv/config";
import app from "./server.js";
import connectDB from "./src/config/db.js";

const PORT = process.env.PORT || 3000;

try {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Vaultify API running at http://localhost:${PORT}`);
  });
} catch (error) {
  console.error("Local API startup failed:", error.message);
  process.exitCode = 1;
}
