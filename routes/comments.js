const express = require("express"),
  router = express.Router({ mergeParams: true }),
  Campground = require("../models/campground"),
  Comment = require("../models/comment"),
  middleware = require("../middleware");

// NEW COMMENTS ROUTE
router.get("/new", middleware.isLoggedIn, (req, res) => {
  // find campround by id
  Campground.findById(req.params.id, (err, campground) => {
    if (err) {
      console.log(err);
    } else {
      res.render("comments/new", { campground: campground });
    }
  });
});

// CREATE COMMENTS ROUTE
router.post("/", middleware.isLoggedIn, (req, res) => {
  // lookup campground using ID
  Campground.findById(req.params.id, (err, campground) => {
    if (err) {
      console.log(err);
      res.redirect("/campgrounds");
    } else {
      Comment.create(req.body.comment, (err, comment) => {
        if (err) {
          req.flash("error", "Something went wrong.");
          console.log(err);
        } else {
          comment.author.id = req.user._id;
          comment.author.username = req.user.username;
          comment.save();
          campground.comments.push(comment);
          campground.save();
          req.flash("success", "Successfully added comment.");
          res.redirect("/campgrounds/" + campground._id);
        }
      });
    }
  });
});

// COMMENT EDIT ROUTE
router.get(
  "/:comment_id/edit",
  middleware.checkCommentOwnership,
  (req, res) => {
    Campground.findById(req.params.id, (err, foundCampground) => {
      if (err || !foundCampground) {
        req.flash("error", "Campground not found.");
        return res.redirect("back");
      }
      Comment.findById(req.params.comment_id, (err, foundComment) => {
        if (err) {
          res.redirect("back");
        } else {
          res.render("comments/edit", {
            campground_id: req.params.id,
            comment: foundComment,
          });
        }
      });
    });
  }
);

// UPDATE COMMENT ROUTE
router.put("/:comment_id", middleware.checkCommentOwnership, (req, res) => {
  Comment.findByIdAndUpdate(
    req.params.comment_id,
    req.body.comment,
    (err, updatedComment) => {
      if (err) {
        res.redirect("back");
      } else {
        res.redirect(`/campgrounds/${req.params.id}`);
      }
    }
  );
});

// router.delete("/:comment_id", middleware.checkCommentOwnership, (req, res) => {
//   Comment.findByIdAndRemove(req.params.review_id, (err) => {
//     if (err) {
//       req.flash("error", err.message);
//       return res.redirect("back");
//     }
//     Campground.findByIdAndUpdate(
//       req.params.id,
//       { $pull: { comments: req.params.comment_id } },
//       { new: true }
//     )
//       .populate("comments")
//       .exec((err, campground) => {
//         if (err) {
//           req.flash("error", err.message);
//           return res.redirect("back");
//         }
//         campground.save();
//         req.flash("success", "Your comment was deleted successfully.");
//         res.redirect(`/campgrounds/${req.params.id}`);
//       });
//   });
// });

// DESTROY COMMENT ROUTE
router.delete("/:comment_id", middleware.checkCommentOwnership, (req, res) => {
  Comment.findByIdAndRemove(req.params.comment_id, (err) => {
    if (err) {
      req.flash("error", err.message);
      res.redirect("back");
    } else {
      Campground.findByIdAndUpdate(
        req.params.id,
        { $pull: { comments: req.params.comment_id } },
        { new: true }
      )
        .populate("comments")
        .exec((err, campground) => {
          if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
          campground.save();
          req.flash("success", "Comment deleted.");
          res.redirect(`/campgrounds/${req.params.id}`);
        });
    }
  });
});

module.exports = router;
