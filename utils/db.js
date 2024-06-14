import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const db = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}/${db}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.connected = false;
    this.client.connect((err) => {
      if (err) {
        this.connected = false;
      } else {
        this.connected = true;
      }
    });
  }

  isAlive() {
    return this.connected;
  }

  async nbUsers() {
    const db = this.client.db();
    return db.collection('users').countDocuments();
  }

  async nbFiles() {
    const db = this.client.db();
    return db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
