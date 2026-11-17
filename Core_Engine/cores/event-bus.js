/* EventBus — قرار 282. جسر WebSocket إلى أحداث الرحلة القائمة. */
(function (root) {
  "use strict";

  var socket = null;
  var timer = null;
  var pending = {};
  var routes = {
    school_settings: "app:settings:saved",
    leadership_seat: "app:leadership:saved",
    committee_seat: "app:committees:changed",
    committee_meta: "app:committees:changed",
    school_programs: "app:program:saved",
    noor_staff: "app:staff:saved"
  };

  function flush() {
    timer = null;
    Object.keys(pending).forEach(function (name) {
      root.dispatchEvent(new CustomEvent(name));
    });
    pending = {};
  }

  function accept(message) {
    if (message && message.topic === "disk.low") {
      root.dispatchEvent(new CustomEvent("app:disk:low", { detail: message.payload || {} }));
    }
    var table = message && message.payload ? message.payload.table : "";
    var name = routes[table];
    if (!name) {
      return;
    }
    pending[name] = true;
    if (!timer) {
      timer = root.setTimeout(flush, 200);
    }
  }

  var cursor = 0;
  var pollTimer = null;

  function sessionToken() {
    try {
      var raw = root.sessionStorage.getItem("sessionUser");
      var user = raw ? JSON.parse(raw) : null;
      return user && user.token ? String(user.token) : "";
    } catch (error) {
      return "";
    }
  }

  function poll() {
    if (typeof root.fetch !== "function") {
      return;
    }
    var headers = { "X-Session-Token": sessionToken() };
    root.fetch("/api/session/events?after=" + cursor, { headers: headers, cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          return null;
        }
        return response.json();
      })
      .then(function (body) {
        if (!body) {
          return;
        }
        (body.events || []).forEach(function (item) {
          if (item && item.event) {
            accept(item.event);
          }
        });
        if (body.next) {
          cursor = body.next;
        }
      })
      .catch(function () {
        return null;
      });
  }

  function startPoll() {
    if (pollTimer) {
      return;
    }
    poll();
    pollTimer = root.setInterval(poll, 4000);
  }

  function connect() {
    if (typeof root.WebSocket !== "function") {
      startPoll();
      return;
    }
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
      return;
    }
    var protocol = root.location.protocol === "https:" ? "wss://" : "ws://";
    try {
      socket = new root.WebSocket(protocol + root.location.host + "/ws/events");
    } catch (error) {
      startPoll();
      return;
    }
    socket.onmessage = function (event) {
      try {
        accept(JSON.parse(event.data));
      } catch (ignore) {
        return;
      }
    };
    socket.onclose = function () {
      socket = null;
      startPoll();
      root.setTimeout(connect, 8000);
    };
  }

  root.EventBus = {
    version: "294",
    connect: connect,
    startPoll: startPoll
  };
}(window));
