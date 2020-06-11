require("dotenv").config();

const express = require("express"),
  app = express(),
  path = require("path"),
  favicon = require("serve-favicon"),
  bodyParser = require("body-parser"),
  mongoose = require("mongoose"),
  flash = require("connect-flash"),
  passport = require("passport"),
  LocalStrategy = require("passport-local"),
  methodOverride = require("method-override"),
  Campground = require("./models/campground"),
  Comment = require("./models/comment"),
  User = require("./models/user"),
  seedDB = require("./seeds"); // seed the database

// requiring routes
const commentRoutes = require("./routes/comments"),
  reviewRoutes = require("./routes/reviews"),
  campgroundRoutes = require("./routes/campgrounds"),
  indexRoutes = require("./routes/index");

mongoose.connect(
  "mongodb+srv://" +
    process.env.MONGOOSE_DATABASE_USERNAME +
    ":" +
    process.env.MONGOOSE_DATABASE_PASSWORD +
    "@yelpcamp-vlprc.mongodb.net/YelpCamp?retryWrites=true&w=majority",
  { useNewUrlParser: true, useUnifiedTopology: true }
);
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(favicon(path.join(__dirname, "public", "favicon.ico")));
app.use(methodOverride("_method"));
app.use(flash());
app.locals.moment = require("moment");
// seedDB(); // seed the DB

// PASSPORT CONFIGURATION
app.use(
  require("express-session")({
    secret: "Gynell is beautiful!",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/comments", commentRoutes);
app.use("/campgrounds/:id/reviews", reviewRoutes);

app.listen(process.env.PORT, () => {
  console.log(
    "The YelpCamp server has started on port " + process.env.PORT + "."
  );
});
