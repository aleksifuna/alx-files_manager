import Bull from 'bull';
import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import { promises as fs } from 'fs';
import dbClient from './utils/db';

const thumbNailQueue = new Bull('fileQueue');
const fileCollection = dbClient.client.db().collection('files');

async function createThumbnail(localPath) {
  const task500 = imageThumbnail(localPath, { width: 500 });
  const task250 = imageThumbnail(localPath, { width: 250 });
  const task100 = imageThumbnail(localPath, { width: 100 });
  const [tn500, tn250, tn100] = await Promise.all([task500, task250, task100]);
  await Promise.all([
    fs.writeFile(`${localPath}_500`, tn500),
    fs.writeFile(`${localPath}_250`, tn250),
    fs.writeFile(`${localPath}_100`, tn100),
  ]);
}

thumbNailQueue.process(async (job) => {
  const { fileId, userId } = job.data;
  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }
  const file = await fileCollection.findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });
  if (!file) {
    throw new Error('File not found');
  }
  try {
    await createThumbnail(file.localPath);
  } catch (error) {
    throw new Error('File not found');
  }
});
