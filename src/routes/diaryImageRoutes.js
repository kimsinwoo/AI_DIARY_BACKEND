const express = require('express');
const router = express.Router();

// authController에서 로그인 및 리프레시 토큰 함수 가져오기
const dirayImageController = require("../controller/diaryImageController")

// 로그인 API
router.post('/imagecreate', dirayImageController.createImage);

router.post('/list', dirayImageController.diarylist)

router.post('/check', dirayImageController.checkAttendance)

module.exports = router;