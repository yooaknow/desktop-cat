(function () {
  const HuntState = {
    WATCH: 'WATCH',
    READY: 'READY',
    WIGGLE: 'WIGGLE',
    POUNCE: 'POUNCE',
    RECOVER: 'RECOVER'
  };

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function getDebugActionScale() {
    if (!window.CatDebug || !window.CatDebug.DEBUG_MODE) {
      return 1;
    }

    return window.CatDebug.DEBUG_HUNT_ACTION_TIME_SCALE || window.CatDebug.DEBUG_ACTION_TIME_SCALE || 1;
  }

  function scaleDebugMs(ms, minimum = 90) {
    return Math.max(minimum, ms * getDebugActionScale());
  }

  class HuntController {
    constructor(animation, movement, mouseTracker) {
      this.animation = animation;
      this.movement = movement;
      this.mouseTracker = mouseTracker;
      this.state = null;
      this.endsAt = 0;
      this.cooldownUntil = 0;
      this.pounceStarted = false;
    }

    canStart(now) {
      return now >= this.cooldownUntil;
    }

    start(approachCount, now) {
      if (!this.canStart(now)) {
        return false;
      }

      if (approachCount >= 3) {
        this.enter(HuntState.WATCH, now, scaleDebugMs(220));
        return true;
      }

      if (approachCount === 2) {
        this.enter(HuntState.READY, now, scaleDebugMs(randomBetween(700, 1200)));
        return true;
      }

      if (approachCount === 1) {
        this.enter(HuntState.WATCH, now, scaleDebugMs(randomBetween(500, 1000)));
        return true;
      }

      return false;
    }

    startForced(now) {
      this.cooldownUntil = 0;
      this.mouseTracker.cursorApproachCount = 3;
      this.enter(HuntState.WATCH, now, scaleDebugMs(220));
      return true;
    }

    enter(state, now, duration) {
      if (window.CatDebug && window.CatDebug.DEBUG_MODE && this.state !== state) {
        console.log(`[CatState] ${this.state || 'HUNT'} -> ${state}`);
      }

      this.state = state;
      this.endsAt = now + duration;
      this.pounceStarted = false;
    }

    update(now, direction) {
      if (!this.state) {
        return { active: false, finished: false, shouldReturnToEdge: false };
      }

      if (this.state === HuntState.WATCH) {
        this.animation.setHuntWatch(direction);

        if (now >= this.endsAt) {
          if (this.mouseTracker.cursorApproachCount >= 3) {
            this.enter(HuntState.READY, now, scaleDebugMs(260));
          } else {
            this.finish(now);
            return { active: false, finished: true, shouldReturnToEdge: false };
          }
        }
      } else if (this.state === HuntState.READY) {
        this.animation.setHuntReady(direction);

        if (now >= this.endsAt) {
          if (this.mouseTracker.cursorApproachCount >= 3) {
            this.enter(HuntState.WIGGLE, now, scaleDebugMs(randomBetween(600, 1400)));
          } else {
            this.finish(now);
            return { active: false, finished: true, shouldReturnToEdge: false };
          }
        }
      } else if (this.state === HuntState.WIGGLE) {
        this.animation.setHuntWiggle(now, direction);

        if (now >= this.endsAt) {
          this.enter(HuntState.POUNCE, now, scaleDebugMs(randomBetween(300, 600)));
        }
      } else if (this.state === HuntState.POUNCE) {
        this.animation.setHuntPounce(direction);

        if (!this.pounceStarted) {
          const cursorPosition = this.mouseTracker.getCursorPosition();
          this.movement.setPounceTarget(cursorPosition, now);
          this.pounceStarted = true;
        }

        const result = this.movement.updatePounce(now);
        window.desktopPet.setPosition(result.position);

        if (result.arrived) {
          this.enter(HuntState.RECOVER, now, scaleDebugMs(randomBetween(500, 1500)));
        }
      } else if (this.state === HuntState.RECOVER) {
        this.animation.setHuntPounce(direction);

        if (now >= this.endsAt) {
          const shouldReturnToEdge = this.movement.isCenterZone(this.movement.position);
          this.finish(now);
          return { active: false, finished: true, shouldReturnToEdge };
        }
      }

      return { active: true, finished: false, shouldReturnToEdge: false };
    }

    finish(now) {
      this.state = null;
      this.pounceStarted = false;
      this.cooldownUntil = now + scaleDebugMs(randomBetween(8000, 20000), 1000);
      this.mouseTracker.resetApproaches();
    }

    cancelForDebug() {
      this.state = null;
      this.pounceStarted = false;
      this.mouseTracker.resetApproaches();
    }
  }

  window.HuntController = HuntController;
})();
