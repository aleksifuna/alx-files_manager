import fs from 'fs';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default async function postUpload(req, resp) {
  const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
  const token = req.headers['x-token'];
  const { name, type, data } = req.body;
  let { parentId, isPublic } = req.body;
  const fileCollection = dbClient.client.db().collection('files');
  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  if (!name) {
    return resp.status(400).json({ error: 'Missing name' });
  }
  if (!type) {
    return resp.status(400).json({ error: 'Missing type' });
  }
  if (!isPublic) {
    isPublic = false;
  }
  if (!data && type !== 'folder') {
    return resp.status(400).json({ error: 'Missing data' });
  }
  if (parentId) {
    const parentFolder = await fileCollection.findOne({ _id: ObjectId(parentId) });
    if (!parentFolder) {
      return resp.status(400).json({ error: 'Parent not found' });
    }
    if (parentFolder.type !== 'folder') {
      return resp.status(400).json({ error: 'Parent is not a folder' });
    }
  } else {
    parentId = 0;
  }
  if (type === 'folder') {
    const insertionInfo = await fileCollection.insertOne({
      name,
      type,
      parentId,
      userId: ObjectId(userId),
    });
    const fileId = insertionInfo.insertedId.toString();
    return resp.status(201).json({
      id: fileId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  const buffer = Buffer.from(data, 'base64');
  const fileUuid = uuidv4();
  fs.writeFileSync(`${folderPath}/${fileUuid}`, buffer);
  const insertionInfo = await fileCollection.insertOne({
    userId,
    name,
    type,
    isPublic,
    parentId,
    localPath: `${folderPath}/${fileUuid}`,
  });
  const fileId = insertionInfo.insertedId.toString();
  return resp.status(201).json({
    id: fileId,
    userId,
    name,
    type,
    isPublic,
    parentId,
  });
}
