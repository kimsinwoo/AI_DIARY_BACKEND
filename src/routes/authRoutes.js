const express = require('express');
const router = express.Router();

// authController에서 로그인 및 리프레시 토큰 함수 가져오기
const authController = require('../controller/authController');

// 로그인 API
router.post('/login', authController.login);

//회원가입 API
router.post('/register', authController.register)

// 리프레시 토큰으로 새로운 엑세스 토큰 발급
router.post('/refresh-token', authController.refreshToken);

// 로그아웃 로직
router.post('/logout', authController.logout)

module.exports = router;
