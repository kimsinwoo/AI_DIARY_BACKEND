const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client"); // PrismaClient 가져오기
const prisma = new PrismaClient(); // PrismaClient 인스턴스화

const JWT_SECRET_KEY = "your-secret-key"; // 실제 환경에서는 더 안전한 키를 사용하세요
const JWT_REFRESH_KEY = "your-refresh-secret-key"; // 리프레시 토큰을 위한 비밀 키
const JWT_ACCESS_EXPIRATION = "1h"; // 엑세스 토큰 만료 시간 (1시간)
const JWT_REFRESH_EXPIRATION = "7d"; // 리프레시 토큰 만료 시간 (7일)

// 로그인 시 엑세스 토큰과 리프레시 토큰 발급
exports.login = async (req, res) => {
  const { UserId, Password } = req.body;

  const user = await prisma.users.findUnique({
    where: { UserId },
  });

  if (!user) {
    return res.status(404).json({
      message: "회원정보를 찾을 수 없습니다.",
      status: "404",
    });
  }

  // 비밀번호 검증
  const isMatch = await bcrypt.compare(Password, user.Password);
  if (!isMatch) {
    return res.status(401).json({
      message: "비밀번호가 일치하지 않습니다.",
      status: "401",
    });
  }

  // 엑세스 토큰 생성
  const accessToken = jwt.sign(
    { UserId: user.UserId, Name: user.Name }, // 페이로드
    JWT_SECRET_KEY, // 비밀 키
    { expiresIn: JWT_ACCESS_EXPIRATION } // 엑세스 토큰 만료 시간
  );

  // 리프레시 토큰 생성
  const refreshToken = jwt.sign(
    { UserId: user.UserId, Name: user.Name }, // 페이로드
    JWT_REFRESH_KEY, // 리프레시 비밀 키
    { expiresIn: JWT_REFRESH_EXPIRATION } // 리프레시 토큰 만료 시간
  );

  // 리프레시 토큰을 DB에 저장 (사용자마다 하나의 리프레시 토큰을 저장)
  await prisma.users.update({
    where: { UserId: user.UserId },
    data: { refreshToken, accessToken },
  });

  return res.status(200).json({
    message: "로그인 성공",
    accessToken,
    refreshToken,
  });
};

// 리프레시 토큰을 사용하여 새로운 엑세스 토큰 발급
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      message: "리프레시 토큰이 제공되지 않았습니다.",
      status: "400",
    });
  }

  // 리프레시 토큰 검증
  jwt.verify(refreshToken, JWT_REFRESH_KEY, async (err, decoded) => {
    if (err) {
      return res.status(403).json({
        message: "유효하지 않은 리프레시 토큰입니다.",
        status: "403",
      });
    }

    // 사용자 정보 확인
    const user = await prisma.users.findUnique({
      where: { UserId: decoded.UserId },
    });

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({
        message: "리프레시 토큰이 일치하지 않습니다.",
        status: "403",
      });
    }

    // 새로운 엑세스 토큰 생성
    const newAccessToken = jwt.sign(
      { UserId: user.UserId, Name: user.Name },
      JWT_SECRET_KEY,
      { expiresIn: JWT_ACCESS_EXPIRATION }
    );

    return res.status(200).json({
      message: "엑세스 토큰 갱신 성공",
      accessToken: newAccessToken,
    });
  });
};

// 인증을 위한 JWT 검증 미들웨어
exports.authenticate = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // 'Bearer <token>'에서 토큰만 추출

  if (!token) {
    return res.status(401).json({
      message: "토큰이 제공되지 않았습니다.",
      status: "401",
    });
  }

  jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        message: "유효하지 않은 토큰입니다.",
        status: "403",
      });
    }

    req.user = decoded; // decoded된 토큰 정보를 req.user에 저장
    next();
  });
};

// 회원가입 기능 (비밀번호 암호화)
exports.register = async (req, res) => {
  const { UserId, Password, Name } = req.body;

  // 이미 존재하는 유저인지 확인
  const existingUser = await prisma.users.findFirst({
    where: {
      UserId,
    },
  });

  if (existingUser) {
    return res.status(400).json({
      message: "이미 등록된 사용자입니다.",
      status: "400",
    });
  }

  // 비밀번호 암호화
  const hashedPassword = await bcrypt.hash(Password, 10); // saltRounds = 10

  // 새 사용자 생성
  const newUser = await prisma.users.create({
    data: {
      UserId,
      Password: hashedPassword, // 암호화된 비밀번호 저장
      Name,
    },
  });

  return res.status(201).json({
    message: "회원가입 성공",
    user: {
      UserId,
      Name,
    },
  });
};

exports.logout = async (req, res) => {
    const { accessToken } = req.body;
  
    if (!accessToken) {
      return res.status(400).json({
        message: "accessToken이 누락되었습니다.",
        status: "400",
      });
    }
  
    try {
      const updatedUser = await prisma.users.updateMany({
        where: { accessToken },
        data: { accessToken: null },
      });
  
      if (updatedUser.count === 0) {
        return res.status(403).json({
          message: "올바르지 않은 accessToken입니다.",
          status: "403",
        });
      }
  
      res.status(200).json({
        message: "로그아웃이 정상적으로 완료되었습니다.",
        status: "200",
      });
    } catch (error) {
      console.error("로그아웃 처리 중 에러 발생:", error);
      res.status(500).json({
        message: "서버 내부 오류가 발생했습니다.",
        status: "500",
      });
    }
  };
  
