(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var sel = document.getElementById("id_line");
    if (!sel) return;
    sel.addEventListener("change", function () {
      var value = sel.value;
      if (!value) return;
      var url = new URL(window.location.href);
      url.searchParams.set("line", value);
      window.location.href = url.toString();
    });
  });
})();
