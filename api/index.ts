import app from '../server.ts';
import { initDatabase } from '../database.ts';

let dbInitialized = false;

// Middleware to ensure DB schema and seeds are initialized on serverless cold starts
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (err) {
      console.error("Failed to initialize database on serverless start:", err);
    }
  }
  next();
});

export default app;
