import sha1 from 'sha1';
import dbClient from '../utils/db';

export default async function postNew(req, res) {
  const collection = dbClient.client.db().collection('users');
  const { email, password } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Missing email' });
    return;
  }
  if (!password) {
    res.status(400).json({ error: 'Missing password' });
    return;
  }
  const user = await collection.findOne({ email });
  if (user) {
    res.status(400).json('error: Already exist');
    return;
  }
  const insertionInfo = await collection.insertOne({ email, password: sha1(password) });
  const userId = insertionInfo.insertedId.toString();
  res.status(201).json({ email, id: userId });
}
