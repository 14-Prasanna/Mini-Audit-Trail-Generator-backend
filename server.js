require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { diffWords } = require("diff"); // For calculating added/removed words

const app = express();

// Middleware
app.use(express.json());
// In your Express backend (replace the current cors() block)
app.use(
  cors({
    origin: [
      "https://14-prasanna.github.io",
      "https://14-prasanna.github.io/Mini-Audit-Trail-Generator-front-end",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);


// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Version Schema — with diff & summary
const versionSchema = new mongoose.Schema({
  versionNumber: { type: Number, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // { title, content }

  // Diff stats compared to previous version
  diff: {
    added: { type: Number, default: 0 },
    removed: { type: Number, default: 0 },
    changed: { type: Number, default: 0 },
  },

  // Short summary like "Added ~45 words"
  summary: { type: String, default: "" },

  prev: { type: Number, default: null }, // previous version number null for first
  next: { type: Number, default: null }, // next version number
  createdAt: { type: Date, default: Date.now },
});

// Task Schema — holds all versions
const taskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  headVersion: { type: Number, default: null },
  tailVersion: { type: Number, default: null },
  versionCount: { type: Number, default: 0 },
  versions: [versionSchema],
});

const Task = mongoose.model("Task", taskSchema);

// CREATE NEW VERSION (with diff & summary)
app.post("/api/task/:taskId/version", async (req, res) => {
  const taskId = req.params.taskId;
  const newData = req.body; // { title: "...", content: "..." }

  try {
    let task = await Task.findOne({ taskId });
    if (!task) task = new Task({ taskId });

    const newVersionNumber = task.versionCount + 1;

    // Default values for first version
    let diffStats = { added: 0, removed: 0, changed: 0 };
    let summary = "Created new task";

    // If this is NOT the first version → compare with previous
    if (task.tailVersion !== null) {
      const prevVersion = task.versions.find((v) => v.versionNumber === task.tailVersion);

      if (prevVersion) {
        const oldContent = prevVersion.data.content || "";
        const newContent = newData.content || "";

        const changes = diffWords(oldContent, newContent);

        let added = 0;
        let removed = 0;

        changes.forEach((part) => {
          const wordCount = part.value.trim().split(/\s+/).filter(Boolean).length;
          if (part.added) added += wordCount;
          if (part.removed) removed += wordCount;
        });

        diffStats = {
          added,
          removed,
          changed: added + removed,
        };

        // Smart summary
        if (added > removed) summary = `Added ~${added} words`;
        else if (removed > added) summary = `Removed ~${removed} words`;
        else if (added > 0) summary = `Edited content (~${added} words changed)`;
        else summary = "Title updated or minor changes";
      }
    }

    // First version: count words as "added"
    else if (newData.content) {
      const wordCount = newData.content.trim().split(/\s+/).filter(Boolean).length;
      diffStats.added = wordCount;
      diffStats.changed = wordCount;
      summary = `Created with ${wordCount} words`;
    }

    // Create the new version object
    const newVersion = {
      versionNumber: newVersionNumber,
      data: newData,
      diff: diffStats,
      summary,
      prev: task.tailVersion || null,
      next: null,
      createdAt: new Date(),
    };

    // Link previous version → this one
    if (task.tailVersion !== null) {
      await Task.updateOne(
        { taskId, "versions.versionNumber": task.tailVersion },
        { $set: { "versions.$.next": newVersionNumber } }
      );
    }

    // Update head/tail pointers
    if (task.versionCount === 0) task.headVersion = newVersionNumber;
    task.tailVersion = newVersionNumber;
    task.versionCount = newVersionNumber;

    // Add new version
    task.versions.push(newVersion);
    await task.save();

    res.json({
      message: `Version ${newVersionNumber} created`,
      version: newVersion,
    });
  } catch (err) {
    console.error("Error creating version:", err);
    res.status(500).json({ error: "Failed to create version" });
  }
});

// GET all tasks (for dropdown)
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await Task.find({})
      .select("taskId tailVersion versions.versionNumber versions.data")
      .lean();

    const list = tasks.map((task) => {
      const latest = task.versions.find((v) => v.versionNumber === task.tailVersion);
      return {
        taskId: task.taskId,
        title: latest?.data?.title?.trim() || "Untitled Task",
      };
    });

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// GET full task with all versions
app.get("/api/task/:taskId", async (req, res) => {
  try {
    const task = await Task.findOne({ taskId: req.params.taskId });
    if (!task) return res.json({ message: "Task not found", versions: [] });

    res.json({
      taskId: task.taskId,
      headVersion: task.headVersion,
      tailVersion: task.tailVersion,
      totalVersions: task.versionCount,
      versions: task.versions.sort((a, b) => a.versionNumber - b.versionNumber),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET single version
app.get("/api/task/:taskId/version/:versionNumber", async (req, res) => {
  try {
    const task = await Task.findOne({ taskId: req.params.taskId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const version = task.versions.find((v) => v.versionNumber == req.params.versionNumber);
    if (!version) return res.status(404).json({ message: "Version not found" });

    const prev = version.prev ? task.versions.find((v) => v.versionNumber === version.prev) : null;
    const next = version.next ? task.versions.find((v) => v.versionNumber === version.next) : null;

    res.json({
      ...version.toObject(),
      navigation: {
        prev: prev ? prev.versionNumber : null,
        next: next ? next.versionNumber : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Dashboard stats
app.get("/api/stats", async (req, res) => {
  try {
    const tasks = await Task.find({})
      .select("taskId tailVersion versions.createdAt versions.data.title")
      .lean();

    const totalTasks = tasks.length;
    const totalVersions = tasks.reduce((sum, t) => sum + t.versionCount, 0);

    let latestTask = null;
    let latestDate = null;

    for (const task of tasks) {
      const lastVer = task.versions.find((v) => v.versionNumber === task.tailVersion);
      if (lastVer?.createdAt) {
        const date = new Date(lastVer.createdAt);
        if (!latestDate || date > latestDate) {
          latestDate = date;
          latestTask = {
            title: lastVer.data?.title?.trim() || "Untitled Task",
            timeAgo: formatTimeAgo(date),
          };
        }
      }
    }

    res.json({
      totalTasks,
      totalVersions,
      latestTask,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
