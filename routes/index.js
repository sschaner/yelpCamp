const express = require("express"),
  router = express.Router(),
  passport = require("passport"),
  User = require("../models/user"),
  Campground = require("../models/campground"),
  async = require("async"),
  crypto = require("crypto"),
  multer = require("multer"),
  cloudinary = require("cloudinary"),
  mailgun = require("mailgun-js")({
    apiKey: process.env.MAIL_GUN_API_KEY,
    domain: process.env.MAIL_GUN_DOMAIN,
  });

const storage = multer.diskStorage({
  filename: (req, file, callback) => {
    callback(null, Date.now() + file.originalname);
  },
});
const imageFilter = (req, file, cb) => {
  // Accept image files only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error("Only image files are allowed."), false);
  }
  cb(null, true);
};
const upload = multer({ storage: storage, fileFilter: imageFilter });
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ROOT ROUTE
router.get("/", (req, res) => {
  res.render("landing");
});

// SHOW REGISTER FORM
router.get("/register", (req, res) => {
  res.render("register", { page: "register" });
});

// REGISTER NEW USER
router.post("/register", upload.single("image"), async (req, res) => {
  let waitForUpload = await cloudinary.v2.uploader.upload(req.file.path, {
    folder: "YelpCamp/Users",
  });

  const newUser = new User({
    username: req.body.username,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    image: waitForUpload.secure_url,
    imageId: waitForUpload.public_id,
    description: req.body.description,
  });

  if (req.body.adminCode === process.env.ADMIN_CODE) {
    newUser.isAdmin = true;
  }

  User.register(newUser, req.body.password, (err, user) => {
    if (err) {
      req.flash("error", err.message + ".");
      return res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, () => {
        if (user.isAdmin) {
          req.flash(
            "success",
            `Welcome to YelpCamp ${user.firstName}. You are an administator and have the power to edit and/or delete anything.`
          );
        } else {
          req.flash("success", `Welcome to YelpCamp ${user.firstName}.`);
        }
        return res.redirect("/campgrounds");
      });
    }
  });
});

// SHOW LOGIN FORM ROUTE
router.get("/login", (req, res) => {
  res.render("login", { page: "login" });
});

// HANDLING LOGIN LOGIC
router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: "Invalid username or password.",
  }),
  (req, res) => {
    let currentUser = req.user;
    if (currentUser.isAdmin) {
      req.flash(
        "success",
        `Welcome back ${currentUser.firstName}. Remember that you have superpowers.`
      );
    } else {
      req.flash("success", `Welcome back ${currentUser.firstName}.`);
    }
    res.redirect("/campgrounds");
  }
);

// LOGOUT ROUTE
router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success", "Logged you out.");
  res.redirect("/campgrounds");
});

// FORGOT PASSWORD ROUTE
router.get("/forgot", (req, res) => {
  res.render("forgot");
});

router.post("/forgot", (req, res, next) => {
  async.waterfall(
    [
      (done) => {
        crypto.randomBytes(20, (err, buf) => {
          var token = buf.toString("hex");
          done(err, token);
        });
      },

      (token, done) => {
        User.findOne({ email: req.body.email }, (err, user) => {
          if (!user) {
            req.flash("error", "No account with that email address exists.");
            return res.redirect("/forgot");
          }

          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

          user.save((err) => {
            done(err, token, user);
          });
        });
      },

      (token, user, done) => {
        var mailOptions = {
          from: "app174367248@heroku.com",
          to: user.email,
          subject: "Vacation Tracker Password Reset",
          text:
            "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
            "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
            "http://" +
            req.headers.host +
            "/reset/" +
            token +
            "\n\n" +
            "If you did not request this, please ignore this email and your password will remain unchanged.\n",
        };
        mailgun.messages().send(mailOptions, (err) => {
          req.flash(
            "success",
            "An e-mail has been sent to " +
              user.email +
              " with further instructions."
          );
          done(err, "done");
        });
      },
    ],
    (err) => {
      if (err) return next(err);
      res.redirect("/forgot");
    }
  );
});

router.get("/reset/:token", (req, res) => {
  User.findOne(
    {
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    },
    (err, user) => {
      if (!user) {
        req.flash("error", "Password reset token is invalid or has expired.");
        return res.redirect("/forgot");
      }
      res.render("reset", { token: req.params.token });
    }
  );
});

router.post("/reset/:token", (req, res) => {
  async.waterfall(
    [
      (done) => {
        User.findOne(
          {
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() },
          },
          (err, user) => {
            if (!user) {
              req.flash(
                "error",
                "Password reset token is invalid or has expired."
              );
              return res.redirect("back");
            }
            if (req.body.password === req.body.confirm) {
              user.setPassword(req.body.password, (err) => {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;

                user.save((err) => {
                  req.logIn(user, (err) => {
                    done(err, user);
                  });
                });
              });
            } else {
              req.flash("error", "Passwords do not match.");
              return res.redirect("back");
            }
          }
        );
      },

      (user, done) => {
        var mailOptions = {
          from: "Steve Schaner <schanerst@gmail.com>",
          to: user.email,
          subject: "Your YelpCamp Password Has Been Changed",
          text:
            "Hello,\n\n" +
            "This is a confirmation that the password for your account " +
            user.email +
            " has just been changed.\n",
        };
        mailgun.messages().send(mailOptions, (err) => {
          req.flash("success", "Your password has been changed.");
          done(err);
        });
      },
    ],
    (err) => {
      res.redirect("/campgrounds");
    }
  );
});

// USER PROFILES ROUTE
router.get("/users/:id", (req, res) => {
  User.findById(req.params.id, (err, foundUser) => {
    if (err) {
      req.flash("error", "Something went wrong.");
      res.redirect("/");
    }
    Campground.find()
      .where("author.id")
      .equals(foundUser._id)
      .exec((err, campgrounds) => {
        if (err) {
          req.flash("error", "Something went wrong.");
          res.redirect("/");
        }
        res.render("users/show", { user: foundUser, campgrounds: campgrounds });
      });
  });
});

module.exports = router;
