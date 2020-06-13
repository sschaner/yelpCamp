const express = require("express"),
  router = express.Router(),
  Vacation = require("../models/vacation"),
  Comment = require("../models/comment"),
  Review = require("../models/review"),
  middleware = require("../middleware"),
  NodeGeocoder = require("node-geocoder"),
  multer = require("multer"),
  cloudinary = require("cloudinary");

const options = {
  provider: "google",
  httpAdapter: "https",
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null,
};
const geocoder = NodeGeocoder(options);

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

// INDEX - show all vacations
router.get("/", (req, res) => {
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "gi"); // 'g' is global and 'i' is ignore case
    // Get all vacations from DB matcing the query string
    Vacation.find({ name: regex }, (err, allVacations) => {
      if (err || !allVacations.length) {
        req.flash("error", "No vacations match your search. Please try again.");
        res.redirect("back");
      } else {
        res.render("vacations/index", {
          vacations: allVacations,
          currentUser: req.user,
          page: "vacations",
        });
      }
    });
  } else {
    // Get all vacations from DB
    Vacation.find({}, (err, allVacations) => {
      if (err) {
        console.log(err);
      } else {
        res.render("vacations/index", {
          vacations: allVacations,
          currentUser: req.user,
          page: "vacations",
        });
      }
    });
  }
});

// CREATE - add new vacation to DB
router.post("/", middleware.isLoggedIn, upload.single("image"), (req, res) => {
  cloudinary.v2.uploader.upload(
    req.file.path,
    { folder: "VacationTracker/vacationSpots" },
    (err, result) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      geocoder.geocode(req.body.location, (err, data) => {
        if (err || !data.length) {
          req.flash("error", "Invalid address.");
          return res.redirect("back");
        }
        req.body.vacation.lat = data[0].latitude;
        req.body.vacation.lng = data[0].longitude;
        req.body.vacation.location = data[0].formattedAddress;
        req.body.vacation.state = data[0].administrativeLevels.level1long;

        // add cloudinary url for the image to the vacation object under image property
        req.body.vacation.image = result.secure_url;
        // Add image public_id to vacation object
        req.body.vacation.imageId = result.public_id;
        // add author to vacation
        req.body.vacation.author = {
          id: req.user._id,
          username: req.user.username,
        };
        Vacation.create(req.body.vacation, (err, vacation) => {
          if (err) {
            req.flash("error", err.messsage);
            return res.redirect("back");
          }
          res.redirect("vacations");
        });
      });
    }
  );
});

// NEW - show form to create new vacation
router.get("/new", middleware.isLoggedIn, (req, res) => {
  res.render("vacations/new");
});

// SHOW - shows more info about one vacation
router.get("/:id", (req, res) => {
  Vacation.findById(req.params.id)
    .populate("comments likes")
    .populate({
      path: "reviews",
      options: { sort: { createdAt: -1 } },
    })
    .exec((err, foundVacation) => {
      if (err || !foundVacation) {
        req.flash("error", "Vacation not found.");
        res.redirect("back");
      } else {
        res.render("vacations/show", {
          vacation: foundVacation,
        });
      }
    });
});

// EDIT VACATION ROUTE
router.get("/:id/edit", middleware.checkVacationOwnership, (req, res) => {
  Vacation.findById(req.params.id, (err, foundVacation) => {
    res.render("vacations/edit", { vacation: foundVacation });
  });
});

// UPDATE VACATION ROUTE
router.put(
  "/:id",
  middleware.checkVacationOwnership,
  upload.single("image"),
  function (req, res) {
    delete req.body.vacation.rating;
    Vacation.findById(req.params.id, async function (err, vacation) {
      if (err) {
        req.flash("error", err.message);
        res.redirect("back");
      } else {
        if (req.file) {
          try {
            await cloudinary.v2.uploader.destroy(vacation.imageId);
            let result = await cloudinary.v2.uploader.upload(req.file.path, {
              folder: "VacationTracker",
            });
            vacation.image = result.secure_url;
            vacation.imageId = result.public_id;
          } catch (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
        }
        if (req.body.location !== vacation.location) {
          try {
            let updatedLocation = await geocoder.geocode(req.body.location);
            vacation.lat = updatedLocation[0].latitude;
            vacation.lng = updatedLocation[0].longitude;
            vacation.location = updatedLocation[0].formattedAddress;
            req.body.vacation.state = data[0].administrativeLevels.level1long;
          } catch (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
        }
        vacation.name = req.body.vacation.name;
        vacation.price = req.body.vacation.price;
        vacation.description = req.body.vacation.description;
        vacation.save((err) => {
          if (err) {
            req.flash("error", err.message);
            res.redirect("back");
          } else {
            req.flash("success", "Vacation spot successfully Updated!");
            res.redirect(`/vacations/${vacation._id}`);
          }
        });
      }
    });
  }
);

// DESTROY VACATION ROUTE
router.delete("/:id", middleware.checkVacationOwnership, (req, res, next) => {
  Vacation.findById(req.params.id, async (err, vacation) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    try {
      await cloudinary.v2.uploader.destroy(vacation.imageId);
      Comment.remove(
        {
          _id: {
            $in: vacation.comments,
          },
        },
        (err) => {
          if (err) return next(err);
        }
      );
      Review.remove(
        {
          _id: {
            $in: vacation.reviews,
          },
        },
        (err) => {
          if (err) return next(err);
        }
      );
    } catch (err) {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
    }
    vacation.remove();
    req.flash("success", "Vacation spot successfully deleted.");
    res.redirect("/vacations");
  });
});

// CAMPGOUND LIKE ROUTE
router.post("/:id/like", middleware.isLoggedIn, (req, res) => {
  Vacation.findById(req.params.id, (err, foundVacation) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/vacations");
    }

    // check if req.user._id exists in foundVacation.likes
    let foundUserLike = foundVacation.likes.some((like) => {
      return like.equals(req.user._id);
    });

    if (foundUserLike) {
      // user aleady liked, removing like
      foundVacation.likes.pull(req.user._id);
    } else {
      // adding the new user like
      foundVacation.likes.push(req.user);
    }

    foundVacation.save((err) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("/vacations");
      }
      return res.redirect(`/vacations/${foundVacation._id}`);
    });
  });
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$!#\s]/g, "\\$&");
}

module.exports = router;
