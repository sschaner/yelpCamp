const express = require("express"),
  router = express.Router(),
  Campground = require("../models/campground"),
  Comment = require("../models/comment"),
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

// INDEX - show all campgrounds
router.get("/", (req, res) => {
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "gi"); // 'g' is global and 'i' is ignore case
    // Get all campgrounds from DB matcing the query string
    Campground.find({ name: regex }, (err, allCampgrounds) => {
      if (err || !allCampgrounds.length) {
        req.flash(
          "error",
          "No campgrounds match your search. Please try again."
        );
        res.redirect("back");
      } else {
        res.render("campgrounds/index", {
          campgrounds: allCampgrounds,
          currentUser: req.user,
          page: "campgrounds",
        });
      }
    });
  } else {
    // Get all campgrounds from DB
    Campground.find({}, (err, allCampgrounds) => {
      if (err) {
        console.log(err);
      } else {
        res.render("campgrounds/index", {
          campgrounds: allCampgrounds,
          currentUser: req.user,
          page: "campgrounds",
        });
      }
    });
  }
});

// CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single("image"), (req, res) => {
  cloudinary.v2.uploader.upload(
    req.file.path,
    { folder: "YelpCamp/Campgrounds" },
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
        req.body.campground.lat = data[0].latitude;
        req.body.campground.lng = data[0].longitude;
        req.body.campground.location = data[0].formattedAddress;

        // add cloudinary url for the image to the campground object under image property
        req.body.campground.image = result.secure_url;
        // Add image public_id to campground object
        req.body.campground.imageId = result.public_id;
        // add author to campground
        req.body.campground.author = {
          id: req.user._id,
          username: req.user.username,
        };
        Campground.create(req.body.campground, (err, campground) => {
          if (err) {
            req.flash("error", err.messsage);
            return res.redirect("back");
          }
          res.redirect("campgrounds");
        });
      });
    }
  );
});

// NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, (req, res) => {
  res.render("campgrounds/new");
});

// SHOW - shows more info about one campground
router.get("/:id", (req, res) => {
  // find the campground with provided ID
  Campground.findById(req.params.id)
    .populate("comments")
    .exec((err, foundCampground) => {
      if (err || !foundCampground) {
        req.flash("error", "Campground not found.");
        res.redirect("back");
      } else {
        // render show template with that campground
        res.render("campgrounds/show", { campground: foundCampground });
      }
    });
});

// EDIT CAMPGROUND ROUTE
router.get("/:id/edit", middleware.checkCampgroundOwnership, (req, res) => {
  Campground.findById(req.params.id, (err, foundCampground) => {
    res.render("campgrounds/edit", { campground: foundCampground });
  });
});

// UPDATE CAMPGROUND ROUTE
router.put(
  "/:id",
  middleware.checkCampgroundOwnership,
  upload.single("image"),
  function (req, res) {
    Campground.findById(req.params.id, async function (err, campground) {
      if (err) {
        req.flash("error", err.message);
        res.redirect("back");
      } else {
        if (req.file) {
          try {
            await cloudinary.v2.uploader.destroy(campground.imageId);
            let result = await cloudinary.v2.uploader.upload(req.file.path, {
              folder: "YelpCamp",
            });
            campground.image = result.secure_url;
            campground.imageId = result.public_id;
          } catch (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
        }
        if (req.body.location !== campground.location) {
          try {
            let updatedLocation = await geocoder.geocode(req.body.location);
            campground.lat = updatedLocation[0].latitude;
            campground.lng = updatedLocation[0].longitude;
            campground.location = updatedLocation[0].formattedAddress;
          } catch (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
        }
        campground.name = req.body.campground.name;
        campground.price = req.body.campground.price;
        campground.description = req.body.campground.description;
        campground.save();
        req.flash("success", "Successfully Updated!");
        res.redirect(`/campgrounds/${campground._id}`);
      }
    });
  }
);

// DESTROY CAMPGROUND ROUTE
router.delete("/:id", middleware.checkCampgroundOwnership, (req, res, next) => {
  Campground.findById(req.params.id, async (err, campground) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    try {
      await cloudinary.v2.uploader.destroy(campground.imageId);
      Comment.remove(
        {
          _id: {
            $in: campground.comments,
          },
        },
        (err) => {
          if (err) return next(err);
          campground.remove();
          req.flash("success", "Campground successfully deleted.");
          res.redirect("/campgrounds");
        }
      );
    } catch (err) {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
    }
  });
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$!#\s]/g, "\\$&");
}

module.exports = router;
