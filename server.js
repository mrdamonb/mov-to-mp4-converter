const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

['uploads', 'converted'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.post('/convert', upload.array('videos'), (req, res) => {
  const quality = req.body.quality || 'medium';
  const crf = quality === 'high' ? 18 : quality === 'medium' ? 23 : 28;
  const preset = quality === 'high' ? 'slow' : quality === 'medium' ? 'medium' : 'fast';

  const results = [];
  let pending = req.files.length;

  if (!pending) return res.status(400).send('No files uploaded.');

  req.files.forEach(file => {
    const outputPath = path.join('converted', file.filename.replace('.mov', '.mp4'));

    ffmpeg(file.path)
      .videoCodec('libx264')
      .outputOptions([`-crf ${crf}`, `-preset ${preset}`])
      .on('end', () => {
        fs.unlinkSync(file.path);
        results.push(outputPath);
        if (--pending === 0) res.json({ files: results });
      })
      .on('error', err => {
        console.error(`Error converting file ${file.filename}:`, err);
        if (--pending === 0) res.status(500).send('Conversion failed');
      })
      .save(outputPath);
  });
});

app.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'converted', req.params.filename);
  res.download(filePath, err => {
    if (!err) fs.unlink(filePath, () => {});
  });
});

app.listen(PORT, () => {
  console.log(`App running at http://localhost:${PORT}`);
});