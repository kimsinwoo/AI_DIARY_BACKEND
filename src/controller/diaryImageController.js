require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
const prisma = new PrismaClient();

exports.createImage = async (req, res) => {
  const { title, content, weather, mood, date, accessToken } = req.body;

  if (!title || !content || !weather || !mood) {
    return res.status(400).json({ message: "내용을 입력해주세요." });
  }
  if (!accessToken) {
    return res.status(403).json({ message: "로그인 후 사용 해주세요." });
  }

  const user = await prisma.Users.findFirst({
    where: { accessToken },
    select: { UserId: true },
  });

  if (!user) {
    return res.status(404).json({ message: "사용자 아이디를 찾을 수 없습니다." });
  }

  const prompt = `일기의 제목은 ${title} 이고 현재 작성된 일기 내용은 ${content} 이런 내용이야 오늘의 날씨는 ${weather} 이런 날씨야 그리고 나의 오늘의 기분은 ${mood} 야 내가 알려준 내용을 토대로 일기에 들어갈 이미지를 "한번 그림에 다 포함해서" 생성해줘 ("only pictures")`;

  try {
    // 이미지 생성
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
    });

    const imageUrl = response.data[0].url;

    // 이미지 저장
    const imageDir = path.join(__dirname, "../images");
    if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir);
    const imagePath = path.join(imageDir, `${user.UserId}_${Date.now()}.png`);

    const downloadImage = async (url, filepath) => {
      const response = await axios({ url, method: "GET", responseType: "stream" });
      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    };

    await downloadImage(imageUrl, imagePath);

    const comments = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `일기의 제목은 ${title} 이고 현재 작성된 일기 내용은 ${content} 이런 내용이야 오늘의 날씨는 ${weather} 이런 날씨야 그리고 나의 오늘의 기분은 ${mood} 야 내가 알려준 내용을 토대로 너가 일기에 대해서 공감을 해주는 말을 해줘 2줄로 적어줘`,
        },
      ],
    });

    const aiComments = comments.choices[0].message.content;

    await prisma.Diary.create({
      data: {
        CreateUserId: user.UserId,
        Title: title,
        Weather: weather,
        Date: date,
        Content: content,
        Mood: mood,
        ImageData: `/images/${path.basename(imagePath)}`, // 이미지 URL 저장
        Ai_Coments: aiComments,
      },
    });

    res.status(200).json({
      message: "이미지가 생성되었고, 일기가 정상적으로 저장되었습니다.",
      localPath: `/images/${path.basename(imagePath)}`, // 클라이언트가 접근할 URL 반환
      ai_comments: aiComments,
    });
  } catch (error) {
    console.error("Error:", error.message || error);
    res.status(500).json({
      message: "이미지 생성 또는 저장에 실패했습니다.",
      error: error.message || "Unknown error",
    });
  }
};

exports.diarylist = async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(403).json({ message: "로그인을 해주세요." });
  }

  const user = await prisma.Users.findFirst({
    where: { accessToken },
    select: { UserId: true },
  });

  if (!user) {
    return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
  }

  try {
    const result = await prisma.Diary.findMany({
      where: { CreateUserId: user.UserId },
      select: {
        Title: true,
        Weather: true,
        Date: true,
        Content: true,
        Mood: true,
        ImageData: true, // 저장된 이미지 경로 포함
        Ai_Coments: true,
      },
    });

    res.status(200).json({
      message: "성공적으로 데이터가 불러와졌습니다.",
      data: result,
    });
  } catch (error) {
    console.error("Error:", error.message || error);
    res.status(500).json({
      message: "오류가 발생했습니다. 다시 시도해주세요.",
      error: error.message || error,
    });
  }
};

exports.checkAttendance = async (req, res) => {
    const { accessToken, date } = req.body;

    if (!accessToken) {
        return res.status(403).json({ message: "로그인을 해주세요." });
    }

    if (!date) {
        return res.status(404).json({ message: "날짜를 불러올 수 없습니다." });
    }

    try {
        // 사용자 정보 조회
        const user = await prisma.Users.findFirst({
            where: { accessToken },
            select: { UserId: true },
        });

        if (!user) {
            return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
        }

        // 다이어리 날짜 조회
        const diaries = await prisma.Diary.findMany({
            where: { CreateUserId: user.UserId },
            select: { Date: true },
        });

        // 오늘 날짜와 동일한 날짜가 있는지 확인
        const resultData = diaries.some(diary => diary.Date === date);

        res.status(200).json({
            message: "성공적으로 데이터가 불러와졌습니다.",
            data: resultData,
        });
    } catch (error) {
        console.error("Error:", error.message || error);
        res.status(500).json({
            message: "오류가 발생했습니다. 다시 시도해주세요.",
            error: error.message || error,
        });
    }
};

