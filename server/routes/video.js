const express = require('express');
const router = express.Router();
const { Video } = require('../models/Video');

const { auth } = require('../middleware/auth');
const multer = require('multer');
var ffmpeg = require('fluent-ffmpeg');
const { Subscriber } = require('../models/Subscriber');

//Storage MULTER CONFIG
let storage = multer.diskStorage({
  //파일을 올리면 어디에 그 파일을 저장할지를 정함.
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  //어떠한 파일이름으로 저장을 할 지. (여기서는 날짜 + 원본파일이름)
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
  //파일 확장자 검색. (비디오 mp4확장자만 업로드 가능)
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext !== '.mp4') {
      return cb(res.status(400).end('Only JPG, PNG, MP4 is allowed'), false);
    }
    cb(null, true);
  },
});

const upload = multer({ storage: storage }).single('file');

//=================================
//             Video
//=================================
router.post('/uploadfiles', (req, res) => {
  //비디오를 서버에 저장한다.
  upload(req, res, (err) => {
    if (err) {
      return res.json({ success: false, err });
    }
    //success여부, 파일저장된 곳 주소, 파일 이름
    return res.json({
      success: true,
      url: res.req.file.path,
      fileName: res.req.file.filename,
    });
  });
});

//비디오 정보들을 DB에 저장한다.
router.post('/uploadVideo', (req, res) => {
  const video = new Video(req.body);
  video.save((err, doc) => {
    if (err) return res.json({ success: false, err });
    res.status(200).json({ success: true });
  });
});

//비디오 정보 리스트를 DB에서 가져오기
router.get('/getVideos', (req, res) => {
  //비디오를 DB에서 가져와서 클라이언트 쪽으로 보낸다.
  Video.find()
    .populate('writer') //user의 모든 정보를 가져오기 위함.
    .exec((err, videos) => {
      if (err) return res.status(400).send(err);

      res.status(200).json({ success: true, videos });
    });
});
//비디오 정보 하나를 DB에서 가져오기
router.post('/getVideoDetail', (req, res) => {
  Video.findOne({ _id: req.body.videoId })
    .populate('writer')
    .exec((err, videoDetail) => {
      if (err) return res.status(400).send(err);
      return res.status(200).json({ success: true, videoDetail });
    });
});

//구독한 비디오 정보 리스트를 DB에서 가져오기
router.post('/getSubscriptionVideos', (req, res) => {
  // 현재 자신의 아이디를 가지고, 구독하는 사람들을 찾는다.
  Subscriber.find({ userFrom: req.body.userFrom }).exec(
    (err, subcriberInfo) => {
      if (err) return res.status(400).send(err);

      let subscribedUser = [];

      subcriberInfo.map((subscriber, i) => {
        subscribedUser.push(subscriber.userTo);
      });

      //그 찾은 사람들의 비디오를 가지고 온다.

      Video.find({ writer: { $in: subscribedUser } })
        .populate('writer')
        .exec((err, videos) => {
          if (err) return res.status(400).send(err);
          res.status(200).json({ success: true, videos });
        });
    }
  );
});

router.post('/thumbnail', (req, res) => {
  //썸네일을 생성하고 비디오 러닝타임 등의 비디오 정보를 가져오기.

  let filePath = '';
  let fileDuration = '';
  //비디오 정보 가져오기
  ffmpeg.ffprobe(req.body.url, function (err, metadata) {
    console.dir(metadata);
    console.log(metadata.format.duration);
    fileDuration = metadata.format.duration;
  });

  //썸네일 생성
  ffmpeg(req.body.url)
    .on('filenames', function (filenames) {
      console.log('Will Generate' + filenames.join(', '));
      console.log(filenames);

      filePath = 'uploads/thumbnails/' + filenames[0];
    })
    .on('end', function () {
      console.log('Screenshots taken');
      return res.json({
        success: true,
        url: filePath,
        fileDuration: fileDuration,
      });
    })
    .on('error', function (err) {
      console.error(err);
      return res.json({ success: false, err });
    })
    .screenshots({
      //will take screenshots at 20, 40, 60, 80% of the video
      count: 3,
      folder: 'uploads/thumbnails',
      size: '320x240',
      //%b: input basename (filename w/o extension)
      filename: 'thumbnail-%b.png',
    });
});

module.exports = router;
