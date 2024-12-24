const express = require("express");
const app = express();
require("dotenv").config();
const authRoutes = require("./routes/authRoutes");
const diaryImageRoutes = require("./routes/diaryImageRoutes");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const port = process.env.PORT;

app.use(
  cors({
    origin: "http://localhost:3000", // 허용할 클라이언트 도메인
    methods: ["GET", "POST", "PUT", "DELETE"], // 허용할 HTTP 메서드
    credentials: true, // 쿠키 전송 허용
  })
);

app.use(express.json());

// 정적 파일 제공 (이미지 경로 설정)
const imageDir = path.join(__dirname, "images");
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir); // 이미지 디렉토리가 없으면 생성
}
app.use("/images", express.static(imageDir)); // 정적 파일 제공

// 라우트 설정
app.use("/auth", authRoutes);
app.use("/diary", diaryImageRoutes);

app.listen(port, () => {
  console.log(`서버가 실행되었습니다. http://localhost:${port}`);
});
