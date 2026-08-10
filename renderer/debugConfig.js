(function () {
  const DEBUG_MODE = true;

  window.CatDebug = {
    DEBUG_MODE,
    DEBUG_TIME_SCALE: 0.01,
    DEBUG_ACTION_TIME_SCALE: 0.35,
    DEBUG_HUNT_ACTION_TIME_SCALE: 0.65,
    DEBUG_DANCE_TIME_SCALE: 2,
    DEBUG_WARM_SECONDS: 10,
    DEBUG_HAPPY_SECONDS: 20,
    DEBUG_OVERWORK_SECONDS: 30,
    DANCE_CHANCE_DEBUG: 0.5,
    debugFocusMinutes: 0,
    getDebugFocusSeconds(minutes) {
      if (minutes >= 90) {
        return this.DEBUG_OVERWORK_SECONDS;
      }

      if (minutes >= 60) {
        return this.DEBUG_HAPPY_SECONDS;
      }

      if (minutes >= 30) {
        return this.DEBUG_WARM_SECONDS;
      }

      return 0;
    },
    log(message, ...args) {
      if (DEBUG_MODE) {
        console.log(message, ...args);
      }
    },
    setDebugFocus(minutes) {
      if (!DEBUG_MODE) {
        return;
      }

      this.debugFocusMinutes = minutes;
      console.log(`[FocusDebug] focus=${minutes}min`, {
        debugSeconds: this.getDebugFocusSeconds(minutes)
      });
    }
  };

  if (DEBUG_MODE) {
    window.setDebugFocus = (minutes) => window.CatDebug.setDebugFocus(minutes);
  }
})();
