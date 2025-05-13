// src/lib/mongodb.ts
import { MongoClient, Db, ServerApiVersion, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'healthwisehub'; // Default DB name if not specified

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

// Extend MongoClient to cache the connection
interface MongoClientWithCache extends MongoClient {
  _db?: Db;
}

let cachedClient: MongoClientWithCache | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClientWithCache; db: Db }> {
  if (cachedClient && cachedDb) {
    try {
      // Verify connection is still active
      await cachedClient.db('admin').command({ ping: 1 });
      return { client: cachedClient, db: cachedDb };
    } catch (e) {
      console.warn("Cached MongoDB connection lost, reconnecting...", e);
      cachedClient = null;
      cachedDb = null;
    }
  }

  const clientOptions = {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    tlsAllowInvalidCertificates: true, // Added to ignore SSL certificate issues
    // You might also need tls: true if not already implied by the URI or other settings,
    // but tlsAllowInvalidCertificates usually requires tls to be active.
    // The MONGODB_URI with `retryWrites=true&w=majority` typically implies SSL.
  };

  const client: MongoClientWithCache = new MongoClient(MONGODB_URI, clientOptions);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log("Successfully connected to MongoDB and database:", DB_NAME);

    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error; // Re-throw error to be handled by the caller
  }
}

export function getMongoDb(): Db {
  if (!cachedDb) {
    throw new Error("Database not connected. Call connectToDatabase first.");
  }
  return cachedDb;
}

export function isMongoDbConnected(): boolean {
    return !!cachedClient && !!cachedDb;
}

// Helper to convert string ID to ObjectId, if needed
export const toObjectId = (id: string): ObjectId | null => {
  try {
    if (ObjectId.isValid(id)) {
      return new ObjectId(id);
    }
    console.warn(`Invalid string ID format for ObjectId conversion: ${id}`);
    return null;
  } catch (error) {
    console.warn(`Error during ObjectId conversion for ID: ${id}`, error);
    return null;
  }
};

// Export ObjectId for use in other files
export { ObjectId };
