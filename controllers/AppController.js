import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export function getStatus(req, res) {
  if (dbClient.isAlive() && redisClient.isAlive()) {
    res.status(200).json({ redis: true, db: true });
  }
}

export function getStats(req, res) {
  Promise.all([dbClient.nbUsers(), dbClient.nbFiles()])
    .then(([usersCount, filesCount]) => {
      res.status(200).json({ users: usersCount, files: filesCount });
    });
}
