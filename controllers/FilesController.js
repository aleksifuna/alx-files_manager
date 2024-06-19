import fs from 'fs';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import Bull from 'bull';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const thumbNailQueue = new Bull('fileQueue');
const fileCollection = dbClient.client.db().collection('files');

export async function postUpload(req, resp) {
  const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
  const token = req.headers['x-token'];
  const { name, type, data } = req.body;
  let { parentId, isPublic } = req.body;
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
    parentId = ObjectId(parentId);
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
    userId: ObjectId(userId),
    name,
    type,
    isPublic,
    parentId,
    localPath: `${folderPath}/${fileUuid}`,
  });
  const fileId = insertionInfo.insertedId.toString();
  if (type === 'image') {
    await thumbNailQueue.add({ userId, fileId });
  }
  return resp.status(201).json({
    id: fileId,
    userId,
    name,
    type,
    isPublic,
    parentId,
  });
}

export async function getShow(req, resp) {
  const fileId = req.params.id;
  const token = req.headers['x-token'];
  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const document = await fileCollection.findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });
  if (!document) {
    return resp.status(404).json({ error: 'Not found' });
  }
  document.id = document._id;
  delete document._id;
  if (document.localPath) {
    delete document.localPath;
  }
  return resp.status(200).json(document);
}

export async function getIndex(req, resp) {
  const token = req.headers['x-token'];
  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const { parentId } = req.query;
  const page = parseInt(req.query.page, 10) || 0;
  const matchingCriteria = {
    userId: ObjectId(userId),
  };
  if (parentId) {
    matchingCriteria.parentId = ObjectId(parentId);
  }
  const results = await fileCollection.aggregate([
    { $match: matchingCriteria },
    { $skip: page * 20 },
    { $limit: 20 },
    {
      $project: {
        _id: 0,
        id: '$_id',
        userId: 1,
        name: 1,
        type: 1,
        isPublic: 1,
        parentId: 1,
      },
    },
  ]).toArray();
  return resp.status(200).json(results);
}

export async function putPublish(req, resp) {
  const token = req.headers['x-token'];
  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const documentId = req.params.id;
  const results = await fileCollection.updateOne(
    { _id: ObjectId(documentId), userId: ObjectId(userId) },
    { $set: { isPublic: true } },
  );
  if (results.matchedCount === 0) {
    return resp.status(404).json({ error: 'Not found' });
  }
  const document = await fileCollection.findOne({ _id: ObjectId(documentId) });
  document.id = document._id;
  delete document._id;
  if (document.localPath) {
    delete document.localPath;
  }
  return resp.status(200).json(document);
}

export async function putUnpublish(req, resp) {
  const token = req.headers['x-token'];
  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }
  const documentId = req.params.id;
  const results = await fileCollection.updateOne(
    { _id: ObjectId(documentId), userId: ObjectId(userId) },
    { $set: { isPublic: false } },
  );
  if (results.matchedCount === 0) {
    return resp.status(404).json({ error: 'Not found' });
  }
  const document = await fileCollection.findOne({ _id: ObjectId(documentId) });
  document.id = document._id;
  delete document._id;
  if (document.localPath) {
    delete document.localPath;
  }
  return resp.status(200).json(document);
}

export async function getFile(req, resp) {
  const token = req.headers['x-token'];
  let userId = null;

  if (token) {
    userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      userId = null;
    }
  }
  const documentId = req.params.id;
  const document = await fileCollection.findOne({
    _id: ObjectId(documentId),
  });
  if (!document) {
    return resp.status(404).json({ error: 'Not found' });
  }
  if (!document.isPublic && (!userId || !ObjectId(userId).equals(document.userId))) {
    return resp.status(404).json({ error: 'Not found' });
  }
  if (document.type === 'folder') {
    return resp.status(400).json({ error: "A folder doesn't have content" });
  }
  let { localPath } = document;
  const { size } = req.query;
  if (size) {
    localPath = `${localPath}_${size}`;
  }
  try {
    const data = await fs.promises.readFile(localPath);
    const mimeType = mime.lookup(document.name);
    resp.setHeader('Content-Type', mimeType);
    return resp.status(200).send(data);
  } catch (error) {
    return resp.status(404).json({ error: 'Not found' });
  }
}
