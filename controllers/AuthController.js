import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export async function getConnect(req, resp) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  if (!authorizationHeader.startsWith('Basic ')) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const base64String = authorizationHeader.split(' ')[1];
  const emailPassword = Buffer.from(base64String, 'base64').toString('utf-8');
  const [email, password] = emailPassword.split(':');
  const collection = dbClient.client.db().collection('users');
  const user = await collection.findOne({ email });
  if (!user) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  if (user.password !== sha1(password)) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const token = uuidv4();
  const key = `auth_${token}`;
  await redisClient.set(key, user._id.toString(), (24 * 60 * 60));
  return resp.status(200).json({ token });
}

export async function getDisconnect(req, resp) {
  const tokenHeader = req.headers['x-token'];
  if (!tokenHeader) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const userId = await redisClient.get(`auth_${tokenHeader}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  await redisClient.del(`auth_${tokenHeader}`);
  return resp.status(204).send();
}
