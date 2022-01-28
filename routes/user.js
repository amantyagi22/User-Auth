require("dotenv").config();
const router = require("express").Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");
const client = require("twilio")(
  process.env.ACCOUNT_SID,
  process.env.AUTH_TOKEN
);
const jwt = require("jsonwebtoken");
//Add a User
router.post("/register", async (req, res) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);
  const randOTP = Math.floor(Math.random() * 1000000 + 100000);
  try {
    const newUser = new User({
      name: req.body.name,
      username: req.body.username,
      pw: req.body.password,
      password: hashedPassword,
      phoneNumber: req.body.phoneNumber,
      otp: randOTP,
    });
    const user = await newUser.save();
    client.messages.create({
      body: `The verification code for using the website is ${randOTP}`,
      from: "+17652469142",
      to: `+91${req.body.phoneNumber}`,
    });
    res.status(200).json({
      message: "User successfully registered",
      id: user._id,
    });
  } catch (err) {
    res.status(500).json({ message: "Username already exist" });
  }
});
// Get the info about the user like isVerified
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { pw, password, ...other } = user._doc;
    res.status(200).json(other);
  } catch (err) {
    res.status(500).json(err);
  }
});
//Update the isVerified boolean
router.put("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      $set: req.body,
    });
    res.status(200).json("Toggled User Verification");
  } catch (err) {
    return res.status(500).json({ messsage: "OTP did not match", error: err });
  }
});
//Login the user
router.post("/login", async (req, res) => {
  const user = await User.findOne({
    username: req.body.username,
  });

  if (!user) {
    return { status: "error", error: "Invalid login" };
  }
  const isPasswordValid = await bcrypt.compare(
    req.body.password,
    user.password
  );
  if (isPasswordValid) {
    const token = jwt.sign(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      `${process.env.SECRET_TOKEN}`
    );
    return res.json({ status: "ok", userid: user._id, jwttoken: token });
  } else {
    return res.json({ status: "error", user: false });
  }
});
//The homepage cookie storage
router.get("/users/homepage", async (req, res) => {
  const token = req.headers.authorization;

  try {
    const decoded = jwt.verify(token, `${process.env.SECRET_TOKEN}`);
    const username = decoded.username;
    const user = await User.findOne({ username: username });

    return res.json({ status: "ok" });
  } catch (error) {
    res.json({ status: "error", error: error });
  }
});

// Forgot password should only work if the user is verified
router.post("/users/forgot", async (req, res) => {
  const user = await User.findOne({
    username: req.body.username,
  });

  if (!user) {
    return { status: "error", error: "Invalid login" };
  }
  if (user.isVerified) {
    try {
      const userPassword = user.pw;
      const phoneNumber = user.phoneNumber;
      client.messages.create({
        body: `Your Password is ${userPassword}`,
        from: "+17652469142",
        to: `+91${phoneNumber}`,
      });
      res.status(200).json({
        message: "Password sent",
      });
    } catch (err) {
      res.status(500).json({ message: "error", error: err });
    }
  } else {
    res.status(401).json({ message: "User is not verified" });
  }
});

module.exports = router;
