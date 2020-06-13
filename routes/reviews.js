const review = require("../models/review");

const express = require("express"),
  router = express.Router({ mergeParams: true }),
  Vacation = require("../models/vacation"),
  Review = require("../models/review"),
  middleware = require("../middleware");

// INDEX REVIEWS ROUTE
router.get("/", (req, res) => {
  Vacation.findById(req.params.id)
    .populate({
      path: "reviews",
      options: { sort: { createdAt: -1 } },
    })
    .exec((err, vacation) => {
      if (err || !vacation) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      res.render("reviews/index", { vacation });
    });
});

// NEW REVIEWS ROUTE
router.get(
  "/new",
  middleware.isLoggedIn,
  middleware.checkReviewExistence,
  (req, res) => {
    Vacation.findById(req.params.id, (err, vacation) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      res.render("reviews/new", { vacation });
    });
  }
);

// CREATE REVIEWS ROUTE
router.post(
  "/",
  middleware.isLoggedIn,
  middleware.checkReviewExistence,
  (req, res) => {
    Vacation.findById(req.params.id)
      .populate("reviews")
      .exec((err, vacation) => {
        if (err) {
          req.flash("error", err.message);
          return res.redirect("back");
        }
        Review.create(req.body.review, (err, review) => {
          if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
          review.author.id = req.user._id;
          review.author.username = req.user.username;
          review.vacation = vacation;
          review.save();
          vacation.reviews.push(review);
          vacation.rating = calculateAverage(vacation.reviews);
          vacation.save();
          req.flash(
            "success",
            "Thank you. Your review has been successfully added."
          );
          res.redirect(`/vacations/${vacation._id}`);
        });
      });
  }
);

// EDIT REVIEWS ROUTE
router.get("/:review_id/edit", middleware.checkReviewOwnership, (req, res) => {
  Review.findById(req.params.review_id, (err, foundReview) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    res.render("reviews/edit", {
      vacation_id: req.params.id,
      review: foundReview,
    });
  });
});

// UPDATE REVIEWS ROUTE
router.put("/:review_id", middleware.checkReviewOwnership, (req, res) => {
  Review.findByIdAndUpdate(
    req.params.review_id,
    req.body.review,
    { new: true },
    (err, updatedReview) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      Vacation.findById(req.params.id)
        .populate("reviews")
        .exec((err, vacation) => {
          if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
          vacation.rating = calculateAverage(vacation.reviews);
          vacation.save();
          req.flash("success", "Your review was successfully edited.");
          res.redirect(`/vacations/${vacation._id}`);
        });
    }
  );
});

// DELETE REVIEWS ROUTE
router.delete("/:review_id", middleware.checkReviewOwnership, (req, res) => {
  Review.findByIdAndRemove(req.params.review_id, (err) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    Vacation.findByIdAndUpdate(
      req.params.id,
      { $pull: { reviews: req.params.review_id } },
      { new: true }
    )
      .populate("reviews")
      .exec((err, vacation) => {
        if (err) {
          req.flash("error", err.message);
          return res.redirect("back");
        }
        vacation.rating = calculateAverage(vacation.reviews);
        vacation.save();
        req.flash("success", "Your review was deleted successfully.");
        res.redirect(`/vacations/${req.params.id}`);
      });
  });
});

function calculateAverage(reviews) {
  if (reviews.length === 0) {
    return 0;
  }
  let sum = 0;
  reviews.forEach((element) => {
    sum += element.rating;
  });
  return sum / reviews.length;
}

module.exports = router;
