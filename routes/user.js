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
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    const randOTP = Math.floor(Math.random() * 1000000 + 100000);
    const newUser = new User({
      name: req.body.name,
      username: req.body.username,
      password: hashedPassword,
      phoneNumber: req.body.phoneNumber,
      otp: randOTP,
    });
    client.messages.create({
      body: `The verification code for using the website is ${randOTP}`,
      from: "+17652469142",
      to: `+91${req.body.phoneNumber}`,
    });
    const user = await newUser.save();
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
    const { password, ...other } = user._doc;
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
    res.status(200).json("Verified");
  } catch (err) {
    return res.status(500).json(err);
  }
});
//Login the user
router.post("/login", async (req, res) => {
  const user = await User.findOne({
    email: req.body.email,
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
        name: user.name,
        email: user.email,
      },
      process.env.SECRET_KEY
    );
    return res.json({ status: "ok", user: token });
  } else {
    return res.json({ status: "error", user: false });
  }
});
//The homepage cookie storage
router.get("/users/homepage", async (req, res) => {
  const token = req.headers.authorization;

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const email = decoded.email;
    const user = await User.findOne({ email: email });

    return res.json({ status: "ok" });
  } catch (error) {
    res.json({ status: "error", error: "invalid token" });
  }
});
module.exports = router;
