const express = require("express"),
  router = express.Router({ mergeParams: true }),
  Vacation = require("../models/vacation"),
  Comment = require("../models/comment"),
  middleware = require("../middleware");

// NEW COMMENTS ROUTE
router.get("/new", middleware.isLoggedIn, (req, res) => {
  // find campround by id
  Vacation.findById(req.params.id, (err, vacation) => {
    if (err) {
      console.log(err);
    } else {
      res.render("comments/new", { vacation });
    }
  });
});

// CREATE COMMENTS ROUTE
router.post("/", middleware.isLoggedIn, (req, res) => {
  // lookup vacation using ID
  Vacation.findById(req.params.id, (err, vacation) => {
    if (err) {
      console.log(err);
      res.redirect("/vacations");
    } else {
      Comment.create(req.body.comment, (err, comment) => {
        if (err) {
          req.flash("error", "Something went wrong.");
          console.log(err);
        } else {
          comment.author.id = req.user._id;
          comment.author.username = req.user.username;
          comment.save();
          vacation.comments.push(comment);
          vacation.save();
          req.flash("success", "Successfully added comment.");
          res.redirect("/vacations/" + vacation._id);
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
    Vacation.findById(req.params.id, (err, foundVacation) => {
      if (err || !foundVacation) {
        req.flash("error", "Vacation spot not found.");
        return res.redirect("back");
      }
      Comment.findById(req.params.comment_id, (err, foundComment) => {
        if (err) {
          res.redirect("back");
        } else {
          res.render("comments/edit", {
            vacation_id: req.params.id,
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
        res.redirect(`/vacations/${req.params.id}`);
      }
    }
  );
});

// DESTROY COMMENT ROUTE
router.delete("/:comment_id", middleware.checkCommentOwnership, (req, res) => {
  Comment.findByIdAndRemove(req.params.comment_id, (err) => {
    if (err) {
      req.flash("error", err.message);
      res.redirect("back");
    } else {
      Vacation.findByIdAndUpdate(
        req.params.id,
        { $pull: { comments: req.params.comment_id } },
        { new: true }
      )
        .populate("comments")
        .exec((err, vacation) => {
          if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
          vacation.save();
          req.flash("success", "Comment deleted.");
          res.redirect(`/vacations/${req.params.id}`);
        });
    }
  });
});

module.exports = router;
