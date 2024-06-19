import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export async function postNew(req, res) {
  const collection = dbClient.client.db().collection('users');
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Missing password' });
  }
  const user = await collection.findOne({ email });
  if (user) {
    return res.status(400).json({ error: 'Already exist' });
  }
  const insertionInfo = await collection.insertOne({ email, password: sha1(password) });
  const userId = insertionInfo.insertedId.toString();
  return res.status(201).json({ email, id: userId });
}

export async function getMe(req, resp) {
  const token = req.headers['x-token'];
  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const collection = dbClient.client.db().collection('users');
  const user = await collection.findOne({ _id: ObjectId(userId) });
  if (!user) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  return resp.status(200).json({ email: user.email, id: user._id });
}
