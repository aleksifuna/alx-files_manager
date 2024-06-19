import express from 'express';
import bodyParser from 'body-parser';
import router from './routes/index';

const app = express();
const PORT = process.env.PORT || 5000;
app.use(bodyParser.json());
app.use('/', router);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
