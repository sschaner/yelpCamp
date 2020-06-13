const Vacation = require("../models/vacation"),
  Comment = require("../models/comment"),
  Review = require("../models/review");

// all the middleware goes here
const middlewareObj = {};

middlewareObj.checkVacationOwnership = (req, res, next) => {
  if (req.isAuthenticated()) {
    Vacation.findById(req.params.id, (err, foundVacation) => {
      if (err || !foundVacation) {
        req.flash("error", "Vacation not found.");
        res.redirect("back");
      } else {
        // does user own the vacation?
        if (foundVacation.author.id.equals(req.user._id) || req.user.isAdmin) {
          next();
        } else {
          req.flash("error", "You don't have permission to do that.");
          res.redirect("back");
        }
      }
    });
  } else {
    req.flash("error", "You need to be logged in to do that.");
    res.redirect("back");
  }
};

middlewareObj.checkCommentOwnership = (req, res, next) => {
  if (req.isAuthenticated()) {
    Comment.findById(req.params.comment_id, (err, foundComment) => {
      if (err || !foundComment) {
        req.flash("error", "Comment not found.");
        res.redirect("back");
      } else {
        // does user own the comment?
        if (foundComment.author.id.equals(req.user._id) || req.user.isAdmin) {
          next();
        } else {
          req.flash("error", "You don't have permission to do that.");
          res.redirect("back");
        }
      }
    });
  } else {
    req.flash("error", "You need to be logged in to do that.");
    res.redirect("back");
  }
};

middlewareObj.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "You need to be logged in to do that.");
  res.redirect("/login");
};

middlewareObj.checkReviewOwnership = (req, res, next) => {
  if (req.isAuthenticated()) {
    Review.findById(req.params.review_id, (err, foundReview) => {
      if (err || !foundReview) {
        res.redirect("back");
      } else {
        if (foundReview.author.id.equals(req.user._id)) {
          next();
        } else {
          req.flash("error", "You don't have permission to do that");
          res.redirect("back");
        }
      }
    });
  } else {
    req.flash("error", "You need to be logged in to do that");
    res.redirect("back");
  }
};

middlewareObj.checkReviewExistence = (req, res, next) => {
  if (req.isAuthenticated()) {
    Vacation.findById(req.params.id)
      .populate("reviews")
      .exec((err, foundVacation) => {
        if (err || !foundVacation) {
          req.flash("error", "Vacation not found.");
          res.redirect("back");
        } else {
          let foundUserReview = foundVacation.reviews.some((review) => {
            return review.author.id.equals(req.user._id);
          });
          if (foundUserReview) {
            req.flash("error", "You already wrote a review.");
            return res.redirect(`/vacations/${foundVacation._id}`);
          }
          next();
        }
      });
  } else {
    req.flash("error", "You need to login first.");
    res.redirect("back");
  }
};

module.exports = middlewareObj;
