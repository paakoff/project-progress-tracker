const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

const mongo = new MongoClient(
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
);
const projects = mongo.db('project_progress_tracker').collection('projects');

const fields = [
  'code', 'name', 'lead', 'startDate', 'dueDate', 'status', 'description'
];
const statuses = ['On Track', 'At Risk', 'Blocked', 'Completed'];

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function projectFrom(body) {
  const project = {};
  for (const field of fields) {
    const value = body?.[field];
    if (typeof value !== 'string' || !value.trim()) return null;
    project[field] = value.trim();
  }

  if (!statuses.includes(project.status) ||
      !isCalendarDate(project.startDate) ||
      !isCalendarDate(project.dueDate) ||
      project.dueDate < project.startDate) {
    return null;
  }

  return project;
}

function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'The database request failed.' });
    }
  };
}

app.param('id', (req, res, next, id) => {
  if (!/^[0-9a-f]{24}$/i.test(id)) {
    return res.status(400).json({ message: 'Invalid project ID.' });
  }
  req.projectId = new ObjectId(id);
  next();
});

app.get('/api/projects', route(async (req, res) => {
  res.json(await projects.find().sort({ name: 1 }).toArray());
}));

app.get('/api/projects/:id', route(async (req, res) => {
  const project = await projects.findOne({ _id: req.projectId });
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  res.json(project);
}));

app.post('/api/projects', route(async (req, res) => {
  const project = projectFrom(req.body);
  if (!project) return res.status(400).json({ message: 'Check the project fields.' });

  const result = await projects.insertOne(project);
  res.status(201).json({ ...project, _id: result.insertedId });
}));

app.put('/api/projects/:id', route(async (req, res) => {
  const project = projectFrom(req.body);
  if (!project) return res.status(400).json({ message: 'Check the project fields.' });

  const result = await projects.updateOne(
    { _id: req.projectId },
    { $set: project }
  );
  if (!result.matchedCount) {
    return res.status(404).json({ message: 'Project not found.' });
  }
  res.json({ ...project, _id: req.projectId });
}));

app.delete('/api/projects/:id', route(async (req, res) => {
  const result = await projects.deleteOne({ _id: req.projectId });
  if (!result.deletedCount) {
    return res.status(404).json({ message: 'Project not found.' });
  }
  res.sendStatus(204);
}));

const port = process.env.PORT || 8000;
mongo.connect()
  .then(() => app.listen(port, () =>
    console.log(`API running at http://localhost:${port}/api/projects`)))
  .catch(error => {
    console.error('Could not connect to MongoDB:', error.message);
    process.exit(1);
  });
