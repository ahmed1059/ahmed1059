/* ConsistencyCore — قرار 282. يقرأ التقرير ولا يعدل القاعدة من المتصفح. */
(function (root) {
  "use strict";

  function headers() {
    var result = { "Content-Type": "application/json" };
    try {
      var user = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
      if (user && user.token) {
        result["X-Session-Token"] = user.token;
      }
    } catch (error) {
      return result;
    }
    return result;
  }

  function check() {
    return fetch("/api/session/consistency", { headers: headers(), cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر فحص الروابط");
        }
        return response.json();
      });
  }

  root.ConsistencyCore = {
    version: "282",
    check: check
  };
}(window));
