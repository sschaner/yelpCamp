// Removes bt-sm class on larger than 576px
const checkWidth = (init) => {
  if ($(window).width() >= 576) {
    $(".small-btn").removeClass("btn-sm");
  } else {
    if (!init) {
      $(".small-btn").addClass("btn-sm");
    }
  }
};

$(document).ready(() => {
  checkWidth(true);

  $(window).resize(() => {
    checkWidth(false);
  });
});
