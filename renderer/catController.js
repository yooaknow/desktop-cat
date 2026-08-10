(function () {
  const CatState = {
    IDLE: 'IDLE',
    WALK: 'WALK',
    REST: 'REST',
    DANCE: 'DANCE',
    HAPPY: 'HAPPY',
    ANGRY_1: 'ANGRY_1',
    ANGRY_2: 'ANGRY_2',
    RUN_AWAY: 'RUN_AWAY',
    HUNT: 'HUNT'
  };

  const STATE_PRIORITY = {
    [CatState.IDLE]: 0,
    [CatState.REST]: 1,
    [CatState.WALK]: 2,
    [CatState.DANCE]: 3,
    [CatState.HAPPY]: 4,
    [CatState.ANGRY_1]: 5,
    [CatState.ANGRY_2]: 5,
    [CatState.RUN_AWAY]: 6,
    [CatState.HUNT]: 7
  };

  const PET_COUNT_RESET_MS = 5200;
  const RUN_AWAY_COOLDOWN_MS = 3000;
  const HUNT_POLL_MS = 120;
  const HUNT_ACTIVE_POLL_MS = 24;
  const DANCE_CHANCE = 0.02;
  const DANCE_COOLDOWN_MIN_MS = 120000;
  const DANCE_COOLDOWN_MAX_MS = 300000;
  const HAPPY_MIN_MS = 5000;
  const HAPPY_MAX_MS = 10000;
  const HAPPY_CLICK_EXTEND_MS = 800;
  const HAPPY_MAX_TOTAL_MS = 14000;
  const POSITION_COMMIT_MS = 34;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function getDebugActionScale() {
    if (!window.CatDebug || !window.CatDebug.DEBUG_MODE) {
      return 1;
    }

    return window.CatDebug.DEBUG_ACTION_TIME_SCALE || 1;
  }

  function scaleDebugMs(ms, minimum = 120) {
    return Math.max(minimum, ms * getDebugActionScale());
  }

  function scaleDebugDanceMs(ms, minimum = 900) {
    if (!window.CatDebug || !window.CatDebug.DEBUG_MODE) {
      return ms;
    }

    return Math.max(minimum, ms * (window.CatDebug.DEBUG_DANCE_TIME_SCALE || 1));
  }

  class CatController {
    constructor(config) {
      this.state = CatState.IDLE;
      this.direction = 'left';
      this.actionLock = null;
      this.petCount = 0;
      this.petCountResetAt = 0;
      this.interactionCooldownUntil = 0;
      this.danceCooldownUntil = 0;
      this.happyStartedAt = 0;
      this.nextDecisionAt = performance.now() + this.pickIdleMs();
      this.lastFrameAt = performance.now();
      this.lastPositionCommitAt = 0;
      this.lastCommittedPosition = null;

      this.catElement = document.getElementById('cat');
      this.animation = new window.AnimationController(this.catElement, window.PetSprites);
      this.movement = new window.MovementController(config);
      this.mouseTracker = new window.MouseTracker(this.movement);
      this.hunt = new window.HuntController(this.animation, this.movement, this.mouseTracker);
      this.lastHuntPollAt = 0;
      this.stateHandlers = {
        [CatState.IDLE]: (now) => this.updateIdle(now),
        [CatState.WALK]: (now, deltaSeconds) => this.updateWalk(now, deltaSeconds),
        [CatState.REST]: (now) => this.updateRest(now),
        [CatState.DANCE]: (now) => this.updateDance(now),
        [CatState.HAPPY]: (now) => this.updateHappy(now),
        [CatState.ANGRY_1]: (now) => this.updateTimedAngry(now),
        [CatState.ANGRY_2]: (now) => this.updateTimedAngry(now),
        [CatState.RUN_AWAY]: (now, deltaSeconds) => this.updateRunAway(now, deltaSeconds),
        [CatState.HUNT]: (now) => this.updateHunt(now)
      };

      this.animation.applyCatSize(config.catSize);
      this.catElement.addEventListener('click', () => this.handlePetClick());
      this.enterState(CatState.IDLE, performance.now(), { force: true });
      this.commitPosition(this.movement.position, { force: true });
      requestAnimationFrame((now) => this.tick(now));
    }

    pickIdleMs() {
      return scaleDebugMs(randomBetween(3000, 10000), 700);
    }

    pickRestMs() {
      return scaleDebugMs(randomBetween(10000, 30000), 1200);
    }

    pickAngryMs() {
      return scaleDebugMs(randomBetween(500, 1000), 220);
    }

    pickHappyMs() {
      return scaleDebugMs(randomBetween(HAPPY_MIN_MS, HAPPY_MAX_MS), 1200);
    }

    pickDanceMs() {
      return scaleDebugDanceMs(randomBetween(2000, 4000), 1800);
    }

    async tick(now) {
      const deltaSeconds = Math.min((now - this.lastFrameAt) / 1000, 0.05);
      this.lastFrameAt = now;

      if (this.petCount > 0 && now >= this.petCountResetAt) {
        this.petCount = 0;
      }

      if (this.shouldTrackCursor(now)) {
        await this.updateCursorTracking(now);
      } else if (this.shouldRefreshHuntCursor(now)) {
        await this.refreshHuntCursor(now);
      }

      this.stateHandlers[this.state](now, deltaSeconds);
      requestAnimationFrame((nextNow) => this.tick(nextNow));
    }

    shouldTrackCursor(now) {
      return (
        now - this.lastHuntPollAt >= HUNT_POLL_MS &&
        !this.isLocked() &&
        this.state !== CatState.ANGRY_1 &&
        this.state !== CatState.ANGRY_2 &&
        this.state !== CatState.RUN_AWAY &&
        this.state !== CatState.HAPPY &&
        this.state !== CatState.DANCE
      );
    }

    shouldRefreshHuntCursor(now) {
      return (
        this.state === CatState.HUNT &&
        now - this.lastHuntPollAt >= HUNT_ACTIVE_POLL_MS
      );
    }

    async updateCursorTracking(now) {
      this.lastHuntPollAt = now;
      const cursor = await this.mouseTracker.update(now);

      if (this.isLocked() || this.state === CatState.HAPPY || this.state === CatState.DANCE) {
        return;
      }

      if (
        this.state !== CatState.HUNT &&
        cursor.inside &&
        this.hunt.canStart(now)
      ) {
        this.facePoint(cursor.cursorPosition);

        if (this.hunt.start(cursor.approachCount, now)) {
          this.enterState(CatState.HUNT, now, { force: true, lock: true });
        }
      } else if (this.state === CatState.HUNT && cursor.cursorPosition) {
        this.facePoint(cursor.cursorPosition);
      }
    }

    async refreshHuntCursor(now) {
      this.lastHuntPollAt = now;
      const cursor = await this.mouseTracker.update(now, { countApproach: false });

      if (cursor.cursorPosition) {
        this.facePoint(cursor.cursorPosition);
      }
    }

    enterState(nextState, now, options = {}) {
      const currentPriority = STATE_PRIORITY[this.state] || 0;
      const nextPriority = STATE_PRIORITY[nextState] || 0;
      const previousState = this.state;

      if (!options.force && this.isLocked() && nextPriority < currentPriority) {
        return false;
      }

      this.state = nextState;
      this.actionLock = options.lock ? nextState : null;
      this.logStateChange(previousState, nextState);

      if (nextState === CatState.IDLE) {
        this.nextDecisionAt = now + this.pickIdleMs();
        this.animation.setIdle(this.direction);
        return true;
      }

      if (nextState === CatState.REST) {
        this.nextDecisionAt = now + this.pickRestMs();
        this.animation.setRest(this.direction);
        return true;
      }

      if (nextState === CatState.DANCE) {
        this.nextDecisionAt = now + this.pickDanceMs();
        this.danceCooldownUntil = now + randomBetween(DANCE_COOLDOWN_MIN_MS, DANCE_COOLDOWN_MAX_MS);
        this.animation.startDance(now);
        return true;
      }

      if (nextState === CatState.HAPPY) {
        this.happyStartedAt = now;
        this.nextDecisionAt = now + this.pickHappyMs();
        this.animation.startHappy(now);
        return true;
      }

      if (nextState === CatState.ANGRY_1) {
        this.nextDecisionAt = now + this.pickAngryMs();
        this.animation.setAngry(1, this.direction);
        return true;
      }

      if (nextState === CatState.ANGRY_2) {
        this.nextDecisionAt = now + this.pickAngryMs();
        this.animation.setAngry(2, this.direction);
        return true;
      }

      if (nextState === CatState.RUN_AWAY) {
        this.animation.setRunAway(this.direction);
        return true;
      }

      return true;
    }

    isLocked() {
      return this.actionLock !== null;
    }

    releaseLock() {
      this.actionLock = null;
    }

    updateIdle(now) {
      if (now < this.nextDecisionAt) {
        return;
      }

      this.chooseNextAmbientAction(now);
    }

    updateRest(now) {
      if (now >= this.nextDecisionAt) {
        this.chooseNextAmbientAction(now);
      }
    }

    chooseNextAmbientAction(now) {
      if (this.canDance(now) && Math.random() < this.getDanceChance()) {
        this.enterState(CatState.DANCE, now, { lock: true });
        return;
      }

      if (Math.random() < 0.7) {
        this.enterWalk();
        return;
      }

      this.enterState(CatState.IDLE, now);
    }

    updateHappy(now) {
      this.animation.updateHappy(now, this.direction);

      if (now >= this.nextDecisionAt) {
        this.releaseLock();
        this.returnToCalmState(now);
      }
    }

    updateDance(now) {
      this.animation.updateDance(now, this.direction);

      if (now >= this.nextDecisionAt) {
        this.releaseLock();

        if (this.movement.isCenterZone(this.movement.position)) {
          this.enterWalk(this.movement.pickEdgeDestination());
          return;
        }

        if (Math.random() < 0.5) {
          this.enterWalk();
          return;
        }

        this.enterState(CatState.IDLE, now);
      }
    }

    updateTimedAngry(now) {
      if (now >= this.nextDecisionAt) {
        this.enterState(CatState.IDLE, now, { force: true });
      }
    }

    updateHunt(now) {
      const result = this.hunt.update(now, this.direction);

      if (result.finished) {
        this.releaseLock();

        if (result.shouldReturnToEdge) {
          this.enterWalk(this.movement.pickEdgeDestination());
        } else {
          this.enterState(CatState.IDLE, now, { force: true });
        }
      }
    }

    enterWalk(forcedTarget) {
      const previousState = this.state;
      const target = forcedTarget || this.movement.pickRandomDestination();
      this.movement.setTarget(target);
      this.direction = this.movement.getDirection();
      this.state = CatState.WALK;
      this.actionLock = null;
      this.logStateChange(previousState, CatState.WALK);
    }

    updateWalk(now, deltaSeconds) {
      this.direction = this.movement.getDirection();
      this.animation.updateWalk(now, this.direction);

      const result = this.movement.update(deltaSeconds);
      this.commitPosition(result.position, { now, force: result.arrived });

      if (result.arrived) {
        if (this.movement.isEdgePosition(result.position) && Math.random() < 0.65) {
          this.enterState(CatState.REST, now);
          return;
        }

        this.enterState(CatState.IDLE, now);
      }
    }

    updateRunAway(now, deltaSeconds) {
      this.animation.setRunAway(this.direction);

      const result = this.movement.updateRun(deltaSeconds);
      this.commitPosition(result.position, { now, force: result.arrived });

      if (result.arrived) {
        this.petCount = 0;
        this.interactionCooldownUntil = now + RUN_AWAY_COOLDOWN_MS;
        this.releaseLock();
        this.enterState(CatState.REST, now, { force: true });
        this.nextDecisionAt = now + scaleDebugMs(randomBetween(2000, 5000), 700);
      }
    }

    async handlePetClick() {
      const now = performance.now();

      if (this.state === CatState.HAPPY) {
        const maxEndAt = this.happyStartedAt + HAPPY_MAX_TOTAL_MS;
        this.nextDecisionAt = Math.min(maxEndAt, this.nextDecisionAt + HAPPY_CLICK_EXTEND_MS);
        return;
      }

      if (now < this.interactionCooldownUntil) {
        return;
      }

      if (this.state === CatState.RUN_AWAY || this.state === CatState.HUNT) {
        return;
      }

      this.petCount = now <= this.petCountResetAt ? this.petCount + 1 : 1;
      this.petCountResetAt = now + PET_COUNT_RESET_MS;

      if (this.petCount === 1) {
        this.enterState(CatState.ANGRY_1, now, { force: true });
        return;
      }

      if (this.petCount === 2) {
        this.enterState(CatState.ANGRY_2, now, { force: true });
        return;
      }

      const cursorPosition = await window.desktopPet.getCursorPosition();
      const target = this.movement.pickRunAwayDestination(cursorPosition);
      this.movement.setTarget(target);
      this.direction = this.movement.getDirection();
      this.enterState(CatState.RUN_AWAY, performance.now(), { force: true, lock: true });
    }

    canDance(now) {
      return now >= this.danceCooldownUntil && !this.isLocked();
    }

    getDanceChance() {
      if (window.CatDebug && window.CatDebug.DEBUG_MODE) {
        return window.CatDebug.DANCE_CHANCE_DEBUG;
      }

      return DANCE_CHANCE;
    }

    returnToCalmState(now) {
      if (this.movement.isCenterZone(this.movement.position)) {
        this.enterWalk(this.movement.pickEdgeDestination());
        return;
      }

      if (Math.random() < 0.55) {
        this.enterState(CatState.IDLE, now, { force: true });
        return;
      }

      this.enterState(CatState.REST, now, { force: true });
    }

    facePoint(point) {
      const center = this.movement.getCenter();
      this.direction = point.x >= center.x ? 'right' : 'left';
    }

    logStateChange(previousState, nextState) {
      if (window.CatDebug && window.CatDebug.DEBUG_MODE && previousState !== nextState) {
        console.log(`[CatState] ${previousState} -> ${nextState}`);
      }
    }

    resetForDebugAction() {
      this.releaseLock();
      this.hunt.cancelForDebug();
      this.movement.pounce = null;
      this.petCount = 0;
      this.petCountResetAt = 0;
      this.interactionCooldownUntil = 0;
    }

    async forceAction(actionName) {
      if (!window.CatDebug || !window.CatDebug.DEBUG_MODE) {
        return;
      }

      const now = performance.now();
      this.resetForDebugAction();

      if (actionName === CatState.IDLE) {
        this.enterState(CatState.IDLE, now, { force: true });
        return;
      }

      if (actionName === CatState.WALK) {
        this.enterWalk();
        return;
      }

      if (actionName === CatState.REST) {
        this.enterState(CatState.REST, now, { force: true });
        return;
      }

      if (actionName === CatState.ANGRY_1) {
        this.enterState(CatState.ANGRY_1, now, { force: true });
        return;
      }

      if (actionName === CatState.ANGRY_2) {
        this.enterState(CatState.ANGRY_2, now, { force: true });
        return;
      }

      if (actionName === CatState.RUN_AWAY) {
        const cursorPosition = await window.desktopPet.getCursorPosition();
        const target = this.movement.pickRunAwayDestination(cursorPosition);
        this.movement.setTarget(target);
        this.direction = this.movement.getDirection();
        this.enterState(CatState.RUN_AWAY, performance.now(), { force: true, lock: true });
        return;
      }

      if (actionName === CatState.HAPPY) {
        this.enterState(CatState.HAPPY, now, { force: true, lock: true });
        return;
      }

      if (actionName === CatState.HUNT) {
        const cursorPosition = await window.desktopPet.getCursorPosition();
        this.mouseTracker.cursorPosition = cursorPosition;
        this.mouseTracker.cursorApproachCount = 3;
        this.facePoint(cursorPosition);
        this.hunt.startForced(performance.now());
        this.enterState(CatState.HUNT, performance.now(), { force: true, lock: true });
        return;
      }

      if (actionName === CatState.DANCE) {
        this.enterState(CatState.DANCE, now, { force: true, lock: true });
      }
    }

    forceMoveToEdge(edge) {
      if (!window.CatDebug || !window.CatDebug.DEBUG_MODE) {
        return;
      }

      this.resetForDebugAction();
      const position = this.movement.setPosition(this.movement.getEdgePosition(edge));
      this.commitPosition(position, { force: true });
      this.enterState(CatState.IDLE, performance.now(), { force: true });
      window.CatDebug.log(`[Debug] Edge: ${edge}`, position);
    }

    forceMoveToCorner(corner) {
      if (!window.CatDebug || !window.CatDebug.DEBUG_MODE) {
        return;
      }

      this.resetForDebugAction();
      const position = this.movement.setPosition(this.movement.getCornerPosition(corner));
      this.commitPosition(position, { force: true });
      this.enterState(CatState.IDLE, performance.now(), { force: true });
      window.CatDebug.log(`[Debug] Corner: ${corner}`, position);
    }

    commitPosition(position, options = {}) {
      const now = options.now || performance.now();
      const nextPosition = {
        x: Math.round(position.x),
        y: Math.round(position.y)
      };

      if (
        this.lastCommittedPosition &&
        this.lastCommittedPosition.x === nextPosition.x &&
        this.lastCommittedPosition.y === nextPosition.y
      ) {
        return;
      }

      if (!options.force && now - this.lastPositionCommitAt < POSITION_COMMIT_MS) {
        return;
      }

      this.lastCommittedPosition = nextPosition;
      this.lastPositionCommitAt = now;
      window.desktopPet.setPosition(nextPosition);
    }
  }

  window.desktopPet.getConfig().then((config) => {
    if (config) {
      window.CatControllerInstance = new CatController(config);
      if (window.installDebugController) {
        window.installDebugController(window.CatControllerInstance);
      }
    }
  });
})();
